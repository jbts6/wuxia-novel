#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

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
  const lines = fs.readFileSync(path.join(splitDir, f), 'utf8').split(/\r?\n/);
  chapterLines.set(n, lines);
}
console.log(`Loaded ${chapterLines.size} chapters from ch_split/`);

function getText(chapter, lineStart, lineEnd) {
  const lines = chapterLines.get(chapter);
  if (!lines) return null;
  const s = Math.max(0, lineStart - 1);
  const e = Math.min(lines.length, lineEnd);
  return lines.slice(s, e).join('\n');
}

function checkRef(ref) {
  if (!ref || typeof ref !== 'object') return { status: 'unverified', reason: 'malformed ref' };
  const { chapter, line_start, line_end, text } = ref;
  if (typeof chapter !== 'number' || !text) {
    return { status: 'unverified', reason: 'missing fields' };
  }
  const cleanNeedle = String(text).trim();
  if (!cleanNeedle) return { status: 'unverified', reason: 'empty text' };

  const lines = chapterLines.get(chapter);
  if (!lines) return { status: 'unverified', reason: `chapter ${chapter} not found` };
  const chapterText = lines.join('\n');

  if (chapterText.includes(cleanNeedle)) {
    if (typeof line_start === 'number') {
      const ls = line_start;
      const le = typeof line_end === 'number' ? line_end : ls;
      const narrow = getText(chapter, ls, le);
      if (narrow && narrow.includes(cleanNeedle)) {
        return { status: 'grounded', reason: null, match_line: ls };
      }
      const wider = getText(chapter, Math.max(1, ls - 10), le + 10);
      if (wider && wider.includes(cleanNeedle)) {
        return { status: 'weak', reason: 'found in wider context of cited lines', match_line: ls };
      }
      const actualLine = findLine(lines, cleanNeedle);
      if (actualLine !== null) {
        const drift = Math.abs(actualLine - ls);
        if (drift <= 20) return { status: 'weak', reason: `line drift ${drift}`, match_line: actualLine + 1 };
        return { status: 'weak', reason: `found elsewhere in chapter, line drift ${drift}`, match_line: actualLine + 1 };
      }
    } else {
      const actualLine = findLine(lines, cleanNeedle);
      return { status: 'grounded', reason: 'chapter-level match', match_line: actualLine !== null ? actualLine + 1 : null };
    }
  }

  const core = cleanNeedle.length > 12 ? cleanNeedle.slice(0, 12) : cleanNeedle;
  if (chapterText.includes(core)) {
    const actualLine = findLine(lines, core);
    return { status: 'weak', reason: 'prefix match only', match_line: actualLine !== null ? actualLine + 1 : null };
  }

  const keyPhrases = extractKeyPhrases(cleanNeedle);
  for (const p of keyPhrases) {
    if (chapterText.includes(p)) {
      const actualLine = findLine(lines, p);
      return { status: 'weak', reason: `key phrase matched: ${p}`, match_line: actualLine !== null ? actualLine + 1 : null };
    }
  }

  const anchors = extractAnchors(cleanNeedle);
  if (anchors.length >= 2) {
    const scores = [];
    for (const [ch, chLines] of chapterLines) {
      const chText = chLines.join('\n');
      let hits = 0;
      const hitDetails = [];
      for (const a of anchors) {
        if (chText.includes(a)) { hits++; hitDetails.push(a); }
      }
      if (hits >= 2) scores.push({ ch, hits, hitDetails });
    }
    scores.sort((a, b) => b.hits - a.hits);
    if (scores.length > 0) {
      const best = scores[0];
      const inCited = best.ch === chapter;
      return {
        status: 'weak',
        reason: `anchor co-occurrence (${best.hits}/${anchors.length}: ${best.hitDetails.join(', ')}) in ${inCited ? 'cited' : 'different'} chapter ${best.ch}`,
        match_chapter: best.ch,
        alt_candidates: scores.slice(0, 3).map(s => s.ch),
      };
    }
  }

  return { status: 'unverified', reason: 'no match in chapter' };
}

