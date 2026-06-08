const fs = require('fs');
const path = require('path');
const { validateChapterData } = require('./validators');
const CHAPTER_JSON_RE = /^ch_\d{3}\.json$/;

const novelDir = process.argv[2];
if (!novelDir) {
  console.error('用法: node resume.js <小说目录路径>');
  console.error('示例: node resume.js 古龙/天涯·明月·刀');
  process.exit(1);
}

const chapterListPath = path.join(novelDir, 'chapter_list.json');
const batchJsonDir = path.join(novelDir, 'batch_json');
const registryPath = path.join(novelDir, 'entity_registry.json');

// 检查 chapter_list.json
if (!fs.existsSync(chapterListPath)) {
  console.error(`[恢复] ❌ ${chapterListPath} 不存在`);
  console.error('[恢复] 请先运行 prepare.js 生成章节列表');
  process.exit(1);
}

const chapterList = JSON.parse(fs.readFileSync(chapterListPath, 'utf-8'));
const totalChapters = chapterList.totalChapters;
const allChapters = chapterList.chapters.map(normalizeChapterStem);

if (!fs.existsSync(batchJsonDir)) {
  console.error(`[恢复] ❌ ${batchJsonDir} 不存在`);
  console.error('[恢复] 没有找到任何提取结果，请从头开始');
  process.exit(1);
}

// 读取所有有效完成章节。存在但无效的 ch_N.json 不算完成。
const existingChapterJsons = new Set();
const invalidChapterJsons = [];
for (const f of fs.readdirSync(batchJsonDir).filter(f => CHAPTER_JSON_RE.test(f))) {
  const stem = f.replace('.json', '');
  const filePath = path.join(batchJsonDir, f);
  try {
    const chapter = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const errors = validateChapterData(chapter, f);
    if (errors.length > 0) {
      invalidChapterJsons.push({ chapter: stem, file: f, errors: errors.slice(0, 5) });
    } else {
      existingChapterJsons.add(stem);
    }
  } catch (err) {
    invalidChapterJsons.push({ chapter: stem, file: f, errors: [err.message] });
  }
}

// 检测可恢复章节（有 progress.jsonl 但没有最终 json；不代表有 Agent 正在运行）
const progressFiles = new Set(
  fs.readdirSync(batchJsonDir)
    .filter(f => f.startsWith('ch_') && f.endsWith('_progress.jsonl'))
    .map(f => f.replace('_progress.jsonl', ''))
);

const completedChapters = allChapters.filter(ch => existingChapterJsons.has(ch));
const inProgressChapters = allChapters.filter(ch => !existingChapterJsons.has(ch) && progressFiles.has(ch));
const pendingChapters = allChapters.filter(ch => !existingChapterJsons.has(ch) && !progressFiles.has(ch));

// 检查合并状态
const registryExists = fs.existsSync(registryPath);
let hasRegistry = false;
let registryEntityCount = 0;
let registryErrors = [];
if (registryExists) {
  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    hasRegistry = true;
    registryEntityCount = Object.values(registry).reduce((sum, arr) => sum + arr.length, 0);
  } catch (e) {
    registryErrors = [e.message];
  }
}

// 检查最终输出文件
const finalOutputs = ['characters.json', 'skills.json', 'techniques.json', 'factions.json', 'locations.json', 'items.json', 'dialogues.json', 'chapter_summaries.json'];
const outputStatus = {};
const invalidOutputs = [];
let finalOutputCount = 0;
for (const f of finalOutputs) {
  const outputPath = path.join(novelDir, f);
  let valid = false;
  if (fs.existsSync(outputPath)) {
    try {
      JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      valid = true;
    } catch (err) {
      invalidOutputs.push({ file: f, error: err.message });
    }
  }
  outputStatus[f] = valid;
  if (valid) finalOutputCount++;
}

// === 输出报告 ===
const pct = Math.round(completedChapters.length / totalChapters * 100);

console.log(`[恢复] 小说: ${novelDir}`);
console.log(`[恢复] 总进度: ${completedChapters.length}/${totalChapters} 章 (${pct}%)`);
console.log('');

if (completedChapters.length > 0) {
  console.log(`[恢复] ✅ 已完成: ${completedChapters.join(', ')}`);
}

if (invalidChapterJsons.length > 0) {
  console.log(`[恢复] ❌ 无效章节文件: ${invalidChapterJsons.map(x => x.file).join(', ')}`);
  for (const item of invalidChapterJsons.slice(0, 5)) {
    console.log(`     ${item.file}: ${item.errors[0]}`);
  }
}

