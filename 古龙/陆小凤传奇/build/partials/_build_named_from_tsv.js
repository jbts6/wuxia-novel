#!/usr/bin/env node
'use strict';
/**
 * Build named-inventory candidates from compact extraction rows.
 * Input JSON: [{window_id, name, category_hint, line_start, line_end?}, ...]
 * Or TSV lines: window_id\tcategory_hint\tname\tline_start[\tline_end]
 */
const fs = require('node:fs');
const path = require('node:path');

const batch = JSON.parse(fs.readFileSync('/tmp/lxf-batch-48-56.json', 'utf8'));
const byId = new Map(batch.windows.map(w => [w.id, w]));

function lineText(window, lineNo) {
  const idx = lineNo - window.line_start;
  const lines = window.text.split('\n');
  if (idx < 0 || idx >= lines.length) {
    throw new Error(`${window.id}: line ${lineNo} out of range ${window.line_start}-${window.line_end}`);
  }
  return lines[idx];
}

function buildCandidate(row, seq) {
  const w = byId.get(row.window_id);
  if (!w) throw new Error(`Unknown window ${row.window_id}`);
  const lineStart = Number(row.line_start);
  const lineEnd = Number(row.line_end || row.line_start);
  const parts = [];
  for (let ln = lineStart; ln <= lineEnd; ln++) {
    parts.push(lineText(w, ln));
  }
  const text = parts.join('\n');
  if (!text.includes(row.name) && !row.allow_missing_name) {
    // soft warn: name may be alias form
    console.warn(`WARN ${row.window_id} L${lineStart}: name "${row.name}" not found in text`);
  }
  const seq4 = String(seq).padStart(4, '0');
  return {
    candidate_id: `cand_${row.window_id}_${seq4}`,
    category_hint: row.category_hint,
    name: row.name,
    chapter: w.chapter,
    source_ref: { line_start: lineStart, line_end: lineEnd, text },
    discovery_pass: 'named-inventory',
    window_id: row.window_id,
  };
}

function parseInput(file) {
  const raw = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.json')) return JSON.parse(raw);
  const rows = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const parts = t.split('\t');
    if (parts.length < 4) throw new Error(`Bad TSV: ${t}`);
    rows.push({
      window_id: parts[0],
      category_hint: parts[1],
      name: parts[2],
      line_start: Number(parts[3]),
      line_end: parts[4] ? Number(parts[4]) : Number(parts[3]),
    });
  }
  return rows;
}

function main() {
  const inFile = process.argv[2];
  const outFile = process.argv[3];
  if (!inFile || !outFile) {
    console.error('Usage: build-named-from-tsv.js <input.tsv|json> <out.jsonl>');
    process.exit(1);
  }
  const rows = parseInput(inFile);
  const seqByWindow = new Map();
  const out = [];
  for (const row of rows) {
    const seq = (seqByWindow.get(row.window_id) || 0) + 1;
    seqByWindow.set(row.window_id, seq);
    out.push(buildCandidate(row, seq));
  }
  fs.writeFileSync(outFile, out.map(r => JSON.stringify(r)).join('\n') + (out.length ? '\n' : ''));
  console.log(JSON.stringify({
    rows: out.length,
    windows: seqByWindow.size,
    per_window: Object.fromEntries([...seqByWindow.entries()].sort()),
    out: outFile,
  }, null, 2));
}

main();
