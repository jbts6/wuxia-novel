'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, makeNovelDirectory, runFlow } = require('./helpers');
const { prepareNovel, splitChapters } = require('../scripts/lib/source');
const { pathsFor } = require('../scripts/lib/paths');
const { readTimingEvents } = require('../scripts/lib/timing-events');

test('prepare splits CRLF Chinese chapter headings and hashes normalized content', () => {
  const novel = makeNovel('试书', '第一章 起始\r\n甲。\r\n第二章 转折\r\n乙。');
  const manifest = prepareNovel(novel);

  assert.equal(manifest.chapters.length, 2);
  assert.equal(fs.readFileSync(manifest.chapters[0].file, 'utf8'), '第一章 起始\n甲。\n');
  assert.match(manifest.source_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(manifest.chapters[0].input_hash, /^sha256:[a-f0-9]{64}$/);
  const events = readTimingEvents(pathsFor(novel, manifest.run_id).events);
  assert.deepEqual(events.map(event => event.type), [
    'run_started', 'source_prepare_started', 'source_prepared'
  ]);
});

test('prepare treats a headingless novella as one chapter', () => {
  const novel = makeNovel('短篇', '越女临江。\n故事结束。');
  const manifest = prepareNovel(novel);

  assert.equal(manifest.chapters.length, 1);
  assert.equal(manifest.chapters[0].number, 1);
  assert.equal(manifest.chapters[0].title, '短篇');
});

test('prepare rejects ambiguous root source files', () => {
  const novel = makeNovelDirectory({ '甲.txt': '甲', '乙.txt': '乙' });

  assert.throws(() => prepareNovel(novel), { code: 'SOURCE_AMBIGUOUS' });
});

test('prepare prefers a source named after the novel directory', () => {
  const novel = makeNovelDirectory({ '试书.txt': '正文', '附录.txt': '附录' });
  const manifest = prepareNovel(novel);

  assert.equal(path.basename(manifest.source_file), '试书.txt');
});

test('split attaches source preamble to the first numbered chapter', () => {
  const chapters = splitChapters('书名\n作者\n第一章 起始\n甲。\n第二章 转折\n乙。\n', '试书');

  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, 1);
  assert.match(chapters[0].content, /^书名\n作者\n第一章 起始/);
});

test('split recognizes a sequential series of bare Chinese numeral chapter headings', () => {
  const chapters = splitChapters('一\n甲。\n二\n乙。\n三\n丙。\n', '试书');

  assert.equal(chapters.length, 3);
  assert.deepEqual(chapters.map(chapter => chapter.title), ['一', '二', '三']);
  assert.equal(chapters[1].content, '二\n乙。\n');
});

test('prepare refreshes unissued chapters into v7 pending progress without transport paths', () => {
  const novel = makeNovel('试书', '尚未识别章节。\n');
  const first = prepareNovel(novel);
  fs.writeFileSync(path.join(novel, '试书.txt'), '一\n甲。\n二\n乙。\n', 'utf8');

  const second = prepareNovel(novel, { runId: first.run_id });
  const progress = JSON.parse(fs.readFileSync(path.join(
    novel, '.game-kb-work', 'runs', first.run_id, 'progress.json'
  ), 'utf8'));

  assert.equal(second.chapters.length, 2);
  assert.equal(Object.hasOwn(second.chapters[0], 'staging_paths'), false);
  assert.equal(progress.schema_version, 7);
  assert.deepEqual(progress.active_units, []);
  assert.equal(progress.units['chapter:001'].status, 'pending');
  assert.equal(progress.units['chapter:001'].cycle, 0);
  assert.equal(progress.units['chapter:001'].attempt, 0);
  assert.equal(progress.units['chapter:001'].input_hash, null);
  assert.equal(progress.units['chapter:002'].status, 'pending');

  progress.units['chapter:001'].status = 'stale';
  fs.writeFileSync(path.join(
    novel, '.game-kb-work', 'runs', first.run_id, 'progress.json'
  ), `${JSON.stringify(progress)}\n`, 'utf8');
  prepareNovel(novel, { runId: first.run_id });
  const refreshed = JSON.parse(fs.readFileSync(path.join(
    novel, '.game-kb-work', 'runs', first.run_id, 'progress.json'
  ), 'utf8'));
  assert.equal(refreshed.units['chapter:001'].status, 'pending');
});

test('prepare does not rewrite unchanged chapter files', async () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const first = prepareNovel(novel);
  const events = pathsFor(novel, first.run_id).events;
  const eventBytes = fs.readFileSync(events, 'utf8');
  const mtime = fs.statSync(first.chapters[0].file).mtimeMs;
  await new Promise(resolve => setTimeout(resolve, 20));
  const second = prepareNovel(novel);

  assert.equal(second.chapters[0].input_hash, first.chapters[0].input_hash);
  assert.equal(fs.statSync(second.chapters[0].file).mtimeMs, mtime);
  assert.equal(fs.readFileSync(events, 'utf8'), eventBytes);
});

test('run recovery completes a persisted source preparation event without duplicating its start', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const manifest = prepareNovel(novel);
  const eventsFile = pathsFor(novel, manifest.run_id).events;
  const events = readTimingEvents(eventsFile);
  fs.writeFileSync(eventsFile, `${events.slice(0, 2).map(event => JSON.stringify(event)).join('\n')}\n`);

  const resumed = runFlow(['run', novel, '--run', manifest.run_id, '--json']);
  assert.equal(resumed.status, 0, resumed.stderr);
  const recovered = readTimingEvents(eventsFile);
  assert.deepEqual(recovered.slice(0, 3).map(event => event.type), [
    'run_started', 'source_prepare_started', 'source_prepared'
  ]);
  assert.equal(recovered[2].occurred_at, manifest.prepared_at);
  assert.equal(recovered.filter(event => event.type === 'source_prepare_started').length, 1);
});
