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

function extractAnchors(text) {
  const anchors = new Set();
  const knownChars = /段誉|萧峰|乔峰|虚竹|王语嫣|慕容复|阿朱|阿紫|木婉清|钟灵|段正淳|刀白凤|阮星竹|秦红棉|甘宝宝|王夫人|李秋水|天山童姥|无崖子|丁春秋|游坦之|鸠摩智|玄慈|萧远山|慕容博|扫地僧|耶律洪基|完颜阿骨打|全冠清|包不同|阿碧|邓百川|公冶乾|风波恶|南海鳄神|叶二娘|云中鹤|枯荣|本因|段正明|高升泰|保定帝|康敏|马夫人|白世镜|单正|谭公|谭婆|赵钱孙|智光|徐长老|马大元|奚长老|陈长老|吴长老|宋长老|吕长老|传功长老|止清|止渊|慧真|慧观|慧方|慧镜|慧轮|苏星河|薛神医|康广陵|范百龄|苟读|吴领军|冯阿三|石清露|李傀儡|摘星子|出尘子|天狼子|狮吼子|乌老大|不平道人|崔绿华|卓不凡|赫连铁树|努儿海|段誉|李清露|梦姑/g;
  let m;
  while ((m = knownChars.exec(text)) !== null) anchors.add(m[0]);
  const places = /松鹤楼|聚贤庄|小镜湖|雁门关|杏子林|曼陀山庄|燕子坞|参合庄|听香水榭|少林寺|灵鹫宫|无量山|剑湖宫|大理城|镇南王府|少室山|缥缈峰|擂鼓山|天龙寺|星宿海|西夏皇宫|大轮寺|磨坊|枯井|冰窖|无锡|信阳|洛阳|苏州|开封|长安|开封/g;
  while ((m = places.exec(text)) !== null) anchors.add(m[0]);
  const events = /斗酒|结拜|自尽|折箭|误杀|相认|招亲|破棋|传功|化功|揭发|独战|喝绝交酒|定情|登场|落败|图谋|认父|杀包不同|传授|初见|论武|重逢|相会/g;
  while ((m = events.exec(text)) !== null) anchors.add(m[0]);
  return [...anchors];
}

const FILES = ['characters.json', 'factions.json', 'locations.json', 'skills.json', 'techniques.json', 'items.json'];
const results = {};
for (const file of FILES) {
  const fp = path.join(novelDir, file);
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

if (fs.existsSync(path.join(novelDir, 'dialogues.json'))) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(novelDir, 'dialogues.json'), 'utf8')); }
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

const mentionPath = path.join(novelDir, 'mention_index.jsonl');
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
