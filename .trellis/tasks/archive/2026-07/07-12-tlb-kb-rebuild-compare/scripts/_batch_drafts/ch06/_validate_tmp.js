#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const base = __dirname;
const winDir = path.join(base, 'windows');

function loadWindow(wid) {
  const raw = fs.readFileSync(path.join(winDir, `${wid}.txt`), 'utf8');
  return raw.split(/\r?\n/).map(line => {
    const idx = line.indexOf('|');
    return idx >= 0 && idx < 8 ? line.slice(idx + 1) : line;
  }).join('\n');
}

const wins = {};
for (const f of fs.readdirSync(winDir).filter(x => x.startsWith('ch006_w') && x.endsWith('.txt'))) {
  wins[f.replace(/\.txt$/, '')] = loadWindow(f.replace(/\.txt$/, ''));
}

const errors = [];
const counts = { named: 0, event: 0 };
for (const fname of ['named.jsonl', 'event.jsonl']) {
  const lines = fs.readFileSync(path.join(base, fname), 'utf8').split(/\r?\n/).filter(Boolean);
  lines.forEach((line, i) => {
    let o;
    try { o = JSON.parse(line); } catch (e) {
      errors.push(`${fname}:${i + 1} JSON parse: ${e.message}`);
      return;
    }
    counts[fname.startsWith('named') ? 'named' : 'event'] += 1;
    const wid = o.window_id;
    if (!wins[wid]) {
      errors.push(`${fname}:${i + 1} unknown window ${wid}`);
      return;
    }
    const text = (o.source_ref && o.source_ref.text) || '';
    if (!wins[wid].includes(text)) {
      errors.push(`${fname}:${i + 1} ${o.candidate_id} source NOT in ${wid}: ${JSON.stringify(text.slice(0, 80))}`);
    }
    if (o.category_hint === 'dialogue') {
      const ctx = (o.context_source_ref && o.context_source_ref.text) || '';
      if (!ctx) errors.push(`${fname}:${i + 1} ${o.candidate_id} missing context`);
      else if (!wins[wid].includes(ctx)) {
        errors.push(`${fname}:${i + 1} ${o.candidate_id} context NOT in ${wid}: ${JSON.stringify(ctx.slice(0, 80))}`);
      }
      if ((o.selection_type_hint === 'persona' || o.selection_type_hint === 'both') && !(o.trait_tags && o.trait_tags.length)) {
        errors.push(`${fname}:${i + 1} ${o.candidate_id} missing trait_tags`);
      }
    }
  });
}
console.log(JSON.stringify({ counts, error_count: errors.length, errors }, null, 2));
