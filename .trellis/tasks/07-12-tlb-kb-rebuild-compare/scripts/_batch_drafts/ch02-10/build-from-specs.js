#!/usr/bin/env node
'use strict';
/**
 * Build draft candidates for ch02-10 batch from hand-authored anchors.
 * Each item provides short anchors; this script finds exact line ranges
 * and verifies substrings against source-index window text.
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/jbts6/Site/wuxia-novel';
const INDEX = path.join(ROOT, '金庸/天龙八部/build/source-index.json');
const DRAFT = path.join(ROOT, '.trellis/tasks/07-12-tlb-kb-rebuild-compare/scripts/_batch_drafts/ch02-10');
const SPECS = path.join(DRAFT, 'specs');

const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const byId = new Map(idx.windows.map(w => [w.id, w]));

function chapterLines(window) {
  // Map chapter-local line number -> line text
  const lines = window.text.split('\n');
  const map = new Map();
  for (let i = 0; i < lines.length; i++) {
    map.set(window.line_start + i, lines[i]);
  }
  return { lines, map };
}

function findSnippet(window, snippet) {
  const pos = window.text.indexOf(snippet);
  if (pos < 0) return null;
  // Compute line_start/line_end from char offset
  const before = window.text.slice(0, pos);
  const snip = window.text.slice(pos, pos + snippet.length);
  const startOffsetLines = before.split('\n').length - 1;
  const snipLines = snip.split('\n').length - 1;
  return {
    line_start: window.line_start + startOffsetLines,
    line_end: window.line_start + startOffsetLines + snipLines,
    text: snippet
  };
}

function expandToLines(window, lineStart, lineEnd) {
  const { map } = chapterLines(window);
  const parts = [];
  for (let ln = lineStart; ln <= lineEnd; ln++) {
    if (!map.has(ln)) return null;
    parts.push(map.get(ln));
  }
  return {
    line_start: lineStart,
    line_end: lineEnd,
    text: parts.join('\n')
  };
}

function resolveRef(window, ref) {
  if (typeof ref === 'string') {
    const r = findSnippet(window, ref);
    if (!r) throw new Error(`snippet not found in ${window.id}: ${ref.slice(0, 40)}...`);
    return r;
  }
  if (ref.snippet) {
    const r = findSnippet(window, ref.snippet);
    if (!r) throw new Error(`snippet not found in ${window.id}: ${ref.snippet.slice(0, 40)}...`);
    if (ref.line_start != null) {
      // Prefer explicit lines if text matches
      const exp = expandToLines(window, ref.line_start, ref.line_end ?? ref.line_start);
      if (exp && exp.text.includes(ref.snippet)) return exp;
    }
    return r;
  }
  if (ref.line_start != null) {
    const exp = expandToLines(window, ref.line_start, ref.line_end ?? ref.line_start);
    if (!exp) throw new Error(`lines ${ref.line_start}-${ref.line_end} out of ${window.id}`);
    return exp;
  }
  throw new Error('bad ref');
}

function buildCandidate(window, seq, pass, spec) {
  const source_ref = resolveRef(window, spec.source_ref);
  const out = {
    candidate_id: `cand_${window.id.replace('ch', 'ch').replace('_w', '_w')}_${String(seq).padStart(4, '0')}`.replace(
      /cand_ch(\d+)_w(\d+)_/,
      (_, c, w) => `cand_ch${c.padStart(3, '0')}_w${w.padStart(3, '0')}_`
    ),
    category_hint: spec.category_hint,
    name: spec.name,
    chapter: window.chapter,
    source_ref,
    discovery_pass: pass,
    window_id: window.id
  };
  // Fix candidate_id properly
  const m = window.id.match(/^ch(\d+)_w(\d+)$/);
  out.candidate_id = `cand_ch${m[1].padStart(3, '0')}_w${m[2].padStart(3, '0')}_${String(seq).padStart(4, '0')}`;

  for (const k of ['event_level_hint', 'speaker_name', 'selection_type_hint', 'selection_reason', 'trait_tags']) {
    if (spec[k] !== undefined) out[k] = spec[k];
  }
  if (spec.context_source_ref) {
    out.context_source_ref = resolveRef(window, spec.context_source_ref);
  }
  // validate
  if (!window.text.includes(out.source_ref.text)) {
    throw new Error(`${out.candidate_id}: source_ref not substring`);
  }
  if (out.context_source_ref && !window.text.includes(out.context_source_ref.text)) {
    throw new Error(`${out.candidate_id}: context not substring`);
  }
  return out;
}

function loadSpecs() {
  if (!fs.existsSync(SPECS)) return [];
  return fs.readdirSync(SPECS).filter(f => f.endsWith('.json')).sort().map(f => {
    return { file: f, data: JSON.parse(fs.readFileSync(path.join(SPECS, f), 'utf8')) };
  });
}

function main() {
  fs.mkdirSync(SPECS, { recursive: true });
  const namedOut = [];
  const eventOut = [];
  const issues = [];
  const windowsProcessed = new Set();

  for (const { file, data } of loadSpecs()) {
    const window = byId.get(data.window_id);
    if (!window) {
      issues.push(`${file}: unknown window ${data.window_id}`);
      continue;
    }
    windowsProcessed.add(window.id);
    let nseq = 1;
    let eseq = 100; // event/dialogue start at 0100 to match pilot style
    for (const spec of data.named || []) {
      try {
        namedOut.push(buildCandidate(window, nseq++, 'named-inventory', spec));
      } catch (e) {
        issues.push(`${window.id} named ${spec.name}: ${e.message}`);
      }
    }
    for (const spec of data.event || []) {
      try {
        eventOut.push(buildCandidate(window, eseq++, 'event-dialogue', spec));
      } catch (e) {
        issues.push(`${window.id} event ${spec.name}: ${e.message}`);
      }
    }
  }

  const namedPath = path.join(DRAFT, 'named.jsonl');
  const eventPath = path.join(DRAFT, 'event.jsonl');
  fs.writeFileSync(namedPath, namedOut.map(o => JSON.stringify(o)).join('\n') + (namedOut.length ? '\n' : ''));
  fs.writeFileSync(eventPath, eventOut.map(o => JSON.stringify(o)).join('\n') + (eventOut.length ? '\n' : ''));
  console.log(JSON.stringify({
    windows_with_specs: [...windowsProcessed].sort(),
    named: namedOut.length,
    event: eventOut.length,
    issues
  }, null, 2));
}

if (require.main === module) main();
module.exports = { byId, resolveRef, buildCandidate, findSnippet };
