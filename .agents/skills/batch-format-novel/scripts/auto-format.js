/**
 * auto-format.js — 小说章节自动排版（简化版）
 *
 * 功能：
 * - 中文引号转英文引号
 * - 段落间加空行
 * - 控制行宽（按句号断行）
 *
 * 用法: node auto-format.js <输入文件> [输出文件]
 */

const fs = require('fs');
const path = require('path');

/* ── 引号归一 ────────────────────────────────── */

function normalizeQuotes(s) {
  // 所有中文引号转英文引号
  return s
    .replace(/“/g, '"')  // 左双引号 " → "
    .replace(/”/g, '"')  // 右双引号 " → "
    .replace(/‘/g, "'")  // 左单引号 ' → '
    .replace(/’/g, "'")  // 右单引号 ' → '
    .replace(/＂/g, '"')  // 全角双引号 ＂ → "
    .replace(/＇/g, "'"); // 全角单引号 ＇ → '
}

/* ── 工具 ────────────────────────────────────── */

function isTitle(t) {
  return /^第/.test(t) || /^\t/.test(t) || /^[一二三四五六七八九十百千]+[　 ]/.test(t);
}

function clean(s) {
  return s.replace(/^[　 ]+/, '').trimEnd();
}

/* ── 行长度配置 ─────────────────────────────── */

const TARGET_MAX = 30;  // 目标行宽
const ABS_MAX = 50;     // 绝对最大行宽

/* ── 叙述分行：在句号处断行 ──────────────────── */

function splitLine(text) {
  if (!text) return [];
  text = text.trim();
  if (!text) return [];

  if (text.length <= TARGET_MAX) return [text];

  // 在句号/问号/叹号处寻找断点
  const breakPoints = [];
  for (let i = 0; i < text.length; i++) {
    if (/[。？！]/.test(text[i])) {
      breakPoints.push(i + 1);
    }
  }

  if (breakPoints.length === 0) {
    return [text];
  }

  // 贪心组装
  const result = [];
  let segStart = 0;
  const splitThreshold = Math.floor(TARGET_MAX * 0.8);

  for (const bp of breakPoints) {
    const segCharLen = bp - segStart;
    if (segCharLen >= splitThreshold && segStart < bp) {
      const segment = text.slice(segStart, bp).trim();
      if (segment) result.push(segment);
      segStart = bp;
    }
  }
  if (segStart < text.length) {
    const remaining = text.slice(segStart).trim();
    if (remaining) result.push(remaining);
  }
  return result;
}

/* ── 段落间加空行 ────────────────────────────── */

function addBlankLines(lines) {
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;

    if (result.length === 0) {
      result.push(line);
      continue;
    }

    const prevLine = result[result.length - 1];

    // 标题后不加空行
    if (isTitle(prevLine)) {
      result.push(line);
      continue;
    }

    // 每行后都加空行
    result.push('');
    result.push(line);
  }

  return result;
}

/* ── 主入口 ──────────────────────────────────── */

function processFile(inputPath, outputPath) {
  const text = normalizeQuotes(fs.readFileSync(inputPath, 'utf8'));
  const lines = text.split(/\r?\n/);
  const formatted = [];

  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;

    if (isTitle(line)) {
      formatted.push(line);
      continue;
    }

    // 分行处理
    const splitResult = splitLine(line);
    for (const sl of splitResult) {
      formatted.push(sl);
    }
  }

  // 段落间加空行
  const result = addBlankLines(formatted);

  let output = result.join('\n');
  if (!output.endsWith('\n')) output += '\n';

  if (outputPath) {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`  ${lines.length} 行 → ${result.length} 行 → ${path.basename(outputPath)}`);
  } else {
    console.log(output);
  }
}

/* ── CLI ──────────────────────────────────────── */

const input = process.argv[2];
const output = process.argv[3];
if (!input) {
  console.error('用法: node auto-format.js <输入文件> [输出文件]');
  console.error('示例: node auto-format.js ch_original/ch_05.md ch_formatted/ch_05.md');
  process.exit(1);
}
processFile(input, output || input.replace('.md', '_formatted.md'));
