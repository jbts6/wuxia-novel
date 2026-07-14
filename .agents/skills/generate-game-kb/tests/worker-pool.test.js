'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, readJson, runFlow } = require('./helpers');
const { pathsFor } = require('../scripts/lib/paths');

function prepareRun(runId = 'run-worker-pool') {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n第二章 转折\n乙。\n');
  const result = runFlow(['prepare', novel, '--run', runId, '--json']);
  assert.equal(result.status, 0, result.stderr);
  return { novel, paths: pathsFor(novel, runId), result: JSON.parse(result.stdout) };
}

function backoff(novel, runId, batchId) {
  return runFlow([
    'worker-backoff', novel,
    '--run', runId,
    '--batch', batchId,
    '--reason', '429',
    '--json'
  ]);
}

test('a new run persists a default chapter-worker concurrency limit of ten', () => {
  const { paths } = prepareRun();
  const workerPoolFile = path.join(paths.run, 'worker-pool.json');

  assert.equal(fs.existsSync(workerPoolFile), true);
  assert.equal(paths.workerPool, workerPoolFile);
  assert.deepEqual(readJson(workerPoolFile), {
    schema_version: 1,
    initial_limit: 10,
    concurrency_limit: 10,
    halted: false,
    incidents: [],
    updated_at: readJson(workerPoolFile).updated_at
  });
  assert.match(readJson(workerPoolFile).updated_at, /^\d{4}-\d{2}-\d{2}T/);
});

test('one or more 429 responses in the same dispatch batch halve the limit once', () => {
  const { novel, paths } = prepareRun();

  const first = backoff(novel, paths.runId, 'batch-001');
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).worker_pool.concurrency_limit, 5);

  const duplicate = backoff(novel, paths.runId, 'batch-001');
  assert.equal(duplicate.status, 0, duplicate.stderr);
  assert.equal(JSON.parse(duplicate.stdout).duplicate, true);

  const persisted = readJson(paths.workerPool);
  assert.equal(persisted.concurrency_limit, 5);
  assert.equal(persisted.incidents.length, 1);
  assert.deepEqual(persisted.incidents[0], {
    batch_id: 'batch-001',
    reason: '429',
    previous_limit: 10,
    next_limit: 5,
    action: 'reduced',
    recorded_at: persisted.incidents[0].recorded_at
  });
});

test('distinct 429 batches reduce ten to five to two to one', () => {
  const { novel, paths } = prepareRun();

  for (const [batchId, expected] of [['batch-001', 5], ['batch-002', 2], ['batch-003', 1]]) {
    const result = backoff(novel, paths.runId, batchId);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).worker_pool.concurrency_limit, expected);
  }

  assert.equal(readJson(paths.workerPool).halted, false);
});

test('a fresh 429 at concurrency one persists a halt and reports external rate limiting', () => {
  const { novel, paths } = prepareRun();
  for (const batchId of ['batch-001', 'batch-002', 'batch-003']) {
    assert.equal(backoff(novel, paths.runId, batchId).status, 0);
  }

  const halted = backoff(novel, paths.runId, 'batch-004');
  assert.equal(halted.status, 1);
  assert.equal(JSON.parse(halted.stderr).code, 'WORKER_RATE_LIMITED');

  const persisted = readJson(paths.workerPool);
  assert.equal(persisted.concurrency_limit, 1);
  assert.equal(persisted.halted, true);
  assert.equal(persisted.incidents.at(-1).action, 'halted');
});

test('prepare resume and status preserve the reduced worker limit', () => {
  const { novel, paths } = prepareRun();
  assert.equal(backoff(novel, paths.runId, 'batch-001').status, 0);

  const resumed = runFlow(['prepare', novel, '--run', paths.runId, '--json']);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(JSON.parse(resumed.stdout).resumed, true);

  const status = runFlow(['status', novel, '--run', paths.runId, '--json']);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).worker_pool.concurrency_limit, 5);
  assert.equal(readJson(paths.workerPool).concurrency_limit, 5);
});

test('a new run resets worker concurrency to ten', () => {
  const { novel, paths } = prepareRun('run-first');
  assert.equal(backoff(novel, paths.runId, 'batch-001').status, 0);

  const second = runFlow(['prepare', novel, '--run', 'run-second', '--json']);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readJson(pathsFor(novel, 'run-second').workerPool).concurrency_limit, 10);
});

test('429 worker backoff does not consume chapter semantic or submission attempts', () => {
  const { novel, paths } = prepareRun();
  const before = fs.readFileSync(paths.progress, 'utf8');

  const result = backoff(novel, paths.runId, 'batch-001');
  assert.equal(result.status, 0, result.stderr);

  assert.equal(fs.readFileSync(paths.progress, 'utf8'), before);
  for (const unit of Object.values(readJson(paths.progress).units)) {
    assert.equal(unit.attempts, 0);
    assert.equal(unit.semantic_attempts, 0);
  }
});

test('worker-backoff rejects incidents that are not explicit 429 responses', () => {
  const { novel, paths } = prepareRun();
  const result = runFlow([
    'worker-backoff', novel,
    '--run', paths.runId,
    '--batch', 'batch-001',
    '--reason', 'timeout',
    '--json'
  ]);

  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).code, 'WORKER_BACKOFF_REASON_INVALID');
  assert.equal(readJson(paths.workerPool).concurrency_limit, 10);
});
