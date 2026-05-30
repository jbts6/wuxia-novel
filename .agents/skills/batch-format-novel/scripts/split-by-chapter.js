#!/usr/bin/env node
/**
 * split-by-chapter.js - 按章节标题拆分小说 txt 文件
 *
 * 支持格式：
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
  // 第X章、第X回、第X节（支持中文数字和阿拉伯数字）
  /^[\s　]*[（(]?第[一二三四五六七八九十百千万\d]+[章回节卷][）)]?/m,
  // （第X回完）
  /^[\s　]*（第[一二三四五六七八九十百千万\d]+[回章]完）/m,
  // 纯数字章节标题（如：001、002）
  /^[\s　]*\d{3}[\s　]/m,
];

/**
 * 检测章节标题
 */
function isChapterTitle(line) {
  return CHAPTER_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * 按章节拆分文本
 */
function splitByChapter(content) {
  const lines = content.split(/\r?\n/);
  const chapters = [];
  let currentChapter = [];
  let inChapter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isChapterTitle(line)) {
      // 保存当前章节
      if (currentChapter.length > 0) {
        chapters.push(currentChapter.join('\n'));
      }
      currentChapter = [line];
      inChapter = true;
    } else if (inChapter) {
      currentChapter.push(line);
    }
  }

  // 保存最后一个章节
  if (currentChapter.length > 0) {
    chapters.push(currentChapter.join('\n'));
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
    console.error('错误: 未检测到章节标题');
    console.log('');
    console.log('支持的章节格式:');
    console.log('  - 第X章、第X回、第X节');
    console.log('  - （第X回完）');
    console.log('  - 纯数字：001、002 等');
    process.exit(1);
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
