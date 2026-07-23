'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { stableHash } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const {
  captureWorkerRootBaseline,
  reconcileWorkerRootTemps
} = require('../scripts/lib/worker-side-effects');
const {
  makeTemporaryNovel,
  parseJsonLine,
  readJson,
  runFlow,
  writeAllWorkerOutputs
} = require('./helpers');

function runJson(args) {
  const result = runFlow(args);
  return { result, payload: parseJsonLine(result.status === 0 ? result.stdout : result.stderr) };
}

test('paths expose run-level Worker side-effect diagnostics', () => {
  const novel = makeTemporaryNovel(1);
  const paths = pathsFor(novel, 'run-side-effects');
  assert.equal(
    paths.workerRootBaseline,
    path.join(paths.run, 'diagnostics', 'worker-root-baseline.json')
  );
  assert.equal(paths.workerLeaks, path.join(paths.run, 'diagnostics', 'worker-leaks'));
});

test('a new run quarantines new root temp files and continues receiving YAML', () => {
  const novel = makeTemporaryNovel(6);
  const historical = path.join(novel, '.tmp-historical.txt');
  fs.writeFileSync(historical, 'existing\n', 'utf8');

  const first = runJson(['run', novel, '--run', 'run-side-effects', '--json']);
  assert.equal(first.result.status, 0, first.result.stderr);
  const paths = pathsFor(novel, first.payload.run_id);
  assert.equal(fs.existsSync(paths.workerRootBaseline), true);

  writeAllWorkerOutputs(first.payload.jobs);
  const leaked = path.join(novel, '.tmp-worker-index.js');
  fs.writeFileSync(leaked, 'helper\n', 'utf8');

  const second = runJson(['run', novel, '--run', first.payload.run_id, '--json']);
  assert.equal(second.result.status, 0, second.result.stderr);
  assert.equal(second.payload.status, 'jobs');
  assert.deepEqual(second.payload.warnings.map(warning => warning.code), [
    'WORKER_SIDE_EFFECT_QUARANTINED'
  ]);
  assert.deepEqual(second.payload.warnings[0].paths, ['.tmp-worker-index.js']);
  assert.equal(fs.existsSync(historical), true);
  assert.equal(fs.existsSync(leaked), false);

  const incidents = fs.readdirSync(paths.workerLeaks, { withFileTypes: true })
    .filter(entry => entry.isDirectory());
  assert.equal(incidents.length, 1);
  const incidentRoot = path.join(paths.workerLeaks, incidents[0].name);
  assert.equal(fs.existsSync(path.join(incidentRoot, '.tmp-worker-index.js')), true);
  assert.equal(fs.existsSync(path.join(incidentRoot, 'incident.json')), true);
});

test('run does not move a temp file while active Worker outputs are missing', () => {
  const novel = makeTemporaryNovel(1);
  const first = runJson(['run', novel, '--run', 'run-active-worker', '--json']);
  assert.equal(first.result.status, 0, first.result.stderr);
  const leaked = path.join(novel, '.tmp-active-worker.txt');
  fs.writeFileSync(leaked, 'still in use\n', 'utf8');

  const waiting = runJson(['run', novel, '--run', first.payload.run_id, '--json']);
  assert.equal(waiting.result.status, 0, waiting.result.stderr);
  assert.equal(waiting.payload.status, 'waiting');
  assert.equal(Object.hasOwn(waiting.payload, 'warnings'), false);
  assert.equal(fs.existsSync(leaked), true);
});

