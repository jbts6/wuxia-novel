#!/usr/bin/env node
/**
 * split-by-chapter.js - 按章节标题拆分小说 txt 文件
 *
 * 支持格式：
 * - 中文数字章节（如：一　灭门、二　聆秘）
 * - 第X章、第X回、第X节
 * - （第X回完）
 * - 纯数字章节：001、002 等
 *
 * 用法：
 *   node split-by-chapter.js <txt文件路径> [输出目录]
 *
 * 输出：
 *   ch_01.md, ch_02.md, ... 到指定目录（默认 ch_original）
 */

const fs = require('fs');
const path = require('path');

// 章节标题正则
const CHAPTER_PATTERNS = [
  // 中文数字章节标题（如：一　灭门、二　聆秘、十四　论杯）
  /^[\s　]*[一二三四五六七八九十百千]+[、　\s\t]+[^\s　]/m,
  // 第X章、第X回、第X节（支持中文数字和阿拉伯数字，数字前后可有空格）
  /^[\s　]*[（(]?第[\s　]*[一二三四五六七八九十百千万\d]+[\s　]*[章回节卷][）)]?/m,
  // （第X回完）
  /^[\s　]*（第[一二三四五六七八九十百千万\d]+[回章]完）/m,
  // 纯数字章节标题（如：001、002）
  /^[\s　]*\d{3}[\s　]/m,
];

function chineseNumberToInt(text) {
  const digits = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (/^\d+$/.test(text)) {
    return Number(text);
  }

  if (text === '十') {
    return 10;
  }

  const tenIndex = text.indexOf('十');
  if (tenIndex !== -1) {
    const before = text.slice(0, tenIndex);
    const after = text.slice(tenIndex + 1);
    const tens = before ? digits[before] : 1;
    const ones = after ? digits[after] : 0;
    return tens * 10 + ones;
  }

  return digits[text] || null;
}

function chapterNumber(line) {
  const match = line.match(/^[\s　]*[（(]?第[\s　]*([一二三四五六七八九十百千万\d]+)[\s　]*[章回节卷]/);
  return match ? chineseNumberToInt(match[1]) : null;
}

function significantLineCount(lines, start, end) {
  return lines.slice(start, end).filter(line => line.trim()).length;
}

function findChapterStarts(lines) {
  const candidates = [];

  for (let i = 0; i < lines.length; i++) {
    if (isChapterTitle(lines[i])) {
      candidates.push({
        lineIndex: i,
        number: chapterNumber(lines[i]),
      });
    }
  }

  const skip = new Set();

  for (let i = 0; i < candidates.length; i++) {
    const run = [i];

    while (i + 1 < candidates.length) {
      const current = candidates[i];
      const next = candidates[i + 1];
      if (current.number == null || next.number == null) {
        break;
      }

      if (next.number !== current.number + 1) {
        break;
      }

      const gap = next.lineIndex - current.lineIndex;
      const bodyLines = significantLineCount(lines, current.lineIndex + 1, next.lineIndex);
      if (gap > 3 || bodyLines > 1) {
        break;
      }

      run.push(i + 1);
      i++;
    }

    if (run.length >= 2 && run.every(index => {
      const candidate = candidates[index];
      return candidates.slice(index + 1).some(later => later.number === candidate.number);
    })) {
      for (const index of run) {
        skip.add(index);
      }
    }
  }

  return candidates.filter((_, index) => !skip.has(index)).map(candidate => candidate.lineIndex);
}

function findBookMarkers(lines) {
  const markers = [];

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*小说：古龙《[^》]+》\s*$/.test(lines[i].trim())) {
      markers.push(i);
    }
  }

  return markers;
}

/**
 * 检测章节标题
 */
function isChapterTitle(line) {
  const trimmed = line.trim();
  if (trimmed.length > 60) {
    return false;
  }

  if (/^[一二三四五六七八九十百千]+[、　\s\t]+/.test(trimmed) && /[，。；：“”]/.test(trimmed)) {
    return false;
  }

  return CHAPTER_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * 按章节拆分文本
 */
function splitByChapter(content) {
  const lines = content.split(/\r?\n/);
  const bookMarkers = findBookMarkers(lines);

  if (bookMarkers.length > 0) {
    return splitOmnibusByChapter(lines, bookMarkers);
  }

  const starts = findChapterStarts(lines);
  const chapters = [];

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = starts[i + 1] || lines.length;
    const chapter = lines.slice(start, end).join('\n').trim();
    if (chapter) {
      chapters.push(chapter);
    }
  }

  return chapters;
}

function splitOmnibusByChapter(lines, bookMarkers) {
  const starts = [];
  const firstMarker = bookMarkers[0];
  const leading = lines.slice(0, firstMarker).join('\n').trim();

  if (leading) {
    starts.push(0);
  }

  for (let i = 0; i < bookMarkers.length; i++) {
    const marker = bookMarkers[i];
    const nextMarker = bookMarkers[i + 1] || lines.length;
    const blockLines = lines.slice(marker, nextMarker);
    const chapterStarts = findChapterStarts(blockLines)
      .map(index => marker + index)
      .filter(index => index > marker);

    starts.push(marker);
    for (const start of chapterStarts.slice(1)) {
      starts.push(start);
    }
  }

  const uniqueStarts = [...new Set(starts)].sort((a, b) => a - b);
  const chapters = [];

  for (let i = 0; i < uniqueStarts.length; i++) {
    const start = uniqueStarts[i];
    const end = uniqueStarts[i + 1] || lines.length;
    const chapter = lines.slice(start, end).join('\n').trim();
    if (chapter) {
      chapters.push(chapter);
    }
  }

  return chapters;
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('用法: node split-by-chapter.js <txt文件路径> [输出目录]');
    console.log('');
    console.log('示例:');
    console.log('  node split-by-chapter.js 天龙八部.txt');
    console.log('  node split-by-chapter.js 天龙八部.txt ch_original');
    process.exit(1);
  }

  const inputFile = path.resolve(args[0]);
  const outputDir = args[1]
    ? path.resolve(args[1])
    : path.join(path.dirname(inputFile), 'ch_original');

  // 验证输入文件
  if (!fs.existsSync(inputFile)) {
    console.error(`错误: 文件不存在 - ${inputFile}`);
    process.exit(1);
  }

  // 读取文件
  console.log(`读取: ${path.basename(inputFile)}`);
  const content = fs.readFileSync(inputFile, 'utf-8');
  console.log(`行数: ${content.split('\n').length}`);

  // 按章节拆分
  const chapters = splitByChapter(content);
  console.log(`章节数: ${chapters.length}`);

  if (chapters.length === 0) {
    if (!content.trim()) {
      console.error('错误: txt 文件为空');
      process.exit(1);
    }
    console.log('未检测到章节标题，按短篇/单章作品处理');
    chapters.push(content.trim());
  }

  // 创建输出目录
  fs.mkdirSync(outputDir, { recursive: true });

  // 写入文件
  console.log(`输出目录: ${outputDir}`);
  console.log('');

  for (let i = 0; i < chapters.length; i++) {
    const chNum = String(i + 1).padStart(2, '0');
    const filename = `ch_${chNum}.md`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, chapters[i], 'utf-8');
    console.log(`  ${filename} (${chapters[i].length} 字)`);
  }

  console.log('');
  console.log(`完成！共 ${chapters.length} 章`);
}

main();
