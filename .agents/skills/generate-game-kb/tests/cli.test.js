'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const { publicCommands } = require('../scripts/flow');
const { stableHash } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { makeNovel, readJson, runFlow } = require('./helpers');

function jsonResult(result) {
  const text = result.status === 0 ? result.stdout : result.stderr;
  return JSON.parse(text.trim());
}

function chapterNovel(count) {
  const source = Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return `第${number}章 第${number}章\n甲留下第${number}段证据。`;
  }).join('\n');
  return makeNovel('窗口测试书', source);
}

function replaceWorkerContractVersion(job, paths, version) {
  const input = readJson(job.input_file);
  input.worker_contract.version = version;
  fs.writeFileSync(job.input_file, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
  const progress = readJson(paths.progress);
  progress.units[job.unit].input_hash = stableHash(input);
  fs.writeFileSync(paths.progress, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
}

test('public command surface is exactly v7', () => {
  assert.deepEqual(
    publicCommands(),
    ['archive-abandoned', 'recover-relations', 'retry-unit', 'run', 'status']
  );
  const novel = chapterNovel(1);
  for (const removed of [
    'prepare', 'extract-plan', 'submit', 'plan-domains', 'accept', 'assemble',
    'verify', 'install', 'archive-run', 'archive-existing', 'reset-unit'
  ]) {
    const result = runFlow([removed, novel, '--json']);
    assert.notEqual(result.status, 0, removed);
    assert.equal(jsonResult(result).code, 'COMMAND_UNKNOWN', removed);
  }
});

test('twenty-five chapters expose only the first five jobs', () => {
  const novel = chapterNovel(25);
  const first = runFlow(['run', novel, '--run', 'run-window', '--json']);
  assert.equal(first.status, 0, first.stderr);
  const firstOutput = jsonResult(first);

  assert.deepEqual(Object.keys(firstOutput), [
    'semantic_contract_version', 'run_id', 'status', 'jobs',
    'active_units', 'progress', 'manual_review'
  ]);
  assert.equal(firstOutput.status, 'jobs');
  assert.deepEqual(firstOutput.jobs.map(job => job.unit), [
    'chapter:001', 'chapter:002', 'chapter:003', 'chapter:004', 'chapter:005'
  ]);
  assert.deepEqual(firstOutput.progress, { accepted: 0, total: 25 });
  assert.equal(firstOutput.manual_review, null);
  for (const job of firstOutput.jobs) {
    assert.deepEqual(Object.keys(job), [
      'unit', 'cycle', 'attempt', 'producer', 'input_file', 'output_file', 'input_hash'
    ]);
    assert.equal(job.producer, 'chapter-worker');
  }

  const second = runFlow(['run', novel, '--run', firstOutput.run_id, '--json']);
  assert.equal(second.status, 0, second.stderr);
  const secondOutput = jsonResult(second);
  assert.equal(secondOutput.status, 'waiting');
  assert.deepEqual(secondOutput.jobs, []);
  assert.deepEqual(secondOutput.progress, { accepted: 0, total: 25 });
});

test('status rejects an active job with a stale worker contract', () => {
  const novel = chapterNovel(1);
  const first = runFlow(['run', novel, '--run', 'run-stale-worker', '--json']);
  assert.equal(first.status, 0, first.stderr);
  const firstOutput = jsonResult(first);
  replaceWorkerContractVersion(
    firstOutput.jobs[0],
    pathsFor(novel, firstOutput.run_id),
    1
  );

  const status = runFlow(['status', novel, '--run', firstOutput.run_id, '--json']);
  assert.notEqual(status.status, 0);
  const error = jsonResult(status);
  assert.equal(error.code, 'WORKER_CONTRACT_STALE_RESTART_REQUIRED');
  assert.deepEqual(error.details, {
    run_id: 'run-stale-worker',
    unit: 'chapter:001',
    actual_version: 1,
    expected_version: 3
  });
});