test('a stale Worker contract fails before quarantining root temp files', () => {
  const novel = makeTemporaryNovel(1);
  const first = runJson(['run', novel, '--run', 'run-stale-side-effect', '--json']);
  assert.equal(first.result.status, 0, first.result.stderr);
  const paths = pathsFor(novel, first.payload.run_id);
  const input = readJson(first.payload.jobs[0].input_file);
  input.worker_contract.version = 1;
  fs.writeFileSync(first.payload.jobs[0].input_file, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
  const progress = readJson(paths.progress);
  progress.units[first.payload.jobs[0].unit].input_hash = stableHash(input);
  fs.writeFileSync(paths.progress, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
  writeAllWorkerOutputs(first.payload.jobs);
  const leaked = path.join(novel, '.tmp-stale-worker.txt');
  fs.writeFileSync(leaked, 'must remain untouched\n', 'utf8');

  const second = runJson(['run', novel, '--run', first.payload.run_id, '--json']);
  assert.notEqual(second.result.status, 0);
  assert.equal(second.payload.code, 'WORKER_CONTRACT_STALE_RESTART_REQUIRED');
  assert.equal(fs.existsSync(leaked), true);
  assert.equal(fs.existsSync(paths.workerLeaks), false);
});

test('a damaged run baseline stops before receiving Worker YAML', () => {
  const novel = makeTemporaryNovel(6);
  const first = runJson(['run', novel, '--run', 'run-damaged-baseline', '--json']);
  assert.equal(first.result.status, 0, first.result.stderr);
  const paths = pathsFor(novel, first.payload.run_id);
  const baseline = path.join(paths.run, 'diagnostics', 'worker-root-baseline.json');
  fs.mkdirSync(path.dirname(baseline), { recursive: true });
  fs.writeFileSync(baseline, '{invalid', 'utf8');
  writeAllWorkerOutputs(first.payload.jobs);

  const second = runJson(['run', novel, '--run', first.payload.run_id, '--json']);
  assert.notEqual(second.result.status, 0);
  assert.equal(second.payload.code, 'WORKER_SIDE_EFFECT_GUARD_FAILED');
  assert.equal(fs.existsSync(first.payload.jobs[0].output_file), true);
});

test('a partial quarantine failure leaves an auditable failure receipt', () => {
  const novel = makeTemporaryNovel(1);
  const paths = pathsFor(novel, 'run-partial-quarantine');
  captureWorkerRootBaseline(paths);
  const outputFile = path.join(paths.run, 'staging', 'chapter_001.yaml');
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, 'ready\n', 'utf8');
  const names = ['.tmp-first.txt', '.tmp-second.txt'];
  for (const name of names) fs.writeFileSync(path.join(novel, name), `${name}\n`, 'utf8');
  const originalRename = fs.renameSync;
  let calls = 0;
  fs.renameSync = (...args) => {
    calls += 1;
    if (calls === 2) throw new Error('injected second rename failure');
    return originalRename(...args);
  };
  let error;
  try {
    reconcileWorkerRootTemps(paths, {
      active_units: ['chapter:001'],
      units: { 'chapter:001': { status: 'active', output_file: outputFile } }
    });
  } catch (caught) {
    error = caught;
  } finally {
    fs.renameSync = originalRename;
  }

  assert.equal(error?.code, 'WORKER_SIDE_EFFECT_GUARD_FAILED');
  const incidents = fs.readdirSync(paths.workerLeaks, { withFileTypes: true })
    .filter(entry => entry.isDirectory());
  assert.equal(incidents.length, 1);
  const incidentRoot = path.join(paths.workerLeaks, incidents[0].name);
  const receipt = readJson(path.join(incidentRoot, 'incident.json'));
  assert.equal(receipt.status, 'failed');
  assert.deepEqual(receipt.paths, names);
  assert.deepEqual(receipt.moved, ['.tmp-first.txt']);
  assert.equal(receipt.failed_path, '.tmp-second.txt');
});

test('a completed run keeps the warning incident path valid after archive', () => {
  const novel = makeTemporaryNovel(1);
  const first = runJson(['run', novel, '--run', 'run-archived-incident', '--json']);
  assert.equal(first.result.status, 0, first.result.stderr);
  writeAllWorkerOutputs(first.payload.jobs);
  fs.writeFileSync(path.join(novel, '.temp-worker-log.txt'), 'helper\n', 'utf8');

  const completed = runJson(['run', novel, '--run', first.payload.run_id, '--json']);
  assert.equal(completed.result.status, 0, completed.result.stderr);
  assert.equal(completed.payload.status, 'complete');
  const archiveRoot = path.join(
    novel, '_archive', 'generate-game-kb', first.payload.run_id
  );
  assert.equal(
    fs.existsSync(path.join(archiveRoot, completed.payload.warnings[0].incident_file)),
    true
  );
});
