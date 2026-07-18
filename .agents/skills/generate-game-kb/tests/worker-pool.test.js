'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, parseJsonLine, readJson, runFlow } = require('./helpers');
const { pathsFor } = require('../scripts/lib/paths');
const {
  MAX_CHAPTERS_PER_JOB,
  MAX_CJK_CHARS_PER_JOB
} = require('../scripts/lib/worker-pool');

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

test('chapter worker jobs expose the three-chapter and 36k CJK limits', () => {
  assert.equal(MAX_CHAPTERS_PER_JOB, 3);
  assert.equal(MAX_CJK_CHARS_PER_JOB, 36000);
});

test('a new run and status persist a default chapter-worker concurrency limit of five', () => {
  const { novel, paths } = prepareRun();
  const workerPoolFile = path.join(paths.run, 'worker-pool.json');

  assert.equal(fs.existsSync(workerPoolFile), true);
  assert.equal(paths.workerPool, workerPoolFile);
  assert.deepEqual(readJson(workerPoolFile), {
    schema_version: 1,
    initial_limit: 5,
    concurrency_limit: 5,
    halted: false,
    incidents: [],
    updated_at: readJson(workerPoolFile).updated_at
  });
  assert.match(readJson(workerPoolFile).updated_at, /^\d{4}-\d{2}-\d{2}T/);
  const status = runFlow(['status', novel, '--run', paths.runId, '--json']);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).worker_pool.concurrency_limit, 5);
});

test('one or more 429 responses in the same dispatch batch fall back from five to three once', () => {
  const { novel, paths } = prepareRun();

  const first = backoff(novel, paths.runId, 'batch-001');
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).worker_pool.concurrency_limit, 3);

  const duplicate = backoff(novel, paths.runId, 'batch-001');
  assert.equal(duplicate.status, 0, duplicate.stderr);
  assert.equal(JSON.parse(duplicate.stdout).duplicate, true);

  const persisted = readJson(paths.workerPool);
  assert.equal(persisted.concurrency_limit, 3);
  assert.equal(persisted.incidents.length, 1);
  assert.deepEqual(persisted.incidents[0], {
    batch_id: 'batch-001',
    reason: '429',
    previous_limit: 5,
    next_limit: 3,
    action: 'reduced',
    recorded_at: persisted.incidents[0].recorded_at
  });
});

test('a 429 batch reduces five to three without halting until another batch fails', () => {
  const { novel, paths } = prepareRun();

  const result = backoff(novel, paths.runId, 'batch-001');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).worker_pool.concurrency_limit, 3);

  assert.equal(readJson(paths.workerPool).halted, false);
});

test('a fresh 429 at fallback concurrency three persists a halt and reports external rate limiting', () => {
  const { novel, paths } = prepareRun();
  assert.equal(backoff(novel, paths.runId, 'batch-001').status, 0);

  const halted = backoff(novel, paths.runId, 'batch-002');
  assert.equal(halted.status, 1);
  assert.equal(parseJsonLine(halted.stderr).code, 'WORKER_RATE_LIMITED');

  const persisted = readJson(paths.workerPool);
  assert.equal(persisted.concurrency_limit, 3);
  assert.equal(persisted.halted, true);
  assert.deepEqual(persisted.incidents.at(-1), {
    batch_id: 'batch-002',
    reason: '429',
    previous_limit: 3,
    next_limit: 3,
    action: 'halted',
    recorded_at: persisted.incidents.at(-1).recorded_at
  });
});

test('prepare resume and status preserve the reduced worker limit', () => {
  const { novel, paths } = prepareRun();
  assert.equal(backoff(novel, paths.runId, 'batch-001').status, 0);

  const resumed = runFlow(['prepare', novel, '--run', paths.runId, '--json']);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(JSON.parse(resumed.stdout).resumed, true);

  const status = runFlow(['status', novel, '--run', paths.runId, '--json']);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).worker_pool.concurrency_limit, 3);
  assert.equal(readJson(paths.workerPool).concurrency_limit, 3);
});

test('a new run resets worker concurrency to five', () => {
  const { novel, paths } = prepareRun('run-first');
  assert.equal(backoff(novel, paths.runId, 'batch-001').status, 0);

  const second = runFlow(['prepare', novel, '--run', 'run-second', '--json']);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readJson(pathsFor(novel, 'run-second').workerPool).concurrency_limit, 5);
});

test('429 worker backoff does not consume the unified submission budget', () => {
  const { novel, paths } = prepareRun();
  const before = fs.readFileSync(paths.progress, 'utf8');

  const result = backoff(novel, paths.runId, 'batch-001');
  assert.equal(result.status, 0, result.stderr);

  assert.equal(fs.readFileSync(paths.progress, 'utf8'), before);
  for (const unit of Object.values(readJson(paths.progress).units)) {
    assert.equal(unit.attempts, 0);
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
  assert.equal(parseJsonLine(result.stderr).code, 'WORKER_BACKOFF_REASON_INVALID');
  assert.equal(readJson(paths.workerPool).concurrency_limit, 5);
});
