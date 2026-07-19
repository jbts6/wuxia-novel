'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { initializeArtifactManifest } = require('./candidate-ledger');
const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson } = require('./io');
const { discoverSource, normalizeSource, sha256 } = require('./source');
const { pathsFor } = require('./paths');
const {
  LEGACY_PROFILE_V5,
  PROFILE_LITE,
  PROFILE_V4,
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE,
  SUPPORTED_PROFILES
} = require('./semantic-contract');
const { EMPTY_DURATIONS } = require('./timing');
const { ensureWorkerPool } = require('./worker-pool');

function generatedRunId() {
  return `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}-${Math.random().toString(16).slice(2, 10)}`;
}

function runDirectories(novelDir) {
  const root = path.join(path.resolve(novelDir), '.game-kb-work', 'runs');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(root, entry.name))
    .filter(directory => fs.existsSync(path.join(directory, 'run.json')));
}

function sourceState(novelDir) {
  const sourceFile = discoverSource(novelDir);
  const sourceHash = sha256(normalizeSource(fs.readFileSync(sourceFile, 'utf8')));
  return { sourceFile, sourceHash };
}

function readRunMetadata(runDir) {
  try {
    const value = readJson(path.join(runDir, 'run.json'));
    if (!value || typeof value !== 'object' || typeof value.run_id !== 'string') throw new Error('invalid run metadata');
    return value;
  } catch (error) {
    throw new GameKbError('RUN_METADATA_INVALID', 'Run metadata cannot be read safely', { run_dir: runDir, cause: error.message });
  }
}

function normalizeProfile(profile) {
  if (profile === undefined || profile === null) return PROFILE_V4;
  if (profile === LEGACY_PROFILE_V5) {
    throw new GameKbError(
      'PROFILE_LEGACY',
      'The legacy v5 profile is read-only; resume it through Lite migration',
      { profile, replacement: PROFILE_LITE }
    );
  }
  if (!SUPPORTED_PROFILES.has(profile)) {
    throw new GameKbError('PROFILE_UNSUPPORTED', 'Unknown game-kb profile', { profile });
  }
  return profile;
}

function assertSemanticContract(metadata, action = 'continue', expectedProfile) {
  if (metadata?.semantic_contract_version !== SEMANTIC_CONTRACT_VERSION
    || metadata?.semantic_profile !== SEMANTIC_PROFILE) {
    throw new GameKbError(
      'LEGACY_SEMANTIC_CONTRACT',
      'This run is read-only under the current semantic contract',
      {
        run_id: metadata?.run_id ?? null,
        semantic_contract_version: metadata?.semantic_contract_version ?? null,
        required_version: SEMANTIC_CONTRACT_VERSION,
        semantic_profile: metadata?.semantic_profile ?? null,
        required_profile: SEMANTIC_PROFILE,
        action
      }
    );
  }
  const actualProfile = metadata.profile ?? PROFILE_V4;
  if (expectedProfile !== undefined && actualProfile !== expectedProfile) {
    throw new GameKbError(
      'PROFILE_MISMATCH',
      `Run profile ${actualProfile} cannot be written by profile ${expectedProfile}`,
      {
        run_id: metadata?.run_id ?? null,
        profile: actualProfile,
        required_profile: expectedProfile,
        action
      }
    );
  }
  return metadata;
}

function assertArchiveExistingAllowed(novelDir) {
  const legacy = runDirectories(novelDir)
    .map(readRunMetadata)
    .filter(metadata => metadata.semantic_contract_version !== SEMANTIC_CONTRACT_VERSION
      || metadata.semantic_profile !== SEMANTIC_PROFILE)
    .map(metadata => ({
      run_id: metadata.run_id,
      semantic_contract_version: metadata.semantic_contract_version ?? null,
      semantic_profile: metadata.semantic_profile ?? null
    }));
  if (legacy.length > 0) {
    throw new GameKbError(
      'LEGACY_SEMANTIC_CONTRACT',
      'Archive legacy runs explicitly with archive-abandoned --confirm',
      { action: 'archive-existing', runs: legacy }
    );
  }
}

