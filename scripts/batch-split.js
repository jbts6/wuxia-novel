'use strict';

const fs = require('node:fs');
const path = require('node:path');

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

function main() {
  console.log('查找没有 ch_split 的小说...\n');

  const novels = findNovelsWithoutChSplit();

  console.log(`找到 ${novels.length} 部需要处理的小说:\n`);

  // 按作者分组显示
  const byAuthor = {};
  for (const novel of novels) {
    if (!byAuthor[novel.author]) {
      byAuthor[novel.author] = [];
    }
    byAuthor[novel.author].push(novel.name);
  }

  for (const [author, names] of Object.entries(byAuthor)) {
    console.log(`${author} (${names.length} 部):`);
    for (const name of names) {
      console.log(`  - ${name}`);
    }
    console.log();
  }

  // 生成批量处理命令
  console.log('批量处理命令:');
  console.log('node scripts/split-chapters.js \\');
  const commands = novels.map(novel => `  "${novel.path}"`);
  console.log(commands.join(' \\\n'));
}

if (require.main === module) {
  main();
}

module.exports = { findNovelsWithoutChSplit };
