const fs = require('fs');
const path = require('path');

const ENTITY_TYPES = ['characters', 'skills', 'techniques', 'factions', 'locations', 'items'];

const TYPE_LABELS = {
  characters: '角色',
  skills: '功法',
  techniques: '招式',
  factions: '门派/势力',
  locations: '地点',
  items: '物品',
};

const HUMAN_FIELDS = {
  characters: ['name', 'alias', 'identity', 'faction', 'role', 'one_line'],
  skills: ['name', 'faction', 'one_line', 'progression', 'effects', 'combat_style'],
  techniques: ['name', 'description'],
  factions: ['name', 'location', 'sub_divisions', 'one_line'],
  locations: ['name', 'region', 'one_line'],
  items: ['name', 'one_line', 'description', 'effects', 'origin'],
};

const GENERIC_NAME_RE = /^(黑衣人|白衣人|青衣人|灰衣人|老者|老人|女子|少女|男子|汉子|大汉|弟子|门人|僧人|和尚|道士|仆人|侍女|丫鬟|店小二|掌柜|军士|士兵|群豪|众人|旁人|一人|某人|神秘人)(甲|乙|丙|丁|之一|之一人|[一二三四五六七八九十]+)?$/;
const GENERIC_ITEM_RE = /^(兵器|暗器|毒药|丹药|秘籍|信物|衣服|酒|食物|宝物|东西|物件|长剑|短刀|棍棒|石头)$/;
const PLACEHOLDER_RE = /(\?{1,}|？{1,}|unknown|unk|todo|tbd|n\/a|null|none|weapon|armor|medicine|poison|hidden_weapon|accessory|formation|tool)/i;
const ITEM_TYPES = ['兵器', '暗器', '防具', '丹药', '毒药', '信物', '秘籍', '坐骑', '食物', '工具', '饰品'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function chineseCharCount(value) {
  if (typeof value !== 'string') return 0;
  const matches = value.match(/[\u4e00-\u9fff]/g);
  return matches ? matches.length : 0;
}

function flattenText(value) {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(flattenText);
  if (isObject(value)) return Object.values(value).flatMap(flattenText);
  return [];
}

function addIssue(report, severity, category, type, entity, message) {
  report.issues.push({
    severity,
    category,
    type,
    id: entity && entity.id ? entity.id : null,
    name: entity && entity.name ? entity.name : null,
    message,
    source_ref: entity && Array.isArray(entity.source_refs) ? entity.source_refs[0] || null : null,
  });
}

function emptyRegistry() {
  return Object.fromEntries(ENTITY_TYPES.map((type) => [type, []]));
}

function collectEntities(novelDir) {
  const entities = emptyRegistry();
  const seen = Object.fromEntries(ENTITY_TYPES.map((type) => [type, new Set()]));
  const registry = readJsonIfExists(path.join(novelDir, 'entity_registry.json'));

  function addMany(type, list) {
    if (!Array.isArray(list)) return;
    for (const entity of list) {
      if (!isObject(entity)) continue;
      const key = entity.id || `${entity.name || ''}:${entities[type].length}`;
      if (seen[type].has(key)) continue;
      seen[type].add(key);
      entities[type].push(entity);
    }
  }

  if (isObject(registry)) {
    for (const type of ENTITY_TYPES) addMany(type, registry[type]);
  }

  const batchDir = path.join(novelDir, 'batch_json');
  if (fs.existsSync(batchDir)) {
    const files = fs.readdirSync(batchDir).filter((file) => /^ch_\d+\.json$/.test(file)).sort();
    for (const file of files) {
      const chapter = readJsonIfExists(path.join(batchDir, file));
      if (!isObject(chapter) || !isObject(chapter.new_entities)) continue;
      for (const type of ENTITY_TYPES) addMany(type, chapter.new_entities[type]);
    }
  }

  return entities;
}

function collectDialogues(novelDir) {
  const finalDialogues = readJsonIfExists(path.join(novelDir, 'dialogues.json'));
  if (Array.isArray(finalDialogues) && finalDialogues.length > 0) return finalDialogues;

  const dialogues = [];
  const batchDir = path.join(novelDir, 'batch_json');
  if (!fs.existsSync(batchDir)) return dialogues;

  const files = fs.readdirSync(batchDir).filter((file) => /^ch_\d+\.json$/.test(file)).sort();
  for (const file of files) {
    const chapter = readJsonIfExists(path.join(batchDir, file));
    if (isObject(chapter) && Array.isArray(chapter.dialogues)) dialogues.push(...chapter.dialogues);
  }
  return dialogues;
}

function analyzeEntity(type, entity, report) {
  if (!isObject(entity)) return;

  const fields = HUMAN_FIELDS[type] || [];
  for (const field of fields) {
    for (const text of flattenText(entity[field])) {
      if (PLACEHOLDER_RE.test(text)) {
        addIssue(report, 'high', 'human_field_placeholder', type, entity, `${field} 含英文占位或问号: ${text}`);
      }
    }
  }

  if (Array.isArray(entity.source_refs)) {
    const weakRef = entity.source_refs.find((ref) => !isObject(ref) || chineseCharCount(ref.text) < 4);
    if (weakRef) addIssue(report, 'medium', 'weak_source_ref', type, entity, 'source_refs 原文片段过短或缺失，人工难以复核');
  } else {
    addIssue(report, 'high', 'missing_source_ref', type, entity, '缺少 source_refs');
  }

  if (entity.one_line !== undefined && chineseCharCount(entity.one_line) < 8) {
    addIssue(report, 'medium', 'short_one_line', type, entity, 'one_line 过短，无法作为人工摘要');
  }

  if (type === 'characters') {
    if (GENERIC_NAME_RE.test(entity.name || '')) {
      addIssue(report, 'medium', 'generic_character_name', type, entity, '角色名是泛称；需要后续合并、改名或降级');
    }
    const traits = entity.personality && entity.personality.traits;
    if (traits !== undefined && (!Array.isArray(traits) || traits.length < 5)) {
      addIssue(report, 'low', 'thin_character_profile', type, entity, 'personality.traits 少于 5 项');
    }
  }

  if (type === 'items') {
    if (!ITEM_TYPES.includes(entity.type)) {
      addIssue(report, 'high', 'invalid_item_type', type, entity, `item.type 不在标准 11 类中: ${entity.type}`);
    }
    if (GENERIC_ITEM_RE.test(entity.name || '')) {
      addIssue(report, 'medium', 'generic_item_name', type, entity, '物品名过泛；可能是临时物或普通物');
    }
    if (chineseCharCount(entity.description) < 20) {
      addIssue(report, 'high', 'short_item_description', type, entity, 'description 少于 20 个汉字');
    }
  }

  if (type === 'techniques') {
    const description = entity.description || '';
    if (description.includes('代表性变化')) {
      addIssue(report, 'high', 'templated_technique_description', type, entity, '招式说明疑似模板化，不是原文描述');
    }
    if (chineseCharCount(description) < 8) {
      addIssue(report, 'medium', 'short_technique_description', type, entity, '招式说明过短');
    }
  }
}

function analyzeDuplicates(type, entities, report) {
  const byName = new Map();
  for (const entity of entities) {
    if (!isObject(entity) || !entity.name) continue;
    if (!byName.has(entity.name)) byName.set(entity.name, []);
    byName.get(entity.name).push(entity);
  }
  for (const [name, list] of byName.entries()) {
    if (list.length <= 1) continue;
    addIssue(report, 'medium', 'duplicate_name', type, list[0], `${TYPE_LABELS[type]}重名 ${list.length} 次: ${name}`);
  }
}

function analyzeCrossTypeNames(entities, report) {
  const names = new Map();
  for (const type of ENTITY_TYPES) {
    for (const entity of entities[type]) {
      if (!isObject(entity) || !entity.name) continue;
      if (!names.has(entity.name)) names.set(entity.name, []);
      names.get(entity.name).push({ type, entity });
    }
  }
  for (const [name, hits] of names.entries()) {
    const types = [...new Set(hits.map((hit) => hit.type))];
    if (types.length <= 1) continue;
    addIssue(report, 'medium', 'cross_type_name_collision', hits[0].type, hits[0].entity, `同名实体跨类型出现: ${name} (${types.map((type) => TYPE_LABELS[type]).join(' / ')})`);
  }
}

function analyzeDialogues(dialogues, report) {
  report.counts.dialogues = dialogues.length;
  const missingSpeaker = dialogues.filter((dialogue) => !dialogue || dialogue.speaker === null || dialogue.speaker === undefined);
  report.metrics.dialogues = {
    total: dialogues.length,
    missing_speaker: missingSpeaker.length,
    missing_speaker_ratio: dialogues.length === 0 ? 0 : Number((missingSpeaker.length / dialogues.length).toFixed(4)),
  };

  if (missingSpeaker.length > 0) {
    const severity = report.metrics.dialogues.missing_speaker_ratio > 0.1 ? 'high' : 'medium';
    report.issues.push({
      severity,
      category: 'dialogue_missing_speaker',
      type: 'dialogues',
      id: null,
      name: null,
      message: `speaker 为空 ${missingSpeaker.length}/${dialogues.length}`,
      source_ref: null,
    });
  }
}

function summarizeIssues(report) {
  const bySeverity = { high: 0, medium: 0, low: 0 };
  const byCategory = {};
  for (const issue of report.issues) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
  }
  report.summary = {
    issue_count: report.issues.length,
    by_severity: bySeverity,
    by_category: byCategory,
  };
}

