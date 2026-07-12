#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = '/Users/jbts6/Site/wuxia-novel';
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, '金庸/天龙八部/build/source-index.json'), 'utf8'));
const byId = new Map(idx.windows.map(w => [w.id, w]));
const draftDir = path.dirname(__filename);
const namedPath = path.join(draftDir, 'named.jsonl');
const eventPath = path.join(draftDir, 'event.jsonl');

function loadLines(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map((line, i) => {
    try { return { i: i + 1, obj: JSON.parse(line), raw: line }; }
    catch (e) { return { i: i + 1, error: String(e), raw: line }; }
  });
}

function validate(file, pass) {
  const rows = loadLines(file);
  const issues = [];
  let ok = 0;
  for (const row of rows) {
    if (row.error) { issues.push(`${file}:${row.i} JSON parse error: ${row.error}`); continue; }
    const o = row.obj;
    if (o.discovery_pass !== pass) issues.push(`${o.candidate_id}: discovery_pass=${o.discovery_pass} expected ${pass}`);
    const w = byId.get(o.window_id);
    if (!w) { issues.push(`${o.candidate_id}: unknown window ${o.window_id}`); continue; }
    if (!o.source_ref?.text) { issues.push(`${o.candidate_id}: missing source_ref.text`); continue; }
    if (!w.text.includes(o.source_ref.text)) issues.push(`${o.candidate_id}: source_ref.text not substring of window`);
    if (o.source_ref.line_start < w.line_start || o.source_ref.line_end > w.line_end) {
      issues.push(`${o.candidate_id}: lines ${o.source_ref.line_start}-${o.source_ref.line_end} outside window ${w.line_start}-${w.line_end}`);
    }
    if (o.category_hint === 'dialogue') {
      if (!o.selection_type_hint) issues.push(`${o.candidate_id}: dialogue missing selection_type_hint`);
      if (!o.selection_reason) issues.push(`${o.candidate_id}: dialogue missing selection_reason`);
      if (!o.context_source_ref?.text) issues.push(`${o.candidate_id}: dialogue missing context_source_ref`);
      else if (!w.text.includes(o.context_source_ref.text)) issues.push(`${o.candidate_id}: context_source_ref.text not substring`);
      if ((o.selection_type_hint === 'persona' || o.selection_type_hint === 'both') && (!o.trait_tags || !o.trait_tags.length)) {
        issues.push(`${o.candidate_id}: persona/both missing trait_tags`);
      }
    }
    ok += 1;
  }
  return { file, total: rows.length, ok, issues };
}

const r1 = validate(namedPath, 'named-inventory');
const r2 = validate(eventPath, 'event-dialogue');
const named = loadLines(namedPath).filter(r => r.obj).map(r => r.obj);
const event = loadLines(eventPath).filter(r => r.obj).map(r => r.obj);
const windows = new Set([...named, ...event].map(o => o.window_id));
const byWin = {};
for (const o of [...named, ...event]) {
  byWin[o.window_id] = byWin[o.window_id] || { named: 0, event: 0 };
  if (o.discovery_pass === 'named-inventory') byWin[o.window_id].named++;
  else byWin[o.window_id].event++;
}
console.log(JSON.stringify({
  named: { total: r1.total, issues: r1.issues.length },
  event: { total: r2.total, issues: r2.issues.length },
  windows_with_candidates: [...windows].sort(),
  byWin,
  issues: [...r1.issues, ...r2.issues].slice(0, 50)
}, null, 2));
