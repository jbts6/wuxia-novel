/**
 * 小说排版后处理脚本
 * 强制执行格式规则，确保一致性
 *
 * 功能:
 * 1. 移除段首缩进（全角空格）
 * 2. 短对话合并（< 20 字）
 * 3. 空行规范化（保留段落间空行）
 * 4. 动态说话标记提取
 */

const fs = require('fs');
const path = require('path');

// 配置文件路径
const CONFIG_PATH = path.join(__dirname, 'speech-markers.json');

// ============================================================
// 基础说话标记（所有项目共用）
// ============================================================
const BASE_MARKERS = [
  '说道', '笑道', '问道', '答道', '叫道', '喊道', '怒道', '叹道', '喝道',
  '低声道', '高声道', '大声道', '轻声道', '微笑道', '冷冷的道', '淡淡的道',
  '厉声道', '哽咽道', '颤声道', '沉声道', '喃喃道', '含笑道', '正色道',
  '接口道', '插口道', '抢着道', '接着道', '续道', '又道', '再道',
  '心想', '寻思', '暗想',
  '道'  // 单独的 "道" 放最后
];

// ============================================================
// 动态说话标记管理
// ============================================================

/**
 * 从配置文件加载额外的说话标记
 */
function loadExtraMarkers() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return data.extraMarkers || [];
    }
  } catch (err) {
    // 配置文件不存在或格式错误，忽略
  }
  return [];
}

/**
 * 保存额外的说话标记到配置文件
 */
function saveExtraMarkers(markers) {
  const data = { extraMarkers: markers };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * 从内容中提取说话标记
 * 匹配模式: "X道"、"X说"、"X笑" 等
 */
function extractSpeechMarkers(content) {
  // 匹配所有 "X道：" 或 "X说：" 模式
  const pattern = /([^\n\s""]{1,6}(?:道|说|笑|喊|叫|问|答|怒|叹|喝|想|思))：/g;
  const markers = new Set();
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const marker = match[1];
    // 过滤掉太长或明显不是说话标记的词
    if (marker.length >= 2 && marker.length <= 6) {
      markers.add(marker);
    }
  }

  return [...markers];
}

/**
 * 获取完整的说话标记列表（基础 + 配置文件 + 动态提取）
 */
function getAllMarkers(content) {
  const extraFromConfig = loadExtraMarkers();
  const extraFromContent = extractSpeechMarkers(content);

  // 合并所有标记，去重
  const allMarkers = [...new Set([
    ...BASE_MARKERS,
    ...extraFromConfig,
    ...extraFromContent
  ])];

  // "道" 必须放最后（因为它是其他标记的子串）
  const withoutSingleDao = allMarkers.filter(m => m !== '道');
  withoutSingleDao.push('道');

  return withoutSingleDao;
}

/**
 * 更新配置文件（如果发现新标记）
 */
function updateConfigIfNewMarkers(content) {
  const extraFromConfig = loadExtraMarkers();
  const extraFromContent = extractSpeechMarkers(content);

  // 找出新标记（不在基础标记和配置文件中的）
  const existingSet = new Set([...BASE_MARKERS, ...extraFromConfig]);
  const newMarkers = extraFromContent.filter(m => !existingSet.has(m));

  if (newMarkers.length > 0) {
    const updatedExtra = [...new Set([...extraFromConfig, ...newMarkers])];
    saveExtraMarkers(updatedExtra);
    console.log('  发现新说话标记: ' + newMarkers.join(', '));
  }
}

// ============================================================
// 格式化函数
// ============================================================

/**
 * 后处理主函数
 * @param {string} content - 原始内容
 * @param {boolean} updateConfig - 是否更新配置文件
 * @returns {string} - 处理后的内容
 */
function postProcess(content, updateConfig = true) {
  // 0. 动态提取说话标记并更新配置
  if (updateConfig) {
    updateConfigIfNewMarkers(content);
  }

  // 1. 移除段首缩进（全角空格）
  content = removeIndentation(content);

  // 2. 短对话合并（< 20 字）
  content = mergeShortDialogues(content);

  // 3. 空行规范化
  content = normalizeEmptyLines(content);

  // 4. 行尾空格清理
  content = removeTrailingSpaces(content);

  return content;
}

/**
 * 移除段首缩进（全角空格）
 */