function buildQualityReport(novelDir) {
  const entities = collectEntities(novelDir);
  const dialogues = collectDialogues(novelDir);
  const report = {
    generated_at: new Date().toISOString(),
    novel_dir: novelDir,
    counts: {},
    metrics: {},
    issues: [],
    summary: {},
  };

  for (const type of ENTITY_TYPES) {
    report.counts[type] = entities[type].length;
    for (const entity of entities[type]) analyzeEntity(type, entity, report);
    analyzeDuplicates(type, entities[type], report);
  }
  analyzeCrossTypeNames(entities, report);
  analyzeDialogues(dialogues, report);
  summarizeIssues(report);

  return report;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Deconstruct Quality Report');
  lines.push('');
  lines.push(`- novel_dir: ${report.novel_dir}`);
  lines.push(`- generated_at: ${report.generated_at}`);
  lines.push(`- issues: ${report.summary.issue_count} (high ${report.summary.by_severity.high}, medium ${report.summary.by_severity.medium}, low ${report.summary.by_severity.low})`);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push('| 类型 | 数量 |');
  lines.push('|------|------|');
  for (const type of ENTITY_TYPES) lines.push(`| ${TYPE_LABELS[type]} | ${report.counts[type] || 0} |`);
  lines.push(`| 对话 | ${report.counts.dialogues || 0} |`);
  lines.push('');
  lines.push('## Issue Categories');
  lines.push('');
  lines.push('| 类别 | 数量 |');
  lines.push('|------|------|');
  for (const [category, count] of Object.entries(report.summary.by_category).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${category} | ${count} |`);
  }
  lines.push('');
  lines.push('## Review Items');
  lines.push('');
  lines.push('| 严重度 | 类别 | 类型 | 名称 | 说明 |');
  lines.push('|--------|------|------|------|------|');
  for (const issue of report.issues.slice(0, 200)) {
    const type = TYPE_LABELS[issue.type] || issue.type;
    const name = issue.name || issue.id || '';
    lines.push(`| ${issue.severity} | ${issue.category} | ${type} | ${name} | ${issue.message.replace(/\|/g, '/')} |`);
  }
  if (report.issues.length > 200) lines.push(`| info | truncated |  |  | 仅展示前 200 条，完整内容见 deconstruct_report.json |`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeReport(novelDir, report) {
  const jsonPath = path.join(novelDir, 'deconstruct_report.json');
  const mdPath = path.join(novelDir, 'deconstruct_report.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(mdPath, renderMarkdown(report), 'utf8');
  return { jsonPath, mdPath };
}

if (require.main === module) {
  const novelDir = process.argv[2];
  if (!novelDir) {
    console.error('用法: node quality-report.js <小说目录路径>');
    process.exit(1);
  }

  const report = buildQualityReport(novelDir);
  const { jsonPath, mdPath } = writeReport(novelDir, report);
  console.log(`[完成] 质量报告已生成: ${mdPath}`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  问题数: ${report.summary.issue_count}`);
  console.log(`  high: ${report.summary.by_severity.high}, medium: ${report.summary.by_severity.medium}, low: ${report.summary.by_severity.low}`);
}

module.exports = {
  buildQualityReport,
  renderMarkdown,
  writeReport,
};
