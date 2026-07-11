#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: compact-mention.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);
const jsonlPath = path.join(novelDir, 'build', 'mention_index.jsonl');
if (!fs.existsSync(jsonlPath)) {
  console.error(`mention_index.jsonl not found; run split-chapters.js first`);
  process.exit(1);
}

const byTerm = new Map();
let lineCount = 0;
for (const raw of fs.readFileSync(jsonlPath, 'utf8').split(/\r?\n/)) {
  if (!raw) continue;
  lineCount++;
  try {
    const { term, chapter, line, snippet } = JSON.parse(raw);
    if (!byTerm.has(term)) byTerm.set(term, { total: 0, chapters: new Map(), firstSnippet: snippet, firstLine: { chapter, line } });
    const t = byTerm.get(term);
    t.total++;
    t.chapters.set(chapter, (t.chapters.get(chapter) || 0) + 1);
  } catch {}
}

const compact = {
  generated_from: 'mention_index.jsonl',
  total_entries: lineCount,
  unique_terms: byTerm.size,
  terms: [...byTerm.entries()]
    .map(([term, t]) => ({
      term,
      total: t.total,
      chapter_count: t.chapters.size,
      per_chapter: [...t.chapters.entries()].sort((a, b) => a[0] - b[0]).map(([ch, c]) => ({ ch, c })),
      first_seen: t.firstLine,
      sample_snippet: t.firstSnippet ? (t.firstSnippet.length > 120 ? t.firstSnippet.slice(0, 120) + '…' : t.firstSnippet) : null,
    }))
    .sort((a, b) => b.total - a.total),
};

const outPath = path.join(novelDir, 'mention_summary.json');
fs.writeFileSync(outPath, JSON.stringify(compact, null, 2), 'utf8');
console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
console.log(`unique terms: ${compact.unique_terms}`);
console.log(`top 20:`);
for (const t of compact.terms.slice(0, 20)) {
  console.log(`  ${t.term}\ttotal=${t.total}\tchapters=${t.chapter_count}`);
}
