'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, readJson } = require('./helpers');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun, resolveRun } = require('../scripts/lib/run');
const { SEMANTIC_CONTRACT_VERSION } = require('../scripts/lib/semantic-contract');
const { prepareNovel } = require('../scripts/lib/source');
const { TIMING_CONTRACT_VERSION, readTimingEvents } = require('../scripts/lib/timing-events');

const RUN_SCOPED_PATHS = [
  'runJson',
  'events',
  'manifest',
  'artifactManifest',
  'progress',
  'manualReview',
  'tasks',
  'revisions',
  'sourceOriginal',
  'sourceChapters',
  'staging',
  'drafts',
  'accepted',
  'chapters',
  'candidateRegistry',
  'reports',
  'runMetrics',
  'finalRoot',
  'finalIdPlan',
  'finalData',
  'finalReports',
  'assemblyReport',
  'verificationReport',
  'reviewReport'
];

function isWithin(parent, candidate) {
  if (typeof candidate !== 'string') return false;
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

test('fast-path metadata and artifact paths are scoped below the explicit run id', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  const first = createOrResumeRun(novel, { runId: 'run-a' });
  const second = createOrResumeRun(novel, { runId: 'run-b' });

  assert.equal(first.run_dir, path.join(novel, '.game-kb-work', 'runs', 'run-a'));
  assert.equal(second.run_dir, path.join(novel, '.game-kb-work', 'runs', 'run-b'));
  assert.notEqual(first.run_dir, second.run_dir);
  const metadata = readJson(path.join(first.run_dir, 'run.json'));
  assert.equal(metadata.run_id, 'run-a');
  assert.equal(metadata.semantic_contract_version, SEMANTIC_CONTRACT_VERSION);
  assert.equal(metadata.semantic_profile, 'chapter-direct-v1');
  assert.equal(metadata.timing_contract_version, TIMING_CONTRACT_VERSION);
  assert.match(metadata.source_hash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(readTimingEvents(pathsFor(novel, 'run-a').events).map(event => event.type), [
    'run_started'
  ]);

  const firstPaths = pathsFor(novel, 'run-a');
  const secondPaths = pathsFor(novel, 'run-b');
  for (const key of RUN_SCOPED_PATHS) {
    assert.equal(firstPaths[key].startsWith(first.run_dir), true, `${key} escaped run-a`);
    assert.equal(secondPaths[key].startsWith(second.run_dir), true, `${key} escaped run-b`);
  }
});

test('v7 direct chapter paths stay inside the run directory', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  const paths = pathsFor(novel, 'run-lite');

  for (const key of ['tasks', 'staging', 'drafts', 'revisions', 'accepted']) {
    assert.equal(isWithin(paths.run, paths[key]), true, key);
  }
});

test('creating or resuming a current run restores only durable current work directories', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  createOrResumeRun(novel, { runId: 'run-a' });
  const paths = pathsFor(novel, 'run-a');

  for (const directory of [paths.staging]) {
    assert.equal(fs.statSync(directory).isDirectory(), true);
    fs.rmSync(directory, { recursive: true });
  }

  const resumed = createOrResumeRun(novel, { runId: 'run-a' });
  assert.equal(resumed.resumed, true);
  for (const directory of [paths.staging]) {
    assert.equal(fs.statSync(directory).isDirectory(), true);
  }
});

test('implicit resolution rejects adjacent eligible runs while explicit ids remain isolated', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  createOrResumeRun(novel, { runId: 'run-a' });
  createOrResumeRun(novel, { runId: 'run-b' });

  assert.throws(() => resolveRun(novel), error => error.code === 'RUN_AMBIGUOUS');
  assert.equal(resolveRun(novel, 'run-a').run_id, 'run-a');
  assert.equal(resolveRun(novel, 'run-b').run_id, 'run-b');
});

test('a single matching current run resumes without changing started_at', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  const first = createOrResumeRun(novel, { runId: 'run-a' });
  const firstMetadata = readJson(path.join(first.run_dir, 'run.json'));
  const events = pathsFor(novel, 'run-a').events;
  const firstEvents = fs.readFileSync(events, 'utf8');

  const resumed = createOrResumeRun(novel, { runId: 'run-a' });
  const resumedMetadata = readJson(path.join(resumed.run_dir, 'run.json'));

  assert.equal(resumed.resumed, true);
  assert.equal(resumedMetadata.started_at, firstMetadata.started_at);
  assert.equal(resumed.source_hash, first.source_hash);
  assert.equal(fs.readFileSync(events, 'utf8'), firstEvents);
  assert.equal(readTimingEvents(events).length, 1);
});

test('a new timing-contract run fails closed when its event file is lost after prepare', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  const created = createOrResumeRun(novel, { runId: 'run-a' });
  prepareNovel(novel, { runId: created.run_id });
  const events = pathsFor(novel, created.run_id).events;
  fs.rmSync(events);

  assert.throws(
    () => createOrResumeRun(novel, { runId: created.run_id }),
    error => error.code === 'TIMING_EVENTS_INVALID'
  );
  assert.equal(fs.existsSync(events), false);
});

test('changed source cannot resume an existing current run', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  createOrResumeRun(novel, { runId: 'run-a' });
  fs.appendFileSync(path.join(novel, '试书.txt'), '新增正文。\n');

  assert.throws(
    () => createOrResumeRun(novel, { runId: 'run-a' }),
    error => error.code === 'RUN_SOURCE_CHANGED'
  );
});

test('a current run snapshot ignores root artifacts and adjacent-run files', () => {
  const novel = makeNovel('试书', '第一章 起始\n真实正文。\n');
  for (const directory of ['build', 'data', 'reports', 'review', 'prompts']) {
    fs.mkdirSync(path.join(novel, directory), { recursive: true });
    fs.writeFileSync(path.join(novel, directory, 'poison.txt'), '不应读取的旧事实\n');
  }
  const first = createOrResumeRun(novel, { runId: 'run-a' });
  const second = createOrResumeRun(novel, { runId: 'run-b' });
  prepareNovel(novel, { runId: 'run-a' });
  fs.writeFileSync(path.join(second.run_dir, 'poison.txt'), '不应读取的相邻 run\n');

  const manifest = readJson(path.join(first.run_dir, 'manifest.json'));
  const chapter = fs.readFileSync(manifest.chapters[0].file, 'utf8');
  assert.match(chapter, /真实正文/);
  assert.doesNotMatch(chapter, /不应读取/);
  assert.equal(manifest.chapters[0].file.startsWith(first.run_dir), true);
});

test('a legacy v4 run rejects writes under the fast-path contract', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  const created = createOrResumeRun(novel, { runId: 'run-v4' });
  const runJson = path.join(created.run_dir, 'run.json');
  const metadata = readJson(runJson);
  metadata.semantic_contract_version = 4;
  fs.writeFileSync(runJson, `${JSON.stringify(metadata, null, 2)}\n`);

  assert.throws(
    () => createOrResumeRun(novel, { runId: 'run-v4' }),
    error => error.code === 'LEGACY_SEMANTIC_CONTRACT'
  );
});
