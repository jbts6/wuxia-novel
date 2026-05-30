/**
 * auto-format.js — 小说章节自动排版（v3 — 贴近 LLM 阅读理解排版）
 *
 * 核心设计：
 * - 只识别「说话标记 + ："」模式，将对话独立成行
 * - 叙述中的行内引号（"无量剑"、"着！"等）保持在段落内，不拆出
 * - 行长度 TARGET_MAX=80, ABS_MAX=120，按句号（。？！）断行
 * - 说话标记后空一行再写对话（短对话 < 25 字例外）
 *
 * 用法: node auto-format.js <输入文件> [输出文件]
 */

const fs = require('fs');
const path = require('path');

/* ── 引号归一 ────────────────────────────────── */

function normalizeQuotes(s) {
  // 保留原始弯引号，只归一全角引号
  return s
    .replace(/＂/g, '“')  // ＂ → "
    .replace(/＇/g, '‘'); // ＇ → '
}

/* ── 说话标记加载 ────────────────────────────── */

const BASE_MARKERS = [
  '说道','笑道','问道','答道','叫道','喊道','怒道','叹道','喝道',
  '低声道','高声道','大声道','轻声道','微声道',
  '微笑道','含笑道','正色道',
  '沉声道','喃喃道','颤声道','哽咽道','厉声道',
  '冷冷的道','淡淡的道',
  '接口道','插口道','抢着道','接着道','续道','又道','再道',
  '心想','寻思','暗想','暗叫','暗道','暗暗叫苦',
  // 变体：喝/叫/喊 + 一声
  '喝一声','叫一声','喊一声','喝一声道','叫一声道','喊一声道',
];

const scriptDir = __dirname;
let ALL_MARKERS = [...BASE_MARKERS];
try {
  const extra = JSON.parse(
    fs.readFileSync(path.join(scriptDir, 'speech-markers.json'), 'utf8')
  );
  for (const m of extra.extraMarkers || []) {
    if (!ALL_MARKERS.includes(m)) ALL_MARKERS.push(m);
  }
} catch (e) {}

// 按长度降序排列（长标记优先匹配）
ALL_MARKERS = [...new Set(ALL_MARKERS)].sort((a, b) => b.length - a.length);

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MARKERS_PAT = ALL_MARKERS.map(esc).join('|');

// 匹配：说话标记 + ："（捕获标记和对话起始位置）
// 支持标记前有 0-8 个汉字主语（如 "木婉清笑道"）
const SPEECH_RE = new RegExp(
  '([\\u4e00-\\u9fff]{0,8})(' + MARKERS_PAT + ')：“',
  'g'
);

/* ── 工具 ────────────────────────────────────── */

function visibleLen(s) {
  if (!s) return 0;
  let n = 0;
  for (const ch of s) {
    if (ch === '\t') continue;
    n += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  }
  return n;
}

function isTitle(t) {
  return /^第/.test(t) || /^\t/.test(t) || /^[一二三四五六七八九十百千]+[　 ]/.test(t);
}

function clean(s) {
  return s.replace(/^[　 ]+/, '').trimEnd();
}

/* ── 行长度配置（字符数，非可见宽度）────────── */

const TARGET_MAX = 30;   // 叙述目标行宽（约 60 可见宽度）
const ABS_MAX = 50;      // 叙述绝对最大行宽（约 100 可见宽度）
const SHORT_SPEECH = 12; // 短对话阈值（标记+对话 < 此字符数则同行）

/* ── 叙述分行：仅在句号/问号/叹号处断行（跳过引号内） ── */

function splitNarration(text) {
  if (!text) return [];
  text = text.trim();
  if (!text) return [];

  if (text.length <= TARGET_MAX) return [text];

  // 在句号/问号/叹号处寻找断点（跳过引号内的标点）
  const breakPoints = [];
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '“' || ch === '”') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && /[。？！]/.test(ch)) {
      breakPoints.push(i + 1);
    }
  }

  if (breakPoints.length === 0) {
    return [text];
  }

  // 贪心组装：累计超过 TARGET_MAX*0.8 后在下一个断点处切分
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

/* ── 对话提取：从一行中提取说话标记和对话 ────── */

/**
 * 从文本中提取所有「说话标记 + 对话」，返回分段列表
 * 每个分段：{ type: 'narration', text } 或 { type: 'speech', marker, dialog }
 *
 * 关键：只识别 SPEECH_RE 匹配的模式（标记 + ："），
 * 叙述中的行内引号不会被误识别为对话
 */
