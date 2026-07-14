'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, makeNovelDirectory } = require('./helpers');
const { prepareNovel, splitChapters } = require('../scripts/lib/source');

test('prepare splits CRLF Chinese chapter headings and hashes normalized content', () => {
  const novel = makeNovel('试书', '第一章 起始\r\n甲。\r\n第二章 转折\r\n乙。');
  const manifest = prepareNovel(novel);

  assert.equal(manifest.chapters.length, 2);
  assert.equal(fs.readFileSync(manifest.chapters[0].file, 'utf8'), '第一章 起始\n甲。\n');
  assert.match(manifest.source_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(manifest.chapters[0].input_hash, /^sha256:[a-f0-9]{64}$/);
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

test('prepare does not rewrite unchanged chapter files', async () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const first = prepareNovel(novel);
  const mtime = fs.statSync(first.chapters[0].file).mtimeMs;
  await new Promise(resolve => setTimeout(resolve, 20));
  const second = prepareNovel(novel);

  assert.equal(second.chapters[0].input_hash, first.chapters[0].input_hash);
  assert.equal(fs.statSync(second.chapters[0].file).mtimeMs, mtime);
});
