#!/usr/bin/env node
'use strict';
/**
 * Emit validated candidates from specs:
 * { category_hint, name, quote, ...extra }
 * quote must be exact substring of window text.
 *
 * Usage:
 *   node emit.js <window_id> named|event <specs.json>
 * specs.json is array of objects
 */
const fs = require('fs');
const path = require('path');
const DRAFT = __dirname;
const INDEX = '/Users/jbts6/Site/wuxia-novel/金庸/天龙八部/build/source-index.json';

function loadWindow(id) {
  const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const w = idx.windows.find(x => x.id === id);
  if (!w) throw new Error('window not found: ' + id);
  return w;
}

function locate(text, quote, lineStart) {
  const idx = text.indexOf(quote);
  if (idx < 0) return null;
  const before = text.slice(0, idx);
  const startOffset = before.split('\n').length - 1;
  const endOffset = before.split('\n').length - 1 + quote.split('\n').length - 1;
  return {
    line_start: lineStart + startOffset,
    line_end: lineStart + endOffset,
    text: quote
  };
}

function nextSeq(file, windowId, pass) {
  if (!fs.existsSync(file)) return pass === 'named-inventory' ? 1 : 100;
  let max = pass === 'named-inventory' ? 0 : 99;
  for (const line of fs.readFileSync(file, 'utf8').split(/\n/).filter(Boolean)) {
    try {
      const o = JSON.parse(line);
      if (o.window_id !== windowId) continue;
      const m = String(o.candidate_id).match(/_(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    } catch {}
  }
  return max + 1;
}

function padId(windowId, seq) {
  // windowId: ch021_w001 -> cand_ch021_w001_0001
  return `cand_${windowId}_${String(seq).padStart(4, '0')}`;
}

function main() {
  const [windowId, kind, specsPath] = process.argv.slice(2);
  if (!windowId || !kind || !specsPath) {
    console.error('Usage: emit.js <window_id> named|event <specs.json>');
    process.exit(1);
  }
  const pass = kind === 'named' ? 'named-inventory' : 'event-dialogue';
  const dest = path.join(DRAFT, kind === 'named' ? 'named.jsonl' : 'event.jsonl');
  const w = loadWindow(windowId);
  const specs = JSON.parse(fs.readFileSync(specsPath, 'utf8'));
  let seq = nextSeq(dest, windowId, pass);
  const kept = [];
  const dropped = [];
  for (const s of specs) {
    const quote = s.quote;
    if (!quote || !w.text.includes(quote)) {
      dropped.push({ name: s.name, err: 'quote missing', preview: (quote || '').slice(0, 40) });
      continue;
    }
    const source_ref = locate(w.text, quote, w.line_start);
    let context_source_ref;
    if (s.context_quote) {
      if (!w.text.includes(s.context_quote)) {
        dropped.push({ name: s.name, err: 'context missing' });
        continue;
      }
      context_source_ref = locate(w.text, s.context_quote, w.line_start);
    }
    const obj = {
      candidate_id: padId(windowId, seq++),
      category_hint: s.category_hint,
      name: s.name,
      chapter: w.chapter,
      source_ref,
      discovery_pass: pass,
      window_id: windowId
    };
    for (const k of Object.keys(s)) {
      if (['quote', 'context_quote', 'category_hint', 'name'].includes(k)) continue;
      obj[k] = s[k];
    }
    if (context_source_ref) obj.context_source_ref = context_source_ref;
    kept.push(JSON.stringify(obj));
  }
  if (kept.length) fs.appendFileSync(dest, kept.join('\n') + '\n');
  console.log(JSON.stringify({ window_id: windowId, pass, appended: kept.length, dropped: dropped.length, dropped_sample: dropped.slice(0, 15) }, null, 2));
}

main();
