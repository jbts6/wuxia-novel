'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { pathsFor } = require('../scripts/lib/paths');
const { SEMANTIC_CONTRACT_VERSION } = require('../scripts/lib/semantic-contract');
const { readJson, runFlow } = require('./helpers');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const novel = path.join(repoRoot, '古龙', '剑神一笑');
const source = path.join(novel, '剑神一笑.txt');

test('tracked Jian Shen Yi Xiao corpus follows the production V4 prepare and status contract', t => {
  const runId = `run-jian-shen-yi-xiao-integration-${process.pid}`;
  const paths = pathsFor(novel, runId);
  fs.rmSync(paths.run, { recursive: true, force: true });
  t.after(() => fs.rmSync(paths.run, { recursive: true, force: true }));

  assert.equal(fs.existsSync(source), true, `tracked source missing: ${source}`);

  const prepared = runFlow(['prepare', novel, '--run', runId, '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);
  const prepareOutput = JSON.parse(prepared.stdout);
  assert.equal(prepareOutput.chapter_count, 20);
  assert.equal(prepareOutput.profile, 'v4');
  assert.equal(path.resolve(prepareOutput.novel_dir), path.resolve(novel));
  assert.equal(path.resolve(prepareOutput.source_file), path.resolve(source));

  const metadata = readJson(paths.runJson);
  assert.equal(metadata.semantic_contract_version, SEMANTIC_CONTRACT_VERSION);
  assert.equal(metadata.semantic_profile, 'domain-distill-v1');
  assert.equal(metadata.profile, 'v4');

  const firstStatus = runFlow(['status', novel, '--run', runId, '--json']);
  assert.equal(firstStatus.status, 0, firstStatus.stderr);
  const first = JSON.parse(firstStatus.stdout);
  const secondStatus = runFlow(['status', novel, '--run', runId, '--json']);
  assert.equal(secondStatus.status, 0, secondStatus.stderr);
  const second = JSON.parse(secondStatus.stdout);

  assert.equal(first.next_action, 'accept-chapters');
  assert.equal(first.next_units.length, 20);
  assert.deepEqual(first.chapter_jobs, second.chapter_jobs);
  assert.equal(first.chapter_jobs.length, 20);
  assert.equal(first.chapter_jobs.every(job => job.chapters.length === 1), true);
  const batchSizes = [...first.chapter_jobs.reduce((counts, job) => {
    counts.set(job.batch_id, (counts.get(job.batch_id) || 0) + 1);
    return counts;
  }, new Map()).values()];
  assert.deepEqual(batchSizes, [3, 3, 3, 3, 3, 3, 2]);

  const descriptors = first.chapter_jobs.flatMap(job => job.chapters);
  assert.equal(descriptors.length, 20);
  assert.deepEqual(descriptors.map(chapter => chapter.number), Array.from({ length: 20 }, (_, index) => index + 1));
  for (const job of first.chapter_jobs) {
    assert.equal(job.chapters.every((chapter, index) => (
      index === 0 || chapter.number === job.chapters[index - 1].number + 1
    )), true);
    const cjkTotal = job.chapters.reduce((total, chapter) => total + chapter.source_char_count, 0);
    assert.equal(job.chapters.length === 1 || cjkTotal <= 36_000, true);
  }
  for (const chapter of descriptors) {
    // Worker projection strips staging_path from visible status
    assert.deepEqual(Object.keys(chapter), [
      'unit',
      'number',
      'title',
      'source_file',
      'input_hash',
      'source_char_count',
      'attempt'
    ]);
    assert.equal(chapter.attempt, 1);
    assert.equal(path.isAbsolute(chapter.source_file), true);
    assert.equal(chapter.source_file.startsWith(paths.sourceChapters), true);
    assert.equal(chapter.source_file.includes(path.join('古龙', '剑神一笑')), true);
    assert.equal('staging_path' in chapter, false);
    assert.equal('staging_paths' in chapter, false);
  }
});
