'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { atomicWriteFile, atomicWriteJson, readJson, serializeYaml } = require('./io');
const { sha256 } = require('./source');

const ACCEPTED_SERIALIZATION = 'yaml-v1';

function assertHashMaps(actualHashes, expectedHashes) {
  for (const [relativePath, expectedHash] of Object.entries(expectedHashes || {})) {
    const actualHash = actualHashes?.[relativePath];
    if (actualHash !== expectedHash) {
      throw new GameKbError(
        'ACCEPTED_ARTIFACT_MUTATED',
        `Accepted artifact hash changed: ${relativePath}`,
        {
          relative_path: relativePath,
          expected_hash: expectedHash,
          actual_hash: actualHash ?? null
        }
      );
    }
  }
}

function artifactRelativePath(paths, file) {
  const relative = path.relative(paths.run, path.resolve(file));
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new GameKbError('ACCEPTED_ARTIFACT_PATH_INVALID', 'Accepted artifact must stay inside its run', {
      file: path.resolve(file)
    });
  }
  return relative.split(path.sep).join('/');
}

function emptyArtifactManifest(paths) {
  return { schema_version: 1, run_id: paths.runId, entries: [] };
}

function initializeArtifactManifest(paths) {
  if (fs.existsSync(paths.artifactManifest)) return readJson(paths.artifactManifest);
  const manifest = emptyArtifactManifest(paths);
  atomicWriteJson(paths.artifactManifest, manifest);
  return manifest;
}

function readArtifactManifest(paths) {
  if (!fs.existsSync(paths.artifactManifest)) {
    throw new GameKbError(
      'ACCEPTED_ARTIFACT_MANIFEST_MISSING',
      'Accepted artifact manifest is missing',
      { artifact_manifest: paths.artifactManifest }
    );
  }
  const manifest = readJson(paths.artifactManifest);
  if (!manifest || manifest.run_id !== paths.runId || !Array.isArray(manifest.entries)) {
    throw new GameKbError(
      'ACCEPTED_ARTIFACT_MANIFEST_INVALID',
      'Accepted artifact manifest is invalid',
      { artifact_manifest: paths.artifactManifest }
    );
  }
  return manifest;
}

function expectedArtifactHashes(paths) {
  const manifest = readArtifactManifest(paths);
  return Object.fromEntries(manifest.entries.map(entry => [entry.relative_path, entry.content_hash]));
}

function currentArtifactHashes(paths, relativePaths) {
  return Object.fromEntries(relativePaths.map(relativePath => {
    const file = path.join(paths.run, ...relativePath.split('/'));
    const hash = fs.existsSync(file) && fs.statSync(file).isFile()
      ? sha256(fs.readFileSync(file))
      : null;
    return [relativePath, hash];
  }));
}

function assertAcceptedArtifacts(pathsOrActual, expectedHashes) {
  if (expectedHashes !== undefined) {
    assertHashMaps(pathsOrActual, expectedHashes);
    return;
  }
  const expected = expectedArtifactHashes(pathsOrActual);
  assertHashMaps(pathsOrActual && currentArtifactHashes(pathsOrActual, Object.keys(expected)), expected);
}

function acceptedArtifactHash(paths, file) {
  const relativePath = artifactRelativePath(paths, file);
  const entry = readArtifactManifest(paths).entries.find(value => value.relative_path === relativePath);
  if (!entry) {
    throw new GameKbError('ACCEPTED_ARTIFACT_UNTRACKED', 'Accepted artifact is not tracked', {
      relative_path: relativePath
    });
  }
  return entry.content_hash;
}

function recordAcceptedArtifact(paths, file, inputHash, value) {
  assertAcceptedArtifacts(paths);
  const manifest = readArtifactManifest(paths);
  const relativePath = artifactRelativePath(paths, file);
  if (manifest.entries.some(entry => entry.relative_path === relativePath) || fs.existsSync(file)) {
    throw new GameKbError('ACCEPTED_ARTIFACT_EXISTS', 'Accepted artifact already exists', {
      relative_path: relativePath
    });
  }
  const yamlArtifact = /\.ya?ml$/i.test(file);
  const content = yamlArtifact
    ? serializeYaml(value)
    : `${JSON.stringify(value, null, 2)}\n`;
  const entry = {
    relative_path: relativePath,
    input_hash: inputHash,
    content_hash: sha256(content),
    accepted_at: new Date().toISOString(),
    ...(yamlArtifact ? { serialization: ACCEPTED_SERIALIZATION } : {})
  };
  atomicWriteFile(file, content);
  try {
    atomicWriteJson(paths.artifactManifest, { ...manifest, entries: [...manifest.entries, entry] });
  } catch (error) {
    fs.rmSync(file, { force: true });
    throw error;
  }
  return entry;
}

