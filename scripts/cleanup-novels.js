#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 武侠小说清理脚本
// 功能：
// 1. 删除行首空格（全角空格和普通空格）
// 2. 识别并标记可能的广告内容
// 3. 识别并标记可能的序言内容

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
];

const PREFACE_PATTERNS = [
  /^.*序言/,
  /^.*前言/,
  /^.*自序/,
  /^.*作者序/,
  /^.*写在前面/,
  /^.*作者简介/,
  /^.*内容简介/,
  /^.*关于本书/,
  /^.*本书由.*整理/,
  /^.*版权归原作者所有/,
  /^.*仅供读者预览/,
  /^.*请于下载后/,
  /^.*如果喜欢请购买正版/,
];

function isAdLine(line) {
  return AD_PATTERNS.some(pattern => pattern.test(line));
}

function isPrefaceLine(line) {
  return PREFACE_PATTERNS.some(pattern => pattern.test(line));
}

function cleanLine(line) {
  // 删除行首空格（全角空格和普通空格）
  return line.replace(/^[\s　]+/, '');
}

function processFile(filePath, dryRun = true) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const result = {
      file: filePath,
      totalLines: lines.length,
      cleanedLines: 0,
      adLines: [],
      prefaceLines: [],
      changes: []
    };

    const cleanedLines = lines.map((line, index) => {
      const original = line;
      let cleaned = cleanLine(line);

      // 检查广告
      if (isAdLine(line)) {
        result.adLines.push({
          line: index + 1,
          content: line.substring(0, 50) + (line.length > 50 ? '...' : '')
        });
      }

      // 检查序言
      if (isPrefaceLine(line)) {
        result.prefaceLines.push({
          line: index + 1,
          content: line.substring(0, 50) + (line.length > 50 ? '...' : '')
        });
      }

      if (cleaned !== original) {
        result.cleanedLines++;
        result.changes.push({
          line: index + 1,
          before: original.substring(0, 30) + (original.length > 30 ? '...' : ''),
          after: cleaned.substring(0, 30) + (cleaned.length > 30 ? '...' : '')
        });
      }

      return cleaned;
    });

    // 如果不是 dry run，则写入文件
    if (!dryRun && result.cleanedLines > 0) {
      fs.writeFileSync(filePath, cleanedLines.join('\n'), 'utf-8');
    }

    return result;
  } catch (error) {
    return {
      file: filePath,
      error: error.message
    };
  }
}

function findNovelFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.txt') && !entry.name.includes('split')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// 主程序
const args = process.argv.slice(2);
const command = args[0] || 'scan';
const targetDir = args[1] || '.';
const dryRun = command === 'scan';

console.log(`\n武侠小说清理工具`);
console.log(`命令: ${command}`);
console.log(`目标目录: ${path.resolve(targetDir)}`);
console.log(`模式: ${dryRun ? '扫描模式（不修改文件）' : '清理模式（将修改文件）'}\n`);

const novelFiles = findNovelFiles(targetDir);
console.log(`找到 ${novelFiles.length} 个小说文件\n`);

let totalStats = {
  files: 0,
  totalLines: 0,
  cleanedLines: 0,
  adFiles: 0,
  prefaceFiles: 0
};

for (const file of novelFiles) {
  const result = processFile(file, dryRun);

  if (result.error) {
    console.log(`❌ ${file}: ${result.error}`);
    continue;
  }

  totalStats.files++;
  totalStats.totalLines += result.totalLines;
  totalStats.cleanedLines += result.cleanedLines;

  if (result.adLines.length > 0) {
    totalStats.adFiles++;
    console.log(`⚠️  ${file}: 发现 ${result.adLines.length} 行广告内容`);
    result.adLines.slice(0, 3).forEach(ad => {
      console.log(`   第 ${ad.line} 行: ${ad.content}`);
    });
    if (result.adLines.length > 3) {
      console.log(`   ... 还有 ${result.adLines.length - 3} 行`);
    }
  }

  if (result.prefaceLines.length > 0) {
    totalStats.prefaceFiles++;
    console.log(`📝 ${file}: 发现 ${result.prefaceLines.length} 行序言内容`);
    result.prefaceLines.slice(0, 3).forEach(pref => {
      console.log(`   第 ${pref.line} 行: ${pref.content}`);
    });
  }

  if (result.cleanedLines > 0 && !dryRun) {
    console.log(`✅ ${file}: 清理了 ${result.cleanedLines} 行`);
  }
}

console.log(`\n=== 统计 ===`);
console.log(`文件数: ${totalStats.files}`);
console.log(`总行数: ${totalStats.totalLines}`);
console.log(`需要清理的行: ${totalStats.cleanedLines}`);
console.log(`含广告的文件: ${totalStats.adFiles}`);
console.log(`含序言的文件: ${totalStats.prefaceFiles}`);

if (dryRun) {
  console.log(`\n提示: 使用 'node scripts/cleanup-novels.js clean' 来执行清理`);
}
