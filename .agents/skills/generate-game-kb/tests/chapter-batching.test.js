'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { makeNovel, readJson, runFlow, validChapterDraft } = require('./helpers');
const { pathsFor } = require('../scripts/lib/paths');

const TEST_NOVEL = path.resolve('C:/novel');
const TEST_RUN_ID = 'run-chapter-jobs';
const TEST_PATHS = pathsFor(TEST_NOVEL, TEST_RUN_ID);

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

function project(job) {
  assert.equal(typeof batching.workerProjection, 'function');
  return batching.workerProjection(job);
}

function chapter(number, sourceCharCount) {
  const padded = String(number).padStart(3, '0');
  return {
    number,
    title: `第${number}章`,
    file: path.join(TEST_PATHS.sourceChapters, `ch_${padded}.txt`),
    input_hash: `sha256:chapter-${padded}`,
    source_char_count: sourceCharCount,
    staging_paths: [
      path.join(TEST_PATHS.staging, `chapter_${padded}_attempt_01.yaml`),
      path.join(TEST_PATHS.staging, `chapter_${padded}_attempt_02.yaml`)
    ]
  };
}

function manifest(chapters) {
  return { novel_dir: TEST_NOVEL, run_id: TEST_RUN_ID, chapters };
}

test('controller safety receipts stay inside the selected run work directory', () => {
  assert.equal(TEST_PATHS.workerGuards, path.join(TEST_PATHS.semanticWork, 'worker-guards'));
  assert.equal(TEST_PATHS.draftSubmissions, path.join(TEST_PATHS.semanticWork, 'draft-submissions'));
  assert.equal(TEST_PATHS.draftRecoveries, path.join(TEST_PATHS.semanticWork, 'draft-recoveries'));
  for (const target of [
    TEST_PATHS.workerGuards,
    TEST_PATHS.draftSubmissions,
    TEST_PATHS.draftRecoveries
  ]) {
    assert.equal(path.relative(TEST_PATHS.run, target).startsWith('..'), false);
  }
});

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

test('packs fifty short chapters into adjacent jobs of up to three chapters', () => {
  const input = manifest(Array.from({ length: 50 }, (_, index) => chapter(index + 1, 1000)));
  const jobs = pack(input);

  assert.equal(jobs.length, 17);
  assert.deepEqual(jobs.map(job => job.chapters.length), [
    3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2
  ]);
  assert.equal(jobs.every(job => job.chapters.every((item, index) => (
    index === 0 || item.number === job.chapters[index - 1].number + 1
  ))), true);
  assert.equal(jobs.every(job => validate(job, input).length === 0), true);
  assert.equal(jobs.every(job => Array.isArray(job.worker_write_paths)), true);
  assert.equal(jobs.every(job => job.worker_write_paths.length === 0), true);
  assert.deepEqual(jobs.flatMap(job => job.submissions), jobs.flatMap(job => (
    job.chapters.map(({ unit, attempt, input_hash: inputHash }) => ({
      unit,
      attempt,
      input_hash: inputHash
    }))
  )));
  for (const descriptor of jobs.flatMap(job => job.chapters)) {
    assert.deepEqual(Object.keys(descriptor), [
      'unit',
      'number',
      'title',
      'source_file',
      'input_hash',
      'source_char_count',
      'attempt',
      'staging_path'
    ]);
    assert.equal(descriptor.attempt, 1);
    assert.match(descriptor.staging_path, /_attempt_01\.yaml$/);
  }
});

test('worker projection exposes only read identity and an empty write set', () => {
  const input = manifest([chapter(1, 1000), chapter(2, 1000)]);
  const [job] = pack(input);

  const worker = project(job);

  assert.deepEqual(worker.worker_write_paths, []);
  assert.deepEqual(worker.submissions, [
    { unit: 'chapter:001', attempt: 1, input_hash: 'sha256:chapter-001' },
    { unit: 'chapter:002', attempt: 1, input_hash: 'sha256:chapter-002' }
  ]);
  assert.equal(JSON.stringify(worker).includes('staging_path'), false);
  assert.equal(JSON.stringify(worker).includes('staging_paths'), false);
  assert.equal(JSON.stringify(worker).includes('output_path'), false);
  assert.deepEqual(Object.keys(worker.chapters[0]), [
    'unit',
    'number',
    'title',
    'source_file',
    'input_hash',
    'source_char_count',
    'attempt'
  ]);
  assert.equal(path.isAbsolute(worker.chapters[0].source_file), true);
});

test('job validation rejects worker writes and malformed submission identities', () => {
  const input = manifest([chapter(1, 1000)]);
  const mutations = [
    job => { job.worker_write_paths = [job.chapters[0].staging_path]; },
    job => { delete job.submissions[0].attempt; },
    job => { job.submissions[0].staging_path = job.chapters[0].staging_path; },
    job => { job.submissions[0].attempt = 2; },
    job => { job.output_path = job.chapters[0].staging_path; }
  ];

  for (const mutate of mutations) {
    const [job] = pack(input);
    mutate(job);
    assert.equal(validate(job, input).length > 0, true);
  }
});

test('worker projection refuses a job carrying an output-path field', () => {
  const input = manifest([chapter(1, 1000)]);
  const [job] = pack(input);
  job.chapters[0].output_path = job.chapters[0].staging_path;

  assert.throws(() => project(job), error => error.code === 'CHAPTER_JOB_PROJECTION_INVALID');
});

