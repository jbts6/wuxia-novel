#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { computeFinalDataHash } = require('./lib/final-data-contract');
const { matchCompleteCitation, splitLines } = require('./lib/source');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: verify.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);
const splitDir = path.join(novelDir, 'ch_split');
if (!fs.existsSync(splitDir)) {
  console.error(`ch_split/ not found; run split-chapters.js first`);
  process.exit(1);
}

const chapterLines = new Map();
for (const f of fs.readdirSync(splitDir)) {
  if (!f.startsWith('ch_') || !f.endsWith('.txt')) continue;
  const n = parseInt(f.slice(3, -4), 10);
  if (isNaN(n)) continue;
  const lines = splitLines(fs.readFileSync(path.join(splitDir, f), 'utf8'));
  chapterLines.set(n, lines);
}
console.log(`Loaded ${chapterLines.size} chapters from ch_split/`);

function checkRef(ref) {
  if (!ref || typeof ref !== 'object') return { status: 'unverified', reason: 'malformed ref' };
  const { chapter, line_start, line_end, text } = ref;
  if (typeof chapter !== 'number' || !text) {
    return { status: 'unverified', reason: 'missing fields' };
  }
  const lines = chapterLines.get(chapter);
  if (!lines) return { status: 'unverified', reason: `chapter ${chapter} not found` };
  if (typeof line_start === 'number') {
    const ranged = matchCompleteCitation(lines, text, {
      lineStart: line_start,
      lineEnd: typeof line_end === 'number' ? line_end : line_start
    });
    if (ranged.matched) {
      return { status: 'grounded', reason: null, match_line: ranged.line_start };
    }
  }

  const chapterMatch = matchCompleteCitation(lines, text);
  if (chapterMatch.matched) {
    return {
      status: 'weak',
      reason: typeof line_start === 'number' ? 'complete citation found outside declared line range' : 'missing line range',
      match_line: chapterMatch.line_start
    };
  }
  return { status: 'unverified', reason: 'complete citation not found in chapter' };
}

const FILES = ['characters.json', 'factions.json', 'locations.json', 'skills.json', 'techniques.json', 'items.json'];
const results = {};
for (const file of FILES) {
  // Try data/ subdirectory first, then root
  const fp = fs.existsSync(path.join(novelDir, 'data', file))
    ? path.join(novelDir, 'data', file)
    : path.join(novelDir, file);
  if (!fs.existsSync(fp)) {
    results[file] = { error: 'file not found' };
    continue;
  }
  let arr;
  try { arr = JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch (e) { results[file] = { error: `parse error: ${e.message}` }; continue; }
  if (!Array.isArray(arr)) { results[file] = { error: 'not an array' }; continue; }

  const fileResults = { total: arr.length, grounded: 0, weak: 0, unverified: 0, alt_grounded: 0, alt_weak: 0, alt_unverified: 0, alt_total: 0, perEntity: [] };
  for (const ent of arr) {
    const refs = Array.isArray(ent?.source_refs) ? ent.source_refs : [];
    let g = 0, w = 0, u = 0;
    let ag = 0, aw = 0, au = 0, at = 0;
    const issues = [];
    const altResults = [];
    for (const ref of refs) {
      const r = checkRef(ref);
      if (r.status === 'grounded') g++;
      else if (r.status === 'weak') { w++; issues.push({ ref, ...r }); }
      else { u++; issues.push({ ref, ...r }); }
      if (Array.isArray(ref.alternatives)) {
        for (const alt of ref.alternatives) {
          at++;
          const ar = checkRef(alt);
          if (ar.status === 'grounded') ag++;
          else if (ar.status === 'weak') aw++;
          else au++;
          altResults.push({ alt, status: ar.status, reason: ar.reason });
        }
      }
    }
    const ratio = refs.length ? g / refs.length : 0;
    fileResults.perEntity.push({
      id: ent?.id || '(no id)',
      name: ent?.name || '(no name)',
      total_refs: refs.length,
      grounded: g, weak: w, unverified: u,
      grounded_ratio: Math.round(ratio * 1000) / 1000,
      alt_total: at, alt_grounded: ag, alt_weak: aw, alt_unverified: au,
      issues: issues.length ? issues : undefined,
    });
    fileResults.grounded += g;
    fileResults.weak += w;
    fileResults.unverified += u;
    fileResults.alt_total += at;
    fileResults.alt_grounded += ag;
    fileResults.alt_weak += aw;
    fileResults.alt_unverified += au;
  }
  results[file] = fileResults;
}

// Try data/ subdirectory first, then root
const dialoguesPath = fs.existsSync(path.join(novelDir, 'data', 'dialogues.json'))
  ? path.join(novelDir, 'data', 'dialogues.json')
  : path.join(novelDir, 'dialogues.json');
if (fs.existsSync(dialoguesPath)) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(dialoguesPath, 'utf8')); }
  catch (e) { results['dialogues.json'] = { error: `parse error: ${e.message}` }; arr = null; }
  if (arr && Array.isArray(arr)) {
    const fileResults = { total: arr.length, grounded: 0, weak: 0, unverified: 0, sample_issues: [] };
    for (const d of arr) {
      const ref = {
        chapter: d.chapter,
        line_start: d.line_start,
        line_end: d.line_end != null ? d.line_end : d.line_start,
        text: d.text,
      };
      const r = checkRef(ref);
      fileResults[r.status]++;
      if (r.status !== 'grounded' && fileResults.sample_issues.length < 20) {
        fileResults.sample_issues.push({ dialogue: d, status: r.status, reason: r.reason });
      }
    }
    results['dialogues.json'] = fileResults;
  }
}

