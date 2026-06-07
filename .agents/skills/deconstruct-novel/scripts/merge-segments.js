const fs = require('fs');
const path = require('path');

const novelDir = process.argv[2];
const chapterNum = process.argv[3];

if (!novelDir || !chapterNum) {
  console.error('用法: node merge-segments.js <小说目录路径> <章节号>');
  console.error('示例: node merge-segments.js 金庸/天龙八部 1');
  process.exit(1);
}

const batchJsonDir = path.join(novelDir, 'batch_json');
const paddedNum = chapterNum.padStart(3, '0');
const progressJsonl = path.join(batchJsonDir, `ch_${paddedNum}_progress.jsonl`);
const summaryFile = path.join(batchJsonDir, `ch_${paddedNum}_summary.txt`);
const outputFile = path.join(batchJsonDir, `ch_${paddedNum}.json`);

// 检查进度文件
if (!fs.existsSync(progressJsonl)) {
  console.error(`错误: ${progressJsonl} 不存在`);
  process.exit(1);
}

// 读取 chapter_summary
let chapterSummary = '';
if (fs.existsSync(summaryFile)) {
  chapterSummary = fs.readFileSync(summaryFile, 'utf8').trim();
} else {
  console.warn(`警告: ${summaryFile} 不存在，chapter_summary 将为空`);
}

// 读取所有段落
const lines = fs.readFileSync(progressJsonl, 'utf8').trim().split('\n').filter(Boolean);

let allDialogues = [];
let allNewEntities = { characters: [], skills: [], techniques: [], factions: [], locations: [], items: [] };
let allEntityUpdates = [];

for (const line of lines) {
  const seg = JSON.parse(line);
  allDialogues.push(...(seg.dialogues || []));

  for (const [type, entities] of Object.entries(seg.new_entities || {})) {
    if (Array.isArray(entities)) {
      allNewEntities[type].push(...entities);
    }
  }

  allEntityUpdates.push(...(seg.entity_updates || []));
}

// 去重对话（按 speaker + text + line_start）
const dialogueSet = new Set();
allDialogues = allDialogues.filter(d => {
  const key = `${d.speaker}_${d.text}_${d.line_start}`;
  if (dialogueSet.has(key)) return false;
  dialogueSet.add(key);
  return true;
});

// 去重实体（按 id）
for (const [type, entities] of Object.entries(allNewEntities)) {
  const seen = new Set();
  allNewEntities[type] = entities.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

// 合并 entity_updates（按 id 聚合）
const updateMap = new Map();
for (const update of allEntityUpdates) {
  if (!updateMap.has(update.id)) {
    updateMap.set(update.id, update);
  } else {
    const existing = updateMap.get(update.id);
    if (update.updates) {
      existing.updates = { ...existing.updates, ...update.updates };
    }
    if (update.relationship_updates) {
      existing.relationship_updates = [
        ...(existing.relationship_updates || []),
        ...update.relationship_updates
      ];
    }
  }
}

// 写入最终文件
const result = {
  chapter: parseInt(chapterNum),
  chapter_summary: chapterSummary,
  dialogues: allDialogues,
  new_entities: allNewEntities,
  entity_updates: Array.from(updateMap.values())
};

fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');

console.log(`[完成] ch_${paddedNum}.json 已生成`);
console.log(`  段落数: ${lines.length}`);
console.log(`  对话数: ${allDialogues.length}`);
console.log(`  新实体: ${Object.values(allNewEntities).reduce((sum, arr) => sum + arr.length, 0)} 个`);
console.log(`  更新数: ${allEntityUpdates.length} 次`);

// 清理临时文件（可选）
// fs.unlinkSync(progressJsonl);
// fs.unlinkSync(summaryFile);
