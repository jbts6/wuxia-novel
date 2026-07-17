'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { atomicWriteFile, atomicWriteJson, readJson } = require('./io');
const { sha256 } = require('./source');

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
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const entry = {
    relative_path: relativePath,
    input_hash: inputHash,
    content_hash: sha256(content),
    accepted_at: new Date().toISOString()
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

module.exports = {
  acceptedArtifactHash,
  assertAcceptedArtifacts,
  initializeArtifactManifest,
  readArtifactManifest,
  recordAcceptedArtifact
};
