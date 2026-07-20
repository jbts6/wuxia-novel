'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// 要处理的作者目录
const AUTHORS = ['古龙', '金庸', '黄易', '梁羽生'];

function findNovelsWithoutRun() {
  const novels = [];

  for (const author of AUTHORS) {
    const authorDir = path.resolve(author);
    if (!fs.existsSync(authorDir) || !fs.statSync(authorDir).isDirectory()) {
      continue;
    }

    const entries = fs.readdirSync(authorDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const novelDir = path.join(authorDir, entry.name);
      const gameKbWorkDir = path.join(novelDir, '.game-kb-work');

      // 检查是否有 run 目录
      let hasRun = false;
      if (fs.existsSync(gameKbWorkDir) && fs.statSync(gameKbWorkDir).isDirectory()) {
        const runs = fs.readdirSync(gameKbWorkDir)
          .filter(item => fs.statSync(path.join(gameKbWorkDir, item)).isDirectory());
        hasRun = runs.length > 0;
      }

      if (!hasRun) {
        // 检查是否有 ch_split 目录
        const chSplitDir = path.join(novelDir, 'ch_split');
        if (fs.existsSync(chSplitDir) && fs.statSync(chSplitDir).isDirectory()) {
          const chFiles = fs.readdirSync(chSplitDir).filter(f => f.endsWith('.txt'));
          if (chFiles.length > 0) {
            novels.push({
              author,
              name: entry.name,
              path: novelDir
            });
          }
        }
      }
    }
  }

  return novels;
}

function generateRunId(novelName) {
  // 生成 run ID：run-<小说名拼音>-lite
  // 简化处理：使用 run-<时间戳>-lite
  const timestamp = Date.now().toString(36);
  return `run-${timestamp}-lite`;
}

function main() {
  console.log('查找需要运行 lite-prepare 的小说...\n');

  const novels = findNovelsWithoutRun();
  console.log(`找到 ${novels.length} 部需要处理的小说\n`);

  const results = [];
  const errors = [];

  for (let i = 0; i < novels.length; i++) {
    const novel = novels[i];
    const progress = `[${i + 1}/${novels.length}]`;
    const runId = generateRunId(novel.name);

    try {
      console.log(`${progress} 处理: ${novel.author}/${novel.name}`);
      console.log(`  Run ID: ${runId}`);

      // 执行 lite-prepare 命令
      const cmd = `node .agents/skills/generate-game-kb/scripts/flow.js lite-prepare "${novel.path}" --run ${runId} --json`;
      const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

      const result = JSON.parse(output);
      results.push({
        author: novel.author,
        name: novel.name,
        runId,
        ...result
      });
      console.log(`  ✓ 完成`);
    } catch (error) {
      console.error(`  ✗ 失败: ${error.message}`);
      errors.push({
        author: novel.author,
        name: novel.name,
        runId,
        error: error.message
      });
    }
  }

  // 生成报告
  console.log('\n' + '='.repeat(60));
  console.log('lite-prepare 完成！');
  console.log('='.repeat(60));
  console.log(`成功: ${results.length} 部`);
  console.log(`失败: ${errors.length} 部`);

  if (results.length > 0) {
    console.log('\n成功处理的小说:');
    for (const result of results.slice(0, 10)) {
      console.log(`  ${result.author}/${result.name}: ${result.runId}`);
    }
    if (results.length > 10) {
      console.log(`  ... 还有 ${results.length - 10} 部`);
    }
  }

  if (errors.length > 0) {
    console.log('\n处理失败的小说:');
    for (const error of errors.slice(0, 10)) {
      console.log(`  ${error.author}/${error.name}: ${error.error}`);
    }
    if (errors.length > 10) {
      console.log(`  ... 还有 ${errors.length - 10} 部`);
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

  const reportPath = path.resolve('scripts/lite-prepare-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n详细报告已保存到: ${reportPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { findNovelsWithoutRun };
