'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, readJson, runFlow } = require('./helpers');
const { pathsFor } = require('../scripts/lib/paths');

let batching = {};
try {
  batching = require('../scripts/lib/chapter-batching');
} catch {
  // The first TDD run intentionally exercises the missing batching module.
}

function pack(manifest, options) {
  assert.equal(typeof batching.packChapterJobs, 'function');
  return batching.packChapterJobs(manifest, options);
}

function validate(job, manifest) {
  assert.equal(typeof batching.validateChapterJob, 'function');
  return batching.validateChapterJob(job, manifest);
}

function chapter(number, sourceCharCount) {
  const padded = String(number).padStart(3, '0');
  return {
    number,
    title: `第${number}章`,
    file: `/novel/source/chapters/ch_${padded}.txt`,
    input_hash: `sha256:chapter-${padded}`,
    source_char_count: sourceCharCount,
    staging_paths: [
      `/novel/staging/chapter_${padded}_attempt_01.yaml`,
      `/novel/staging/chapter_${padded}_attempt_02.yaml`
    ]
  };
}

function manifest(chapters) {
  return { chapters };
}

test('prepare records chapter CJK counts and both canonical staging attempts', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲乙。\n第二章 转折\n丙丁戊。\n');
  const runId = 'run-chapter-batching';
  const result = runFlow(['prepare', novel, '--run', runId, '--json']);
  assert.equal(result.status, 0, result.stderr);

  const paths = pathsFor(novel, runId);
  const prepared = readJson(paths.manifest);
  for (const descriptor of prepared.chapters) {
    const content = fs.readFileSync(descriptor.file, 'utf8');
    assert.equal(descriptor.source_char_count, (content.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length);
    const unit = `chapter_${String(descriptor.number).padStart(3, '0')}`;
    assert.deepEqual(descriptor.staging_paths, [
      path.join(paths.staging, `${unit}_attempt_01.yaml`),
      path.join(paths.staging, `${unit}_attempt_02.yaml`)
    ]);
  }
});

test('packs fifty short chapters into twenty-five adjacent two-chapter jobs', () => {
  const input = manifest(Array.from({ length: 50 }, (_, index) => chapter(index + 1, 1000)));
  const jobs = pack(input);

  assert.equal(jobs.length, 25);
  assert.equal(jobs.every(job => job.chapters.length === 2), true);
  assert.equal(jobs.every(job => job.chapters[1].number === job.chapters[0].number + 1), true);
  assert.equal(jobs.every(job => validate(job, input).length === 0), true);
  for (const descriptor of jobs.flatMap(job => job.chapters)) {
    assert.deepEqual(Object.keys(descriptor), [
      'unit',
      'number',
      'title',
      'source_file',
      'input_hash',
      'source_char_count',
      'staging_paths'
    ]);
  }
});

test('runs an oversized chapter alone without splitting it', () => {
  const input = manifest([chapter(1, 1000), chapter(2, 40000), chapter(3, 1000)]);
  const jobs = pack(input);

  assert.deepEqual(jobs.map(job => job.chapters.map(item => item.number)), [[1], [2], [3]]);
  assert.equal(jobs[1].chapters[0].source_char_count, 40000);
});

test('obeys both count and CJK limits without joining non-adjacent chapters', () => {
  const input = manifest([
    chapter(1, 18000),
    chapter(2, 18000),
    chapter(4, 18001),
    chapter(5, 18000),
    chapter(6, 1000)
  ]);
  const jobs = pack(input);

  assert.deepEqual(jobs.map(job => job.chapters.map(item => item.number)), [[1, 2], [4], [5, 6]]);
  for (const job of jobs) {
    const total = job.chapters.reduce((sum, item) => sum + item.source_char_count, 0);
    assert.equal(job.chapters.length <= 2, true);
    assert.equal(total <= 36000 || job.chapters.length === 1, true);
  }
});

test('packing is deterministic regardless of manifest chapter order', () => {
  const ordered = manifest([chapter(1, 1000), chapter(2, 1000), chapter(3, 1000), chapter(4, 1000)]);
  const shuffled = manifest([ordered.chapters[2], ordered.chapters[0], ordered.chapters[3], ordered.chapters[1]]);

  assert.deepEqual(pack(shuffled), pack(ordered));
});

test('job validation returns the same deterministic descriptor errors', () => {
  const input = manifest([chapter(1, 1000), chapter(2, 1000)]);
  const [job] = pack(input);
  const invalid = structuredClone(job);
  invalid.chapters[0].source_file = '/wrong/chapter.txt';
  invalid.chapters[1].number = 9;

  const first = validate(invalid, input);
  const second = validate(invalid, input);
  assert.deepEqual(first, second);
  assert.equal(first.length > 0, true);
  assert.deepEqual([...first].sort((left, right) => left.path.localeCompare(right.path)), first);
});

test('job validation reports malformed chapter descriptors without throwing', () => {
  const input = manifest([chapter(1, 1000)]);
  const errors = validate({ batch_id: 'chapter-batch-001', chapters: [null] }, input);

  assert.deepEqual(errors, [{
    code: 'CHAPTER_DESCRIPTOR_INVALID',
    path: 'chapters[0]',
    target: ''
  }]);
});

test('extraction prompt requires one YAML per chapter and forbids cross-chapter evidence', () => {
  const prompt = fs.readFileSync(path.resolve(__dirname, '..', 'prompts', 'extract-chapters.md'), 'utf8');
  assert.match(prompt, /每个章节[^\n]*一个[^\n]*YAML/);
  assert.match(prompt, /禁止[^\n]*跨章节[^\n]*证据/);
});
