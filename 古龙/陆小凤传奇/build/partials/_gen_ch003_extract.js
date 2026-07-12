const fs = require('fs');
const DIR = '/Users/jbts6/Site/wuxia-novel/古龙/陆小凤传奇/build/partials';

function parseWindow(wid) {
  const raw = fs.readFileSync(`${DIR}/_win_${wid}.txt`, 'utf8');
  const lines = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*(\d+)\|(.*)$/);
    if (m) lines[Number(m[1])] = m[2];
  }
  return lines;
}

function snippet(L, a, b) {
  const parts = [];
  for (let i = a; i <= b; i++) if (L[i] !== undefined) parts.push(L[i]);
  return parts.join('\n');
}

function findLine(L, name, prefer) {
  if (prefer != null && L[prefer] && L[prefer].includes(name)) return prefer;
  const keys = Object.keys(L).map(Number).sort((a, b) => a - b);
  for (const k of keys) if (L[k].includes(name)) return k;
  return null;
}

function make(wid, L, cat, name, a, b) {
  const text = snippet(L, a, b);
  if (!text.includes(name)) {
    console.error('MISSING', wid, name, a, b);
    return null;
  }
  return {
    candidate_id: '',
    category_hint: cat,
    name,
    chapter: 3,
    source_ref: { line_start: a, line_end: b, text },
    discovery_pass: 'named-inventory',
    window_id: wid,
  };
}

const all = [];
function add(c) { if (c) all.push(c); }

// ===== w001 =====
{
  const wid = 'ch003_w001';
  const L = parseWindow(wid);
  const specs = [
    ['character', '丹凤公主', 1],
    ['character', '陆小凤', 3],
    ['character', '霍老头', 5],
    ['location', '霍老头屋', 5],
    ['location', '小木屋', 7],
    ['location', '枣树林', 7],
    ['character', '柳余恨', 73],
    ['character', '萧秋雨', 73],
    ['character', '独孤方', 73],
  ];
  for (const [cat, name, pref] of specs) {
    const ln = findLine(L, name, pref);
    if (ln == null) console.error('not found', wid, name);
    else add(make(wid, L, cat, name, ln, ln));
  }
}

// ===== w002 =====
{
  const wid = 'ch003_w002';
  const L = parseWindow(wid);
  const specs = [
    ['character', '陆小凤', 121],
    ['character', '霍老头', 121],
    ['character', '柳余恨', 157],
    ['character', '萧秋雨', 157],
    ['character', '独孤方', 157],
  ];
  for (const [cat, name, pref] of specs) {
    const ln = findLine(L, name, pref);
    if (ln == null) console.error('not found', wid, name);
    else add(make(wid, L, cat, name, ln, ln));
  }
}

// ===== w003 =====
{
  const wid = 'ch003_w003';
  const L = parseWindow(wid);
  // multi-line for 大金鹏王
  add(make(wid, L, 'character', '大金鹏王', 267, 267));
  add(make(wid, L, 'character', '丹凤公主', 267, 267));
  add(make(wid, L, 'character', '陆小凤', 203, 203));
  add(make(wid, L, 'character', '陆公子', 267, 267));
  add(make(wid, L, 'character', '小凤公主', 273, 273));
  add(make(wid, L, 'character', '霍老头', 277, 277));
  add(make(wid, L, 'character', '萧秋雨', 207, 207));
  add(make(wid, L, 'character', '独孤方', 201, 201));
  add(make(wid, L, 'character', '柳余恨', 229, 229));
  add(make(wid, L, 'location', '枣林', 271, 271));
  add(make(wid, L, 'item', '花篮', 301, 301));
  add(make(wid, L, 'item', '元宝', 307, 307));
  add(make(wid, L, 'item', '酒坛子', 203, 203));
}

