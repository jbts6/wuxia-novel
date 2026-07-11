#!/usr/bin/env node
'use strict';

/**
 * locate-dialogues.js
 * 精确定位 dialogues.json 中每条对话的行号，删除原文中不存在的幻觉条目。
 *
 * LLM 生成的 dialogues 行号是估算值，偏差可达数百行。
 * 此脚本用子串搜索修正行号，并删除原文中找不到的条目。
 *
 * 用法: node locate-dialogues.js <novelDir>
 * 输入: <novelDir>/data/dialogues.json + ch_split/
 * 输出: 原地更新 dialogues.json（修正行号 + 删除幻觉）
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: locate-dialogues.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);
const splitDir = path.join(novelDir, 'ch_split');
const dPath = path.join(novelDir, 'data', 'dialogues.json');

if (!fs.existsSync(splitDir)) {
  console.error('ch_split/ not found');
  process.exit(1);
}
if (!fs.existsSync(dPath)) {
  console.error('data/dialogues.json not found');
  process.exit(1);
}

// Load all chapters
const chapters = new Map();
for (const f of fs.readdirSync(splitDir)) {
  if (!f.startsWith('ch_') || !f.endsWith('.txt')) continue;
  const n = parseInt(f.slice(3, -4), 10);
  if (isNaN(n)) continue;
  chapters.set(n, fs.readFileSync(path.join(splitDir, f), 'utf8'));
}
console.log(`Loaded ${chapters.size} chapters`);

// Load dialogues
const dialogues = JSON.parse(fs.readFileSync(dPath, 'utf8'));
console.log(`Loaded ${dialogues.length} dialogues`);

let located = 0;
let relocated = 0;
let hallucinated = 0;

const kept = [];

for (const d of dialogues) {
  if (!d.text || d.text.length < 5) {
    hallucinated++;
    continue;
  }

  const cleanText = d.text.trim();
  let found = false;

  // Step 1: search in the specified chapter
  const chText = chapters.get(d.chapter);
  if (chText) {
    const idx = chText.indexOf(cleanText);
    if (idx !== -1) {
      const lineStart = chText.substring(0, idx).split('\n').length;
      const lineEnd = chText.substring(0, idx + cleanText.length).split('\n').length;

      if (lineStart !== d.line_start || lineEnd !== d.line_end) {
        d.line_start = lineStart;
        d.line_end = lineEnd;
        relocated++;
      } else {
        located++;
      }
      found = true;
    }
  }

  // Step 2: if not found in specified chapter, search all chapters
  if (!found) {
    for (const [chNum, chText] of chapters) {
      const idx = chText.indexOf(cleanText);
      if (idx !== -1) {
        const lineStart = chText.substring(0, idx).split('\n').length;
        const lineEnd = chText.substring(0, idx + cleanText.length).split('\n').length;

        d.chapter = chNum;
        d.line_start = lineStart;
        d.line_end = lineEnd;
        relocated++;
        found = true;
        break;
      }
    }
  }

  if (found) {
    kept.push(d);
  } else {
    hallucinated++;
  }
}

// Write back
fs.writeFileSync(dPath, JSON.stringify(kept, null, 2) + '\n', 'utf8');

console.log(`\n=== locate-dialogues summary ===`);
console.log(`Input:  ${dialogues.length} dialogues`);
console.log(`Output: ${kept.length} dialogues`);
console.log(`  located (unchanged): ${located}`);
console.log(`  relocated (line fixed): ${relocated}`);
console.log(`  hallucinated (removed): ${hallucinated}`);