const mentionPath = path.join(novelDir, 'build', 'mention_index.jsonl');
let coverage = null;
if (fs.existsSync(mentionPath)) {
  const termFreq = new Map();
  for (const raw of fs.readFileSync(mentionPath, 'utf8').split(/\r?\n/)) {
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw);
      termFreq.set(obj.term, (termFreq.get(obj.term) || 0) + 1);
    } catch {}
  }

  const covered = new Map();
  const nameToType = new Map();
  for (const file of FILES) {
    const fp = fs.existsSync(path.join(novelDir, 'data', file))
      ? path.join(novelDir, 'data', file)
      : path.join(novelDir, file);
    if (!fs.existsSync(fp)) continue;
    let arr;
    try { arr = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    const type = file.replace('.json', '');
    for (const ent of arr) {
      if (ent?.name) { nameToType.set(ent.name, type); covered.set(ent.name, true); }
      if (Array.isArray(ent?.alias)) {
        for (const a of ent.alias) { nameToType.set(a, type); covered.set(a, true); }
      }
    }
  }

  const uncovered = [];
  for (const [term, count] of termFreq) {
    if (!covered.has(term)) uncovered.push({ term, count });
  }
  uncovered.sort((a, b) => b.count - a.count);
  coverage = {
    total_unique_terms: termFreq.size,
    covered: covered.size,
    uncovered_count: uncovered.length,
    top_uncovered: uncovered.slice(0, 30),
  };
}

const out = {
  generated_at: new Date().toISOString(),
  results,
  coverage,
};
fs.mkdirSync(path.join(novelDir, 'reports'), { recursive: true });
fs.writeFileSync(path.join(novelDir, 'reports', 'verification_result.json'), JSON.stringify(out, null, 2), 'utf8');
fs.writeFileSync(path.join(novelDir, 'verification_result.json'), JSON.stringify(out, null, 2), 'utf8');

const grandTotal = { entities: 0, refs: 0, grounded: 0, weak: 0, unverified: 0 };
const altTotal = { total: 0, grounded: 0, weak: 0, unverified: 0 };
const fileErrors = Object.entries(results).flatMap(([filename, result]) =>
  result?.error ? [`${filename}: ${result.error}`] : []
);
const finalDataHash = computeFinalDataHash(novelDir);
if (!finalDataHash) fileErrors.push('final data files are incomplete or unreadable');
let noRefCount = 0;
for (const file of FILES) {
  const result = results[file];
  if (!result || result.error) continue;
  grandTotal.entities += result.total;
  grandTotal.refs += result.grounded + result.weak + result.unverified;
  grandTotal.grounded += result.grounded;
  grandTotal.weak += result.weak;
  grandTotal.unverified += result.unverified;
  altTotal.total += result.alt_total;
  altTotal.grounded += result.alt_grounded;
  altTotal.weak += result.alt_weak;
  altTotal.unverified += result.alt_unverified;
  noRefCount += result.perEntity.filter(entity => entity.total_refs === 0).length;
}
const verificationReport = {
  generated_at: out.generated_at,
  final_data_hash: finalDataHash,
  file_errors: fileErrors,
  grand_total: grandTotal,
  grand_grounded_ratio: grandTotal.refs ? grandTotal.grounded / grandTotal.refs : 0,
  alt_total: altTotal,
  alt_grounded_ratio: altTotal.total ? altTotal.grounded / altTotal.total : 0,
  cross_chapter_count: 0,
  low_confidence_count: grandTotal.weak + grandTotal.unverified,
  no_ref_count: noRefCount,
  needs_patch: fileErrors.length + grandTotal.weak + grandTotal.unverified + noRefCount > 0,
  coverage_summary: coverage
};
fs.writeFileSync(
  path.join(novelDir, 'reports', 'verification_report.json'),
  JSON.stringify(verificationReport, null, 2),
  'utf8'
);

console.log('=== verify summary ===');
for (const [file, r] of Object.entries(results)) {
  if (r.error) { console.log(`${file}: ERROR ${r.error}`); continue; }
  const totalRefs = r.grounded + r.weak + r.unverified;
  const ratio = totalRefs ? Math.round((r.grounded / totalRefs) * 1000) / 10 : 0;
  console.log(`${file}: entities=${r.total}, refs=${totalRefs}, grounded=${r.grounded} (${ratio}%), weak=${r.weak}, unverified=${r.unverified}`);
}
if (coverage) {
  console.log(`\ncoverage: ${coverage.covered}/${coverage.total_unique_terms} seed terms covered in KB`);
  console.log(`top uncovered:`);
  for (const u of coverage.top_uncovered.slice(0, 10)) {
    console.log(`  ${u.term}\t${u.count}`);
  }
}
console.log(`\nFull result written to verification_result.json`);
if (verificationReport.needs_patch) process.exitCode = 1;