function removeIndentation(content) {
  // 只移除行首的全角空格（一个或多个），不影响空行
  return content.replace(/^　　+/gm, '');
}

/**
 * 短对话合并
 * 当说话标记 + 对话内容 < 20 字时，合并成一行
 */
function mergeShortDialogues(content) {
  // 获取完整的说话标记列表
  const allMarkers = getAllMarkers(content);
  const speechMarkers = allMarkers.join('|');

  // 处理双行换行的情况（说话标记：\n\n"对话"）
  const doubleLineRegex = new RegExp(`(${speechMarkers})：\\n\\n(["""][^]*?["""])`, 'g');
  content = content.replace(doubleLineRegex, (match, marker, dialogue) => {
    const dialogueContent = dialogue.replace(/["""]/g, '');
    if (dialogueContent.length < 20) {
      return marker + '：' + dialogue;
    }
    return match;
  });

  // 处理单行换行的情况（说话标记：\n"对话"）
  const singleLineRegex = new RegExp(`(${speechMarkers})：\\n(["""][^]*?["""])`, 'g');
  content = content.replace(singleLineRegex, (match, marker, dialogue) => {
    const dialogueContent = dialogue.replace(/["""]/g, '');
    if (dialogueContent.length < 20) {
      return marker + '：' + dialogue;
    }
    return match;
  });

  return content;
}

/**
 * 空行规范化
 * - 保留段落间的空行（两个换行符）
 * - 移除过多的连续空行（超过3个）
 */
function normalizeEmptyLines(content) {
  // 将连续4个以上换行合并为3个（段落间保留一个空行）
  content = content.replace(/\n{4,}/g, '\n\n\n');

  // 确保文件末尾有且仅有一个换行符
  content = content.trimEnd() + '\n';

  return content;
}

/**
 * 移除行尾空格
 */
function removeTrailingSpaces(content) {
  return content.replace(/[ \t]+$/gm, '');
}

// ============================================================
// 文件处理
// ============================================================

/**
 * 处理单个文件
 */
function processFile(inputPath, outputPath, updateConfig = true) {
  console.log('处理文件: ' + inputPath);

  const content = fs.readFileSync(inputPath, 'utf8');
  const processed = postProcess(content, updateConfig);

  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, processed, 'utf8');

  // 统计
  const originalLines = content.split('\n').length;
  const processedLines = processed.split('\n').length;
  console.log('  原始行数: ' + originalLines);
  console.log('  处理后行数: ' + processedLines);
  console.log('  输出: ' + outputPath);
}

/**
 * 批量处理目录中的所有 .md 文件
 */
function processDirectory(inputDir, outputDir) {
  console.log('批量处理目录: ' + inputDir);
  console.log('输出目录: ' + outputDir);
  console.log('---');

  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.md'));
  console.log('找到 ' + files.length + ' 个 .md 文件');

  let processed = 0;
  let errors = 0;

  for (const file of files) {
    try {
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(outputDir, file);
      // 只在第一个文件时更新配置（避免重复提取）
      processFile(inputPath, outputPath, processed === 0);
      processed++;
    } catch (err) {
      console.error('处理 ' + file + ' 时出错: ' + err.message);
      errors++;
    }
  }

  console.log('---');
  console.log('处理完成: ' + processed + ' 成功, ' + errors + ' 失败');
}

/**
 * 显示当前配置
 */
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
    console.log('  node post-process.js --config');
    console.log('');
    console.log('示例:');
    console.log('  node post-process.js ch_01.md ch_01_processed.md');
    console.log('  node post-process.js --dir ch_original ch_formatted');
    console.log('  node post-process.js --config');
    process.exit(1);
  }

  if (args[0] === '--config') {
    showConfig();
  } else if (args[0] === '--dir') {
    // 批量处理模式
    if (args.length < 3) {
      console.error('错误: 批量模式需要输入目录和输出目录');
      process.exit(1);
    }
    processDirectory(args[1], args[2]);
  } else {
    // 单文件模式
    const inputPath = args[0];
    const outputPath = args[1] || inputPath.replace('.md', '_processed.md');
    processFile(inputPath, outputPath);
  }
}

module.exports = { postProcess, processFile, processDirectory, extractSpeechMarkers, getAllMarkers };
