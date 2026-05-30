#!/usr/bin/env node
/**
 * batch-format.js - 批量排版武侠小说章节
 *
 * 工作流：
 * 1. 检测指定路径下是否有 ch_original 文件夹
 * 2. 如果没有，新建并调用 split-chapter.js 按章节拆分 txt
 * 3. 扫描 ch_formatted，跳过已存在的章节
 * 4. 调用 auto-format.js 处理剩余章节
 *
 * 用法：
 *   node batch-format.js <小说目录路径>
 *
 * 示例：
 *   node batch-format.js "金庸/天龙八部"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 脚本路径
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const FORMAT_NOVEL_BATCH_SCRIPTS = path.join(PROJECT_ROOT, '.agents', 'skills', 'format-novel-batch', 'scripts');
const SPLIT_SCRIPT = path.join(__dirname, 'split-by-chapter.js');  // 使用按章节拆分
const FORMAT_SCRIPT = path.join(FORMAT_NOVEL_BATCH_SCRIPTS, 'auto-format.js');

// ANSI 颜色
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(color, msg) {
  console.log(`${color}${msg}${RESET}`);
}

/**
 * 扫描目录中的 md 文件，返回章节号集合
 */
function scanExistingChapters(dir) {
  const chapters = new Set();
  if (!fs.existsSync(dir)) return chapters;

  const files = fs.readdirSync(dir);
  for (const f of files) {
    const match = f.match(/^ch_(\d+)\.md$/);
    if (match) {
      chapters.add(parseInt(match[1], 10));
    }
  }
  return chapters;
}

/**
 * 查找 txt 文件（小说原文）
 */
function findTxtFile(dir) {
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f.endsWith('.txt')) {
      return path.join(dir, f);
    }
  }
  return null;
}

/**
 * 执行命令并输出结果
 */
function runCmd(cmd, label) {
  log(CYAN, `\n[执行] ${label}`);
  log(CYAN, `  $ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..', '..', '..', '..') });
    return true;
  } catch (err) {
    log(RED, `[错误] ${label} 失败`);
    return false;
  }
}

/**
 * 主流程
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('用法: node batch-format.js <小说目录路径>');
    console.log('示例: node batch-format.js "金庸/天龙八部"');
    process.exit(1);
  }

  const novelDir = path.resolve(args[0]);

  // 验证目录存在
  if (!fs.existsSync(novelDir)) {
    log(RED, `[错误] 目录不存在: ${novelDir}`);
    process.exit(1);
  }

  const chOriginalDir = path.join(novelDir, 'ch_original');
  const chFormattedDir = path.join(novelDir, 'ch_formatted');

  log(CYAN, `\n[批量排版] ${novelDir}`);

  // ─────────────────────────────────────────────
  // 步骤 1: 检测 ch_original，如果不存在则拆分 txt
  // ─────────────────────────────────────────────
  if (!fs.existsSync(chOriginalDir)) {
    log(YELLOW, '\n[步骤 1] ch_original 不存在，开始拆分 txt...');

    const txtFile = findTxtFile(novelDir);
    if (!txtFile) {
      log(RED, '[错误] 未找到 txt 文件');
      process.exit(1);
    }

    log(CYAN, `[发现] ${path.basename(txtFile)}`);

    // 执行拆分（直接输出到 ch_original）
    const ok = runCmd(
      `node "${SPLIT_SCRIPT}" "${txtFile}" "${chOriginalDir}"`,
      '拆分章节'
    );

    if (!ok) {
      log(RED, '[错误] 拆分失败');
      process.exit(1);
    }

    log(GREEN, '[步骤 1] 拆分完成');
  } else {
    log(GREEN, '\n[步骤 1] ch_original 已存在，跳过拆分');
  }

  // ─────────────────────────────────────────────
  // 步骤 2: 统计章节
  // ─────────────────────────────────────────────
  const originalChapters = scanExistingChapters(chOriginalDir);
  const formattedChapters = scanExistingChapters(chFormattedDir);

  const total = originalChapters.size;
  const done = formattedChapters.size;
  const pending = [...originalChapters]
    .filter(ch => !formattedChapters.has(ch))
    .sort((a, b) => a - b);

  log(CYAN, `\n[统计] 原文: ${total} 章`);
  log(CYAN, `[统计] 已排版: ${done} 章`);
  log(CYAN, `[统计] 待处理: ${pending.length} 章`);

  if (pending.length === 0) {
    log(GREEN, '\n[完成] 所有章节已排版！');
    process.exit(0);
  }

  // ─────────────────────────────────────────────
  // 步骤 3: 创建 ch_formatted 目录
  // ─────────────────────────────────────────────
  fs.mkdirSync(chFormattedDir, { recursive: true });

  // ─────────────────────────────────────────────
  // 步骤 4: 批量排版
  // ─────────────────────────────────────────────
  log(CYAN, `\n[步骤 4] 开始排版 ${pending.length} 章...`);

  let success = 0;
  let fail = 0;

  for (const ch of pending) {
    const chNum = String(ch).padStart(2, '0');
    const input = path.join(chOriginalDir, `ch_${chNum}.md`);
    const output = path.join(chFormattedDir, `ch_${chNum}.md`);

    log(CYAN, `\n  排版 ch_${chNum}.md...`);

    const ok = runCmd(
      `node "${FORMAT_SCRIPT}" "${input}" "${output}"`,
      `ch_${chNum}`
    );

    if (ok) {
      success++;
      log(GREEN, `  ✓ ch_${chNum}.md 完成`);
    } else {
      fail++;
      log(RED, `  ✗ ch_${chNum}.md 失败`);
    }
  }

  // ─────────────────────────────────────────────
  // 完成
  // ─────────────────────────────────────────────
  log(CYAN, '\n' + '='.repeat(50));
  log(GREEN, `[完成] 成功: ${success} 章`);
  if (fail > 0) {
    log(RED, `[完成] 失败: ${fail} 章`);
  }
  log(CYAN, '='.repeat(50));
}

main();
