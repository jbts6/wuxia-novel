/**
 * 小说章节分组合并脚本
 * 将排版完成的分组文件合并为完整章节
 *
 * 用法:
 *   node scripts/merge-groups.js <basename> [output-path]
 *   node scripts/merge-groups.js --batch <input-dir> <output-dir>
 *
 * 示例:
 *   node scripts/merge-groups.js ch_001
 *   node scripts/merge-groups.js ch_001 ch_formatted/ch_001.md
 *   node scripts/merge-groups.js --batch .ch_groups ch_formatted
 */

const fs = require('fs');
const path = require('path');
const progress = require('./progress');

const TEMP_DIR = '.ch_groups';

/**
 * 合并单个章节的分组文件
 * @param {string} basename - 章节文件名（不含扩展名）
 * @param {string} groupDir - 分组目录
 * @param {string} outputPath - 输出文件路径
 */
function mergeGroups(basename, groupDir, outputPath) {
  if (!fs.existsSync(groupDir)) {
    console.error('错误: 分组目录不存在 - ' + groupDir);
    return 0;
  }

  const incomplete = progress.getIncompleteGroups(basename);
  if (incomplete.length > 0) {
    console.log(`  警告: ${incomplete.length} 组未排版 (${incomplete.join(', ')})`);
  }

  const files = fs.readdirSync(groupDir)
    .filter(f => f.startsWith(basename + '_g') && f.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    console.error('错误: 未找到分组文件 (basename: ' + basename + ')');
    return 0;
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const allLines = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(groupDir, file), 'utf8');
    const fileLines = content.split('\n');
    allLines.push(...fileLines);
  }

  fs.writeFileSync(outputPath, allLines.join('\n'), 'utf8');
  return files.length;
}

/**
 * 批量合并：遍历分组目录下的所有子目录，每个子目录对应一个章节
 */
function batchMerge(inputDir, outputDir) {
  if (!fs.existsSync(inputDir)) {
    console.error('错误: 分组根目录不存在 - ' + inputDir);
    return;
  }

  const entries = fs.readdirSync(inputDir, { withFileTypes: true });
  const chapterDirs = entries.filter(e => e.isDirectory());

  if (chapterDirs.length === 0) {
    console.log('未找到章节分组目录');
    return;
  }

  let total = 0;
  for (const dir of chapterDirs) {
    const basename = dir.name;
    const groupDir = path.join(inputDir, basename);
    const outputPath = path.join(outputDir, basename + '.md');

    const groups = mergeGroups(basename, groupDir, outputPath);
    if (groups > 0) {
      console.log(`${basename}.md  ← ${groups} 个分组`);
      total++;
    }
  }
  console.log(`合并完成: ${total} 章`);
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('小说章节分组合并脚本');
    console.log('');
    console.log('用法:');
    console.log('  node scripts/merge-groups.js <basename> [output-path]');
    console.log('  node scripts/merge-groups.js --batch [input-dir] [output-dir]');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/merge-groups.js ch_001');
    console.log('  node scripts/merge-groups.js ch_001 ch_formatted/ch_001.md');
    console.log('  node scripts/merge-groups.js --batch .ch_groups ch_formatted');
    process.exit(1);
  }

  if (args[0] === '--batch') {
    const inputDir = args[1] || TEMP_DIR;
    const outputDir = args[2] || 'ch_formatted';
    batchMerge(inputDir, outputDir);
  } else {
    const basename = args[0];
    const groupDir = path.join(TEMP_DIR, basename);
    const outputPath = args[1] || path.join('ch_formatted', basename + '.md');
    const groups = mergeGroups(basename, groupDir, outputPath);
    if (groups > 0) {
      console.log(`${basename}.md → ${outputPath} (${groups} 个分组)`);
    }
  }
}

module.exports = { mergeGroups, batchMerge };