function extractSegments(text) {
  const segments = [];
  let pos = 0;
  let m;

  SPEECH_RE.lastIndex = 0;
  while ((m = SPEECH_RE.exec(text)) !== null) {
    const name = m[1] || '';
    const verb = m[2];
    const marker = name + verb;
    const matchStart = m.index;

    // 标记前的叙述文本
    if (matchStart > pos) {
      const before = text.slice(pos, matchStart).trim();
      if (before) segments.push({ type: 'narration', text: before });
    }

    // 从标记后开始找对话（marker + ：之后）
    const afterMarker = matchStart + marker.length + 1; // +1 for ：
    const rest = text.slice(afterMarker);

    // 用正则匹配引号对
    const quoteMatch = rest.match(/^“([\s\S]*?)”/);
    if (quoteMatch) {
      segments.push({ type: 'speech', marker, dialog: quoteMatch[1] });
      pos = afterMarker + quoteMatch[0].length;
      // 更新 SPEECH_RE 的 lastIndex 以避免重复匹配
      SPEECH_RE.lastIndex = pos;
    } else {
      // 没有匹配到引号对，当作叙述处理
      const markerText = text.slice(matchStart, afterMarker);
      segments.push({ type: 'narration', text: markerText });
      pos = afterMarker;
    }
  }

  // 剩余文本
  if (pos < text.length) {
    const remaining = text.slice(pos).trim();
    if (remaining) segments.push({ type: 'narration', text: remaining });
  }

  return segments;
}

/* ── 格式化一行 ──────────────────────────────── */

/**
 * 将一行原始文本格式化为多行输出
 *
 * 核心逻辑：
 * 1. 提取说话标记和对话
 * 2. 叙述 + 说话标记保持在同一行（如 "微微一笑，说道："）
 * 3. 短对话（< SHORT_SPEECH）也保持在同一行
 * 4. 长对话换行：标记后空一行，对话独占一行
 * 5. 纯叙述按句号断行
 */
function formatLine(line) {
  line = normalizeQuotes(clean(line));
  if (!line) return [];
  if (isTitle(line)) return [line];

  const segments = extractSegments(line);
  if (segments.length === 0) return [];

  const out = [];
  let pendingNarration = ''; // 累积的叙述文本

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (seg.type === 'narration') {
      // 累积叙述文本，后面可能跟说话标记
      pendingNarration += seg.text;
      continue;
    }

    // seg.type === 'speech'
    const marker = seg.marker;
    const dialog = seg.dialog;
    const speechTotal = marker.length + dialog.length + 2;

    if (speechTotal < SHORT_SPEECH) {
      // 短对话：叙述 + 标记 + 对话 全在一行
      const combined = pendingNarration + marker + '：“' + dialog + '”';
      out.push(...splitNarration(combined));
      pendingNarration = '';
    } else {
      // 长对话：叙述 + 标记在一行，对话换行
      const narrationWithMarker = pendingNarration + marker + '：';
      out.push(...splitNarration(narrationWithMarker));
      // 对话保持完整，不拆分
      out.push('“' + dialog + '”');
      pendingNarration = '';
    }
  }

  // 处理剩余的叙述文本
  if (pendingNarration) {
    out.push(...splitNarration(pendingNarration));
  }

  return out;
}

/* ── 对话分行：在句号处拆分长对话 ────────────── */

function splitDialogue(text) {
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

  if (breakPoints.length === 0) return [text];

  // 贪心组装：累计超过 TARGET_MAX*0.8 后在下一个断点处切分
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

    // 每行后都加空行（与 LLM 排版一致）
    result.push('');
    result.push(line);
  }

  return result;
}

/**
 * 判断是否是纯说话标记行（以 说话标记：" 结尾，没有对话内容）
 */
function isSpeechMarkerLine(line) {
  return /：$/.test(line) && new RegExp(MARKERS_PAT + '：$').test(line);
}

/* ── 主入口 ──────────────────────────────────── */

function processFile(inputPath, outputPath) {
  const text = normalizeQuotes(fs.readFileSync(inputPath, 'utf8'));
  const lines = text.split(/\r?\n/);
  const formatted = [];

  for (const raw of lines) {
    const lineResult = formatLine(raw);
    for (const fl of lineResult) {
      formatted.push(fl);
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
