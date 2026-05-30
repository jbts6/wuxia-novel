/**
 * 小说排版后处理脚本
 *
 * 功能:
 * 1. 移除段首缩进（全角空格）
 * 2. 短对话合并（< 20 字）
 * 3. 空行规范化（保留段落间空行）
 * 4. 动态说话标记提取
 * 5. 格式一致性验证（--validate 模式）
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'speech-markers.json');

const BASE_MARKERS = [
  '说道', '笑道', '问道', '答道', '叫道', '喊道', '怒道', '叹道', '喝道',
  '低声道', '高声道', '大声道', '轻声道', '微笑道', '冷冷的道', '淡淡的道',
  '厉声道', '哽咽道', '颤声道', '沉声道', '喃喃道', '含笑道', '正色道',
  '接口道', '插口道', '抢着道', '接着道', '续道', '又道', '再道',
  '心想', '寻思', '暗想',
  '道'
];

function loadExtraMarkers() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return data.extraMarkers || [];
    }
  } catch (err) {}
  return [];
}

function saveExtraMarkers(markers) {
  const data = { extraMarkers: markers };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function extractSpeechMarkers(content) {
  const pattern = /([^\n\s""]{1,6}(?:道|说|笑|喊|叫|问|答|怒|叹|喝|想|思))：/g;
  const markers = new Set();
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const marker = match[1];
    if (marker.length >= 2 && marker.length <= 6) {
      markers.add(marker);
    }
  }
  return [...markers];
}

function getAllMarkers(content) {
  const extraFromConfig = loadExtraMarkers();
  const extraFromContent = extractSpeechMarkers(content);
  const allMarkers = [...new Set([...BASE_MARKERS, ...extraFromConfig, ...extraFromContent])];
  const withoutSingleDao = allMarkers.filter(m => m !== '道');
  withoutSingleDao.push('道');
  return withoutSingleDao;
}

function updateConfigIfNewMarkers(content) {
  const extraFromConfig = loadExtraMarkers();
  const extraFromContent = extractSpeechMarkers(content);
  const existingSet = new Set([...BASE_MARKERS, ...extraFromConfig]);
  const newMarkers = extraFromContent.filter(m => !existingSet.has(m));
  if (newMarkers.length > 0) {
    const updatedExtra = [...new Set([...extraFromConfig, ...newMarkers])];
    saveExtraMarkers(updatedExtra);
    console.log('  发现新说话标记: ' + newMarkers.join(', '));
  }
}

function removeIndentation(content) {
  return content.replace(/^　　+/gm, '');
}

function mergeShortDialogues(content) {
  const allMarkers = getAllMarkers(content);
  const sortedMarkers = allMarkers.slice().sort((a, b) => b.length - a.length);
  const escapedMarkers = sortedMarkers.map(m =>
    m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const pattern = `(${escapedMarkers.join('|')})：\\n+("([^"]{1,20})")`;
  const regex = new RegExp(pattern, 'g');
  content = content.replace(regex, (match, marker, dialogue, innerText) => {
    if ((marker + '：' + innerText).length < 20) {
      return marker + '：' + dialogue;
    }
    return match;
  });
  return content;
}

function normalizeEmptyLines(content) {
  content = content.replace(/\n{4,}/g, '\n\n\n');
  content = content.trimEnd() + '\n';
  return content;
}

function removeTrailingSpaces(content) {
  return content.replace(/[ \t]+$/gm, '');
}

// ============================================================
// 格式验证
// ============================================================

function isShortDialogue(line) {
  const markers = getAllMarkers(line);
  const sorted = markers.slice().sort((a, b) => b.length - a.length);
  const escaped = sorted.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})：("([^"]{1,20})")`);
  const m = line.match(re);
  if (m) {
    const totalLen = m[1].length + 1 + m[3].length;
    return totalLen < 20;
  }
  return false;
}

/**
 * 验证排版格式一致性
 * @returns {Array<{line: number, level: string, message: string}>}
 */
function validateContent(content) {
  const lines = content.split('\n');
  const issues = [];
  let consecutiveBlanks = 0;

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const stripped = line.replace(/^[\s　]+/, '');

    if (line.trim() === '') {
      consecutiveBlanks++;
      return;
    }
    if (consecutiveBlanks > 1) {
      issues.push({ line: lineNo - consecutiveBlanks, level: '警告', message: `连续 ${consecutiveBlanks} 个空行，应不超过 1 个` });
    }
    consecutiveBlanks = 0;

    if (lineNo === lines.length) return;

    if (/^[ 　]/.test(line)) {
      const type = /^ +/.test(line) ? '半角空格' : '全角空格';
      issues.push({ line: lineNo, level: '错误', message: '段首缩进（' + type + '）' });
    }

    if (/[ \t]+$/.test(line)) {
      issues.push({ line: lineNo, level: '警告', message: '行尾多余空格' });
    }

    const charCount = [...stripped].length;
    if (charCount > 80) {
      issues.push({ line: lineNo, level: '错误', message: `行长度 ${charCount} 字 > 80，必须拆分` });
    } else if (charCount > 60) {
      issues.push({ line: lineNo, level: '警告', message: `行长度 ${charCount} 字 > 60，建议拆分` });
    }

    const quoteCount = (line.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      issues.push({ line: lineNo, level: '警告', message: '引号不配对' });
    }

    if (line.match(/[:：]/) && line.match(/"/) && !line.match(/^[\s　]*"/)) {
      if (!isShortDialogue(line)) {
        issues.push({ line: lineNo, level: '警告', message: '说话标记与对话可能未分行' });
      }
    }
  });

  if (consecutiveBlanks > 0) {
    const lineNo = lines.length - consecutiveBlanks + 1;
    if (consecutiveBlanks > 1) {
      issues.push({ line: lineNo, level: '警告', message: `文件末尾 ${consecutiveBlanks} 个空行，应不超过 1 个` });
    }
  }

  return issues;
}

