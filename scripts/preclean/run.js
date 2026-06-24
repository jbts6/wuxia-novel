#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { sanitizeNovelFile } = require('./sanitizer');

/**
 * 对一个小说目录执行完整预清洗。
 *
 * 用法: node run.js <novelDir>
 * 示例: node run.js 金庸/天龙八部
 */

const FILE_KINDS = [
  // 先清洗 characters（其他文件引用它）
  { fileName: 'characters.json', fileKind: 'characters' },
  { fileName: 'dialogues.json', fileKind: 'dialogues' },
  { fileName: 'locations.json', fileKind: 'locations' },
  { fileName: 'factions.json', fileKind: 'factions' },
  { fileName: 'items.json', fileKind: 'items' },
  { fileName: 'skills.json', fileKind: 'skills' },
  { fileName: 'techniques.json', fileKind: 'techniques' },
];

function getCompanionFiles(novelDir, currentKind) {
  const companions = {};
  const map = {
    characters: 'characters.json',
    skills: 'skills.json',
    techniques: 'techniques.json',
    locations: 'locations.json',
  };
  for (const [kind, file] of Object.entries(map)) {
    if (kind === currentKind) continue;
    const p = path.join(novelDir, file);
    if (fs.existsSync(p)) companions[kind] = p;
  }
  return companions;
}

function main() {
  const novelDir = process.argv[2];
  if (!novelDir) {
    console.error('用法: node run.js <novelDir>');
    process.exit(1);
  }

  if (!fs.existsSync(novelDir)) {
    console.error(`目录不存在: ${novelDir}`);
    process.exit(1);
  }

  console.log(`\n=== 预清洗: ${novelDir} ===\n`);

  const results = [];

  for (const { fileName, fileKind } of FILE_KINDS) {
    const workPath = path.join(novelDir, fileName);
    if (!fs.existsSync(workPath)) {
      console.log(`⏭  跳过 ${fileName}（文件不存在）`);
      continue;
    }

    const companionFiles = getCompanionFiles(novelDir, fileKind);

    try {
      const result = sanitizeNovelFile({ novelDir, fileName, fileKind, companionFiles });
      const status = result.changed ? '✓' : '○';
      console.log(`${status}  ${fileName}: ${result.changed ? '已修改' : '无变化'}`);
      results.push({ fileName, ...result });
    } catch (err) {
      console.error(`✗  ${fileName}: ${err.message}`);
      results.push({ fileName, error: err.message });
    }
  }

  // 汇总
  console.log('\n=== 汇总 ===\n');
  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.fileName}: 错误 - ${r.error}`);
    } else {
      console.log(`  ${r.fileName}: ${r.changed ? '已修改' : '无变化'} → ${r.reportPath}`);
    }
  }
  console.log('');
}

main();
