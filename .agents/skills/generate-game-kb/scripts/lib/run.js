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
const { TIMING_CONTRACT_VERSION, appendTimingEvent } = require('./timing-events');

const ACCEPTED_SERIALIZATION_READ_COMMANDS = new Set(['status', 'verify', 'archive-run']);

function ensureRunStartedEvent(paths, metadata) {
  if (metadata.timing_contract_version !== TIMING_CONTRACT_VERSION) return;
  if (!fs.existsSync(paths.events) && fs.existsSync(paths.manifest)) {
    throw new GameKbError('TIMING_EVENTS_INVALID', 'Timing event file is missing after source prepare', {
      run_id: metadata.run_id
    });
  }
  appendTimingEvent(paths.events, { type: 'run_started' }, { occurredAt: metadata.started_at });
}

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

function archivedRunDirectories(novelDir) {
  const root = path.join(path.resolve(novelDir), '_archive', 'generate-game-kb');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== 'abandoned')
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

function assertSemanticContract(metadata, action = 'continue') {
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
  for (const directory of [paths.staging]) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function initialRunMetadata(runId, sourceFile, sourceHash) {
  return {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    semantic_profile: SEMANTIC_PROFILE,
    timing_contract_version: TIMING_CONTRACT_VERSION,
    accepted_serialization: ACCEPTED_SERIALIZATION,
    run_id: runId,
    source_file: sourceFile,
    source_hash: sourceHash,
    status: 'active',
    started_at: new Date().toISOString(),
    phase_durations: { ...EMPTY_DURATIONS }
  };
}

function createOrResumeRun(novelDir, options = {}) {
  const novel = path.resolve(novelDir);
  const { sourceFile, sourceHash } = sourceState(novel);
  const runs = runDirectories(novel);
  let runId = options.runId;
  if (!runId) {
    if (runs.length > 1) throw new GameKbError('RUN_AMBIGUOUS', 'Multiple eligible runs require --run <run-id>');
    runId = runs.length === 1 ? readRunMetadata(runs[0]).run_id : generatedRunId();
  }
  const paths = pathsFor(novel, runId);
  if (fs.existsSync(paths.runJson)) {
    let metadata = readRunMetadata(paths.run);
    assertSemanticContract(metadata, 'run');
    assertAcceptedSerialization(metadata, 'run');
    if (metadata.source_hash !== sourceHash) {
      throw new GameKbError('RUN_SOURCE_CHANGED', 'Source changed; archive the old run before resuming it', {
        run_id: runId,
        previous_source_hash: metadata.source_hash,
        source_hash: sourceHash
      });
    }
    ensureRunDirectories(paths);
    ensureRunStartedEvent(paths, metadata);
    return {
      run_id: runId,
      run_dir: paths.run,
      source_file: sourceFile,
      source_hash: sourceHash,
      semantic_contract_version: metadata.semantic_contract_version,
      semantic_profile: metadata.semantic_profile,
      resumed: true
    };
  }
  fs.mkdirSync(paths.run, { recursive: true });
  ensureRunDirectories(paths);
  const metadata = initialRunMetadata(runId, sourceFile, sourceHash);
  atomicWriteJson(paths.runJson, metadata);
  initializeArtifactManifest(paths);
  ensureRunStartedEvent(paths, metadata);
  return {
    run_id: runId,
    run_dir: paths.run,
    source_file: sourceFile,
    source_hash: sourceHash,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    semantic_profile: SEMANTIC_PROFILE,
    resumed: false
  };
}

function resolveRunReadOnly(novelDir, runId) {
  const runs = runDirectories(novelDir);
  if (runId) {
    const active = pathsFor(novelDir, runId).run;
    const archived = path.join(path.resolve(novelDir), '_archive', 'generate-game-kb', runId);
    const candidates = [active, archived]
      .filter(directory => fs.existsSync(path.join(directory, 'run.json')));
    if (candidates.length === 0) {
      throw new GameKbError('RUN_MISSING', 'Requested run does not exist', { run_id: runId });
    }
    if (candidates.length > 1) {
      throw new GameKbError('RUN_AMBIGUOUS', 'Run exists in both active and archived storage', { run_id: runId });
    }
    return { ...readRunMetadata(candidates[0]), run_dir: candidates[0] };
  }
  const candidates = [...runs, ...archivedRunDirectories(novelDir)];
  if (candidates.length === 0) throw new GameKbError('RUN_REQUIRED', 'No run exists; run the pipeline first');
  if (candidates.length > 1) throw new GameKbError('RUN_AMBIGUOUS', 'Multiple runs require --run <run-id>');
  const runDir = candidates[0];
  return { ...readRunMetadata(runDir), run_dir: runDir };
}

function resolveRun(novelDir, runId) {
  return assertSemanticContract(resolveRunReadOnly(novelDir, runId), 'resolve');
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
  resolveRunReadOnly,
  resolveWritableRun,
  sourceState
};
