#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const STANDARD_ITEM_TYPES = new Set(['兵器', '暗器', '防具', '丹药', '毒药', '信物', '秘籍', '坐骑', '食物', '工具', '饰品']);

const ITEM_TYPE_GUIDANCE = {
  wine: ['改类型为 `食物`', '英文 wine 表示酒，通常归入食物；若只是普通酒且无剧情作用，可删除。'],
  特殊: ['逐条判断', '特殊不是标准类型；有剧情、身份、武学、唯一性价值则保留，否则删除。'],
  面具: ['保留，建议改类型为 `饰品` 或 `工具`', '面具通常有身份遮掩作用；无剧情作用时再删。'],
  被毁图谱: ['保留，建议改类型为 `秘籍`', '图谱/帛卷关联武学线索；即使被毁，也有剧情价值。'],
  文书: ['改类型为 `信物`', '文书通常承载身份、命令或线索，可作为信物处理。'],
  礼单: ['改类型为 `信物`', '礼单属于关系和事件凭证，可作为信物处理；若只是普通清单再删。'],
  刺字: ['保留，建议改类型为 `信物`', '刺字是身份、惩戒或剧情标记，不应直接删除。'],
  追踪标记: ['保留，建议改类型为 `信物`', '追踪标记有情节功能，建议保留为线索类信物。'],
  墓牌: ['需要确认', '若指向重要人物或事件则保留；普通背景墓牌可删除。'],
  遗体残肢: ['需要确认', '若承担剧情证据或身份线索则保留；纯场景物可删除。'],
  束缚物: ['改类型为 `工具`', '束缚物是行动工具，通常可归入工具。'],
  绳索: ['改类型为 `工具`', '绳索是行动工具，通常可归入工具。'],
  棋局: ['保留，建议改类型为 `工具`', '棋局若承载珍珑棋局等剧情或机关功能，应保留。'],
};

function readJson(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''));
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`);
}

function cell(value) {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.map((item) => cell(item)).filter(Boolean).join('、');
  return String(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function oneLine(record) {
  return cell(record.one_line || record.description || record.significance || record.effect || '');
}

function countBy(records, keyFn) {
  const counts = new Map();
  for (const record of records) {
    const key = keyFn(record) || '未标注';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'));
}

function table(headers, rows) {
  const header = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map(cell).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

function section(title, body) {
  return `## ${title}\n\n${body}\n`;
}

function itemGuidance(type) {
  return ITEM_TYPE_GUIDANCE[type] || ['需要确认', '当前类型不在标准枚举中；请按剧情价值决定保留、改类型或删除。'];
}

function byId(records) {
  return new Map(records.map((record) => [record.id, record]));
}

function entityName(map, id) {
  if (!id) return '';
  return map.get(id)?.name || id;
}

function novelTitle(novelDir) {
  return path.basename(path.resolve(novelDir));
}

function generateCharactersSummary(novelDir, data) {
  const rows = data.characters.map((character) => [
    character.name,
    oneLine(character),
    character.role,
    character.identity || character.archetype,
    character.faction,
  ]);
  const stats = table(['级别', '数量'], countBy(data.characters, (c) => c.role));
  const list = table(['名称', '说明', '级别', '身份', '势力'], rows);
  return `# 《${novelTitle(novelDir)}》角色清单\n\n共 ${data.characters.length} 人。\n\n${section('分级统计', stats)}\n${section('角色明细（全部）', list)}`;
}

function generateItemsSummary(novelDir, data) {
  const itemMap = byId(data.items);
  const pendingRows = data.itemPending.map((pending) => {
    const item = itemMap.get(pending.id) || {};
    const [action, reason] = itemGuidance(pending.value || item.type);
    return [item.name || pending.id, oneLine(item), item.type || pending.value, action, reason];
  });
  const typeStats = table(['类型', '数量'], countBy(data.items, (item) => item.type));
  const pending = pendingRows.length
    ? table(['名称', '说明', '当前 type', '建议动作', '理由'], pendingRows)
    : '无。';
  const grouped = countBy(data.items, (item) => item.type).map(([type]) => {
    const rows = data.items
      .filter((item) => (item.type || '未标注') === type)
      .map((item) => [
        item.name,
        oneLine(item),
        item.type,
        item.rarity_tier,
        entityName(data.characterMap, item.owner),
      ]);
    return section(`${type}（${rows.length}）`, table(['名称', '说明', '类型', '品阶', '归属/持有者'], rows));
  }).join('\n');
  const invalidTypes = [...new Set(data.items.map((item) => item.type).filter((type) => type && !STANDARD_ITEM_TYPES.has(type)))].sort();

  return `# 《${novelTitle(novelDir)}》物品清单\n\n共 ${data.items.length} 件。\n\n${section('按类型统计', typeStats)}\n${section('待人工判断：保留、改类型或删除', pending)}\n${section('非标准类型索引', invalidTypes.length ? invalidTypes.join('、') : '无。')}\n${section('物品明细（按类型）', grouped)}`;
}

