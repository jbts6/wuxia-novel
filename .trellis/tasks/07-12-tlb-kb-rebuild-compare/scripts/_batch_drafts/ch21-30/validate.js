#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const DRAFT = __dirname;
const INDEX = '/Users/jbts6/Site/wuxia-novel/金庸/天龙八部/build/source-index.json';

function loadIndex() {
  return JSON.parse(fs.readFileSync(INDEX, 'utf8'));
}

function windowMap(idx) {
  return new Map(idx.windows.map(w => [w.id, w]));
}

function dumpWindow(id) {
  const idx = loadIndex();
  const w = windowMap(idx).get(id);
  if (!w) throw new Error('missing ' + id);
  const lines = w.text.split('\n');
  // line numbers are chapter-relative starting at line_start
  let out = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = w.line_start + i;
    out.push(String(ln).padStart(4, ' ') + '|' + lines[i]);
  }
  return { w, numbered: out.join('\n') };
}

function validateFile(file) {
  const idx = loadIndex();
  const map = windowMap(idx);
  const lines = fs.readFileSync(file, 'utf8').split(/\n/).filter(Boolean);
  let ok = 0, bad = [];
  for (const line of lines) {
    let o;
    try { o = JSON.parse(line); } catch (e) { bad.push({err:'json', line: line.slice(0,80)}); continue; }
    const w = map.get(o.window_id);
    if (!w) { bad.push({id:o.candidate_id, err:'no window'}); continue; }
    const t = o.source_ref && o.source_ref.text;
    if (!t || !w.text.includes(t)) {
      bad.push({id:o.candidate_id, err:'source_ref not substring', text:(t||'').slice(0,40)});
      continue;
    }
    if (o.context_source_ref && o.context_source_ref.text && !w.text.includes(o.context_source_ref.text)) {
      bad.push({id:o.candidate_id, err:'context not substring'});
      continue;
    }
    ok++;
  }
  return { file, total: lines.length, ok, bad_count: bad.length, bad: bad.slice(0,20) };
}

function stats() {
  const named = path.join(DRAFT, 'named.jsonl');
  const event = path.join(DRAFT, 'event.jsonl');
  const n = fs.existsSync(named) ? fs.readFileSync(named,'utf8').split(/\n/).filter(Boolean).length : 0;
  const e = fs.existsSync(event) ? fs.readFileSync(event,'utf8').split(/\n/).filter(Boolean).length : 0;
  const windows = new Set();
  for (const f of [named, event]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f,'utf8').split(/\n/).filter(Boolean)) {
      try { windows.add(JSON.parse(line).window_id); } catch {}
    }
  }
  return { named: n, event: e, windows_with_cands: [...windows].sort() };
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'dump') {
  const { numbered } = dumpWindow(rest[0]);
  console.log(numbered);
} else if (cmd === 'meta') {
  const { w } = dumpWindow(rest[0]);
  console.log(JSON.stringify({id:w.id,chapter:w.chapter,line_start:w.line_start,line_end:w.line_end,chars:w.text.length},null,2));
} else if (cmd === 'validate') {
  console.log(JSON.stringify(validateFile(rest[0] || path.join(DRAFT,'named.jsonl')), null, 2));
} else if (cmd === 'validate-all') {
  const r1 = validateFile(path.join(DRAFT,'named.jsonl'));
  const r2 = validateFile(path.join(DRAFT,'event.jsonl'));
  console.log(JSON.stringify({named:r1, event:r2}, null, 2));
} else if (cmd === 'stats') {
  console.log(JSON.stringify(stats(), null, 2));
} else if (cmd === 'append') {
  // node validate.js append named|event <jsonl-file-or-stdin>
  const kind = rest[0];
  const file = rest[1];
  const dest = path.join(DRAFT, kind === 'named' ? 'named.jsonl' : 'event.jsonl');
  const raw = fs.readFileSync(file, 'utf8');
  const idx = loadIndex();
  const map = windowMap(idx);
  const kept = [];
  const dropped = [];
  for (const line of raw.split(/\n/).filter(Boolean)) {
    let o;
    try { o = JSON.parse(line); } catch { dropped.push({err:'json'}); continue; }
    const w = map.get(o.window_id);
    if (!w || !o.source_ref?.text || !w.text.includes(o.source_ref.text)) {
      dropped.push({id:o.candidate_id, err:'bad source'});
      continue;
    }
    if (o.context_source_ref?.text && !w.text.includes(o.context_source_ref.text)) {
      dropped.push({id:o.candidate_id, err:'bad context'});
      continue;
    }
    kept.push(JSON.stringify(o));
  }
  if (kept.length) fs.appendFileSync(dest, kept.join('\n') + '\n');
  console.log(JSON.stringify({appended:kept.length, dropped:dropped.length, dropped_sample:dropped.slice(0,10)},null,2));
} else {
  console.error('dump|meta|validate|validate-all|stats|append');
  process.exit(1);
}