function ensureRunDirectories(paths) {
  for (const directory of [
    paths.staging,
    paths.domainWork,
    paths.domainDecisions
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function createOrResumeRun(novelDir, options = {}) {
  const novel = path.resolve(novelDir);
  const { sourceFile, sourceHash } = sourceState(novel);
  const profile = normalizeProfile(options.profile);
  const runs = runDirectories(novel);
  let runId = options.runId;
  if (!runId) {
    if (runs.length > 1) throw new GameKbError('RUN_AMBIGUOUS', 'Multiple eligible runs require --run <run-id>');
    runId = runs.length === 1 ? readRunMetadata(runs[0]).run_id : generatedRunId();
  }
  const paths = pathsFor(novel, runId);
  if (fs.existsSync(paths.runJson)) {
    let metadata = readRunMetadata(paths.run);
    assertSemanticContract(metadata, 'prepare');
    if (metadata.source_hash !== sourceHash) {
      throw new GameKbError('RUN_SOURCE_CHANGED', 'Source changed; archive the old run before resuming it', {
        run_id: runId,
        previous_source_hash: metadata.source_hash,
        source_hash: sourceHash
      });
    }
    const storedProfile = metadata.profile ?? PROFILE_V4;
    if (storedProfile === LEGACY_PROFILE_V5 && profile === PROFILE_LITE) {
      metadata = { ...metadata, profile: PROFILE_LITE };
      atomicWriteJson(paths.runJson, metadata);
    } else {
      assertSemanticContract(metadata, 'prepare', profile);
    }
    ensureRunDirectories(paths);
    ensureWorkerPool(paths);
    return {
      run_id: runId,
      run_dir: paths.run,
      source_file: sourceFile,
      source_hash: sourceHash,
      semantic_contract_version: metadata.semantic_contract_version,
      semantic_profile: metadata.semantic_profile,
      profile: metadata.profile ?? PROFILE_V4,
      resumed: true
    };
  }
  fs.mkdirSync(paths.run, { recursive: true });
  ensureRunDirectories(paths);
  const metadata = {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    semantic_profile: SEMANTIC_PROFILE,
    profile,
    run_id: runId,
    source_file: sourceFile,
    source_hash: sourceHash,
    status: 'active',
    started_at: new Date().toISOString(),
    phase_durations: { ...EMPTY_DURATIONS }
  };
  atomicWriteJson(paths.runJson, metadata);
  initializeArtifactManifest(paths);
  ensureWorkerPool(paths);
  return {
    run_id: runId,
    run_dir: paths.run,
    source_file: sourceFile,
    source_hash: sourceHash,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    semantic_profile: SEMANTIC_PROFILE,
    profile,
    resumed: false
  };
}

function resolveRun(novelDir, runId, expectedProfile) {
  const runs = runDirectories(novelDir);
  if (runId) {
    const paths = pathsFor(novelDir, runId);
    if (!fs.existsSync(paths.runJson)) throw new GameKbError('RUN_MISSING', 'Requested run does not exist', { run_id: runId });
    return assertSemanticContract({ ...readRunMetadata(paths.run), run_dir: paths.run }, 'resolve', expectedProfile);
  }
  if (runs.length === 0) throw new GameKbError('RUN_REQUIRED', 'No eligible run exists; run prepare first');
  if (runs.length > 1) throw new GameKbError('RUN_AMBIGUOUS', 'Multiple eligible runs require --run <run-id>');
  const runDir = runs[0];
  return assertSemanticContract({ ...readRunMetadata(runDir), run_dir: runDir }, 'resolve', expectedProfile);
}

function resolveWritableRun(novelDir, runId, action = 'continue', expectedProfile) {
  const metadata = resolveRun(novelDir, runId);
  if (metadata.profile === LEGACY_PROFILE_V5) {
    throw new GameKbError(
      'PROFILE_LEGACY',
      'The legacy v5 profile must be migrated with lite-prepare before writing',
      { run_id: metadata.run_id, profile: metadata.profile, action }
    );
  }
  return assertSemanticContract(metadata, action, expectedProfile);
}

module.exports = {
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE,
  assertArchiveExistingAllowed,
  assertSemanticContract,
  createOrResumeRun,
  normalizeProfile,
  resolveRun,
  resolveWritableRun,
  sourceState
};
