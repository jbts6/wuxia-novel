'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  ACCEPTED_SERIALIZATION,
  initializeArtifactManifest
} = require('./candidate-ledger');
const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson } = require('./io');
const { discoverSource, normalizeSource, sha256 } = require('./source');
const { pathsFor } = require('./paths');
const {
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE
} = require('./semantic-contract');
const { EMPTY_DURATIONS } = require('./timing');
const { ensureWorkerPool } = require('./worker-pool');

const ACCEPTED_SERIALIZATION_READ_COMMANDS = new Set(['status', 'verify', 'archive-run']);

function assertAcceptedSerialization(metadata, command = 'continue') {
  if (metadata?.accepted_serialization === ACCEPTED_SERIALIZATION) return;
  if (ACCEPTED_SERIALIZATION_READ_COMMANDS.has(command)) return;
  throw new GameKbError(
    'LEGACY_ACCEPTED_SERIALIZATION',
    'This run uses legacy accepted serialization; start a new run before writing',
    {
      run_id: metadata?.run_id ?? null,
      accepted_serialization: metadata?.accepted_serialization ?? null,
      required: ACCEPTED_SERIALIZATION,
      command,
      action: 'start-new-run'
    }
  );
}

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

function normalizeDeep(deep) {
  if (deep === undefined || deep === null) return false;
  if (typeof deep !== 'boolean') {
    throw new GameKbError('DEEP_MODE_INVALID', 'Deep mode must be a boolean', { deep });
  }
  return deep;
}

function assertSemanticContract(metadata, action = 'continue', expectedDeep) {
  if (metadata?.semantic_contract_version !== SEMANTIC_CONTRACT_VERSION
    || metadata?.semantic_profile !== SEMANTIC_PROFILE
    || typeof metadata?.deep !== 'boolean') {
    throw new GameKbError(
      'LEGACY_SEMANTIC_CONTRACT',
      'This run is read-only under the current semantic contract',
      {
        run_id: metadata?.run_id ?? null,
        semantic_contract_version: metadata?.semantic_contract_version ?? null,
        required_version: SEMANTIC_CONTRACT_VERSION,
        semantic_profile: metadata?.semantic_profile ?? null,
        required_profile: SEMANTIC_PROFILE,
        deep: metadata?.deep ?? null,
        action
      }
    );
  }
  if (expectedDeep !== undefined && metadata.deep !== expectedDeep) {
    throw new GameKbError(
      'DEEP_MODE_MISMATCH',
      `Run deep mode ${metadata.deep} cannot be written with --deep=${expectedDeep}`,
      {
        run_id: metadata?.run_id ?? null,
        deep: metadata.deep,
        required_deep: expectedDeep,
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
  const deep = normalizeDeep(options.deep);
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
    assertAcceptedSerialization(metadata, 'prepare');
    if (metadata.source_hash !== sourceHash) {
      throw new GameKbError('RUN_SOURCE_CHANGED', 'Source changed; archive the old run before resuming it', {
        run_id: runId,
        previous_source_hash: metadata.source_hash,
        source_hash: sourceHash
      });
    }
    assertSemanticContract(metadata, 'prepare', deep);
    ensureRunDirectories(paths);
    ensureWorkerPool(paths);
    return {
      run_id: runId,
      run_dir: paths.run,
      source_file: sourceFile,
      source_hash: sourceHash,
      semantic_contract_version: metadata.semantic_contract_version,
      semantic_profile: metadata.semantic_profile,
      deep: metadata.deep,
      resumed: true
    };
  }
  fs.mkdirSync(paths.run, { recursive: true });
  ensureRunDirectories(paths);
  const metadata = {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    semantic_profile: SEMANTIC_PROFILE,
    accepted_serialization: ACCEPTED_SERIALIZATION,
    deep,
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
    deep,
    resumed: false
  };
}

function resolveRun(novelDir, runId, expectedDeep) {
  const runs = runDirectories(novelDir);
  if (runId) {
    const paths = pathsFor(novelDir, runId);
    if (!fs.existsSync(paths.runJson)) throw new GameKbError('RUN_MISSING', 'Requested run does not exist', { run_id: runId });
    return assertSemanticContract({ ...readRunMetadata(paths.run), run_dir: paths.run }, 'resolve', expectedDeep);
  }
  if (runs.length === 0) throw new GameKbError('RUN_REQUIRED', 'No eligible run exists; run prepare first');
  if (runs.length > 1) throw new GameKbError('RUN_AMBIGUOUS', 'Multiple eligible runs require --run <run-id>');
  const runDir = runs[0];
  return assertSemanticContract({ ...readRunMetadata(runDir), run_dir: runDir }, 'resolve', expectedDeep);
}

function resolveWritableRun(novelDir, runId, action = 'continue', expectedDeep) {
  const metadata = resolveRun(novelDir, runId);
  assertAcceptedSerialization(metadata, action);
  return assertSemanticContract(metadata, action, expectedDeep);
}

module.exports = {
  ACCEPTED_SERIALIZATION,
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE,
  assertAcceptedSerialization,
  assertArchiveExistingAllowed,
  assertSemanticContract,
  createOrResumeRun,
  normalizeDeep,
  resolveRun,
  resolveWritableRun,
  sourceState
};
