'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { publicCommands } = require('../scripts/flow');
const { makeNovel, runFlow } = require('./helpers');

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

test('public command surface is exactly v7', () => {
  assert.deepEqual(publicCommands(), ['archive-abandoned', 'retry-unit', 'run', 'status']);
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
