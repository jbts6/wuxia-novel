#!/usr/bin/env node
'use strict';

/**
 * Inventory scan helpers for 天龙八部 rebuild.
 * Append candidates, mark windows complete, list pending windows.
 *
 * Usage:
 *   node scan-helpers.js pending [--pass named-inventory|event-dialogue|gap-audit] [--limit N]
 *   node scan-helpers.js window <window_id>
 *   node scan-helpers.js mark <pass> <window_id> [window_id...]
 *   node scan-helpers.js append-jsonl <path-to-candidates-snippet.jsonl>
 *   node scan-helpers.js stats
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');
const NOVEL = path.join(ROOT, '金庸/天龙八部');
const BUILD = path.join(NOVEL, 'build');
const INDEX_PATH = path.join(BUILD, 'source-index.json');
const MANIFEST_PATH = path.join(BUILD, 'scan-manifest.json');
const CANDIDATES_PATH = path.join(BUILD, 'candidates.jsonl');

const PASSES = ['named-inventory', 'event-dialogue', 'gap-audit'];

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function ensureCandidatesFile() {
  if (!fs.existsSync(CANDIDATES_PATH)) {
    fs.writeFileSync(CANDIDATES_PATH, '');
  }
}

function loadIndex() {
  return loadJson(INDEX_PATH);
}

function loadManifest() {
  return loadJson(MANIFEST_PATH);
}

function saveManifest(manifest) {
  writeJson(MANIFEST_PATH, manifest);
}

function windowById(index) {
  return new Map((index.windows || []).map(w => [w.id, w]));
}

function pending(pass, limit = Infinity) {
  if (!PASSES.includes(pass)) throw new Error(`unknown pass: ${pass}`);
  const index = loadIndex();
  const manifest = loadManifest();
  const done = new Set(manifest.passes?.[pass]?.completed_window_ids ?? []);
  const required = manifest.required_window_ids || index.windows.map(w => w.id);
  const list = required.filter(id => !done.has(id));
  return list.slice(0, limit);
}

function getWindow(windowId) {
  const index = loadIndex();
  const w = windowById(index).get(windowId);
  if (!w) throw new Error(`window not found: ${windowId}`);
  return w;
}

function markComplete(pass, windowIds) {
  if (!PASSES.includes(pass)) throw new Error(`unknown pass: ${pass}`);
  const index = loadIndex();
  const valid = new Set(index.windows.map(w => w.id));
  const manifest = loadManifest();
  if (!manifest.passes[pass]) {
    manifest.passes[pass] = { completed_window_ids: [] };
  }
  const set = new Set(manifest.passes[pass].completed_window_ids || []);
  const added = [];
  for (const id of windowIds) {
    if (!valid.has(id)) throw new Error(`unknown window id: ${id}`);
    if (!set.has(id)) {
      set.add(id);
      added.push(id);
    }
  }
  manifest.passes[pass].completed_window_ids = [...set].sort();
  saveManifest(manifest);
  return { pass, added, total_completed: set.size, required: (manifest.required_window_ids || []).length };
}

function appendCandidates(lines) {
  ensureCandidatesFile();
  const cleaned = [];
  for (const line of lines) {
    const trimmed = String(line).trim();
    if (!trimmed) continue;
    const obj = JSON.parse(trimmed);
    if (!obj.candidate_id) throw new Error('candidate missing candidate_id');
    if (!obj.window_id) throw new Error(`${obj.candidate_id}: missing window_id`);
    if (!obj.discovery_pass) throw new Error(`${obj.candidate_id}: missing discovery_pass`);
    if (!obj.source_ref?.text) throw new Error(`${obj.candidate_id}: missing source_ref.text`);
    cleaned.push(JSON.stringify(obj));
  }
  if (cleaned.length === 0) return { appended: 0 };
  fs.appendFileSync(CANDIDATES_PATH, `${cleaned.join('\n')}\n`);
  return { appended: cleaned.length };
}

function appendFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  return appendCandidates(lines);
}

function stats() {
  ensureCandidatesFile();
  const index = loadIndex();
  const manifest = loadManifest();
  const candText = fs.readFileSync(CANDIDATES_PATH, 'utf8');
  const candLines = candText.split(/\r?\n/).filter(Boolean);
  let candCount = 0;
  const byPass = {};
  const byCategory = {};
  for (const line of candLines) {
    try {
      const o = JSON.parse(line);
      candCount += 1;
      byPass[o.discovery_pass || '?'] = (byPass[o.discovery_pass || '?'] || 0) + 1;
      byCategory[o.category_hint || '?'] = (byCategory[o.category_hint || '?'] || 0) + 1;
    } catch {
      // ignore bad lines in stats
    }
  }
  const progress = {};
  for (const pass of PASSES) {
    const done = manifest.passes?.[pass]?.completed_window_ids?.length || 0;
    const req = manifest.required_window_ids?.length || index.windows.length;
    progress[pass] = { completed: done, required: req, remaining: req - done };
  }
  return {
    windows: index.windows.length,
    candidates: candCount,
    byPass,
    byCategory,
    progress
  };
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) {
    console.error('Usage: pending|window|mark|append-jsonl|stats');
    process.exitCode = 1;
    return;
  }
  if (cmd === 'pending') {
    let pass = 'named-inventory';
    let limit = Infinity;
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i] === '--pass') pass = rest[++i];
      else if (rest[i] === '--limit') limit = Number(rest[++i]);
    }
    const list = pending(pass, limit);
    console.log(JSON.stringify({ pass, count: list.length, window_ids: list }, null, 2));
    return;
  }
  if (cmd === 'window') {
    const id = rest[0];
    if (!id) throw new Error('window requires id');
    const w = getWindow(id);
    console.log(JSON.stringify(w, null, 2));
    return;
  }
  if (cmd === 'mark') {
    const pass = rest[0];
    const ids = rest.slice(1);
    if (!pass || ids.length === 0) throw new Error('mark <pass> <window_id>...');
    console.log(JSON.stringify(markComplete(pass, ids), null, 2));
    return;
  }
  if (cmd === 'append-jsonl') {
    const file = rest[0];
    if (!file) throw new Error('append-jsonl <file>');
    console.log(JSON.stringify(appendFromFile(path.resolve(file)), null, 2));
    return;
  }
  if (cmd === 'stats') {
    console.log(JSON.stringify(stats(), null, 2));
    return;
  }
  throw new Error(`unknown command: ${cmd}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = {
  pending,
  getWindow,
  markComplete,
  appendCandidates,
  appendFromFile,
  stats,
  NOVEL,
  CANDIDATES_PATH,
  PASSES
};
