#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 批量清理小说文件
// 功能：
// 1. 删除行首空格
// 2. 删除网站信息（如"热血古龙(rxgl.net)提供最佳古龙小说阅读版本"）
// 3. 删除序言（与小说正文无关的作者自述）

const AD_PATTERNS = [
  /www\./i,
  /http/i,
  /\.com/i,
  /\.cn/i,
  /网址/i,
  /网站/i,
  /手机阅读/i,
  /TXT下载/i,
  /电子书/i,
  /小说下载/i,
  /免费阅读/i,
  /最新章节/i,
  /笔趣阁/i,
  /顶点小说/i,
  /69书吧/i,
  /书趣阁/i,
  /热血古龙/i,
  /rxgl\.net/i,
  /提供最佳.*阅读版本/i,
];

const PREFACE_PATTERNS = [
  /◆.*前言.*◆/,
  /^序言/,
  /^前言/,
  /^自序/,
  /^作者序/,
  /^写在前面/,
  /^作者简介/,
  /^内容简介/,
  /^关于本书/,
];

function findNovelFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && !entry.name.startsWith('_')) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.txt') && !entry.name.includes('split')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function findPrefaceEnd(lines, startIndex) {
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();

    // 检查是否是正文开始的标记
    if (/^第[一二三四五六七八九十百千\d]+[回章]/.test(line)) {
      return i;
    }

    // 检查是否是楔子（楔子是小说的一部分，不应该删除）
    if (/^楔子/.test(line)) {
      return -1;
    }
  }

  return -1;
}

function processFile(filePath, dryRun = true) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const result = {
      file: filePath,
      totalLines: lines.length,
      prefaceStart: -1,
      prefaceEnd: -1,
      headerEnd: 0,
      isXiezi: false,
      removed: false,
      hasHeader: false,
      hasAd: false
    };

    // 查找头部信息结束位置
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (/^小说：/.test(line) ||
          /热血古龙|rxgl\.net|提供最佳.*阅读版本/.test(line) ||
          /^\s*$/.test(line)) {
        result.headerEnd = i + 1;
        result.hasHeader = true;
      } else {
        break;
      }
    }

    // 查找序言开始位置
    for (let i = result.headerEnd; i < Math.min(result.headerEnd + 200, lines.length); i++) {
      const line = lines[i].trim();

      if (PREFACE_PATTERNS.some(pattern => pattern.test(line)) ||
          /◆写在.*之前◆/.test(line)) {
        result.prefaceStart = i;
        break;
      }
    }

    // 查找广告内容
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (AD_PATTERNS.some(pattern => pattern.test(line))) {
        result.hasAd = true;
        break;
      }
    }

    // 如果有序言，查找序言结束位置
    if (result.prefaceStart !== -1) {
      result.prefaceEnd = findPrefaceEnd(lines, result.prefaceStart);

      if (result.prefaceEnd === -1) {
        result.isXiezi = true;
      }
    }

    // 执行清理
    if (!dryRun) {
      let newLines;

      if (result.prefaceStart !== -1 && !result.isXiezi) {
        // 删除头部信息和序言
        newLines = [
          ...lines.slice(0, result.headerEnd),
          ...lines.slice(result.prefaceEnd)
        ];
      } else if (result.hasHeader) {
        // 只删除头部信息
        newLines = lines.slice(result.headerEnd);
      } else {
        // 只清理行首空格
        newLines = lines;
      }

      // 清理行首空格
      const cleanedLines = newLines.map(line => line.replace(/^[\s　]+/, ''));

      // 删除文件开头的空行
      while (cleanedLines.length > 0 && cleanedLines[0].trim() === '') {
        cleanedLines.shift();
      }

      fs.writeFileSync(filePath, cleanedLines.join('\n'), 'utf-8');
      result.removed = true;
    }

    return result;
  } catch (error) {
    return {
      file: filePath,
      error: error.message
    };
  }
}

// 主程序
const args = process.argv.slice(2);
const command = args[0] || 'scan';
const targetDir = args[1] || '.';
const dryRun = command === 'scan';

console.log(`\n武侠小说批量清理工具`);
console.log(`命令: ${command}`);
console.log(`目标目录: ${path.resolve(targetDir)}`);
console.log(`模式: ${dryRun ? '扫描模式（不修改文件）' : '清理模式（将修改文件）'}\n`);

const novelFiles = findNovelFiles(targetDir);
console.log(`找到 ${novelFiles.length} 个小说文件\n`);

let totalStats = {
  files: 0,
  totalLines: 0,
  headerFiles: 0,
  prefaceFiles: 0,
  xieziFiles: 0,
  adFiles: 0,
  cleanedFiles: 0
};

const filesToClean = [];

for (const file of novelFiles) {
  const result = processFile(file, dryRun);

  if (result.error) {
    console.log(`❌ ${file}: ${result.error}`);
    continue;
  }

  totalStats.files++;
  totalStats.totalLines += result.totalLines;

  if (result.hasHeader) {
    totalStats.headerFiles++;
  }

  if (result.prefaceStart !== -1) {
    if (result.isXiezi) {
      totalStats.xieziFiles++;
    } else {
      totalStats.prefaceFiles++;
      filesToClean.push(file);
    }
  }

  if (result.hasAd) {
    totalStats.adFiles++;
  }

  if (result.removed) {
    totalStats.cleanedFiles++;
  }
}

console.log(`\n=== 统计 ===`);
console.log(`文件数: ${totalStats.files}`);
console.log(`总行数: ${totalStats.totalLines}`);
console.log(`含头部信息的文件: ${totalStats.headerFiles}`);
console.log(`含序言的文件: ${totalStats.prefaceFiles}`);
console.log(`含楔子的文件: ${totalStats.xieziFiles}`);
console.log(`含广告的文件: ${totalStats.adFiles}`);

if (dryRun) {
  console.log(`\n需要清理的文件: ${filesToClean.length}`);
  filesToClean.forEach(file => console.log(`  - ${file}`));
  console.log(`\n提示: 使用 'node scripts/batch-cleanup.js clean' 来执行清理`);
} else {
  console.log(`已清理的文件: ${totalStats.cleanedFiles}`);
}