test('controller staging identity rejects a junction that escapes the selected run', t => {
  const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'game-kb-staging-junction-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const novel = path.join(root, '小说');
  const runId = 'run-junction-escape';
  const paths = pathsFor(novel, runId);
  const outside = path.join(root, 'outside');
  fs.mkdirSync(paths.run, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  try {
    fs.symlinkSync(outside, paths.staging, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    t.skip(`junction creation unavailable: ${error.code || error.message}`);
    return;
  }
  const input = {
    novel_dir: novel,
    run_id: runId,
    chapters: [{
      ...chapter(1, 1000),
      file: path.join(paths.sourceChapters, 'ch_001.txt')
    }]
  };

  assert.throws(() => pack(input), error => error.code === 'STAGING_PATH_ESCAPE');
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
    assert.equal(job.chapters.length <= 3, true);
    assert.equal(total <= 36000 || job.chapters.length === 1, true);
  }
});

test('custom packing options may lower but never raise the absolute worker limits', () => {
  const input = manifest([chapter(1, 10000), chapter(2, 10000), chapter(3, 10000)]);
  const raised = pack(input, { maxChapters: 3, maxCjkChars: 100000 });
  const lowered = pack(input, { maxChapters: 1, maxCjkChars: 20000 });

  assert.deepEqual(raised.map(job => job.chapters.map(item => item.number)), [[1, 2, 3]]);
  assert.equal(raised.every(job => job.chapters.length <= 3), true);
  assert.equal(raised.every(job => (
    job.chapters.length === 1
    || job.chapters.reduce((sum, item) => sum + item.source_char_count, 0) <= 36000
  )), true);
  assert.deepEqual(lowered.map(job => job.chapters.map(item => item.number)), [[1], [2], [3]]);
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
  const errors = validate({ batch_id: 'chapter-batch-001', chapters: [null], worker_write_paths: [], submissions: [{ unit: 'chapter:001', attempt: 1, input_hash: 'x' }] }, input);

  assert.deepEqual(errors, [{
    code: 'CHAPTER_DESCRIPTOR_INVALID',
    path: 'chapters[0]',
    target: ''
  }]);
});

test('packing derives one canonical current staging path instead of trusting manifest values', () => {
  const input = manifest([chapter(1, 1000)]);
  input.chapters[0].staging_paths = ['C:/outside/escape.yaml'];

  const [job] = pack(input);
  assert.equal(job.chapters[0].attempt, 1);
  assert.equal(job.chapters[0].staging_path,
    path.join(TEST_PATHS.staging, 'chapter_001_attempt_01.yaml'));
});

test('accept uses the canonical descriptor path when manifest staging paths are stale', () => {
  const novel = makeNovel('staging 路径试书', '第一章 起始\n甲。\n');
  const runId = 'run-staging-source';
  const prepared = runFlow(['prepare', novel, '--run', runId, '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);

  const paths = pathsFor(novel, runId);
  const preparedManifest = readJson(paths.manifest);
  preparedManifest.chapters[0].staging_paths = ['C:/outside/stale-attempt.yaml'];
  fs.writeFileSync(paths.manifest, `${JSON.stringify(preparedManifest, null, 2)}\n`, 'utf8');
  const [job] = pack(preparedManifest, { progress: readJson(paths.progress) });
  const descriptor = job.chapters[0];
  fs.writeFileSync(descriptor.staging_path, yaml.dump(validChapterDraft({
    source_hash: descriptor.input_hash,
    skills: []
  }), { noRefs: true, lineWidth: -1 }), 'utf8');

  const result = runFlow([
    'accept', novel, '--run', runId, '--unit', descriptor.unit,
    '--draft', descriptor.staging_path, '--json'
  ]);

  assert.equal(result.status, 0, result.stderr);
});

test('packing projects the second current attempt from controller progress', () => {
  const input = manifest([chapter(1, 1000)]);
  const progress = {
    units: {
      'chapter:001': {
        input_hash: input.chapters[0].input_hash,
        status: 'pending',
        attempts: 1
      }
    }
  };

  const [job] = pack(input, { progress });
  assert.equal(job.chapters[0].attempt, 2);
  assert.equal(job.chapters[0].staging_path,
    path.join(TEST_PATHS.staging, 'chapter_001_attempt_02.yaml'));
});

test('job validation rejects escaped, mismatched, and path-list descriptors', () => {
  const validManifest = manifest([chapter(1, 1000)]);
  const invalidDescriptors = [
    { staging_path: 'C:/outside/chapter_001_attempt_01.yaml' },
    { staging_path: path.join(TEST_PATHS.staging, 'chapter_001_attempt_02.yaml') },
    { attempt: 2 },
    { staging_paths: validManifest.chapters[0].staging_paths }
  ];

  for (const replacement of invalidDescriptors) {
    const [job] = pack(validManifest);
    Object.assign(job.chapters[0], replacement);
    const errors = validate(job, validManifest);
    assert.equal(errors.some(error => (
      error.path === 'chapters[0].staging_path'
      || error.path === 'chapters[0].attempt'
      || error.path === 'chapters[0].staging_paths'
    )), true);
  }
});

test('extraction prompt requires one YAML per chapter and forbids cross-chapter evidence', () => {
  const prompt = fs.readFileSync(path.resolve(__dirname, '..', 'prompts', 'extract-chapters.md'), 'utf8');
  assert.match(prompt, /每章一个文件/);
  assert.match(prompt, /不能把多个章节包在同一个 YAML/);
  assert.match(prompt, /禁止[^\n]*跨章节[^\n]*证据/);
});
