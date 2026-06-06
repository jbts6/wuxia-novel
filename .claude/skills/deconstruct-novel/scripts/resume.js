const fs = require('fs');
const path = require('path');

const novelDir = process.argv[2];
if (!novelDir) {
  console.error('用法: node resume.js <小说目录路径>');
  console.error('示例: node resume.js 古龙/天涯·明月·刀');
  process.exit(1);
}

const batchConfigPath = path.join(novelDir, 'batch_config.json');
const batchJsonDir = path.join(novelDir, 'batch_json');
const registryPath = path.join(novelDir, 'entity_registry.json');

// 检查必要目录
if (!fs.existsSync(batchConfigPath)) {
  console.error(`[恢复] ❌ ${batchConfigPath} 不存在`);
  console.error('[恢复] 请先运行 prepare.js 生成批次配置');
  process.exit(1);
}

const batchConfig = JSON.parse(fs.readFileSync(batchConfigPath, 'utf-8'));
const totalChapters = batchConfig.totalChapters;
const totalBatches = batchConfig.totalBatches;

if (!fs.existsSync(batchJsonDir)) {
  console.error(`[恢复] ❌ ${batchJsonDir} 不存在`);
  console.error('[恢复] 没有找到任何提取结果，请从头开始');
  process.exit(1);
}

// 读取所有已完成的章节
const existingChapterFiles = new Set(
  fs.readdirSync(batchJsonDir)
    .filter(f => f.startsWith('ch_') && f.endsWith('.json'))
    .map(f => f.replace('.json', '.md'))
);

// 分析每个批次的状态
const batchStatus = [];
let completedChapters = 0;
let completedBatches = 0;
let partialBatches = 0;
let pendingBatches = 0;

for (const batch of batchConfig.batches) {
  const batchNum = batch.batch;
  const chapters = batch.chapters;
  const batchRegistryPath = path.join(novelDir, batch.registry副本);
  const hasRegistry = fs.existsSync(batchRegistryPath);

  const done = chapters.filter(ch => existingChapterFiles.has(ch));
  const pending = chapters.filter(ch => !existingChapterFiles.has(ch));

  completedChapters += done.length;

  let status;
  if (done.length === chapters.length && hasRegistry) {
    status = 'complete';
    completedBatches++;
  } else if (done.length === 0 && !hasRegistry) {
    status = 'pending';
    pendingBatches++;
  } else {
    status = 'partial';
    partialBatches++;
  }

  batchStatus.push({
    batch: batchNum,
    status,
    chapters,
    done: done.map(ch => ch.replace('.md', '')),
    pending: pending.map(ch => ch.replace('.md', '')),
    hasRegistry
  });
}

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
const pct = Math.round(completedChapters / totalChapters * 100);

console.log(`[恢复] 小说: ${novelDir}`);
console.log(`[恢复] 总进度: ${completedChapters}/${totalChapters} 章 (${pct}%)`);
console.log('');

// 批次详情
for (const b of batchStatus) {
  const statusIcon = b.status === 'complete' ? '✅' : b.status === 'partial' ? '🔄' : '⬜';
  const range = b.chapters[0].replace('.md', '') + '~' + b.chapters[b.chapters.length - 1].replace('.md', '');
  if (b.status === 'complete') {
    console.log(`  ${statusIcon} 第${b.batch}批(${range}): 完成`);
  } else if (b.status === 'partial') {
    const doneStr = b.done.join(' ');
    const pendStr = b.pending.join(' ');
    console.log(`  ${statusIcon} 第${b.batch}批(${range}): ${doneStr} ✓  待处理: ${pendStr}`);
  } else {
    console.log(`  ${statusIcon} 第${b.batch}批(${range}): 未开始`);
  }
}

console.log('');
console.log(`[恢复] 统计: ${completedBatches}批完成, ${partialBatches}批部分完成, ${pendingBatches}批未开始`);

// 合并状态
const registriesToMerge = batchStatus.filter(b => b.hasRegistry).length;
console.log('');
console.log('[恢复] 合并状态:');
if (hasRegistry) {
  console.log(`  ✅ entity_registry.json: ${registryEntityCount} 个实体 (${registriesToMerge} 个批次已写入)`);
} else {
  console.log(`  ⬜ entity_registry.json: 不存在`);
  if (completedBatches > 0) {
    console.log(`  💡 提示: 有 ${completedBatches} 个批次已完成，可运行 merge-registries.js 合并`);
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
if (pendingBatches > 0 || partialBatches > 0) {
  const partialAndPending = batchStatus.filter(b => b.status !== 'complete');
  console.log(`  ⚠️  还有处理中的批次，请继续 Sub Agent 提取:`);
  for (const b of partialAndPending) {
    const range = b.chapters[0].replace('.md', '') + '~' + b.chapters[b.chapters.length - 1].replace('.md', '');
    if (b.status === 'partial') {
      console.log(`     - 第${b.batch}批(${range}): 恢复模式启动（跳过已完成章节）`);
    } else {
      console.log(`     - 第${b.batch}批(${range}): 正常启动`);
    }
  }
} else if (completedBatches === totalBatches && !hasRegistry) {
  console.log(`  💡 运行 merge-registries.js 合并注册表`);
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
  totalBatches,
  completedChapters,
  overallProgress: pct,
  batchStatus,
  completedBatches,
  partialBatches,
  pendingBatches,
  registry: {
    exists: hasRegistry,
    entityCount: registryEntityCount,
    batchCountMerged: registriesToMerge
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