function generateFactionsSummary(novelDir, data) {
  const stats = table(['类型', '数量'], countBy(data.factions, (faction) => faction.type));
  const rows = data.factions.map((faction) => [
    faction.name,
    oneLine(faction),
    faction.type,
    faction.location,
    faction.leader,
    cell(faction.notable_members || faction.members),
  ]);
  return `# 《${novelTitle(novelDir)}》势力清单\n\n共 ${data.factions.length} 个势力。\n\n${section('type 分布', stats)}\n${section('势力明细（全部）', table(['名称', '说明', '类型', '地点', '首领', '成员'], rows))}`;
}

function generateLocationsSummary(novelDir, data) {
  const stats = table(['区域', '数量'], countBy(data.locations, (location) => location.region));
  const grouped = countBy(data.locations, (location) => location.region).map(([region]) => {
    const rows = data.locations
      .filter((location) => (location.region || '未标注') === region)
      .map((location) => [
        location.name,
        oneLine(location),
        location.region,
        location.type || location.category,
        location.parent,
      ]);
    return section(`${region}（${rows.length}）`, table(['名称', '说明', '区域', '类型', '上级地点'], rows));
  }).join('\n');
  return `# 《${novelTitle(novelDir)}》地点清单\n\n共 ${data.locations.length} 个地点。\n\n${section('region 分布', stats)}\n${section('地点明细（按区域）', grouped)}`;
}

function generateSkillsSummary(novelDir, data) {
  const techniqueCountBySkill = new Map();
  for (const technique of data.techniques) {
    if (!technique.source_skill) continue;
    techniqueCountBySkill.set(technique.source_skill, (techniqueCountBySkill.get(technique.source_skill) || 0) + 1);
  }
  const stats = table(['类型/分类', '数量'], countBy(data.skills, (skill) => skill.type || skill.category));
  const rows = data.skills.map((skill) => [
    skill.name,
    oneLine(skill),
    skill.type || skill.category,
    techniqueCountBySkill.get(skill.id) || 0,
  ]);
  return `# 《${novelTitle(novelDir)}》功法清单\n\n共 ${data.skills.length} 门功法。\n\n${section('类型统计', stats)}\n${section('功法明细（全部）', table(['名称', '说明', '类型', '招式数'], rows))}`;
}

function generateTechniquesSummary(novelDir, data) {
  const stats = table(['类型', '数量'], countBy(data.techniques, (technique) => technique.type));
  const rows = data.techniques.map((technique) => [
    technique.name,
    technique.effect || technique.description || '',
    entityName(data.skillMap, technique.source_skill),
    technique.type,
  ]);
  return `# 《${novelTitle(novelDir)}》招式清单\n\n共 ${data.techniques.length} 招。\n\n${section('按 type 统计', stats)}\n${section('招式明细（全部）', table(['名称', '效果/说明', '所属功法', '类型'], rows))}`;
}

function loadNovelData(novelDir) {
  const data = {
    characters: readJson(path.join(novelDir, 'characters.json')),
    items: readJson(path.join(novelDir, 'items.json')),
    factions: readJson(path.join(novelDir, 'factions.json')),
    locations: readJson(path.join(novelDir, 'locations.json')),
    skills: readJson(path.join(novelDir, 'skills.json')),
    techniques: readJson(path.join(novelDir, 'techniques.json')),
    itemPending: readJson(path.join(novelDir, 'archive/reports/items.pending.json')),
  };
  data.characterMap = byId(data.characters);
  data.skillMap = byId(data.skills);
  return data;
}

function generateDetailedSummaries(novelDir) {
  const data = loadNovelData(novelDir);
  const outputs = {
    'characters_summary.md': generateCharactersSummary(novelDir, data),
    'items_summary.md': generateItemsSummary(novelDir, data),
    'factions_summary.md': generateFactionsSummary(novelDir, data),
    'locations_summary.md': generateLocationsSummary(novelDir, data),
    'skills_summary.md': generateSkillsSummary(novelDir, data),
    'techniques_summary.md': generateTechniquesSummary(novelDir, data),
  };

  for (const [fileName, content] of Object.entries(outputs)) {
    write(path.join(novelDir, fileName), content);
  }

  return Object.keys(outputs).map((fileName) => path.join(novelDir, fileName));
}

if (require.main === module) {
  const novelDir = process.argv[2];
  if (!novelDir) {
    console.error('用法: node scripts/summaries/generate.js <小说目录>');
    process.exit(1);
  }
  const files = generateDetailedSummaries(novelDir);
  for (const file of files) console.log(file);
}

module.exports = { generateDetailedSummaries };
