'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { CANDIDATE_CATEGORIES } = require('./coverage');
const { REJECTION_REASONS: DOMAIN_REJECTION_REASONS } = require('./domain-contract');
const { GameKbError } = require('./errors');
const { atomicWriteFile, atomicWriteJson, readJson } = require('./io');
const { sha256 } = require('./source');

const RESOLUTIONS = new Set(['merged_to', 'rejected', 'ambiguous']);
const REJECTION_REASONS = new Set([
  'ordinary_item',
  'duplicate',
  'misclassified',
  'no_evidence',
  'not_game_relevant',
  ...Object.values(DOMAIN_REJECTION_REASONS).flat()
]);

function nonempty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function chapterCandidates(chapters) {
  const candidates = [];
  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    for (const category of CANDIDATE_CATEGORIES) {
      for (const candidate of Array.isArray(chapter?.[category]) ? chapter[category] : []) {
        candidates.push({
          category,
          chapter: chapter.chapter,
          candidate_key: candidate?.candidate_key,
          local_key: candidate?.local_key,
          name: candidate?.name
        });
      }
    }
  }
  return candidates;
}

function decisionReason(decision, categoryTargets) {
  if (!decision || !RESOLUTIONS.has(decision.resolution)) return 'INVALID_DECISION';
  if (decision.resolution === 'merged_to') {
    if (!nonempty(decision.merged_to) || !categoryTargets.has(decision.merged_to)) return 'INVALID_DECISION';
    return null;
  }
  if (decision.resolution === 'rejected') {
    if (!REJECTION_REASONS.has(decision.reason) || !nonempty(decision.detail)) return 'INVALID_DECISION';
    return null;
  }
  return nonempty(decision.detail) ? null : 'INVALID_DECISION';
}

function buildCandidateLedger(chapters, merged = {}, cleaned) {
  void cleaned;
  const decisionsByKey = new Map();
  for (const decision of Array.isArray(merged?.candidate_resolutions) ? merged.candidate_resolutions : []) {
    if (!decisionsByKey.has(decision?.candidate_key)) decisionsByKey.set(decision?.candidate_key, []);
    decisionsByKey.get(decision?.candidate_key).push(decision);
  }

  const rows = chapterCandidates(chapters).map(candidate => {
    const decisions = decisionsByKey.get(candidate.candidate_key) || [];
    if (decisions.length === 0) return { ...candidate, resolution: 'ambiguous', reason: 'MISSING_DECISION' };
    if (decisions.length > 1) return { ...candidate, resolution: 'ambiguous', reason: 'MULTIPLE_DECISIONS' };
    const decision = decisions[0];
    const targets = new Set((Array.isArray(merged?.[candidate.category]) ? merged[candidate.category] : [])
      .map(record => record?.local_key)
      .filter(nonempty));
    const reason = decisionReason(decision, targets);
    if (reason) return { ...candidate, resolution: 'ambiguous', reason };
    return { ...candidate, ...decision };
  });

  const missingResolution = rows.filter(row => [
    'MISSING_DECISION',
    'MULTIPLE_DECISIONS',
    'INVALID_DECISION'
  ].includes(row.reason));
  const ambiguous = rows.filter(row => row.resolution === 'ambiguous' && !missingResolution.includes(row));
  return {
    passed: missingResolution.length === 0 && ambiguous.length === 0,
    rows,
    missing_resolution: missingResolution,
    ambiguous
  };
}

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

function releaseAcceptedDomainDecision(paths, file, inputHash) {
  assertAcceptedArtifacts(paths);
  const relativeDomainPath = path.relative(path.resolve(paths.domainDecisions), path.resolve(file));
  if (relativeDomainPath === '' || relativeDomainPath.startsWith('..') || path.isAbsolute(relativeDomainPath)) {
    throw new GameKbError('DOMAIN_RECOVERY_INVALID', 'Only a domain decision can be released for recovery', {
      file: path.resolve(file)
    });
  }
  const manifest = readArtifactManifest(paths);
  const relativePath = artifactRelativePath(paths, file);
  const entry = manifest.entries.find(value => value.relative_path === relativePath);
  if (!entry || entry.input_hash !== inputHash) {
    throw new GameKbError('DOMAIN_RECOVERY_INVALID', 'Domain decision input hash does not match recovery target', {
      relative_path: relativePath,
      input_hash: inputHash
    });
  }
  const content = fs.readFileSync(file);
  fs.rmSync(file);
  try {
    atomicWriteJson(paths.artifactManifest, {
      ...manifest,
      entries: manifest.entries.filter(value => value.relative_path !== relativePath)
    });
  } catch (error) {
    atomicWriteFile(file, content);
    throw error;
  }
  return entry;
}

function replaceInvalidDeterministicClean(paths, inputHash, value) {
  assertAcceptedArtifacts(paths);
  const file = path.resolve(paths.cleaned);
  const relativePath = artifactRelativePath(paths, file);
  const manifest = readArtifactManifest(paths);
  const entry = manifest.entries.find(candidate => candidate.relative_path === relativePath);
  if (!entry || entry.input_hash !== inputHash || !fs.existsSync(file)) {
    throw new GameKbError('DETERMINISTIC_CLEAN_REPAIR_INVALID', 'Cleaned artifact does not match the repair target', {
      relative_path: relativePath,
      input_hash: inputHash
    });
  }
  const previousContent = fs.readFileSync(file);
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const replacement = {
    ...entry,
    content_hash: sha256(content),
    replaced_at: new Date().toISOString()
  };
  atomicWriteFile(file, content);
  try {
    atomicWriteJson(paths.artifactManifest, {
      ...manifest,
      entries: manifest.entries.map(candidate => candidate.relative_path === relativePath ? replacement : candidate)
    });
  } catch (error) {
    atomicWriteFile(file, previousContent);
    throw error;
  }
  return replacement;
}

module.exports = {
  REJECTION_REASONS,
  RESOLUTIONS,
  acceptedArtifactHash,
  assertAcceptedArtifacts,
  buildCandidateLedger,
  initializeArtifactManifest,
  readArtifactManifest,
  recordAcceptedArtifact,
  releaseAcceptedDomainDecision,
  replaceInvalidDeterministicClean
};
