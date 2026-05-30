/**
 * 小说章节分组脚本
 * 将章节文件按行数拆分为若干组，每组单独写入文件
 *
 * 用法:
 *   node scripts/split-chapter.js <input-file> [group-size]
 *   node scripts/split-chapter.js --batch <input-dir> [group-size]
 *
 * 示例:
 *   node scripts/split-chapter.js ch_original/ch_001.md
 *   node scripts/split-chapter.js --batch ch_original
 *   node scripts/split-chapter.js ch_original/ch_001.md 20
 */

const fs = require('fs');
const path = require('path');
const progress = require('./progress');

const DEFAULT_GROUP_SIZE = 15;
const TEMP_DIR = '.ch_groups';

function splitFile(inputFile, groupSize, groupsRoot) {
  const content = fs.readFileSync(inputFile, 'utf8');
  const lines = content.split('\n');
  const basename = path.basename(inputFile, '.md');
  const outDir = path.join(groupsRoot || TEMP_DIR, basename);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const groups = [];
  for (let i = 0; i < lines.length; i += groupSize) {
    groups.push(lines.slice(i, i + groupSize));
  }

  const groupFiles = [];
  groups.forEach((group, idx) => {
    const num = String(idx + 1).padStart(3, '0');
    const fileName = `${basename}_g${num}.md`;
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, group.join('\n'), 'utf8');
    groupFiles.push(filePath);
  });

  progress.initChapter(basename, lines.length, groupFiles, groupSize);

  return { basename, totalLines: lines.length, groups: groups.length, groupFiles, outDir };
}

function batchSplit(inputDir, groupSize) {
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('未找到 .md 文件');
    return;
  }

  let totalGroups = 0;
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const result = splitFile(inputPath, groupSize, TEMP_DIR);
    console.log(`${file}  → ${result.groups} 组 (${result.totalLines} 行)`);
    totalGroups += result.groups;
  }
  console.log(`共 ${files.length} 章，${totalGroups} 组`);
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('小说章节分组脚本');
    console.log('');
    console.log('用法:');
    console.log('  node scripts/split-chapter.js <input-file> [group-size]');
    console.log('  node scripts/split-chapter.js --batch <input-dir> [group-size]');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/split-chapter.js ch_original/ch_001.md');
    console.log('  node scripts/split-chapter.js --batch ch_original');
    console.log('  node scripts/split-chapter.js ch_original/ch_001.md 20');
    process.exit(1);
  }

  const groupSize = args.length >= 2 && !isNaN(parseInt(args[args.length - 1]))
    ? parseInt(args[args.length - 1]) : DEFAULT_GROUP_SIZE;

  if (args[0] === '--batch') {
    const inputDir = args[1];
    if (!inputDir || !fs.existsSync(inputDir)) {
      console.error('错误: 目录不存在 - ' + inputDir);
      process.exit(1);
    }
    batchSplit(inputDir, groupSize);
  } else {
    const inputFile = args[0];
    if (!fs.existsSync(inputFile)) {
      console.error('错误: 文件不存在 - ' + inputFile);
      process.exit(1);
    }
    const result = splitFile(inputFile, groupSize);
    console.log(`文件: ${path.basename(inputFile)}`);
    console.log(`行数: ${result.totalLines}`);
    console.log(`分组: ${result.groups} 组 (每组 ${groupSize} 行)`);
    console.log('分组文件:');
    result.groupFiles.forEach(f => console.log('  ' + f));
  }
}

module.exports = { splitFile, batchSplit };
