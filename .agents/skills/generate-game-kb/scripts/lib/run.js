'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { initializeArtifactManifest } = require('./candidate-ledger');
const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson } = require('./io');
const { discoverSource, normalizeSource, sha256 } = require('./source');
const { pathsFor } = require('./paths');
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

function ensureRunDirectories(paths) {
  for (const directory of [
    paths.staging,
    paths.mergeWork,
    paths.cleanWork,
    paths.mergeDecisions,
    paths.cleanDecisions,
    paths.mergeCategories,
    paths.cleanCategories
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }
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
    const metadata = readRunMetadata(paths.run);
    if (metadata.source_hash !== sourceHash) {
      throw new GameKbError('RUN_SOURCE_CHANGED', 'Source changed; archive the old run before resuming it', {
        run_id: runId,
        previous_source_hash: metadata.source_hash,
        source_hash: sourceHash
      });
    }
    ensureRunDirectories(paths);
    ensureWorkerPool(paths);
    return { run_id: runId, run_dir: paths.run, source_file: sourceFile, source_hash: sourceHash, resumed: true };
  }
  fs.mkdirSync(paths.run, { recursive: true });
  ensureRunDirectories(paths);
  const metadata = {
    schema_version: 1,
    run_id: runId,
    source_file: sourceFile,
    source_hash: sourceHash,
    status: 'active',
    started_at: new Date().toISOString(),
    phase_durations: {
      chapter_extraction_ms: 0,
      merge_ms: 0,
      clean_ms: 0,
      targeted_recall_ms: 0,
      script_ms: 0,
      human_wait_ms: 0,
      total_ms: 0
    }
  };
  atomicWriteJson(paths.runJson, metadata);
  initializeArtifactManifest(paths);
  ensureWorkerPool(paths);
  return { run_id: runId, run_dir: paths.run, source_file: sourceFile, source_hash: sourceHash, resumed: false };
}

function resolveRun(novelDir, runId) {
  const runs = runDirectories(novelDir);
  if (runId) {
    const paths = pathsFor(novelDir, runId);
    if (!fs.existsSync(paths.runJson)) throw new GameKbError('RUN_MISSING', 'Requested run does not exist', { run_id: runId });
    return { ...readRunMetadata(paths.run), run_dir: paths.run };
  }
  if (runs.length === 0) throw new GameKbError('RUN_REQUIRED', 'No eligible run exists; run prepare first');
  if (runs.length > 1) throw new GameKbError('RUN_AMBIGUOUS', 'Multiple eligible runs require --run <run-id>');
  const runDir = runs[0];
  return { ...readRunMetadata(runDir), run_dir: runDir };
}

module.exports = { createOrResumeRun, resolveRun, sourceState };
