'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { splitChapters } = require('./split-chapters');

// 要处理的作者目录
const AUTHORS = ['古龙', '金庸', '黄易', '梁羽生'];

function findNovelsWithoutChSplit() {
  const novels = [];

  for (const author of AUTHORS) {
    const authorDir = path.resolve(author);
    if (!fs.existsSync(authorDir) || !fs.statSync(authorDir).isDirectory()) {
      console.warn(`作者目录不存在: ${author}`);
      continue;
    }

    const entries = fs.readdirSync(authorDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const novelDir = path.join(authorDir, entry.name);
      const chSplitDir = path.join(novelDir, 'ch_split');

      // 检查是否有 ch_split 目录
      if (!fs.existsSync(chSplitDir) || !fs.statSync(chSplitDir).isDirectory()) {
        // 检查是否有源文件
        const sourceFile = path.join(novelDir, `${entry.name}.txt`);
        if (fs.existsSync(sourceFile) && fs.statSync(sourceFile).isFile()) {
          novels.push({
            author,
            name: entry.name,
            path: novelDir,
            sourceFile
          });
        } else {
          // 尝试查找其他 txt 文件
          const txtFiles = fs.readdirSync(novelDir)
            .filter(file => file.toLowerCase().endsWith('.txt'))
            .map(file => path.join(novelDir, file));

          if (txtFiles.length === 1) {
            novels.push({
              author,
              name: entry.name,
              path: novelDir,
              sourceFile: txtFiles[0]
            });
          } else if (txtFiles.length > 1) {
            console.warn(`跳过 ${author}/${entry.name}: 找到多个源文件`);
          } else {
            console.warn(`跳过 ${author}/${entry.name}: 找不到源文件`);
          }
        }
      }
    }
  }

  return novels;
}

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
    sourceFile: sourcePath,
    chapters: results.length,
    files: results.slice(0, 5) // 只显示前5个作为示例
  };
}

function main() {
  console.log('开始批量处理小说章节拆分...\n');

  const novels = findNovelsWithoutChSplit();
  console.log(`找到 ${novels.length} 部需要处理的小说\n`);

  const results = [];
  const errors = [];

  for (let i = 0; i < novels.length; i++) {
    const novel = novels[i];
    const progress = `[${i + 1}/${novels.length}]`;

    try {
      console.log(`${progress} 处理: ${novel.author}/${novel.name}`);
      const result = splitNovelChapters(novel.path);
      results.push({
        author: novel.author,
        name: novel.name,
        ...result
      });
      console.log(`  ✓ 完成: ${result.chapters} 章`);
    } catch (error) {
      console.error(`  ✗ 失败: ${error.message}`);
      errors.push({
        author: novel.author,
        name: novel.name,
        error: error.message
      });
    }
  }

  // 生成报告
  console.log('\n' + '='.repeat(60));
  console.log('处理完成！');
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
    total: novels.length,
    success: results.length,
    failed: errors.length,
    results,
    errors
  };

  const reportPath = path.resolve('scripts/split-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n详细报告已保存到: ${reportPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { findNovelsWithoutChSplit, splitNovelChapters };