function findLine(lines, needle) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i;
  }
  return null;
}

function extractKeyPhrases(text) {
  const phrases = new Set();
  const charNameRe = /[\u4e00-\u9fa5]{2,4}(?:公子|姑娘|先生|师父|帮主|大王|王爷|夫人|大师|长老|掌门)/g;
  let m;
  while ((m = charNameRe.exec(text)) !== null) phrases.add(m[0]);
  const placeRe = /[\u4e00-\u9fa5]{2,4}(?:山|寺|庄|宫|峰|关|湖|林|洞|谷|派|帮|府|国|城)/g;
  while ((m = placeRe.exec(text)) !== null) phrases.add(m[0]);
  const skillRe = /[\u4e00-\u9fa5]{2,6}(?:掌|剑|指|功|步|刀|法|拳|经|谱|诀)/g;
  while ((m = skillRe.exec(text)) !== null) phrases.add(m[0]);
  const quotedRe = /[''""]([^'""]{2,8})[''""]/g;
  while ((m = quotedRe.exec(text)) !== null) phrases.add(m[1]);
  return [...phrases].filter(p => p.length >= 3);
}

// Build dynamic patterns from JSON files
let charNames = [];
let placeNames = [];
let eventWords = [];

// Load character names (from data/)
const charPath = fs.existsSync(path.join(novelDir, 'data', 'characters.json'))
  ? path.join(novelDir, 'data', 'characters.json')
  : path.join(novelDir, 'characters.json');
if (fs.existsSync(charPath)) {
  try {
    const chars = JSON.parse(fs.readFileSync(charPath, 'utf8'));
    for (const c of chars) {
      if (c.name) charNames.push(c.name);
      if (Array.isArray(c.alias)) charNames.push(...c.alias);
    }
  } catch {}
}

// Load location names (from data/)
const locPath = fs.existsSync(path.join(novelDir, 'data', 'locations.json'))
  ? path.join(novelDir, 'data', 'locations.json')
  : path.join(novelDir, 'locations.json');
if (fs.existsSync(locPath)) {
  try {
    const locs = JSON.parse(fs.readFileSync(locPath, 'utf8'));
    for (const l of locs) {
      if (l.name) placeNames.push(l.name);
      if (Array.isArray(l.alias)) placeNames.push(...l.alias);
    }
  } catch {}
}

// Common event words (generic, not book-specific)
const COMMON_EVENT_WORDS = ['斗酒', '结拜', '自尽', '误杀', '相认', '招亲', '传功', '揭发', '独战', '定情', '登场', '落败', '认父', '传授', '初见', '论武', '重逢', '相会', '拜师', '比武', '决战', '成亲', '分离', '中毒', '疗伤', '逃脱', '被捕', '背叛', '和解'];

function extractAnchors(text) {
  const anchors = new Set();
  
  // Match character names
  if (charNames.length > 0) {
    const charPattern = new RegExp(charNames.join('|'), 'g');
    let m;
    while ((m = charPattern.exec(text)) !== null) anchors.add(m[0]);
  }
  
  // Match place names
  if (placeNames.length > 0) {
    const placePattern = new RegExp(placeNames.join('|'), 'g');
    let m;
    while ((m = placePattern.exec(text)) !== null) anchors.add(m[0]);
  }
  
  // Match event words
  const eventPattern = new RegExp(COMMON_EVENT_WORDS.join('|'), 'g');
  let m;
  while ((m = eventPattern.exec(text)) !== null) anchors.add(m[0]);
  
  return [...anchors];
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
    const fp = path.join(novelDir, file);
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
fs.writeFileSync(path.join(novelDir, 'verification_result.json'), JSON.stringify(out, null, 2), 'utf8');

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
