const fs = require('fs');
const path = require('path');
const { validateChapterData } = require('./validators');
const { normalizeSkill, normalizeCharacter, normalizeItem } = require('./semantic-fields');
const CHAPTER_JSON_RE = /^ch_\d{3}\.json$/;

const novelDir = process.argv[2];

if (!novelDir) {
  console.error('用法: node merge-entities.js <小说目录路径>');
  console.error('示例: node merge-entities.js 金庸/天龙八部');
  process.exit(1);
}

const batchJsonDir = path.join(novelDir, 'batch_json');
const registryPath = path.join(novelDir, 'entity_registry.json');

// 1. 检查 batch_json 目录
if (!fs.existsSync(batchJsonDir)) {
  console.error(`错误: ${batchJsonDir} 目录不存在`);
  console.error('请先运行 prepare.js 并完成章节提取');
  process.exit(1);
}

// 2. 列出所有 ch_NNN.json 文件，按章节号排序
const chapterFiles = fs.readdirSync(batchJsonDir)
  .filter(f => CHAPTER_JSON_RE.test(f))
  .sort((a, b) => {
    const numA = parseInt(a.replace('ch_', '').replace('.json', ''));
    const numB = parseInt(b.replace('ch_', '').replace('.json', ''));
    return numA - numB;
  });

if (chapterFiles.length === 0) {
  console.error(`错误: ${batchJsonDir} 中没有找到 ch_*.json 文件`);
  console.error('请先完成章节提取');
  process.exit(1);
}

console.log(`[合并] 小说目录: ${novelDir}`);
console.log(`[合并] 找到 ${chapterFiles.length} 个章节文件`);

// 3. 初始化注册表
const registry = {
  characters: [],
  skills: [],
  techniques: [],
  factions: [],
  locations: [],
  items: []
};

// 实体索引：id -> 实体对象（快速查找）
const entityIndex = {
  characters: new Map(),
  skills: new Map(),
  techniques: new Map(),
  factions: new Map(),
  locations: new Map(),
  items: new Map()
};

// 4. 按章节顺序处理
let processedCount = 0;
let newEntityCount = 0;
let updateCount = 0;

function normalizeEntityForType(type, entity) {
  if (type === 'skills') return normalizeSkill(entity).entity;
  if (type === 'characters') return normalizeCharacter(entity).entity;
  if (type === 'items') return normalizeItem(entity).entity;
  return entity;
}

