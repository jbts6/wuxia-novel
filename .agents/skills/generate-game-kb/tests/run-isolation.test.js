'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, readJson } = require('./helpers');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun, resolveRun } = require('../scripts/lib/run');
const { prepareNovel } = require('../scripts/lib/source');

test('run metadata and artifact paths are scoped below the explicit run id', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');

  const first = createOrResumeRun(novel, { runId: 'run-a' });
  const second = createOrResumeRun(novel, { runId: 'run-b' });

  assert.equal(first.run_id, 'run-a');
  assert.equal(second.run_id, 'run-b');
  assert.equal(first.run_dir, path.join(novel, '.game-kb-work', 'runs', 'run-a'));
  assert.equal(second.run_dir, path.join(novel, '.game-kb-work', 'runs', 'run-b'));
  assert.notEqual(first.run_dir, second.run_dir);
  assert.match(first.source_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(readJson(path.join(first.run_dir, 'run.json')).run_id, 'run-a');
  assert.match(readJson(path.join(first.run_dir, 'run.json')).started_at, /^\d{4}-\d{2}-\d{2}T/);

  const firstPaths = pathsFor(novel, 'run-a');
  const secondPaths = pathsFor(novel, 'run-b');
  for (const key of ['manifest', 'progress', 'manualReview', 'sourceChapters', 'drafts', 'chapters', 'merged', 'cleaned', 'finalData']) {
    assert.equal(firstPaths[key].startsWith(first.run_dir), true, `${key} escaped run-a`);
    assert.equal(secondPaths[key].startsWith(second.run_dir), true, `${key} escaped run-b`);
  }
});

test('creating or resuming a run provides a durable run-scoped staging directory', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  const first = createOrResumeRun(novel, { runId: 'run-a' });
  const paths = pathsFor(novel, 'run-a');

  assert.equal(paths.staging, path.join(first.run_dir, 'staging'));
  assert.equal(fs.statSync(paths.staging).isDirectory(), true);

  fs.rmSync(paths.staging, { recursive: true });
  const resumed = createOrResumeRun(novel, { runId: 'run-a' });
  assert.equal(resumed.resumed, true);
  assert.equal(fs.statSync(paths.staging).isDirectory(), true);
});

test('implicit run resolution rejects multiple eligible runs', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  createOrResumeRun(novel, { runId: 'run-a' });
  createOrResumeRun(novel, { runId: 'run-b' });

  assert.throws(() => resolveRun(novel), error => error.code === 'RUN_AMBIGUOUS');
  assert.equal(resolveRun(novel, 'run-a').run_id, 'run-a');
});

test('a single matching run resumes without changing started_at', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  const first = createOrResumeRun(novel, { runId: 'run-a' });
  const firstMetadata = readJson(path.join(first.run_dir, 'run.json'));

  const resumed = createOrResumeRun(novel, { runId: 'run-a' });
  const resumedMetadata = readJson(path.join(resumed.run_dir, 'run.json'));

  assert.equal(resumed.resumed, true);
  assert.equal(resumedMetadata.started_at, firstMetadata.started_at);
  assert.equal(resumed.source_hash, first.source_hash);
});

test('changed source cannot resume an existing run', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  createOrResumeRun(novel, { runId: 'run-a' });
  fs.appendFileSync(path.join(novel, '试书.txt'), '新增正文。\n');

  assert.throws(
    () => createOrResumeRun(novel, { runId: 'run-a' }),
    error => error.code === 'RUN_SOURCE_CHANGED'
  );
});

test('a run snapshot ignores root artifacts and adjacent-run files', () => {
  const novel = makeNovel('试书', '第一章 起始\n真实正文。\n');
  for (const directory of ['build', 'data', 'reports', 'review', 'prompts']) {
    fs.mkdirSync(path.join(novel, directory), { recursive: true });
    fs.writeFileSync(path.join(novel, directory, 'poison.txt'), '不应读取的旧事实\n');
  }
  const first = createOrResumeRun(novel, { runId: 'run-a' });
  const second = createOrResumeRun(novel, { runId: 'run-b' });
  prepareNovel(novel, { runId: 'run-a' });
  fs.writeFileSync(path.join(second.run_dir, 'poison.txt'), '不应读取的相邻 run\n');

  const firstManifest = readJson(path.join(first.run_dir, 'manifest.json'));
  const firstChapter = fs.readFileSync(firstManifest.chapters[0].file, 'utf8');

  assert.match(firstChapter, /真实正文/);
  assert.doesNotMatch(firstChapter, /不应读取/);
  assert.equal(firstManifest.chapters[0].file.startsWith(first.run_dir), true);
});