if (inProgressChapters.length > 0) {
  console.log(`[恢复] 🔄 可恢复: ${inProgressChapters.join(', ')}`);
  console.log(`     注意: 可恢复只表示存在 progress.jsonl，不代表有 Sub Agent 正在运行`);
  // 显示每个可恢复章节的进度
  for (const ch of inProgressChapters) {
    const progressFile = path.join(batchJsonDir, `${ch}_progress.jsonl`);
    const lines = fs.readFileSync(progressFile, 'utf8').trim().split('\n').filter(Boolean);
    console.log(`     ${ch}: 已处理 ${lines.length} 段`);
  }
}

if (pendingChapters.length > 0) {
  console.log(`[恢复] ⬜ 待处理: ${pendingChapters.join(', ')}`);
}

console.log('');

// 合并状态
console.log('[恢复] 合并状态:');
if (hasRegistry) {
  console.log(`  ✅ entity_registry.json: ${registryEntityCount} 个实体`);
} else if (registryExists) {
  console.log(`  ❌ entity_registry.json: 无效 (${registryErrors[0] || '无法解析'})`);
} else {
  console.log(`  ⬜ entity_registry.json: 不存在`);
  if (completedChapters.length > 0) {
    console.log(`  💡 提示: 有 ${completedChapters.length} 个章节已完成，可运行 merge-entities.js 合并`);
  }
}

// 最终产出
console.log('[恢复] 最终产物:');
for (const f of finalOutputs) {
  if (outputStatus[f]) {
    console.log(`  ✅ ${f}`);
  }
}
if (finalOutputCount > 0 && finalOutputCount < 8) {
  console.log(`  💡 提示: 最终产物不完整 (${finalOutputCount}/8)，需要重新运行第4~5步`);
} else if (finalOutputCount === 8) {
  console.log('  🎉 所有最终产物已就绪');
}
if (invalidOutputs.length > 0) {
  console.log(`  ❌ 无效最终产物: ${invalidOutputs.map(x => x.file).join(', ')}`);
}

// 下一步建议
console.log('');
console.log('[恢复] 下一步建议:');
if (inProgressChapters.length > 0 || pendingChapters.length > 0) {
  const total = inProgressChapters.length + pendingChapters.length;
  console.log(`  ⚠️  还有 ${total} 章待处理（${inProgressChapters.length} 章可恢复，${pendingChapters.length} 章未开始）`);
  console.log(`  💡 如果当前没有 Sub Agent 正在运行，必须立即继续派发（RPM < 100）`);
  if (inProgressChapters.length > 0) {
    console.log(`  💡 可恢复章节会从上次中断的段落继续`);
  }
} else if (completedChapters.length === totalChapters && !hasRegistry) {
  console.log(`  💡 运行 merge-entities.js 合并注册表`);
} else if (hasRegistry && finalOutputCount < 8) {
  if (finalOutputCount < 2) {
    console.log(`  💡 运行代码合并（第4步）和最终拆分（第5步）`);
  } else if (finalOutputCount < 8) {
    console.log(`  💡 重新运行最终拆分（第5步）生成缺失文件`);
  }
} else if (finalOutputCount === 8) {
  console.log('  🎉 所有步骤已完成，无需继续处理');
}

// === 写入 resume JSON（供脚本读取） ===
const resumeData = {
  novelDir,
  totalChapters,
  completedChapters: completedChapters.length,
  resumableChapters: inProgressChapters.length,
  inProgressChapters: inProgressChapters.length,
  pendingChapters: pendingChapters.length,
  invalidChapters: invalidChapterJsons.length,
  overallProgress: pct,
  completed: completedChapters,
  resumable: inProgressChapters,
  inProgress: inProgressChapters,
  pending: pendingChapters,
  invalid: invalidChapterJsons,
  registry: {
    exists: hasRegistry,
    entityCount: registryEntityCount
  },
  finalOutput: {
    count: finalOutputCount,
    total: 8,
    files: outputStatus,
    invalid: invalidOutputs
  }
};

const resumeJsonPath = path.join(novelDir, 'batch_resume.json');
fs.writeFileSync(resumeJsonPath, JSON.stringify(resumeData, null, 2), 'utf-8');
console.log(`\n[恢复] 详细报告已写入 ${resumeJsonPath}`);

function normalizeChapterStem(file) {
  const stem = file.replace(/\.md$/, '');
  const match = stem.match(/^ch_(\d+)$/);
  if (!match) return stem;
  return `ch_${match[1].padStart(3, '0')}`;
}
