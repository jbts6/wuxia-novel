#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { discoverChapterFiles, matchCompleteCitation, splitLines } = require('./lib/source');

function inferNovelDir(dialoguesFile, explicitDir) {
  if (explicitDir) return path.resolve(explicitDir);
  const parent = path.dirname(dialoguesFile);
  return path.basename(parent) === 'data' ? path.dirname(parent) : parent;
}

function verifyDialogues(dialoguesFile, explicitNovelDir = null) {
  const resolvedFile = path.resolve(dialoguesFile);
  const novelDir = inferNovelDir(resolvedFile, explicitNovelDir);
  const chapters = new Map(discoverChapterFiles(novelDir).map(entry => [
    entry.chapter,
    splitLines(fs.readFileSync(entry.file, 'utf8'))
  ]));
  const dialogues = JSON.parse(fs.readFileSync(resolvedFile, 'utf8'));
  if (!Array.isArray(dialogues)) throw new Error('dialogues JSON must be an array');

  const results = dialogues.map((dialogue, index) => {
    const lines = chapters.get(Number(dialogue.chapter));
    if (!lines) {
      return { index, id: dialogue.id ?? null, status: 'missing_chapter', matched: false };
    }
    const match = matchCompleteCitation(lines, dialogue.text, {
      lineStart: dialogue.line_start,
      lineEnd: dialogue.line_end ?? dialogue.line_start
    });
    return {
      index,
      id: dialogue.id ?? null,
      chapter: dialogue.chapter,
      status: match.matched ? 'grounded' : match.reason,
      ...match
    };
  });
  const grounded = results.filter(result => result.matched).length;
  return {
    generated_at: new Date().toISOString(),
    total: results.length,
    grounded,
    unverified: results.length - grounded,
    grounded_ratio: results.length ? grounded / results.length : 0,
    results
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2) {
    console.error('Usage: node verify_dialogues.js <dialogues-json-file> [novel-dir]');
    process.exit(1);
  }
  try {
    const report = verifyDialogues(args[0], args[1]);
    console.log(`Dialogues grounded: ${report.grounded}/${report.total}`);
    for (const result of report.results.filter(item => !item.matched).slice(0, 20)) {
      console.log(`- #${result.index} chapter ${result.chapter ?? '?'}: ${result.status}`);
    }
    if (report.unverified > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { inferNovelDir, verifyDialogues };
