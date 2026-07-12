#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = JSON.parse(fs.readFileSync(path.join(root, 'source-index.json'), 'utf8'));
const man = JSON.parse(fs.readFileSync(path.join(root, 'scan-manifest.json'), 'utf8'));
const wins = src.windows.filter(w => w.chapter >= 48 && w.chapter <= 56);
const done = new Set(man.passes['named-inventory'].completed_window_ids || []);

console.log('count', wins.length);
const by = {};
for (const w of wins) {
  by[w.chapter] = (by[w.chapter] || 0) + 1;
  console.log(w.id, w.chapter, w.line_start, w.line_end, w.text.length, done.has(w.id) ? 'DONE' : 'todo');
}
console.log('by chapter', JSON.stringify(by));
console.log('named completed total', done.size);
console.log('already done in range', wins.filter(w => done.has(w.id)).length);

fs.writeFileSync('/tmp/lxf-batch-48-56.json', JSON.stringify({ windows: wins }, null, 2));
fs.writeFileSync('/tmp/lxf-batch-48-56-meta.json', JSON.stringify({
  windows: wins.map(w => ({
    id: w.id,
    chapter: w.chapter,
    line_start: w.line_start,
    line_end: w.line_end,
    chars: w.text.length,
    done: done.has(w.id),
  })),
  count: wins.length,
}, null, 2));

// also dump each window text for offline reading
const dumpDir = path.join(__dirname, '_win_ch048-056');
fs.mkdirSync(dumpDir, { recursive: true });
for (const w of wins) {
  fs.writeFileSync(
    path.join(dumpDir, `${w.id}.txt`),
    `ID: ${w.id}\nCHAPTER: ${w.chapter}\nLINES: ${w.line_start}-${w.line_end}\n\n${w.text}`
  );
}
console.log('wrote', wins.length, 'window dumps to', dumpDir);