function ensureAcceptedArtifact(paths, file, inputHash, value, options = {}) {
  const manifest = readArtifactManifest(paths);
  const relativePath = artifactRelativePath(paths, file);
  const yamlArtifact = /\.ya?ml$/i.test(file);
  const content = yamlArtifact
    ? serializeYaml(value)
    : `${JSON.stringify(value, null, 2)}\n`;
  const contentHash = sha256(content);
  const existingEntry = manifest.entries.find(e => e.relative_path === relativePath);
  const fileExists = fs.existsSync(file);

  // Case 1: file absent + entry absent → write canonical YAML and entry
  if (!fileExists && !existingEntry) {
    atomicWriteFile(file, content);
    const entry = {
      relative_path: relativePath,
      input_hash: inputHash,
      content_hash: contentHash,
      accepted_at: options.acceptedAt || new Date().toISOString(),
      ...(yamlArtifact ? { serialization: ACCEPTED_SERIALIZATION } : {})
    };
    try {
      atomicWriteJson(paths.artifactManifest, { ...manifest, entries: [...manifest.entries, entry] });
    } catch (error) {
      fs.rmSync(file, { force: true });
      throw error;
    }
    return entry;
  }

  // Case 2: exact file + exact entry present → return existing entry
  if (fileExists && existingEntry) {
    const fileBytes = fs.readFileSync(file);
    const fileHash = sha256(fileBytes);
    if (fileHash !== existingEntry.content_hash) {
      throw new GameKbError('ACCEPTED_ARTIFACT_REPLAY_CONFLICT', 'Accepted file hash does not match manifest entry', {
        relative_path: relativePath,
        file_hash: fileHash,
        entry_hash: existingEntry.content_hash
      });
    }
    if (existingEntry.input_hash !== inputHash) {
      throw new GameKbError('ACCEPTED_ARTIFACT_REPLAY_CONFLICT', 'Accepted entry input hash does not match', {
        relative_path: relativePath,
        entry_input_hash: existingEntry.input_hash,
        incoming_input_hash: inputHash
      });
    }
    if (yamlArtifact && existingEntry.serialization !== ACCEPTED_SERIALIZATION) {
      throw new GameKbError('ACCEPTED_ARTIFACT_REPLAY_CONFLICT', 'Accepted entry serialization does not match', {
        relative_path: relativePath,
        entry_serialization: existingEntry.serialization,
        expected_serialization: ACCEPTED_SERIALIZATION
      });
    }
    return existingEntry;
  }

  // Case 3: exact file present + entry absent → crash recovery
  if (fileExists && !existingEntry) {
    const fileBytes = fs.readFileSync(file);
    const fileHash = sha256(fileBytes);
    if (fileHash !== contentHash) {
      throw new GameKbError('ACCEPTED_ARTIFACT_REPLAY_CONFLICT', 'Existing file content does not match canonical bytes', {
        relative_path: relativePath,
        file_hash: fileHash,
        expected_hash: contentHash
      });
    }
    const entry = {
      relative_path: relativePath,
      input_hash: inputHash,
      content_hash: contentHash,
      accepted_at: options.acceptedAt || new Date().toISOString(),
      ...(yamlArtifact ? { serialization: ACCEPTED_SERIALIZATION } : {})
    };
    atomicWriteJson(paths.artifactManifest, { ...manifest, entries: [...manifest.entries, entry] });
    return entry;
  }

  // Case 4: entry present but file absent → conflict
  throw new GameKbError('ACCEPTED_ARTIFACT_REPLAY_CONFLICT', 'Manifest entry exists but file is missing', {
    relative_path: relativePath
  });
}

module.exports = {
  ACCEPTED_SERIALIZATION,
  acceptedArtifactHash,
  assertAcceptedArtifacts,
  ensureAcceptedArtifact,
  initializeArtifactManifest,
  readArtifactManifest,
  recordAcceptedArtifact
};
