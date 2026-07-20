#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 专门处理序言的脚本
// 识别并删除真正的序言内容（与小说正文无关的作者自述）

function findPrefaceEnd(lines, startIndex) {
  // 从 startIndex 开始，找到序言的结束位置
  // 序言通常以"第X回"或"第X章"等正文标记结束

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();

    // 检查是否是正文开始的标记
    if (/^第[一二三四五六七八九十百千\d]+[回章]/.test(line)) {
      return i;
    }

    // 检查是否是楔子（楔子是小说的一部分，不应该删除）
    if (/^楔子/.test(line)) {
      return -1; // 表示这是楔子，不应该删除
    }
  }

  return -1; // 没有找到正文开始标记
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
      isXiezi: false,
      removed: false,
      headerEnd: -1
    };

    // 查找序言开始位置
    // 通常在文件开头，包含"前言"、"序言"等关键词
    for (let i = 0; i < Math.min(200, lines.length); i++) {
      const line = lines[i].trim();

      // 检查是否是序言开始
      if (/◆.*前言.*◆/.test(line) ||
          /^序言/.test(line) ||
          /^前言/.test(line) ||
          /^自序/.test(line) ||
          /^作者序/.test(line) ||
          /◆写在.*之前◆/.test(line)) {
        result.prefaceStart = i;
        break;
      }

      // 检查是否是网站信息（通常在序言之前）
      if (/热血古龙|rxgl\.net|提供最佳.*阅读版本/.test(line)) {
        // 这是网站信息，跳过
        continue;
      }

      // 如果第一行就是"小说：..."，跳过
      if (/^小说：/.test(line)) {
        continue;
      }
    }

    // 查找网站信息结束位置（在序言开始之前）
    let headerEnd = 0;
    for (let i = 0; i < (result.prefaceStart === -1 ? lines.length : result.prefaceStart); i++) {
      const line = lines[i].trim();

      // 检查是否是需要删除的头部信息
      if (/^小说：/.test(line) ||
          /热血古龙|rxgl\.net|提供最佳.*阅读版本/.test(line) ||
          /^\s*$/.test(line)) {
        headerEnd = i + 1;
      } else {
        break;
      }
    }
    result.headerEnd = headerEnd;

    // 如果没有找到序言开始标记，只删除头部信息
    if (result.prefaceStart === -1) {
      if (headerEnd > 0 && !dryRun) {
        const newLines = lines.slice(headerEnd);
        const cleanedLines = newLines.map(line => line.replace(/^[\s　]+/, ''));
        fs.writeFileSync(filePath, cleanedLines.join('\n'), 'utf-8');
        result.removed = true;
      }
      return result;
    }

    // 查找序言结束位置
    result.prefaceEnd = findPrefaceEnd(lines, result.prefaceStart);

    // 如果是楔子，不删除
    if (result.prefaceEnd === -1) {
      result.isXiezi = true;
      return result;
    }

    if (!dryRun) {
      // 删除头部信息和序言部分
      const newLines = [
        ...lines.slice(0, headerEnd),
        ...lines.slice(result.prefaceEnd)
      ];

      // 同时清理行首空格
      const cleanedLines = newLines.map(line => line.replace(/^[\s　]+/, ''));

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
const filePath = args[1];
const dryRun = command === 'scan';

if (!filePath) {
  console.log('用法: node remove-preface.js [scan|clean] <文件路径>');
  process.exit(1);
}

console.log(`\n序言处理工具`);
console.log(`命令: ${command}`);
console.log(`目标文件: ${filePath}`);
console.log(`模式: ${dryRun ? '扫描模式（不修改文件）' : '清理模式（将修改文件）'}\n`);

const result = processFile(filePath, dryRun);

if (result.error) {
  console.log(`❌ 错误: ${result.error}`);
  process.exit(1);
}

if (result.prefaceStart === -1) {
  console.log('✅ 未发现序言内容');
} else if (result.isXiezi) {
  console.log('📝 发现楔子内容（楔子是小说的一部分，将保留）');
} else {
  console.log(`📝 发现序言内容`);
  console.log(`   开始位置: 第 ${result.prefaceStart + 1} 行`);
  console.log(`   结束位置: 第 ${result.prefaceEnd + 1} 行`);
  console.log(`   行数: ${result.prefaceEnd - result.prefaceStart}`);

  if (dryRun) {
    console.log(`\n提示: 使用 'node remove-preface.js clean ${filePath}' 来执行清理`);
  } else {
    console.log(`✅ 已删除序言内容`);
  }
}
