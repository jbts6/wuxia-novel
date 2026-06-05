const fs = require('fs');
const path = require('path');

const novelDir = process.argv[2];
if (!novelDir) {
  console.error('用法: node merge-registries.js <小说目录路径>');
  console.error('示例: node merge-registries.js 金庸/天龙八部');
  process.exit(1);
}

const batchConfigPath = path.join(novelDir, 'batch_config.json');
const mainRegistryPath = path.join(novelDir, 'entity_registry.json');
const batchJsonDir = path.join(novelDir, 'batch_json');

if (!fs.existsSync(batchConfigPath)) {
  console.error(`错误: ${batchConfigPath} 不存在`);
  console.error('请先运行 prepare.js 生成批次配置');
  process.exit(1);
}

const batchConfig = JSON.parse(fs.readFileSync(batchConfigPath, 'utf-8'));

// 读取主 registry
let mainRegistry = JSON.parse(fs.readFileSync(mainRegistryPath, 'utf-8'));

console.log(`[合并] 小说目录: ${novelDir}`);
console.log(`[合并] 共 ${batchConfig.totalBatches} 个批次`);

// Rank 排序表
const rankOrder = ['平平无奇','初窥门径','略有小成','登堂入室','炉火纯青','出神入化','登峰造极','返璞归真'];

// 辅助函数：去重追加
function appendDedup(arr1, arr2) {
  const set = new Set(arr1.map(x => JSON.stringify(x)));
  for (const item of arr2) {
    const key = JSON.stringify(item);
    if (!set.has(key)) {
      arr1.push(item);
      set.add(key);
    }
  }
  return arr1;
}

// 辅助函数：按 target+type 去重追加关系
function appendDedupByTargetType(arr1, arr2) {
  const existingKeys = new Set(arr1.map(r => `${r.target}|${r.type}`));
  for (const rel of arr2) {
    const key = `${rel.target}|${rel.type}`;
    if (!existingKeys.has(key)) {
      arr1.push(rel);
      existingKeys.add(key);
    }
  }
  return arr1;
}

// 辅助函数：合并字符数组（去重）
function dedupArray(arr) {
  return [...new Set(arr)];
}

// 合并单个类型的所有实体
function mergeEntityType(mainEntities, batchEntities, type) {
  for (const batchEntity of batchEntities) {
    const existing = mainEntities.find(e => e.id === batchEntity.id);
    if (!existing) {
      // 新实体，直接添加
      mainEntities.push(batchEntity);
    } else {
      // 已存在，按策略合并
      mergeEntity(existing, batchEntity, type);
    }
  }
}