const LEVEL_ORDER = { '错误': 0, '警告': 1 };

function printValidationResult(filename, lineCount, issues) {
  const errors = issues.filter(i => i.level === '错误').length;
  const warnings = issues.filter(i => i.level === '警告').length;
  const total = errors + warnings;

  const status = total === 0 ? 'OK' : `${errors} 错误, ${warnings} 警告`;
  console.log(`${filename}`);
  console.log(`  行数: ${lineCount}  ${status}`);

  if (total > 0) {
    issues.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.line - b.line);
    for (const issue of issues) {
      const tag = issue.level === '错误' ? 'ERR' : 'WARN';
      console.log(`  [行 ${issue.line}] [${tag}] ${issue.message}`);
    }
  }
  return total;
}

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = validateContent(content);
  const lines = content.split('\n').length;
  const problems = printValidationResult(path.basename(filePath), lines, issues);
  return problems;
}

function validateDirectory(dirPath) {
  console.log('验证目录: ' + dirPath);
  console.log('---');

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
  let totalProblems = 0;
  let totalFiles = 0;

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const problems = validateFile(filePath);
      totalProblems += problems;
      totalFiles++;
    } catch (err) {
      console.log(file);
      console.log('  读取错误: ' + err.message);
    }
    console.log('');
  }

  console.log('---');
  if (totalProblems === 0) {
    console.log(`验证通过: ${totalFiles} 个文件，无问题`);
  } else {
    console.log(`验证完成: ${totalFiles} 个文件，共 ${totalProblems} 个问题`);
  }
}

// ============================================================
// 后处理主函数
// ============================================================

function postProcess(content, updateConfig) {
  if (updateConfig) {
    updateConfigIfNewMarkers(content);
  }
  content = removeIndentation(content);
  content = mergeShortDialogues(content);
  content = normalizeEmptyLines(content);
  content = removeTrailingSpaces(content);
  return content;
}

function processFile(inputPath, outputPath, updateConfig) {
  console.log('处理: ' + inputPath);
  const content = fs.readFileSync(inputPath, 'utf8');
  const processed = postProcess(content, updateConfig);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, processed, 'utf8');
  const originalLines = content.split('\n').length;
  const processedLines = processed.split('\n').length;
  console.log(`  行数: ${originalLines} → ${processedLines}`);
  console.log('  输出: ' + outputPath);
}

function processDirectory(inputDir, outputDir) {
  console.log('批量处理: ' + inputDir);
  console.log('输出到: ' + outputDir);
  console.log('---');

  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.md'));
  console.log('找到 ' + files.length + ' 个 .md 文件\n');

  let processed = 0;
  let errors = 0;

  for (const file of files) {
    try {
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(outputDir, file);
      processFile(inputPath, outputPath, processed === 0);
      processed++;
    } catch (err) {
      console.error('处理 ' + file + ' 出错: ' + err.message);
      errors++;
    }
  }

  console.log('---');
  console.log('完成: ' + processed + ' 成功, ' + errors + ' 失败');
}

function showConfig() {
  const extraMarkers = loadExtraMarkers();
  console.log('=== 说话标记配置 ===');
  console.log('基础标记: ' + BASE_MARKERS.length + ' 个');
  console.log('  ' + BASE_MARKERS.join(', '));
  console.log('额外标记: ' + extraMarkers.length + ' 个');
  if (extraMarkers.length > 0) {
    console.log('  ' + extraMarkers.join(', '));
  }
  console.log('配置文件: ' + CONFIG_PATH);
}

// ============================================================
// 主程序
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('小说排版后处理脚本');
    console.log('');
    console.log('用法:');
    console.log('  node post-process.js <input-file> [output-file]');
    console.log('  node post-process.js --dir <input-dir> <output-dir>');
    console.log('  node post-process.js --validate <dir-or-file>');
    console.log('  node post-process.js --config');
    console.log('');
    console.log('示例:');
    console.log('  node post-process.js ch_01.md ch_01_processed.md');
    console.log('  node post-process.js --dir ch_original ch_formatted');
    console.log('  node post-process.js --validate ch_formatted');
    console.log('  node post-process.js --config');
    process.exit(1);
  }

  if (args[0] === '--config') {
    showConfig();
  } else if (args[0] === '--validate') {
    if (!args[1]) {
      console.error('错误: --validate 需要目录或文件路径');
      process.exit(1);
    }
    const target = args[1];
    if (fs.existsSync(target)) {
      if (fs.statSync(target).isDirectory()) {
        validateDirectory(target);
      } else {
        validateFile(target);
      }
    } else {
      console.error('错误: 路径不存在: ' + target);
      process.exit(1);
    }
  } else if (args[0] === '--dir') {
    if (args.length < 3) {
      console.error('错误: --dir 需要输入目录和输出目录');
      process.exit(1);
    }
    processDirectory(args[1], args[2]);
  } else {
    const inputPath = args[0];
    const outputPath = args[1] || inputPath.replace('.md', '_processed.md');
    processFile(inputPath, outputPath, true);
  }
}

module.exports = { postProcess, processFile, processDirectory, validateContent, validateFile, validateDirectory, extractSpeechMarkers, getAllMarkers };
