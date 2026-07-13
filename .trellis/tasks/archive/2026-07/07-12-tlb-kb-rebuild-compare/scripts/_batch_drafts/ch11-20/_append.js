#!/usr/bin/env node
'use strict';
/**
 * Validate and append candidates for ch11-20 drafts.
 * Usage:
 *   node _append.js named <candidates.json|jsonl|->
 *   node _append.js event <candidates.json|jsonl|->
 *   node _append.js stats
 *   node _append.js validate
 */
const fs = require('node:fs');
const path = require('node:path');

const DRAFT = __dirname;
const INDEX = path.resolve(__dirname, '../../../../../金庸/天龙八部/build/source-index.json');
const CHAPTERS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function loadIndexWindows() {
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const map = new Map();
  for (const w of index.windows) {
    if (CHAPTERS.includes(w.chapter)) map.set(w.id, w);
  }
  return map;
}

function parseInput(raw) {
  const t = raw.trim();
  if (!t) return [];
  // array json
  if (t.startsWith('[')) {
    return JSON.parse(t);
  }
  // single object
  if (t.startsWith('{') && !t.includes('\n{')) {
    try {
      return [JSON.parse(t)];
    } catch {
      // fall through to jsonl
    }
  }
  // jsonl or multi-object
  const out = [];
  for (const line of t.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    out.push(JSON.parse(s));
  }
  return out;
}

function validateCandidate(c, winMap, pass) {
  const issues = [];
  if (!c.candidate_id) issues.push('missing candidate_id');
  if (!c.window_id) issues.push('missing window_id');
  if (!c.category_hint) issues.push('missing category_hint');
  if (!c.name) issues.push('missing name');
  if (c.discovery_pass !== pass) issues.push(`discovery_pass want ${pass} got ${c.discovery_pass}`);
  if (!c.source_ref || !c.source_ref.text) {
    issues.push('missing source_ref.text');
    return { ok: false, issues };
  }
  const w = winMap.get(c.window_id);
  if (!w) {
    issues.push(`unknown window ${c.window_id}`);
    return { ok: false, issues };
  }
  if (!w.text.includes(c.source_ref.text)) {
    // try normalized newlines
    const normWin = w.text.replace(/\r\n/g, '\n');
    const normText = c.source_ref.text.replace(/\r\n/g, '\n');
    if (!normWin.includes(normText)) {
      issues.push(`source_ref.text not substring of ${c.window_id}: ${c.candidate_id}`);
    }
  }
  if (c.source_ref.line_start != null && c.source_ref.line_start < w.line_start) {
    issues.push(`line_start ${c.source_ref.line_start} < window ${w.line_start}`);
  }
  if (c.source_ref.line_end != null && c.source_ref.line_end > w.line_end) {
    issues.push(`line_end ${c.source_ref.line_end} > window ${w.line_end}`);
  }
  if (c.category_hint === 'dialogue') {
    if (!c.selection_type_hint) issues.push('dialogue missing selection_type_hint');
    if (!c.selection_reason) issues.push('dialogue missing selection_reason');
    if (!c.context_source_ref?.text) issues.push('dialogue missing context_source_ref');
    else if (!w.text.includes(c.context_source_ref.text) &&
             !w.text.replace(/\r\n/g, '\n').includes(c.context_source_ref.text.replace(/\r\n/g, '\n'))) {
      issues.push(`context_source_ref.text not substring: ${c.candidate_id}`);
    }
    if ((c.selection_type_hint === 'persona' || c.selection_type_hint === 'both') &&
        (!Array.isArray(c.trait_tags) || c.trait_tags.length === 0)) {
      issues.push('persona/both needs trait_tags');
    }
  }
  return { ok: issues.length === 0, issues };
}

function append(pass, candidates) {
  const winMap = loadIndexWindows();
  const file = path.join(DRAFT, pass === 'named-inventory' ? 'named.jsonl' : 'event.jsonl');
  const accepted = [];
  const rejected = [];
  for (const c of candidates) {
    const v = validateCandidate(c, winMap, pass);
    if (v.ok) accepted.push(c);
    else rejected.push({ id: c.candidate_id, issues: v.issues });
  }
  if (accepted.length) {
    const lines = accepted.map(c => JSON.stringify(c)).join('\n') + '\n';
    fs.appendFileSync(file, lines);
  }
  return { accepted: accepted.length, rejected, file };
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
}

function stats() {
  const named = readJsonl(path.join(DRAFT, 'named.jsonl'));
  const event = readJsonl(path.join(DRAFT, 'event.jsonl'));
  const byWinN = {};
  const byWinE = {};
  for (const c of named) byWinN[c.window_id] = (byWinN[c.window_id] || 0) + 1;
  for (const c of event) byWinE[c.window_id] = (byWinE[c.window_id] || 0) + 1;
  const winMap = loadIndexWindows();
  const allIds = [...winMap.keys()].sort();
  return {
    named: named.length,
    event: event.length,
    windows_with_named: Object.keys(byWinN).length,
    windows_with_event: Object.keys(byWinE).length,
    missing_named: allIds.filter(id => !byWinN[id]),
    missing_event: allIds.filter(id => !byWinE[id]),
    by_window_named: byWinN,
    by_window_event: byWinE,
    sample_ids: [...named, ...event].slice(0, 10).map(c => c.candidate_id)
  };
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'stats') {
    console.log(JSON.stringify(stats(), null, 2));
    return;
  }
  if (cmd === 'validate') {
    const winMap = loadIndexWindows();
    const issues = [];
    for (const [pass, file] of [
      ['named-inventory', path.join(DRAFT, 'named.jsonl')],
      ['event-dialogue', path.join(DRAFT, 'event.jsonl')]
    ]) {
      for (const c of readJsonl(file)) {
        const v = validateCandidate(c, winMap, pass);
        if (!v.ok) issues.push(...v.issues.map(i => `${c.candidate_id}: ${i}`));
      }
    }
    console.log(JSON.stringify({ ok: issues.length === 0, issues }, null, 2));
    return;
  }
  if (cmd === 'named' || cmd === 'event') {
    const pass = cmd === 'named' ? 'named-inventory' : 'event-dialogue';
    let raw;
    if (!rest[0] || rest[0] === '-') {
      raw = fs.readFileSync(0, 'utf8');
    } else {
      raw = fs.readFileSync(path.resolve(rest[0]), 'utf8');
    }
    const candidates = parseInput(raw);
    const result = append(pass, candidates);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.error('Usage: named|event|stats|validate');
  process.exitCode = 1;
}

main();
