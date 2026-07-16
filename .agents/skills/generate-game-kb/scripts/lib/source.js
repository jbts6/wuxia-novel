'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { atomicWriteJson, writeFileIfChanged } = require('./io');
const { pathsFor } = require('./paths');
const { loadProgress } = require('./progress');

const CHAPTER_HEADING = /^第[零〇一二三四五六七八九十百千两\d]+(?:章|回|节|卷)(?:\s+.*|[^\s]*)?$/;
const BARE_CHAPTER_HEADING = /^(?:[一二三四五六七八九十]{1,3}|\d{1,3})$/;
const CHINESE_DIGITS = Object.freeze({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 });

function bareChapterNumber(value) {
  if (!BARE_CHAPTER_HEADING.test(value)) return null;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === '十') return 10;
  const ten = value.indexOf('十');
  if (ten < 0) return CHINESE_DIGITS[value] ?? null;
  const tens = ten === 0 ? 1 : CHINESE_DIGITS[value.slice(0, ten)];
  const ones = ten === value.length - 1 ? 0 : CHINESE_DIGITS[value.slice(ten + 1)];
  return tens && ones !== undefined ? (tens * 10) + ones : null;
}

function sequentialBareChapterStarts(lines) {
  const candidates = lines.map((line, index) => ({ index, number: bareChapterNumber(line.trim()) }))
    .filter(entry => entry.number !== null);
  if (candidates.length < 2) return [];
  if (!candidates.every((entry, index) => entry.number === index + 1)) return [];
  return candidates.map(entry => entry.index);
}

function normalizeSource(value) {
  const normalized = String(value).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function splitChapters(sourceText, fallbackTitle = '第一章') {
  const source = normalizeSource(sourceText);
  const lines = source.split('\n');
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (CHAPTER_HEADING.test(lines[index].trim())) starts.push(index);
  }
  if (starts.length === 0) starts.push(...sequentialBareChapterStarts(lines));

  if (starts.length === 0) {
    return [{ number: 1, title: fallbackTitle, content: source }];
  }

  return starts.map((start, index) => {
    const from = index === 0 ? 0 : start;
    const to = starts[index + 1] ?? lines.length - 1;
    const content = `${lines.slice(from, to).join('\n').replace(/\n+$/g, '')}\n`;
    return {
      number: index + 1,
      title: lines[start].trim(),
      content
    };
  });
}

function discoverSource(novelDir) {
  const novel = path.resolve(novelDir);
  if (!fs.existsSync(novel) || !fs.statSync(novel).isDirectory()) {
    throw new GameKbError('NOVEL_DIR_MISSING', 'Novel directory does not exist', { novel });
  }

  const preferred = path.join(novel, `${path.basename(novel)}.txt`);
  if (fs.existsSync(preferred) && fs.statSync(preferred).isFile()) return preferred;

  const candidates = fs.readdirSync(novel, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.txt'))
    .map(entry => path.join(novel, entry.name))
    .sort();
  if (candidates.length === 0) {
    throw new GameKbError('SOURCE_MISSING', 'No root novel text file found', { novel });
  }
  if (candidates.length > 1) {
    throw new GameKbError('SOURCE_AMBIGUOUS', 'Multiple root novel text files found', {
      candidates: candidates.map(file => path.basename(file))
    });
  }
  return candidates[0];
}

function prepareNovel(novelDir, options = {}) {
  const run = options.runId
    ? { run_id: options.runId }
    : require('./run').createOrResumeRun(novelDir, options);
  const paths = pathsFor(novelDir, run.run_id);
  const sourceFile = discoverSource(paths.novel);
  const source = normalizeSource(fs.readFileSync(sourceFile, 'utf8'));
  const chapters = splitChapters(source, path.basename(paths.novel));
  writeFileIfChanged(paths.sourceOriginal, source);
  const manifestChapters = chapters.map(chapter => {
    const file = path.join(paths.sourceChapters, `ch_${String(chapter.number).padStart(3, '0')}.txt`);
    writeFileIfChanged(file, chapter.content);
    return {
      number: chapter.number,
      title: chapter.title,
      file,
      input_hash: sha256(chapter.content)
    };
  });

  const manifest = {
    schema_version: 1,
    run_id: run.run_id,
    novel_dir: paths.novel,
    source_file: sourceFile,
    source_snapshot: paths.sourceOriginal,
    source_hash: sha256(source),
    source_char_count: (source.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length,
    chapters: manifestChapters,
    prepared_at: new Date().toISOString()
  };
  atomicWriteJson(paths.manifest, manifest);
  loadProgress(paths, manifest);
  return manifest;
}

module.exports = {
  CHAPTER_HEADING,
  discoverSource,
  normalizeSource,
  prepareNovel,
  sha256,
  splitChapters
};
