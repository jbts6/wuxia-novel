'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { splitChapters } = require('./split-chapters');

// 需要重新处理的小说
const NOVELS_TO_REPROCESS = [
  '黄易/大唐双龙传',
  '金庸/越女剑',
  '金庸/鸳鸯刀',
  '古龙/剑气书香'
];

function splitNovelChapters(novelDir) {
  const novel = path.resolve(novelDir);
  const sourceFile = fs.readdirSync(novel)
    .find(file => file.toLowerCase().endsWith('.txt') && file !== 'ch_split');

  if (!sourceFile) {
    throw new Error(`找不到源文件: ${novel}`);
  }

  const sourcePath = path.join(novel, sourceFile);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const chapters = splitChapters(source, path.basename(novel));

  const chSplitDir = path.join(novel, 'ch_split');
  if (fs.existsSync(chSplitDir)) {
    fs.rmSync(chSplitDir, { recursive: true, force: true });
  }
  fs.mkdirSync(chSplitDir, { recursive: true });

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
    sourceFile: sourcePath,
    chapters: results.length,
    files: results.slice(0, 5) // 只显示前5个作为示例
  };
}

function main() {
  console.log('重新处理需要修复的小说...\n');

  const results = [];
  const errors = [];

  for (let i = 0; i < NOVELS_TO_REPROCESS.length; i++) {
    const novelDir = NOVELS_TO_REPROCESS[i];
    const progress = `[${i + 1}/${NOVELS_TO_REPROCESS.length}]`;

    try {
      console.log(`${progress} 处理: ${novelDir}`);
      const result = splitNovelChapters(novelDir);
      results.push({
        author: novelDir.split('/')[0],
        name: novelDir.split('/')[1],
        ...result
      });
      console.log(`  ✓ 完成: ${result.chapters} 章`);
    } catch (error) {
      console.error(`  ✗ 失败: ${error.message}`);
      errors.push({
        author: novelDir.split('/')[0],
        name: novelDir.split('/')[1],
        error: error.message
      });
    }
  }

  // 生成报告
  console.log('\n' + '='.repeat(60));
  console.log('重新处理完成！');
  console.log('='.repeat(60));
  console.log(`成功: ${results.length} 部`);
  console.log(`失败: ${errors.length} 部`);

  if (results.length > 0) {
    console.log('\n成功处理的小说:');
    for (const result of results) {
      console.log(`  ${result.author}/${result.name}: ${result.chapters} 章`);
    }
  }

  if (errors.length > 0) {
    console.log('\n处理失败的小说:');
    for (const error of errors) {
      console.log(`  ${error.author}/${error.name}: ${error.error}`);
    }
  }

  // 保存详细报告
  const report = {
    timestamp: new Date().toISOString(),
    total: NOVELS_TO_REPROCESS.length,
    success: results.length,
    failed: errors.length,
    results,
    errors
  };

  const reportPath = path.resolve('scripts/reprocess-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n详细报告已保存到: ${reportPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { splitNovelChapters };
