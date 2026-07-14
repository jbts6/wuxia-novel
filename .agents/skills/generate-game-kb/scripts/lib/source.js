'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { atomicWriteJson, writeFileIfChanged } = require('./io');
const { pathsFor } = require('./paths');
const { loadProgress } = require('./progress');

const CHAPTER_HEADING = /^第[零〇一二三四五六七八九十百千两\d]+(?:章|回|节|卷)(?:\s+.*|[^\s]*)?$/;

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

function prepareNovel(novelDir) {
  const paths = pathsFor(novelDir);
  const sourceFile = discoverSource(paths.novel);
  const source = normalizeSource(fs.readFileSync(sourceFile, 'utf8'));
  const chapters = splitChapters(source, path.basename(paths.novel));
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
    novel_dir: paths.novel,
    source_file: sourceFile,
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
