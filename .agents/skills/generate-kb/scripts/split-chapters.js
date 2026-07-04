#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: split-chapters.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);
if (!fs.existsSync(novelDir)) {
  console.error(`Not found: ${novelDir}`);
  process.exit(1);
}

const baseName = path.basename(novelDir);
const txtPath = path.join(novelDir, `${baseName}.txt`);
if (!fs.existsSync(txtPath)) {
  console.error(`Novel file not found: ${txtPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(txtPath, 'utf8');
const lines = raw.split(/\r?\n/);
console.log(`Read ${lines.length} lines from ${txtPath}`);

const chapterHeaderRe = /^第[零一二三四五六七八九十百千\d]{1,8}[回章]\s*.*$/;
const numRe = /^第([零一二三四五六七八九十百千\d]{1,8})[回章]/;

const candidateIndices = [];
for (let i = 0; i < lines.length; i++) {
  if (chapterHeaderRe.test(lines[i].trim())) candidateIndices.push(i);
}

const realHeaderSet = new Set();
for (const i of candidateIndices) {
  const title = lines[i].trim();
  const isTocStyle = title.length >= 8;
  if (!isTocStyle) realHeaderSet.add(i);
}

const cnDigitMap = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '百': 100, '千': 1000 };
function cnToNum(s) {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  let result = 0;
  let current = 0;
  let lastWasUnit = false;
  for (const ch of s) {
    const v = cnDigitMap[ch];
    if (v === undefined) continue;
    if (v >= 10) {
      if (current === 0) current = 1;
      if (v === 1000) { result += current * 1000; current = 0; }
      else if (v === 100) { result += current * 100; current = 0; }
      else if (v === 10) { result += current * 10; current = 0; }
      lastWasUnit = true;
    } else {
      current = v;
      lastWasUnit = false;
    }
  }
  if (!lastWasUnit) result += current;
  return result;
}

const chapters = [];
let current = null;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (realHeaderSet.has(i)) {
    if (current) {
      current.lineEnd = i;
      chapters.push(current);
    }
    const m = numRe.exec(line.trim());
    current = {
      n: m ? cnToNum(m[1]) : chapters.length + 1,
      title: line.trim(),
      lineStart: i + 1,
      lineEnd: null,
    };
  }
}
if (current) {
  current.lineEnd = lines.length;
  chapters.push(current);
}

console.log(`Detected ${chapters.length} chapters`);
for (const c of chapters) {
  c.charCount = lines.slice(c.lineStart, c.lineEnd).join('\n').length;
}

const splitDir = path.join(novelDir, 'ch_split');
fs.mkdirSync(splitDir, { recursive: true });
for (const c of chapters) {
  const chapterLines = lines.slice(c.lineStart, c.lineEnd);
  const padded = String(c.n).padStart(3, '0');
  fs.writeFileSync(path.join(splitDir, `ch_${padded}.txt`), chapterLines.join('\n'), 'utf8');
}

const manifest = {
  novel: baseName,
  sourceFile: `${baseName}.txt`,
  totalLines: lines.length,
  totalChapters: chapters.length,
  chapters: chapters.map(c => ({
    n: c.n,
    title: c.title,
    lineStart: c.lineStart + 1,
    lineEnd: c.lineEnd,
    charCount: c.charCount,
  })),
};
fs.writeFileSync(path.join(novelDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Wrote manifest.json`);

const seedPatterns = [
  /段誉|乔峰|萧峰|虚竹|王语嫣|慕容复|阿朱|阿紫|木婉清|钟灵|段正淳|刀白凤|阮星竹|秦红棉|甘宝宝|王夫人|李秋水|天山童姥|无崖子|丁春秋|游坦之|鸠摩智|玄慈|萧远山|慕容博|扫地僧|耶律洪基|完颜阿骨打/g,
  /少林|丐帮|大理|逍遥派|星宿|灵鹫宫|姑苏|慕容氏|段氏|全真|古墓|武当|峨眉|明教|日月神教|恒山|华山|嵩山|泰山|衡山|青城|无量剑|神龙教|天地会|红花会|侠客岛|桃花岛|白驼山|铁掌帮/g,
  /大理国|无量山|少林寺|灵鹫宫|雁门关|聚贤庄|曼陀山庄|燕子坞|参合庄|听香水榭|西夏|辽国|宋境|姑苏|无锡|信阳|擂鼓山|缥缈峰|少室山|天山|星宿海|大理城|镇南王府|大轮寺/g,
  /北冥神功|凌波微步|六脉神剑|一阳指|降龙十八掌|打狗棒法|易筋经|小无相功|天山折梅手|天山六阳掌|生死符|斗转星移|参合指|火焰刀|袈裟伏魔功|擒龙功|伏魔杖法|太祖长拳|大金刚掌|拈花指|无相劫指|般若掌|龙爪手|韦陀杵|神足经|化功大法|吸星大法|八荒六合唯我独尊功|白虹掌力|寒袖拂穴|天竺点穴手|五罗轻烟掌/g,
];
const combined = new RegExp(seedPatterns.map(p => p.source).join('|'), 'g');

const mentionIndex = [];
const seenPerChapter = new Map();
for (const c of chapters) {
  const chapSeen = new Set();
  seenPerChapter.set(c.n, chapSeen);
  for (let lineIdx = c.lineStart; lineIdx < c.lineEnd; lineIdx++) {
    const line = lines[lineIdx];
    let m;
    combined.lastIndex = 0;
    while ((m = combined.exec(line)) !== null) {
      const term = m[0];
      if (!chapSeen.has(term)) chapSeen.add(term);
      mentionIndex.push({
        chapter: c.n,
        line: lineIdx + 1,
        term,
        snippet: line.length > 80 ? line.slice(0, 80) + '…' : line,
      });
    }
  }
}

const jsonlPath = path.join(novelDir, 'mention_index.jsonl');
const stream = fs.createWriteStream(jsonlPath, { encoding: 'utf8' });
for (const entry of mentionIndex) {
  stream.write(JSON.stringify(entry) + '\n');
}
stream.end();
console.log(`Wrote mention_index.jsonl (${mentionIndex.length} entries)`);

const freq = new Map();
for (const e of mentionIndex) freq.set(e.term, (freq.get(e.term) || 0) + 1);
const topN = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
console.log('Top 30 terms:');
for (const [term, count] of topN) console.log(`  ${term}\t${count}`);

console.log('Done.');
