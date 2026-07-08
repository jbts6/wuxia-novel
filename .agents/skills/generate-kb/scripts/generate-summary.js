#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: generate-summary.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);

// Load JSON file helper with subdirectory support
function loadJson(filename, subdir) {
  const dirs = subdir ? [path.join(novelDir, subdir), novelDir] : [novelDir];
  for (const dir of dirs) {
    const fp = path.join(dir, filename);
    if (fs.existsSync(fp)) {
      try {
        return JSON.parse(fs.readFileSync(fp, 'utf8'));
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

// Load all files (from appropriate subdirectories)
const characters = loadJson('characters.json', 'data') || [];
const factions = loadJson('factions.json', 'data') || [];
const locations = loadJson('locations.json', 'data') || [];
const skills = loadJson('skills.json', 'data') || [];
const techniques = loadJson('techniques.json', 'data') || [];
const items = loadJson('items.json', 'data') || [];
const dialogues = loadJson('dialogues.json', 'data') || [];
const chapterSummaries = loadJson('chapter_summaries.json', 'data') || [];
const qualityReport = loadJson('quality_report.json', 'reports') || {};

// Get novel info from baseline or quality report
const baseline = loadJson('baseline.json', 'build') || {};
const novelName = baseline.novel || path.basename(novelDir);
const author = baseline.author || '未知';
const chapterCount = chapterSummaries.length || 0;

// Count by importance
function countByImportance(arr) {
  const result = {};
  for (const item of arr) {
    const imp = item.importance || item.role || '未知';
    result[imp] = (result[imp] || 0) + 1;
  }
  return result;
}

// Count by type
function countByType(arr, field = 'type') {
  const result = {};
  for (const item of arr) {
    const t = item[field] || '未知';
    result[t] = (result[t] || 0) + 1;
  }
  return result;
}

// Count locations by region
function countByRegion(arr) {
  const result = {};
  for (const item of arr) {
    const r = item.region || '未知';
    result[r] = (result[r] || 0) + 1;
  }
  return result;
}

// Group techniques by source skill
function groupTechniquesBySkill(arr) {
  const result = {};
  for (const tech of arr) {
    const skill = tech.source_skill || '其他';
    if (!result[skill]) result[skill] = [];
    result[skill].push(tech.name);
  }
  return result;
}

const charImportance = countByImportance(characters);
const factionImportance = countByImportance(factions);
const skillTypes = countByType(skills);
const itemTypes = countByType(items);
const locationRegions = countByRegion(locations);
const techBySkill = groupTechniquesBySkill(techniques);

// Get core characters
const coreChars = characters.filter(c => c.importance === '核心' || c.role === '核心');
const importantChars = characters.filter(c => c.importance === '重要' || c.role === '重要');

// Get quality metrics
const metrics = qualityReport.metrics || {};
const overallScore = qualityReport.overall_score || 'N/A';

// Generate summary markdown
const lines = [];

lines.push(`# 《${novelName}》知识库总览\n`);
lines.push('## 基本信息\n');
lines.push(`- **小说名称**：${novelName}`);
lines.push(`- **作者**：${author}`);
lines.push(`- **章节数**：${chapterCount} 回`);
lines.push(`- **生成时间**：${new Date().toISOString().split('T')[0]}`);
lines.push(`- **质量分数**：${overallScore}/100\n`);
lines.push('---\n');

// Entity statistics
lines.push('## 实体统计\n');

// Characters
lines.push('### 角色（characters.json）\n');
lines.push('| 重要性 | 数量 | 说明 |');
lines.push('|--------|------|------|');
const importanceOrder = ['核心', '重要', '次要', '龙套', '背景'];
for (const imp of importanceOrder) {
  if (charImportance[imp]) {
    const chars = characters.filter(c => (c.importance || c.role) === imp).slice(0, 5).map(c => c.name).join('、');
    lines.push(`| ${imp} | ${charImportance[imp]} | ${chars}${charImportance[imp] > 5 ? '等' : ''} |`);
  }
}
lines.push(`| **总计** | **${characters.length}** | |\n`);

// Factions
lines.push('### 门派/势力（factions.json）\n');
lines.push('| 类型 | 数量 | 代表 |');
lines.push('|------|------|------|');
const factionTypes = countByType(factions);
for (const [type, count] of Object.entries(factionTypes)) {
  const facs = factions.filter(f => f.type === type).slice(0, 4).map(f => f.name).join('、');
  lines.push(`| ${type} | ${count} | ${facs}${count > 4 ? '等' : ''} |`);
}
lines.push(`| **总计** | **${factions.length}** | |\n`);

// Locations
lines.push('### 地点（locations.json）\n');
lines.push('| 区域 | 数量 | 代表 |');
lines.push('|------|------|------|');
const regionOrder = ['中原', '大理', '姑苏', '天山', '西北', '北方', '江南', '嵩山', '吐蕃'];
for (const reg of regionOrder) {
  if (locationRegions[reg]) {
    const locs = locations.filter(l => l.region === reg).slice(0, 4).map(l => l.name).join('、');
    lines.push(`| ${reg} | ${locationRegions[reg]} | ${locs}${locationRegions[reg] > 4 ? '等' : ''} |`);
  }
}
// Add remaining regions
for (const [reg, count] of Object.entries(locationRegions)) {
  if (!regionOrder.includes(reg) && reg !== '未知') {
    const locs = locations.filter(l => l.region === reg).slice(0, 4).map(l => l.name).join('、');
    lines.push(`| ${reg} | ${count} | ${locs} |`);
  }
}
lines.push(`| **总计** | **${locations.length}** | |\n`);

// Skills
lines.push('### 武功/技能（skills.json）\n');
lines.push('| 类型 | 数量 | 代表 |');
lines.push('|------|------|------|');
const skillTypeOrder = ['内功', '掌法', '指法', '轻功', '剑法', '刀法', '拳法', '棒法', '杖法', '擒拿', '暗器', '毒功', '点穴', '奇门兵器'];
for (const type of skillTypeOrder) {
  if (skillTypes[type]) {
    const sks = skills.filter(s => s.type === type).slice(0, 3).map(s => s.name).join('、');
    lines.push(`| ${type} | ${skillTypes[type]} | ${sks}${skillTypes[type] > 3 ? '等' : ''} |`);
  }
}
lines.push(`| **总计** | **${skills.length}** | |\n`);

// Techniques
lines.push('### 招式（techniques.json）\n');
lines.push('| 来源 | 数量 | 代表 |');
lines.push('|------|------|------|');
for (const [skill, techs] of Object.entries(techBySkill)) {
  const skillName = skill === '其他' ? '其他' : (skills.find(s => s.id === skill)?.name || skill);
  lines.push(`| ${skillName} | ${techs.length} | ${techs.slice(0, 3).join('、')}${techs.length > 3 ? '等' : ''} |`);
}
lines.push(`| **总计** | **${techniques.length}** | |\n`);

// Items
lines.push('### 物品（items.json）\n');
lines.push('| 类型 | 数量 | 代表 |');
lines.push('|------|------|------|');
const itemTypeOrder = ['秘籍', '信物', '兵器', '毒药', '工具', '暗器', '丹药', '防具'];
for (const type of itemTypeOrder) {
  if (itemTypes[type]) {
    const its = items.filter(i => i.type === type).slice(0, 3).map(i => i.name).join('、');
    lines.push(`| ${type} | ${itemTypes[type]} | ${its}${itemTypes[type] > 3 ? '等' : ''} |`);
  }
}
lines.push(`| **总计** | **${items.length}** | |\n`);

lines.push('---\n');

// Quality metrics
lines.push('## 质量指标\n');
lines.push('| 指标 | 分数 | 说明 |');
lines.push('|------|------|------|');

const metricLabels = {
  entity_completeness: 'Entity Completeness | 实体覆盖率',
  entity_quantity: 'Entity Quantity | 实体数量达标',
  relationship_completeness: 'Relationship Completeness | 关系覆盖率',
  relationship_accuracy: 'Relationship Accuracy | 关系准确率',
  description_accuracy: 'Description Accuracy | 描述准确率',
  event_coverage: 'Event Coverage | 事件覆盖率',
  dialogue_quality: 'Dialogue Authenticity | 对话真实率',
  cross_book_purity: 'Cross-Book Purity | 跨书纯净度'
};

for (const [key, label] of Object.entries(metricLabels)) {
  const metric = metrics[key];
  if (metric) {
    const score = metric.score || metric.authenticity || 'N/A';
    lines.push(`| ${label} | ${score}% |`);
  }
}
lines.push(`| **综合质量分数** | **${overallScore}/100** | |\n`);

lines.push('---\n');

// Core characters
lines.push('## 核心角色\n');
lines.push('| 角色 | 身份 | 核心武功 | 关键关系 |');
lines.push('|------|------|----------|----------|');
for (const char of coreChars) {
  const charSkills = (char.known_skills || []).slice(0, 3).map(s => {
    const skillObj = skills.find(sk => sk.id === s);
    return skillObj ? skillObj.name : s;
  }).join('、');
  const rels = (char.relationships || []).slice(0, 2).map(r => {
    const target = characters.find(c => c.id === r.target);
    return target ? `${target.name}（${r.type}）` : '';
  }).filter(Boolean).join('、');
  lines.push(`| ${char.name} | ${char.identity || ''} | ${charSkills || '-'} | ${rels || '-'} |`);
}
lines.push('');

lines.push('---\n');

// Important events from chapter summaries
lines.push('## 重要事件\n');
lines.push('| 章节 | 事件 | 主要角色 |');
lines.push('|------|------|----------|');

// Get key events (first 10 chapters with events)
const keyEvents = [];
for (const ch of chapterSummaries.slice(0, 50)) {
  if (ch.key_events && ch.key_events.length > 0) {
    const chars = (ch.key_characters || []).slice(0, 3).map(c => {
      const char = characters.find(ch => ch.id === c);
      return char ? char.name : '';
    }).filter(Boolean).join('、');
    keyEvents.push({
      chapter: ch.chapter,
      title: ch.title,
      events: ch.key_events.slice(0, 2).join('；'),
      characters: chars
    });
  }
}

// Show every 5th chapter or chapters with important events
const importantChapters = keyEvents.filter((_, i) => i % 5 === 0 || i < 5).slice(0, 12);
for (const evt of importantChapters) {
  lines.push(`| ${evt.chapter} | ${evt.events} | ${evt.characters || '-'} |`);
}
lines.push('');

lines.push('---\n');

// File list
lines.push('## 文件清单\n');
lines.push('| 文件 | 大小 | 说明 |');
lines.push('|------|------|------|');

const fileList = [
  { name: 'characters.json', desc: `${characters.length} 个角色` },
  { name: 'factions.json', desc: `${factions.length} 个门派/势力` },
  { name: 'locations.json', desc: `${locations.length} 个地点` },
  { name: 'skills.json', desc: `${skills.length} 个武功/技能` },
  { name: 'techniques.json', desc: `${techniques.length} 个招式` },
  { name: 'items.json', desc: `${items.length} 个物品` },
  { name: 'dialogues.json', desc: `${dialogues.length} 条对话` },
  { name: 'chapter_summaries.json', desc: `${chapterCount} 章摘要` },
  { name: 'baseline.json', desc: '基准数据' },
  { name: 'quality_report.json', desc: '质量报告（JSON）' },
  { name: 'quality_report.md', desc: '质量报告（可读）' },
  { name: 'verification_report.md', desc: '验证报告' },
  { name: 'summary.md', desc: '本文件' }
];

for (const file of fileList) {
  const fp = path.join(novelDir, file.name);
  let size = '-';
  if (fs.existsSync(fp)) {
    const stat = fs.statSync(fp);
    if (stat.size > 1024 * 1024) {
      size = `${(stat.size / 1024 / 1024).toFixed(1)}M`;
    } else if (stat.size > 1024) {
      size = `${(stat.size / 1024).toFixed(1)}K`;
    } else {
      size = `${stat.size}B`;
    }
  }
  lines.push(`| ${file.name} | ${size} | ${file.desc} |`);
}

// Write summary.md
const outputPath = path.join(novelDir, 'summary.md');
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Summary generated: ${outputPath}`);