// ===== w004 =====
{
  const wid = 'ch003_w004';
  const L = parseWindow(wid);
  add(make(wid, L, 'character', '陆小凤', 303, 303));
  add(make(wid, L, 'character', '霍老头', 363, 363));
  add(make(wid, L, 'character', '独孤方', 365, 365));
  add(make(wid, L, 'character', '霍休', 367, 367));
  add(make(wid, L, 'character', '鲁直', 345, 345));
  add(make(wid, L, 'character', '陆放翁', 353, 353));
  add(make(wid, L, 'location', '陆放翁的夏日行吟处', 353, 353));
  add(make(wid, L, 'location', '皇宫大内', 345, 345));
  add(make(wid, L, 'location', '江南', 367, 367));
  add(make(wid, L, 'location', '关中', 367, 367));
  add(make(wid, L, 'faction', '江南花家', 367, 367));
  add(make(wid, L, 'faction', '关中阎家', 367, 367));
  add(make(wid, L, 'item', '雕花木椅', 341, 341));
  add(make(wid, L, 'item', '元宝', 307, 307));
  add(make(wid, L, 'item', '花篮', 301, 301));
}

// ===== w005 =====
{
  const wid = 'ch003_w005';
  const L = parseWindow(wid);
  add(make(wid, L, 'character', '陆小凤', 407, 407));
  add(make(wid, L, 'character', '花满楼', 441, 441));
  add(make(wid, L, 'character', '丹凤公主', 477, 477));
  // 小女孩 is generic - skip
  // 陈小凤 is OCR error of 陆小凤 at line 427 - skip as not real name
}

// ===== w006 =====
{
  const wid = 'ch003_w006';
  const L = parseWindow(wid);
  add(make(wid, L, 'character', '陆小凤', 503, 503));
  add(make(wid, L, 'character', '丹凤公主', 511, 511));
  add(make(wid, L, 'character', '花满楼', 569, 569));
  add(make(wid, L, 'character', '上官飞燕', 579, 579));
  add(make(wid, L, 'character', '雪儿', 583, 583));
  add(make(wid, L, 'character', '朱停', 607, 607));
  // 丹风公主 is OCR typo of 丹凤公主 - still extract as appears in text
  const ln = findLine(L, '丹风公主', 543);
  if (ln != null) add(make(wid, L, 'character', '丹风公主', ln, ln));
}

// ===== w007 =====
{
  const wid = 'ch003_w007';
  const L = parseWindow(wid);
  add(make(wid, L, 'character', '陆小凤', 601, 601));
  add(make(wid, L, 'character', '花满楼', 601, 601));
  add(make(wid, L, 'character', '丹凤公主', 611, 611));
  add(make(wid, L, 'character', '朱停', 607, 607));
  add(make(wid, L, 'character', '柳余恨', 627, 627));
  add(make(wid, L, 'character', '萧秋雨', 627, 627));
  add(make(wid, L, 'character', '独孤方', 627, 627));
  add(make(wid, L, 'character', '大金鹏王', 655, 655));
  const ln = findLine(L, '丹风公主', 603);
  if (ln != null) add(make(wid, L, 'character', '丹风公主', ln, ln));
}

// assign ids per window
const byWin = {};
for (const c of all) {
  byWin[c.window_id] = byWin[c.window_id] || [];
  byWin[c.window_id].push(c);
}
const ordered = [];
const windows = ['ch003_w001','ch003_w002','ch003_w003','ch003_w004','ch003_w005','ch003_w006','ch003_w007'];
for (const wid of windows) {
  const list = byWin[wid] || [];
  list.forEach((c, i) => {
    c.candidate_id = `cand_${wid}_${String(i + 1).padStart(4, '0')}`;
    ordered.push(c);
  });
}

const outPath = `${DIR}/_extract_ch003.jsonl`;
fs.writeFileSync(outPath, ordered.map(c => JSON.stringify(c)).join('\n') + '\n');
fs.writeFileSync(`${DIR}/_extract_ch003.done.json`, JSON.stringify({
  pass: 'named-inventory',
  window_ids: windows,
}, null, 2) + '\n');

const names = [...new Set(ordered.map(c => c.name))].sort();
const byCat = {};
for (const c of ordered) byCat[c.category_hint] = (byCat[c.category_hint] || 0) + 1;
const byW = {};
for (const c of ordered) byW[c.window_id] = (byW[c.window_id] || 0) + 1;
console.log(JSON.stringify({
  windows: windows.length,
  candidates: ordered.length,
  byWindow: byW,
  byCategory: byCat,
  names,
}, null, 2));