for (const chapterFile of chapterFiles) {
  const chapterPath = path.join(batchJsonDir, chapterFile);
  let chapterData;

  try {
    chapterData = JSON.parse(fs.readFileSync(chapterPath, 'utf8'));
  } catch (err) {
    console.error(`[错误] 无法解析 ${chapterFile}: ${err.message}`);
    process.exit(1);
  }

  const validationErrors = validateChapterData(chapterData, chapterFile);
  if (validationErrors.length > 0) {
    console.error(`[错误] ${chapterFile} 校验失败，停止合并:`);
    for (const err of validationErrors.slice(0, 30)) console.error(`  - ${err}`);
    if (validationErrors.length > 30) console.error(`  ... 还有 ${validationErrors.length - 30} 个错误`);
    process.exit(1);
  }

  const chapterNum = chapterData.chapter;

  // 处理 new_entities
  if (chapterData.new_entities) {
    for (const [type, entities] of Object.entries(chapterData.new_entities)) {
      if (!Array.isArray(entities)) continue;

      for (const entity of entities) {
        if (!entity.id) {
          console.warn(`[警告] ${chapterFile} 中有无 ID 的 ${type} 实体，跳过`);
          continue;
        }

        const index = entityIndex[type];
        if (index.has(entity.id)) {
          // 已存在，合并 source_refs
          const existing = index.get(entity.id);
          if (entity.source_refs) {
            existing.source_refs = mergeSourceRefs(existing.source_refs, entity.source_refs);
          }
          if (entity.rag_refs) {
            existing.rag_refs = mergeRagRefs(existing.rag_refs, entity.rag_refs);
          }
          updateCount++;
        } else {
          // 新实体
          const normalized = normalizeEntityForType(type, entity);
          registry[type].push(normalized);
          index.set(normalized.id, normalized);
          newEntityCount++;
        }
      }
    }
  }

  // 处理 entity_updates
  if (chapterData.entity_updates) {
    for (const update of chapterData.entity_updates) {
      if (!update.id) {
        console.warn(`[警告] ${chapterFile} 中有无 ID 的 entity_update，跳过`);
        continue;
      }

      // 查找实体
      let entity = null;
      let entityType = null;
      for (const [type, index] of Object.entries(entityIndex)) {
        if (index.has(update.id)) {
          entity = index.get(update.id);
          entityType = type;
          break;
        }
      }

      if (!entity) {
        console.warn(`[警告] ${chapterFile} 中更新的实体 ${update.id} 不存在，跳过`);
        continue;
      }

      // 处理字段更新
      if (update.updates) {
        for (const [key, value] of Object.entries(update.updates)) {
          if (key === 'source_refs') {
            entity.source_refs = mergeSourceRefs(entity.source_refs || [], value);
          } else if (key === 'rag_refs') {
            entity.rag_refs = mergeRagRefs(entity.rag_refs || [], value);
          } else if (key === 'relationships') {
            entity.relationships = mergeRelationships(entity.relationships || [], value);
          } else {
            // 其他字段直接覆盖（如 rank 提升）
            entity[key] = value;
          }
        }
        const normalized = normalizeEntityForType(entityType, entity);
        Object.assign(entity, normalized);
        updateCount++;
      }

      // 处理关系更新
      if (update.relationship_updates) {
        if (!entity.relationships) {
          entity.relationships = [];
        }
        for (const relUpdate of update.relationship_updates) {
          if (relUpdate.action === 'add') {
            // 检查是否已存在相同 target+type 的关系
            const existing = entity.relationships.find(
              r => r.target === relUpdate.target && r.type === relUpdate.type
            );
            if (!existing) {
              entity.relationships.push({
                target: relUpdate.target,
                type: relUpdate.type,
                intensity: relUpdate.intensity,
                bond_level: relUpdate.bond_level,
                dynamic: relUpdate.dynamic
              });
            }
          } else if (relUpdate.action === 'update') {
            const existing = entity.relationships.find(
              r => r.target === relUpdate.target && r.type === relUpdate.type
            );
            if (existing) {
              existing.intensity = relUpdate.intensity;
              existing.bond_level = relUpdate.bond_level;
              existing.dynamic = relUpdate.dynamic;
            }
          }
        }
        updateCount++;
      }
    }
  }

  processedCount++;
}

// 5. 写入注册表
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');

// 6. 输出统计
console.log(`\n[完成] 实体合并完成！`);
console.log(`  处理章节: ${processedCount} 个`);
console.log(`  新增实体: ${newEntityCount} 个`);
console.log(`  更新实体: ${updateCount} 次`);
console.log(`\n[统计] entity_registry.json:`);
for (const [type, entities] of Object.entries(registry)) {
  console.log(`  ${type}: ${entities.length} 个`);
}

// 辅助函数：合并 source_refs
function mergeSourceRefs(existing, newRefs) {
  if (!newRefs || newRefs.length === 0) return existing;
  if (!existing) return newRefs;

  const merged = [...existing];
  for (const newRef of newRefs) {
    // 检查是否已存在相同 chapter+line_start 的引用
    const exists = merged.some(
      r => r.chapter === newRef.chapter && r.line_start === newRef.line_start
    );
    if (!exists) {
      merged.push(newRef);
    }
  }
  return merged;
}

// 辅助函数：合并 rag_refs
function mergeRagRefs(existing, newRefs) {
  if (!newRefs || newRefs.length === 0) return existing;
  if (!existing) return newRefs;

  const merged = new Set([...existing, ...newRefs]);
  return Array.from(merged).sort((a, b) => a - b);
}

// 辅助函数：合并 relationships
function mergeRelationships(existing, newRels) {
  if (!newRels || newRels.length === 0) return existing;
  if (!existing) return newRels;

  const merged = [...existing];
  for (const newRel of newRels) {
    const existingIndex = merged.findIndex(
      r => r.target === newRel.target && r.type === newRel.type
    );
    if (existingIndex >= 0) {
      // 更新已有关系
      merged[existingIndex] = newRel;
    } else {
      // 新增关系
      merged.push(newRel);
    }
  }
  return merged;
}