// 合并单个实体（按策略）
function mergeEntity(main, batch, type) {
  // 通用：source_refs 追加去重
  if (batch.source_refs) {
    main.source_refs = appendDedup(main.source_refs || [], batch.source_refs);
  }

  // 通用：rag_refs 追加去重
  if (batch.rag_refs) {
    main.rag_refs = [...new Set([...(main.rag_refs || []), ...batch.rag_refs])];
  }

  switch (type) {
    case 'characters':
      // name: keep_first_with_alias（真名揭晓时更新）
      if (batch.name && batch.name !== main.name && main.name !== '未知') {
        main.alias = [...new Set([...(main.alias || []), main.name])];
        main.name = batch.name;
      }
      // alias: append_dedup
      if (batch.alias) {
        main.alias = [...new Set([...(main.alias || []), ...batch.alias])];
      }
      // rank: max
      if (batch.rank) {
        const currentIdx = rankOrder.indexOf(main.rank);
        const batchIdx = rankOrder.indexOf(batch.rank);
        if (batchIdx > currentIdx) {
          main.rank = batch.rank;
        }
      }
      // one_line: override
      if (batch.one_line) main.one_line = batch.one_line;
      // personality: override
      if (batch.personality) {
        main.personality = main.personality || {};
        if (batch.personality.traits) {
          main.personality.traits = [...new Set([...(main.personality.traits || []), ...batch.personality.traits])];
        }
        if (batch.personality.speech_style) main.personality.speech_style = batch.personality.speech_style;
        if (batch.personality.temperament) main.personality.temperament = batch.personality.temperament;
      }
      // relationships: append_dedup_by_target_type
      if (batch.relationships) {
        main.relationships = appendDedupByTargetType(main.relationships || [], batch.relationships);
      }
      // known_skills, related_skills: append
      if (batch.known_skills) main.known_skills = dedupArray([...(main.known_skills || []), ...batch.known_skills]);
      if (batch.related_skills) main.related_skills = dedupArray([...(main.related_skills || []), ...batch.related_skills]);
      break;

    case 'skills':
      // rank: max
      if (batch.rank) {
        const currentIdx = rankOrder.indexOf(main.rank);
        const batchIdx = rankOrder.indexOf(batch.rank);
        if (batchIdx > currentIdx) main.rank = batch.rank;
      }
      // one_line, combat_style: override
      if (batch.one_line) main.one_line = batch.one_line;
      if (batch.combat_style) main.combat_style = batch.combat_style;
      // techniques: append_dedup_by_id
      if (batch.techniques) {
        main.techniques = main.techniques || [];
        const existingIds = new Set(main.techniques.map(t => t.id));
        for (const tech of batch.techniques) {
          if (!existingIds.has(tech.id)) {
            main.techniques.push(tech);
            existingIds.add(tech.id);
          }
        }
      }
      // progression: append_dedup_by_level
      if (batch.progression) {
        main.progression = main.progression || [];
        const existingLevels = new Set(main.progression.map(p => p.level));
        for (const p of batch.progression) {
          if (!existingLevels.has(p.level)) {
            main.progression.push(p);
            existingLevels.add(p.level);
          }
        }
      }
      // effects: append_dedup
      if (batch.effects) {
        main.effects = appendDedup(main.effects || [], batch.effects);
      }
      break;

    case 'techniques':
      // description: override
      if (batch.description) main.description = batch.description;
      break;

    case 'factions':
      // one_line: override
      if (batch.one_line) main.one_line = batch.one_line;
      // sub_divisions: append_dedup
      if (batch.sub_divisions) {
        main.sub_divisions = [...new Set([...(main.sub_divisions || []), ...batch.sub_divisions])];
      }
      break;

    case 'locations':
      // one_line: override
      if (batch.one_line) main.one_line = batch.one_line;
      break;

    case 'items':
      // owner: override
      if (batch.owner) main.owner = batch.owner;
      // one_line, description: override
      if (batch.one_line) main.one_line = batch.one_line;
      if (batch.description) main.description = batch.description;
      // effects: append_dedup
      if (batch.effects) {
        main.effects = appendDedup(main.effects || [], batch.effects);
      }
      // related_characters, related_skills: append
      if (batch.related_characters) main.related_characters = dedupArray([...(main.related_characters || []), ...batch.related_characters]);
      if (batch.related_skills) main.related_skills = dedupArray([...(main.related_skills || []), ...batch.related_skills]);
      break;
  }
}

// 读取并合并每个批次的 registry
for (const batch of batchConfig.batches) {
  const batchRegistryPath = path.join(novelDir, batch.registry副本);
  if (!fs.existsSync(batchRegistryPath)) {
    console.log(`[跳过] 批次 ${batch.batch}: ${batch.registry副本} 不存在`);
    continue;
  }

  console.log(`[合并] 批次 ${batch.batch}: ${batch.chapters.join(', ')}`);
  const batchRegistry = JSON.parse(fs.readFileSync(batchRegistryPath, 'utf-8'));

  for (const type of ['characters', 'skills', 'techniques', 'factions', 'locations', 'items']) {
    if (batchRegistry[type]) {
      mergeEntityType(mainRegistry[type], batchRegistry[type], type);
    }
  }
}

// 写入主 registry
fs.writeFileSync(mainRegistryPath, JSON.stringify(mainRegistry, null, 2), 'utf-8');

// 输出统计
console.log('\n[完成] 注册表合并完成！');
console.log('最终统计:');
for (const [type, data] of Object.entries(mainRegistry)) {
  console.log(`  ${type}: ${data.length} 个实体`);
}
