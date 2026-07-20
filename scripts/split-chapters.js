'use strict';

const fs = require('node:fs');
const path = require('node:path');

// 章节标题匹配规则（与 generate-game-kb 保持一致）
const CHAPTER_HEADING = /^(?:第[零〇一二三四五六七八九十百千两\d]+(?:章|回|节|卷)|卷[零〇一二三四五六七八九十百千两\d]+)\s*.*$/;
const BARE_CHAPTER_HEADING = /^(?:[一二三四五六七八九十]{1,3}|\d{1,3})$/;
const CHINESE_DIGITS = Object.freeze({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 });

function bareChapterNumber(value) {
  if (!BARE_CHAPTER_HEADING.test(value)) return null;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === '十') return 10;
  const ten = value.indexOf('十');
  if (ten < 0) return CHINESE_DIGITS[value] ?? null;
  const tens = ten === 0 ? 1 : CHINESE_DIGITS[value.slice(0, ten)];
  const ones = ten === value.length - 1 ? 0 : CHINESE_DIGITS[value.slice(ten + 1)];
  return tens && ones !== undefined ? (tens * 10) + ones : null;
}

function sequentialBareChapterStarts(lines) {
  const candidates = lines.map((line, index) => ({ index, number: bareChapterNumber(line.trim()) }))
    .filter(entry => entry.number !== null);
  if (candidates.length < 2) return [];
  if (!candidates.every((entry, index) => entry.number === index + 1)) return [];
  return candidates.map(entry => entry.index);
}

function normalizeSource(value) {
  const normalized = String(value).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

function splitChapters(sourceText, fallbackTitle = '第一章') {
  const source = normalizeSource(sourceText);
  const lines = source.split('\n');
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (CHAPTER_HEADING.test(lines[index].trim())) starts.push(index);
  }
  if (starts.length === 0) starts.push(...sequentialBareChapterStarts(lines));

  if (starts.length === 0) {
    return [{ number: 1, title: fallbackTitle, content: source }];
  }

  return starts.map((start, index) => {
    const from = index === 0 ? 0 : start;
    const to = starts[index + 1] ?? lines.length - 1;
    const content = `${lines.slice(from, to).join('\n').replace(/\n+$/g, '')}\n`;
    return {
      number: index + 1,
      title: lines[start].trim(),
      content
    };
  });
}

function discoverSource(novelDir) {
  const novel = path.resolve(novelDir);
  if (!fs.existsSync(novel) || !fs.statSync(novel).isDirectory()) {
    throw new Error(`小说目录不存在: ${novel}`);
  }

  const preferred = path.join(novel, `${path.basename(novel)}.txt`);
  if (fs.existsSync(preferred) && fs.statSync(preferred).isFile()) return preferred;

  const candidates = fs.readdirSync(novel, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.txt'))
    .map(entry => path.join(novel, entry.name))
    .sort();
  if (candidates.length === 0) {
    throw new Error(`找不到源文件: ${novel}`);
  }
  if (candidates.length > 1) {
    throw new Error(`找到多个源文件: ${candidates.map(file => path.basename(file)).join(', ')}`);
  }
  return candidates[0];
}

function splitNovelChapters(novelDir) {
  const novel = path.resolve(novelDir);
  const sourceFile = discoverSource(novel);
  const source = fs.readFileSync(sourceFile, 'utf8');
  const chapters = splitChapters(source, path.basename(novel));

  const chSplitDir = path.join(novel, 'ch_split');
  if (!fs.existsSync(chSplitDir)) {
    fs.mkdirSync(chSplitDir, { recursive: true });
  }

  const results = [];
  for (const chapter of chapters) {
    const file = path.join(chSplitDir, `ch_${String(chapter.number).padStart(3, '0')}.txt`);
    fs.writeFileSync(file, chapter.content, 'utf8');
    results.push({
      number: chapter.number,
      title: chapter.title,
      file: path.relative(novel, file)
    });
  }

  return {
    novel: path.basename(novel),
    sourceFile: path.relative(novel, sourceFile),
    chapters: results.length,
    files: results.slice(0, 5) // 只显示前5个作为示例
  };
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('用法: node split-chapters.js <小说目录> [小说目录2 ...]');
    console.log('示例: node split-chapters.js "古龙/七杀手" "金庸/越女剑"');
    process.exit(1);
  }

  const results = [];
  for (const novelDir of args) {
    try {
      console.log(`处理: ${novelDir}`);
      const result = splitNovelChapters(novelDir);
      results.push(result);
      console.log(`  ✓ 完成: ${result.chapters} 章`);
    } catch (error) {
      console.error(`  ✗ 失败: ${error.message}`);
      results.push({ novel: novelDir, error: error.message });
    }
  }

  console.log('\n处理结果汇总:');
  console.log(JSON.stringify(results, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { splitChapters, splitNovelChapters };
