const fs = require('fs');
const path = require('path');

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
const allChapters = chapterList.chapters.map(f => f.replace('.md', ''));

if (!fs.existsSync(batchJsonDir)) {
  console.error(`[恢复] ❌ ${batchJsonDir} 不存在`);
  console.error('[恢复] 没有找到任何提取结果，请从头开始');
  process.exit(1);
}

// 读取所有已完成的章节
const existingChapterJsons = new Set(
  fs.readdirSync(batchJsonDir)
    .filter(f => f.startsWith('ch_') && f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
);

// 检测进行中的章节（有 progress.jsonl 但没有最终 json）
const progressFiles = new Set(
  fs.readdirSync(batchJsonDir)
    .filter(f => f.startsWith('ch_') && f.endsWith('_progress.jsonl'))
    .map(f => f.replace('_progress.jsonl', ''))
);

const completedChapters = allChapters.filter(ch => existingChapterJsons.has(ch));
const inProgressChapters = allChapters.filter(ch => !existingChapterJsons.has(ch) && progressFiles.has(ch));
const pendingChapters = allChapters.filter(ch => !existingChapterJsons.has(ch) && !progressFiles.has(ch));

// 检查合并状态
const hasRegistry = fs.existsSync(registryPath);
let registryEntityCount = 0;
if (hasRegistry) {
  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    registryEntityCount = Object.values(registry).reduce((sum, arr) => sum + arr.length, 0);
  } catch (e) {
    // JSON 损坏
  }
}

// 检查最终输出文件
const finalOutputs = ['characters.json', 'skills.json', 'techniques.json', 'factions.json', 'locations.json', 'items.json', 'dialogues.json', 'chapter_summaries.json'];
const outputStatus = {};
let finalOutputCount = 0;
for (const f of finalOutputs) {
  const exists = fs.existsSync(path.join(novelDir, f));
  outputStatus[f] = exists;
  if (exists) finalOutputCount++;
}

// === 输出报告 ===
const pct = Math.round(completedChapters.length / totalChapters * 100);

console.log(`[恢复] 小说: ${novelDir}`);
console.log(`[恢复] 总进度: ${completedChapters.length}/${totalChapters} 章 (${pct}%)`);
console.log('');

if (completedChapters.length > 0) {
  console.log(`[恢复] ✅ 已完成: ${completedChapters.join(', ')}`);
}

if (inProgressChapters.length > 0) {
  console.log(`[恢复] 🔄 进行中: ${inProgressChapters.join(', ')}`);
  // 显示每个进行中章节的进度
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

// 下一步建议
console.log('');
console.log('[恢复] 下一步建议:');
if (inProgressChapters.length > 0 || pendingChapters.length > 0) {
  const total = inProgressChapters.length + pendingChapters.length;
  console.log(`  ⚠️  还有 ${total} 章待处理（${inProgressChapters.length} 章进行中，${pendingChapters.length} 章未开始）`);
  console.log(`  💡 Agent 自主决定并行度（RPM < 100）`);
  if (inProgressChapters.length > 0) {
    console.log(`  💡 进行中的章节会从上次中断的段落继续`);
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
  inProgressChapters: inProgressChapters.length,
  pendingChapters: pendingChapters.length,
  overallProgress: pct,
  completed: completedChapters,
  inProgress: inProgressChapters,
  pending: pendingChapters,
  registry: {
    exists: hasRegistry,
    entityCount: registryEntityCount
  },
  finalOutput: {
    count: finalOutputCount,
    total: 8,
    files: outputStatus
  }
};

const resumeJsonPath = path.join(novelDir, 'batch_resume.json');
fs.writeFileSync(resumeJsonPath, JSON.stringify(resumeData, null, 2), 'utf-8');
console.log(`\n[恢复] 详细报告已写入 ${resumeJsonPath}`);
