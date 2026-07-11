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

// ============================================================
// Load configuration
// ============================================================
function loadConfig() {
  // Default configuration
  const defaultConfig = {
    chapterPattern: '^第[零一二三四五六七八九十百千\\d]{1,8}[回章]\\s*.*$',
    numberPattern: '^第([零一二三四五六七八九十百千\\d]{1,8})[回章]',
    seedPatterns: []
  };

  // Try to load from multiple locations
  const configPaths = [
    path.join(novelDir, 'split-config.json'),
    path.join(novelDir, 'build', 'split-config.json'),
    path.join(novelDir, 'prompts', 'split-config.json')
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log(`Loaded config from ${configPath}`);
        return { ...defaultConfig, ...config };
      } catch (e) {
        console.warn(`Failed to parse ${configPath}: ${e.message}`);
      }
    }
  }

  console.log('No split-config.json found, using default configuration');
  return defaultConfig;
}

const config = loadConfig();

// ============================================================
// Read novel file
// ============================================================
const baseName = path.basename(novelDir);
const txtPath = path.join(novelDir, `${baseName}.txt`);
if (!fs.existsSync(txtPath)) {
  console.error(`Novel file not found: ${txtPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(txtPath, 'utf8');
const lines = raw.split(/\r?\n/);
console.log(`Read ${lines.length} lines from ${txtPath}`);

// ============================================================
// Parse chapter pattern from config
// ============================================================
const chapterHeaderRe = new RegExp(config.chapterPattern);
const numRe = new RegExp(config.numberPattern);

console.log(`Chapter pattern: ${config.chapterPattern}`);

// ============================================================
// Detect chapter headers
// ============================================================
const candidateIndices = [];
for (let i = 0; i < lines.length; i++) {
  if (chapterHeaderRe.test(lines[i].trim())) candidateIndices.push(i);
}

console.log(`Found ${candidateIndices.length} candidate chapter headers`);

// Detect TOC entries: if the same title appears more than once, the first occurrence is likely TOC
const titleCountMap = new Map();
for (const i of candidateIndices) {
  const title = lines[i].trim();
  if (!titleCountMap.has(title)) titleCountMap.set(title, []);
  titleCountMap.get(title).push(i);
}

const realHeaderSet = new Set();
for (const [title, indices] of titleCountMap) {
  if (indices.length > 1) {
    // Duplicate title: keep only the last occurrence (actual chapter, not TOC)
    realHeaderSet.add(indices[indices.length - 1]);
  } else {
    // Unique title: keep it
    realHeaderSet.add(indices[0]);
  }
}

// ============================================================
// Chinese number conversion
// ============================================================
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

// ============================================================
// Split chapters
// ============================================================
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

// ============================================================
// Write chapter files
// ============================================================
const splitDir = path.join(novelDir, 'ch_split');
fs.mkdirSync(splitDir, { recursive: true });
for (const c of chapters) {
  const chapterLines = lines.slice(c.lineStart, c.lineEnd);
  const padded = String(c.n).padStart(3, '0');
  fs.writeFileSync(path.join(splitDir, `ch_${padded}.txt`), chapterLines.join('\n'), 'utf8');
}

// ============================================================
// Write manifest.json (to build/)
// ============================================================
const buildDir = path.join(novelDir, 'build');
fs.mkdirSync(buildDir, { recursive: true });

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
fs.writeFileSync(path.join(buildDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Wrote manifest.json`);

// ============================================================
// Generate mention index (if seedPatterns provided)
// ============================================================
if (config.seedPatterns && config.seedPatterns.length > 0) {
  const seedPatterns = config.seedPatterns.map(p => new RegExp(p, 'g'));
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

  const jsonlPath = path.join(buildDir, 'mention_index.jsonl');
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
} else {
  console.log('No seedPatterns in config, skipping mention index generation');
}

console.log('Done.');
