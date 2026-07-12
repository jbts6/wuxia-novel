#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function normalizeNewlines(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n');
}

function normalizeCitation(text) {
  return normalizeNewlines(text).normalize('NFKC').replace(/\s+/gu, '');
}

function hashText(text) {
  return crypto.createHash('sha256').update(normalizeNewlines(text), 'utf8').digest('hex');
}

function splitLines(text) {
  const lines = normalizeNewlines(text).split('\n');
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();
  return lines;
}

function discoverChapterFiles(novelDir) {
  const splitDir = path.join(novelDir, 'ch_split');
  if (!fs.existsSync(splitDir)) {
    throw new Error(`Missing chapter directory: ${splitDir}`);
  }

  return fs.readdirSync(splitDir)
    .map(filename => {
      const match = /^ch_(\d+)\.txt$/i.exec(filename);
      return match ? { filename, chapter: Number(match[1]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.chapter - b.chapter)
    .map(entry => ({ ...entry, file: path.join(splitDir, entry.filename) }));
}

function findOriginalSource(novelDir) {
  const exact = path.join(novelDir, `${path.basename(novelDir)}.txt`);
  if (fs.existsSync(exact)) return exact;

  const textFiles = fs.readdirSync(novelDir)
    .filter(filename => filename.toLowerCase().endsWith('.txt'))
    .sort();
  return textFiles.length === 1 ? path.join(novelDir, textFiles[0]) : null;
}

function makeWindows(chapter, lines, windowLines, overlapLines) {
  if (lines.length === 0) return [];
  const step = windowLines - overlapLines;
  const windows = [];

  for (let start = 0, number = 1; start < lines.length; start += step, number += 1) {
    const end = Math.min(start + windowLines, lines.length);
    windows.push({
      id: `ch${String(chapter).padStart(3, '0')}_w${String(number).padStart(3, '0')}`,
      chapter,
      line_start: start + 1,
      line_end: end,
      text: lines.slice(start, end).join('\n')
    });
    if (end === lines.length) break;
  }
  return windows;
}

function chaptersAlignWithSource(sourceText, chapters) {
  const source = normalizeNewlines(sourceText);
  let cursor = 0;
  for (const chapter of chapters) {
    const text = chapter.lines.join('\n').trim();
    if (!text) continue;
    const offset = source.indexOf(text, cursor);
    if (offset === -1) return false;
    cursor = offset + text.length;
  }
  return true;
}

function buildSourceIndex(novelDir, options = {}) {
  const windowLines = Number(options.windowLines ?? 120);
  const overlapLines = Number(options.overlapLines ?? 20);
  if (!Number.isInteger(windowLines) || windowLines < 1) {
    throw new Error('windowLines must be a positive integer');
  }
  if (!Number.isInteger(overlapLines) || overlapLines < 0 || overlapLines >= windowLines) {
    throw new Error('overlapLines must be an integer smaller than windowLines');
  }

  const files = discoverChapterFiles(novelDir);
  if (files.length === 0) throw new Error(`No ch_NNN.txt files found in ${novelDir}`);

  const chapters = files.map(entry => {
    const text = normalizeNewlines(fs.readFileSync(entry.file, 'utf8'));
    const lines = splitLines(text);
    return {
      chapter: entry.chapter,
      file: path.relative(novelDir, entry.file),
      line_count: lines.length,
      sha256: hashText(text),
      lines
    };
  });
  const chapterCorpus = chapters
    .map(chapter => `@@chapter:${chapter.chapter}\n${chapter.lines.join('\n')}`)
    .join('\n');
  const originalFile = findOriginalSource(novelDir);
  const sourceText = originalFile
    ? fs.readFileSync(originalFile, 'utf8')
    : chapterCorpus;
  const windows = chapters.flatMap(chapter =>
    makeWindows(chapter.chapter, chapter.lines, windowLines, overlapLines)
  );

  return {
    schema_version: 1,
    novel: path.basename(novelDir),
    source_file: originalFile ? path.relative(novelDir, originalFile) : null,
    source_hash: hashText(sourceText),
    chapter_corpus_hash: hashText(chapterCorpus),
    source_alignment_valid: originalFile ? chaptersAlignWithSource(sourceText, chapters) : true,
    window_lines: windowLines,
    overlap_lines: overlapLines,
    chapters: chapters.map(({ lines, ...chapter }) => chapter),
    windows
  };
}

function normalizedTextWithLineMap(lines, startIndex, endIndex) {
  let text = '';
  const lineMap = [];
  for (let index = startIndex; index < endIndex; index += 1) {
    const normalized = String(lines[index] ?? '').normalize('NFKC');
    for (const character of normalized) {
      if (/\s/u.test(character)) continue;
      text += character;
      lineMap.push(index + 1);
    }
  }
  return { text, lineMap };
}

function matchCompleteCitation(inputLines, citation, options = {}) {
  const lines = Array.isArray(inputLines) ? inputLines.map(String) : splitLines(inputLines);
  const needle = normalizeCitation(citation);
  if (!needle) return { matched: false, reason: 'empty_citation' };

  const startIndex = Math.max(0, Number(options.lineStart ?? 1) - 1);
  const endIndex = Math.min(lines.length, Number(options.lineEnd ?? lines.length));
  if (endIndex <= startIndex) return { matched: false, reason: 'invalid_line_range' };

  const normalized = normalizedTextWithLineMap(lines, startIndex, endIndex);
  const offset = normalized.text.indexOf(needle);
  if (offset === -1) return { matched: false, reason: 'citation_not_found' };

  return {
    matched: true,
    line_start: normalized.lineMap[offset],
    line_end: normalized.lineMap[offset + needle.length - 1]
  };
}

function verifySourceRef(lines, ref) {
  if (!ref || typeof ref.text !== 'string') {
    return { matched: false, reason: 'missing_source_text' };
  }
  return matchCompleteCitation(lines, ref.text, {
    lineStart: ref.line_start,
    lineEnd: ref.line_end
  });
}

module.exports = {
  buildSourceIndex,
  chaptersAlignWithSource,
  discoverChapterFiles,
  findOriginalSource,
  hashText,
  matchCompleteCitation,
  normalizeCitation,
  normalizeNewlines,
  splitLines,
  verifySourceRef
};
