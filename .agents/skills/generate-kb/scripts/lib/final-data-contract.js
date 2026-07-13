#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  expectedIdFormat,
  isValidId,
  isValidIdForAnyCategory
} = require('./id-contract');

const FINAL_DATA_FILES = [
  'characters.json',
  'factions.json',
  'locations.json',
  'skills.json',
  'techniques.json',
  'items.json',
  'dialogues.json',
  'chapter_summaries.json'
];

const ENUMS = {
  rank: [
    '平平无奇', '初窥门径', '略有小成', '登堂入室',
    '炉火纯青', '出神入化', '登峰造极', '返璞归真'
  ],
  importance: ['核心', '重要', '次要', '龙套', '背景'],
  archetype: ['scholar', 'warrior', 'monk', 'assassin', 'healer'],
  skillType: [
    '剑法', '掌法', '指法', '拳法', '刀法', '枪法', '棍法', '杖法',
    '棒法', '暗器', '阵法', '奇门', '内功', '轻功', '毒功', '音攻', '点穴'
  ],
  techniqueType: [
    'attack', 'defense', 'buff', 'debuff', 'control', 'feint',
    'movement', 'poison', 'internal', 'support', 'combo', 'counter', 'special'
  ],
  effectType: ['伤害', '控制', '增益', '减益', '特殊'],
  itemType: [
    '兵器', '暗器', '防具', '丹药', '毒药', '信物', '秘籍',
    '奇门', '坐骑', '食物', '工具', '饰品', '异兽'
  ],
  itemTag: [
    '兵器', '刀', '剑', '枪', '棍', '棒', '暗器', '奇门兵器', '秘籍',
    '内功', '外功', '轻功', '毒功', '丹药', '解药', '毒药', '增益',
    '信物', '钥匙', '线索', '剧情关键'
  ],
  rarity: ['凡品', '良品', '珍品', '神品', '未知'],
  factionType: ['武林门派', '帮派', '家族', '军队', '王族', '寺院', '部族', '官署'],
  relationshipType: ['挚友', '恋人', '师徒', '宿敌', '对手', '主仆', '合作者', '亲属'],
  dialogueTone: [
    '陈述', '疑问', '愤怒', '激动', '悲伤', '恳求',
    '嘲讽', '调侃', '冷酷', '恐惧', '欣喜', '焦急'
  ],
  selectionType: ['event', 'persona', 'both']
};

const EVIDENCE_FIELDS = {
  'characters.json': ['identity', 'one_line', 'biography', 'personality', 'relationships'],
  'factions.json': ['one_line'],
  'locations.json': ['region', 'one_line'],
  'skills.json': ['one_line', 'techniques', 'progression', 'effects', 'combat_style'],
  'techniques.json': ['description'],
  'items.json': ['one_line', 'description', 'effects', 'origin'],
  'chapter_summaries.json': ['summary', 'key_events']
};

const PROVISIONAL_RECORD_FILES = Object.freeze({
  character: 'characters.json',
  faction: 'factions.json',
  location: 'locations.json',
  skill: 'skills.json',
  technique: 'techniques.json',
  item: 'items.json',
  dialogue: 'dialogues.json',
  chapter_summary: 'chapter_summaries.json'
});

const VALIDATION_IDS = Object.freeze({
  character: 'char_provisional',
  faction: 'faction_provisional',
  location: 'loc_provisional',
  skill: 'skill_provisional',
  technique: 'tech_provisional',
  item: 'item_provisional',
  dialogue: 'dialogue_provisional',
  event: 'event_provisional'
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasContent(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return value !== null && value !== undefined;
}

function semanticLength(value) {
  return Array.from(String(value).replace(/[\s，。！？；：、,.!?;:'"“”‘’（）()《》〈〉【】\[\]]/g, '')).length;
}

function isPlaceholderText(value, recordName = '') {
  const normalized = String(value).trim().replace(/[。！？!?]+$/g, '');
  const name = String(recordName).trim();
  if (name && [name, `${name}的招式`, `${name}的来历不明`].includes(normalized)) return true;
  return /^(?:未知|不详|不明|暂无|待补充|有待补充|资料不足|原文未说明|来历不明)$/.test(normalized)
    || /^(?:该|此)?(?:人物|门派|地点|武功|招式|物品)(?:信息|详情|来历)?(?:未知|不详|不明)$/.test(normalized);
}

function recordLabel(filename, record, index) {
  const id = String(record?.id ?? '').trim();
  if (id) return `${filename}/${id}`;
  if (filename === 'chapter_summaries.json' && Number.isInteger(record?.chapter)) {
    return `${filename}/chapter:${record.chapter}`;
  }
  return `${filename}/#${index}`;
}

function requireField(record, field, label, schemaErrors) {
  if (!Object.prototype.hasOwnProperty.call(record, field)) {
    schemaErrors.push(`${label}.${field}: required field is missing`);
    return false;
  }
  return true;
}

function requireString(record, field, label, schemaErrors, enrichmentErrors, options = {}) {
  if (!requireField(record, field, label, schemaErrors)) {
    if (options.enrichment) {
      enrichmentErrors.push(`${label}.${field}: required enrichment field is missing`);
    }
    return false;
  }
  const value = record[field];
  if (value === null && options.nullable) return true;
  if (typeof value !== 'string') {
    schemaErrors.push(`${label}.${field}: expected string${options.nullable ? ' or null' : ''}`);
    return false;
  }
  const trimmed = value.trim();
  if (options.nonEmpty && !trimmed) {
    const target = options.enrichment ? enrichmentErrors : schemaErrors;
    target.push(`${label}.${field}: must not be empty`);
  }
  if (options.enrichment && trimmed) {
    if (options.minLength && semanticLength(trimmed) < options.minLength) {
      enrichmentErrors.push(
        `${label}.${field}: enrichment text must contain at least ${options.minLength} meaningful characters`
      );
    }
    if (isPlaceholderText(trimmed, options.recordName)) {
      enrichmentErrors.push(`${label}.${field}: placeholder enrichment text is not allowed`);
    }
  }
  if (options.enum && trimmed && !options.enum.includes(value)) {
    schemaErrors.push(`${label}.${field}: invalid value ${JSON.stringify(value)}`);
  }
  if (options.pattern && trimmed && !options.pattern.test(value)) {
    schemaErrors.push(`${label}.${field}: invalid format ${JSON.stringify(value)}`);
  }
  if (options.idCategory && trimmed && !isValidId(value, options.idCategory)) {
    schemaErrors.push(
      `${label}.${field}: invalid ${options.idCategory} ID ${JSON.stringify(value)}; ` +
      `expected ${expectedIdFormat(options.idCategory)}`
    );
  }
  if (options.idCategories && trimmed &&
      !isValidIdForAnyCategory(value, options.idCategories)) {
    schemaErrors.push(
      `${label}.${field}: invalid ID ${JSON.stringify(value)}; expected one of ` +
      options.idCategories.map(expectedIdFormat).join(', ')
    );
  }
  return true;
}

function requireNumber(record, field, label, schemaErrors, options = {}) {
  if (!requireField(record, field, label, schemaErrors)) return false;
  const value = record[field];
  const validType = options.integer ? Number.isInteger(value) : typeof value === 'number' && Number.isFinite(value);
  if (!validType) {
    schemaErrors.push(`${label}.${field}: expected ${options.integer ? 'integer' : 'number'}`);
    return false;
  }
  if (options.min !== undefined && value < options.min) {
    schemaErrors.push(`${label}.${field}: must be >= ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    schemaErrors.push(`${label}.${field}: must be <= ${options.max}`);
  }
  return true;
}

function requireArray(record, field, label, schemaErrors, enrichmentErrors, options = {}) {
  if (!requireField(record, field, label, schemaErrors)) {
    if (options.enrichment) {
      enrichmentErrors.push(`${label}.${field}: required enrichment field is missing`);
    }
    return null;
  }
  const value = record[field];
  if (!Array.isArray(value)) {
    schemaErrors.push(`${label}.${field}: expected array`);
    return null;
  }
  if (options.nonEmpty && value.length === 0) {
    const target = options.enrichment ? enrichmentErrors : schemaErrors;
    target.push(`${label}.${field}: must not be empty`);
  }
  value.forEach((item, index) => {
    const itemLabel = `${label}.${field}[${index}]`;
    if (options.itemType === 'string') {
      if (typeof item !== 'string' || (options.itemNonEmpty && !item.trim())) {
        schemaErrors.push(`${itemLabel}: expected${options.itemNonEmpty ? ' non-empty' : ''} string`);
      } else if (options.itemEnum && !options.itemEnum.includes(item)) {
        schemaErrors.push(`${itemLabel}: invalid value ${JSON.stringify(item)}`);
      } else if (options.itemIdCategory && !isValidId(item, options.itemIdCategory)) {
        schemaErrors.push(
          `${itemLabel}: invalid ${options.itemIdCategory} ID ${JSON.stringify(item)}; ` +
          `expected ${expectedIdFormat(options.itemIdCategory)}`
        );
      } else if (options.itemIdCategories &&
          !isValidIdForAnyCategory(item, options.itemIdCategories)) {
        schemaErrors.push(
          `${itemLabel}: invalid ID ${JSON.stringify(item)}; expected one of ` +
          options.itemIdCategories.map(expectedIdFormat).join(', ')
        );
      }
    } else if (options.itemType === 'positiveInteger') {
      if (!Number.isInteger(item) || item < 1) {
        schemaErrors.push(`${itemLabel}: expected positive integer`);
      }
    } else if (options.itemValidator) {
      options.itemValidator(item, itemLabel, schemaErrors, enrichmentErrors);
    }
  });
  return value;
}

function requireObject(record, field, label, schemaErrors) {
  if (!requireField(record, field, label, schemaErrors)) return null;
  const value = record[field];
  if (!isPlainObject(value)) {
    schemaErrors.push(`${label}.${field}: expected object`);
    return null;
  }
  return value;
}

function validateSourceRef(ref, label, schemaErrors) {
  if (!isPlainObject(ref)) {
    schemaErrors.push(`${label}: expected source reference object`);
    return;
  }
  if (!Number.isInteger(ref.chapter) || ref.chapter < 1) {
    schemaErrors.push(`${label}.chapter: expected positive integer`);
  }
  if (!Number.isInteger(ref.line_start) || ref.line_start < 1) {
    schemaErrors.push(`${label}.line_start: expected positive integer`);
  }
  if (!Number.isInteger(ref.line_end) || ref.line_end < (ref.line_start ?? 1)) {
    schemaErrors.push(`${label}.line_end: expected integer >= line_start`);
  }
  if (typeof ref.text !== 'string' || !ref.text.trim()) {
    schemaErrors.push(`${label}.text: expected non-empty string`);
  }
}

function validateSourceRefs(record, label, schemaErrors, enrichmentErrors) {
  requireArray(record, 'source_refs', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true,
    itemValidator: validateSourceRef
  });
}

function validateFieldSourceRefs(record, label, schemaErrors) {
  if (!Object.prototype.hasOwnProperty.call(record, 'field_source_refs')) return;
  const refsByField = record.field_source_refs;
  if (!isPlainObject(refsByField)) {
    schemaErrors.push(`${label}.field_source_refs: expected object`);
    return;
  }
  for (const [field, refs] of Object.entries(refsByField)) {
    if (!Array.isArray(refs) || refs.length === 0) {
      schemaErrors.push(`${label}.field_source_refs.${field}: expected non-empty array`);
      continue;
    }
    refs.forEach((ref, index) => validateSourceRef(
      ref,
      `${label}.field_source_refs.${field}[${index}]`,
      schemaErrors
    ));
  }
}

function validateEffect(effect, label, schemaErrors, enrichmentErrors) {
  if (!isPlainObject(effect)) {
    schemaErrors.push(`${label}: expected object`);
    return;
  }
  requireString(effect, 'type', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true,
    enum: ENUMS.effectType
  });
  requireString(effect, 'description', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true,
    enrichment: true,
    minLength: 6
  });
}

function validateRelationship(relationship, label, schemaErrors, enrichmentErrors) {
  if (!isPlainObject(relationship)) {
    schemaErrors.push(`${label}: expected object`);
    return;
  }
  requireString(relationship, 'target', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true,
    idCategory: 'character'
  });
  requireString(relationship, 'type', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true,
    enum: ENUMS.relationshipType
  });
  requireNumber(relationship, 'intensity', label, schemaErrors, { min: 0, max: 100 });
  requireNumber(relationship, 'bond_level', label, schemaErrors, { integer: true, min: 1, max: 5 });
  requireString(relationship, 'dynamic', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true,
    enrichment: true,
    minLength: 6
  });
}

function validateNestedTechnique(technique, label, schemaErrors, enrichmentErrors) {
  if (!isPlainObject(technique)) {
    schemaErrors.push(`${label}: expected object`);
    return;
  }
  requireString(technique, 'id', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true,
    idCategory: 'technique'
  });
  requireString(technique, 'name', label, schemaErrors, enrichmentErrors, { nonEmpty: true });
  requireString(technique, 'type', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true,
    enum: ENUMS.techniqueType
  });
  requireString(technique, 'description', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true,
    enrichment: true,
    minLength: 8,
    recordName: technique.name
  });
}

function validateCharacter(record, label, schemaErrors, enrichmentErrors) {
  requireString(record, 'id', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true,
    idCategory: 'character'
  });
  requireString(record, 'name', label, schemaErrors, enrichmentErrors, { nonEmpty: true });
  requireArray(record, 'alias', label, schemaErrors, enrichmentErrors, {
    itemType: 'string', itemNonEmpty: true
  });
  requireString(record, 'identity', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 4, recordName: record.name
  });
  requireString(record, 'faction', label, schemaErrors, enrichmentErrors);
  requireString(record, 'role', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.importance
  });
  requireString(record, 'archetype', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.archetype
  });
  requireString(record, 'power_rank', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.rank
  });
  requireString(record, 'importance', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.importance
  });
  requireString(record, 'one_line', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 8, recordName: record.name
  });
  requireString(record, 'biography', label, schemaErrors, enrichmentErrors, {
    enrichment: true, minLength: 12, recordName: record.name
  });

  const detailed = ['核心', '重要', '次要'].includes(record.importance);
  if (detailed && typeof record.biography === 'string' && !record.biography.trim()) {
    enrichmentErrors.push(`${label}.biography: must not be empty for ${record.importance} character`);
  }

  const personality = requireObject(record, 'personality', label, schemaErrors);
  if (personality) {
    const traits = requireArray(personality, 'traits', `${label}.personality`, schemaErrors, enrichmentErrors, {
      itemType: 'string', itemNonEmpty: true
    });
    requireString(personality, 'speech_style', `${label}.personality`, schemaErrors, enrichmentErrors);
    requireString(personality, 'temperament', `${label}.personality`, schemaErrors, enrichmentErrors);
    if (detailed) {
      if (traits && traits.length < 5) {
        enrichmentErrors.push(`${label}.personality.traits: requires at least 5 traits for ${record.importance} character`);
      }
      if (typeof personality.speech_style === 'string' && !personality.speech_style.trim()) {
        enrichmentErrors.push(`${label}.personality.speech_style: must not be empty for ${record.importance} character`);
      }
      if (typeof personality.temperament === 'string' && !personality.temperament.trim()) {
        enrichmentErrors.push(`${label}.personality.temperament: must not be empty for ${record.importance} character`);
      }
    }
  }

  requireArray(record, 'relationships', label, schemaErrors, enrichmentErrors, {
    itemValidator: validateRelationship
  });
  requireArray(record, 'known_skills', label, schemaErrors, enrichmentErrors, {
    itemType: 'string', itemNonEmpty: true, itemIdCategory: 'skill'
  });
  requireArray(record, 'related_skills', label, schemaErrors, enrichmentErrors, {
    itemType: 'string', itemNonEmpty: true, itemIdCategory: 'skill'
  });
  requireArray(record, 'rag_refs', label, schemaErrors, enrichmentErrors, {
    itemType: 'positiveInteger'
  });
  validateSourceRefs(record, label, schemaErrors, enrichmentErrors);
  validateFieldSourceRefs(record, label, schemaErrors);
}

function validateFaction(record, label, schemaErrors, enrichmentErrors) {
  requireString(record, 'id', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, idCategory: 'faction'
  });
  requireString(record, 'name', label, schemaErrors, enrichmentErrors, { nonEmpty: true });
  requireString(record, 'type', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.factionType
  });
  requireString(record, 'location', label, schemaErrors, enrichmentErrors, {
    nullable: true, idCategory: 'location'
  });
  requireString(record, 'leader', label, schemaErrors, enrichmentErrors, {
    nullable: true, idCategory: 'character'
  });
  requireArray(record, 'sub_divisions', label, schemaErrors, enrichmentErrors, {
    itemType: 'string', itemNonEmpty: true
  });
  requireString(record, 'one_line', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 8, recordName: record.name
  });
  validateSourceRefs(record, label, schemaErrors, enrichmentErrors);
  validateFieldSourceRefs(record, label, schemaErrors);
}

function validateLocation(record, label, schemaErrors, enrichmentErrors) {
  requireString(record, 'id', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, idCategory: 'location'
  });
  requireString(record, 'name', label, schemaErrors, enrichmentErrors, { nonEmpty: true });
  requireString(record, 'region', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 2, recordName: record.name
  });
  requireString(record, 'one_line', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 8, recordName: record.name
  });
  validateSourceRefs(record, label, schemaErrors, enrichmentErrors);
  validateFieldSourceRefs(record, label, schemaErrors);
}

function validateSkill(record, label, schemaErrors, enrichmentErrors) {
  requireString(record, 'id', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, idCategory: 'skill'
  });
  requireString(record, 'name', label, schemaErrors, enrichmentErrors, { nonEmpty: true });
  requireString(record, 'type', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.skillType
  });
  requireString(record, 'faction', label, schemaErrors, enrichmentErrors, { nullable: true });
  requireString(record, 'mastery_rank', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.rank
  });
  requireString(record, 'one_line', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 8, recordName: record.name
  });
  requireArray(record, 'techniques', label, schemaErrors, enrichmentErrors, {
    itemValidator: validateNestedTechnique
  });
  requireString(record, 'progression', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 8, recordName: record.name
  });
  requireArray(record, 'effects', label, schemaErrors, enrichmentErrors, {
    itemValidator: validateEffect
  });
  requireString(record, 'combat_style', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 8, recordName: record.name
  });
  requireArray(record, 'rag_refs', label, schemaErrors, enrichmentErrors, {
    itemType: 'positiveInteger'
  });
  validateSourceRefs(record, label, schemaErrors, enrichmentErrors);
  validateFieldSourceRefs(record, label, schemaErrors);
}

function validateTechnique(record, label, schemaErrors, enrichmentErrors) {
  requireString(record, 'id', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, idCategory: 'technique'
  });
  requireString(record, 'name', label, schemaErrors, enrichmentErrors, { nonEmpty: true });
  requireString(record, 'type', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.techniqueType
  });
  requireString(record, 'description', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 8, recordName: record.name
  });
  requireString(record, 'source_skill', label, schemaErrors, enrichmentErrors, {
    nullable: true, idCategory: 'skill'
  });
  validateSourceRefs(record, label, schemaErrors, enrichmentErrors);
  validateFieldSourceRefs(record, label, schemaErrors);
}

function validateItem(record, label, schemaErrors, enrichmentErrors) {
  requireString(record, 'id', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, idCategory: 'item'
  });
  requireString(record, 'name', label, schemaErrors, enrichmentErrors, { nonEmpty: true });
  requireString(record, 'type', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.itemType
  });
  requireArray(record, 'tags', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, itemType: 'string', itemNonEmpty: true, itemEnum: ENUMS.itemTag
  });
  requireString(record, 'owner', label, schemaErrors, enrichmentErrors, {
    nullable: true, idCategories: ['character', 'faction']
  });
  requireString(record, 'one_line', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 8, recordName: record.name
  });
  requireString(record, 'description', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 10, recordName: record.name
  });
  requireArray(record, 'effects', label, schemaErrors, enrichmentErrors, {
    itemValidator: validateEffect
  });
  requireString(record, 'origin', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 8, recordName: record.name
  });
  requireArray(record, 'related_characters', label, schemaErrors, enrichmentErrors, {
    itemType: 'string', itemNonEmpty: true, itemIdCategory: 'character'
  });
  requireArray(record, 'related_skills', label, schemaErrors, enrichmentErrors, {
    itemType: 'string', itemNonEmpty: true, itemIdCategory: 'skill'
  });
  requireString(record, 'rarity_tier', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.rarity
  });
  requireArray(record, 'rag_refs', label, schemaErrors, enrichmentErrors, {
    itemType: 'positiveInteger'
  });
  validateSourceRefs(record, label, schemaErrors, enrichmentErrors);
  validateFieldSourceRefs(record, label, schemaErrors);
}

function validateDialogue(record, label, schemaErrors, enrichmentErrors) {
  requireString(record, 'id', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, idCategory: 'dialogue'
  });
  requireString(record, 'speaker', label, schemaErrors, enrichmentErrors, {
    nullable: true, idCategory: 'character'
  });
  requireString(record, 'speaker_name', label, schemaErrors, enrichmentErrors);
  requireString(record, 'listener', label, schemaErrors, enrichmentErrors, {
    nullable: true, idCategory: 'character'
  });
  requireString(record, 'text', label, schemaErrors, enrichmentErrors, { nonEmpty: true });
  requireString(record, 'tone', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.dialogueTone
  });
  requireNumber(record, 'chapter', label, schemaErrors, { integer: true, min: 1 });
  requireNumber(record, 'line_start', label, schemaErrors, { integer: true, min: 1 });
  requireNumber(record, 'line_end', label, schemaErrors, { integer: true, min: 1 });
  requireString(record, 'selection_type', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enum: ENUMS.selectionType
  });
  requireString(record, 'selection_reason', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 8
  });
  const traits = requireArray(record, 'trait_tags', label, schemaErrors, enrichmentErrors, {
    itemType: 'string', itemNonEmpty: true
  });
  requireString(record, 'context', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 8
  });
  requireNumber(record, 'context_line_start', label, schemaErrors, { integer: true, min: 1 });
  requireNumber(record, 'context_line_end', label, schemaErrors, { integer: true, min: 1 });

  if (!String(record.speaker ?? '').trim() && !String(record.speaker_name ?? '').trim()) {
    schemaErrors.push(`${label}: requires speaker or speaker_name`);
  }
  if (Number.isInteger(record.line_start) && Number.isInteger(record.line_end) &&
      record.line_end < record.line_start) {
    schemaErrors.push(`${label}.line_end: must be >= line_start`);
  }
  if (Number.isInteger(record.context_line_start) && Number.isInteger(record.context_line_end) &&
      record.context_line_end < record.context_line_start) {
    schemaErrors.push(`${label}.context_line_end: must be >= context_line_start`);
  }
  if (['event', 'both'].includes(record.selection_type)) {
    requireString(record, 'event_id', label, schemaErrors, enrichmentErrors, {
      nonEmpty: true, idCategory: 'event'
    });
  }
  if (['persona', 'both'].includes(record.selection_type) && traits && traits.length === 0) {
    enrichmentErrors.push(`${label}.trait_tags: must not be empty for ${record.selection_type} dialogue`);
  }
}

function validateChapterSummary(record, label, schemaErrors, enrichmentErrors) {
  requireNumber(record, 'chapter', label, schemaErrors, { integer: true, min: 1 });
  requireString(record, 'title', label, schemaErrors, enrichmentErrors, { nonEmpty: true });
  requireString(record, 'summary', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, minLength: 20
  });
  requireArray(record, 'key_events', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, enrichment: true, itemType: 'string', itemNonEmpty: true
  });
  requireArray(record, 'key_characters', label, schemaErrors, enrichmentErrors, {
    nonEmpty: true, itemType: 'string', itemNonEmpty: true, itemIdCategory: 'character'
  });
  validateSourceRefs(record, label, schemaErrors, enrichmentErrors);
  requireObject(record, 'field_source_refs', label, schemaErrors);
  validateFieldSourceRefs(record, label, schemaErrors);
}

const VALIDATORS = {
  'characters.json': validateCharacter,
  'factions.json': validateFaction,
  'locations.json': validateLocation,
  'skills.json': validateSkill,
  'techniques.json': validateTechnique,
  'items.json': validateItem,
  'dialogues.json': validateDialogue,
  'chapter_summaries.json': validateChapterSummary
};

function provisionalCategory(value) {
  const key = String(value ?? '');
  const entity = key.match(/^entity_(character|faction|location|skill|technique|item)_([a-f0-9]{16})$/);
  if (entity) return entity[1];
  if (/^dialogue_key_[a-f0-9]{16}$/.test(key)) return 'dialogue';
  if (/^event_key_[a-f0-9]{16}$/.test(key)) return 'event';
  return null;
}

function validateProvisionalRecord(category, record) {
  const filename = PROVISIONAL_RECORD_FILES[category];
  const schemaErrors = [];
  const enrichmentErrors = [];
  if (!filename) {
    return {
      schema_errors: [`unsupported provisional record category: ${JSON.stringify(category)}`],
      enrichment_errors: []
    };
  }
  if (!isPlainObject(record)) {
    return {
      schema_errors: [`${filename}/#0: record must be an object`],
      enrichment_errors: []
    };
  }

  const labelKey = category === 'chapter_summary'
    ? `chapter:${record.chapter ?? '?'}`
    : String(record.provisional_key ?? '').trim();
  const label = `${filename}/${labelKey || '#0'}`;
  if (category !== 'chapter_summary' && provisionalCategory(labelKey) !== category) {
    schemaErrors.push(`${label}.provisional_key: invalid ${category} provisional key`);
  }

  const projected = JSON.parse(JSON.stringify(record));
  if (category !== 'chapter_summary') projected.id = VALIDATION_IDS[category];

  function projectReference(value, categories, fieldLabel) {
    if (value === null || value === undefined || value === '') return value;
    const referenceCategory = provisionalCategory(value);
    if (!referenceCategory || !categories.includes(referenceCategory)) {
      schemaErrors.push(
        `${fieldLabel}: expected provisional ${categories.join(' or ')} key, got ${JSON.stringify(value)}`
      );
      return value;
    }
    return VALIDATION_IDS[referenceCategory];
  }

  if (category === 'character') {
    projected.relationships = (projected.relationships ?? []).map((relationship, index) => ({
      ...relationship,
      target: projectReference(
        relationship?.target,
        ['character'],
        `${label}.relationships[${index}].target`
      )
    }));
    for (const field of ['known_skills', 'related_skills']) {
      projected[field] = (projected[field] ?? []).map((value, index) => projectReference(
        value,
        ['skill'],
        `${label}.${field}[${index}]`
      ));
    }
  } else if (category === 'faction') {
    projected.location = projectReference(projected.location, ['location'], `${label}.location`);
    projected.leader = projectReference(projected.leader, ['character'], `${label}.leader`);
  } else if (category === 'skill') {
    projected.techniques = (projected.techniques ?? []).map((technique, index) => ({
      ...technique,
      id: projectReference(technique?.id, ['technique'], `${label}.techniques[${index}].id`)
    }));
  } else if (category === 'technique') {
    projected.source_skill = projectReference(
      projected.source_skill,
      ['skill'],
      `${label}.source_skill`
    );
  } else if (category === 'item') {
    projected.owner = projectReference(projected.owner, ['character', 'faction'], `${label}.owner`);
    for (const [field, categories] of [
      ['related_characters', ['character']],
      ['related_skills', ['skill']]
    ]) {
      projected[field] = (projected[field] ?? []).map((value, index) => projectReference(
        value,
        categories,
        `${label}.${field}[${index}]`
      ));
    }
  } else if (category === 'dialogue') {
    projected.speaker = projectReference(projected.speaker, ['character'], `${label}.speaker`);
    projected.listener = projectReference(projected.listener, ['character'], `${label}.listener`);
    if (['event', 'both'].includes(projected.selection_type)) {
      projected.event_id = projectReference(projected.event_id, ['event'], `${label}.event_id`);
    }
  } else if (category === 'chapter_summary') {
    projected.key_characters = (projected.key_characters ?? []).map((value, index) => projectReference(
      value,
      ['character'],
      `${label}.key_characters[${index}]`
    ));
  }

  VALIDATORS[filename](projected, label, schemaErrors, enrichmentErrors);
  return { schema_errors: schemaErrors, enrichment_errors: enrichmentErrors };
}

const RECORD_CATEGORY_BY_FILE = {
  'characters.json': 'character',
  'factions.json': 'faction',
  'locations.json': 'location',
  'skills.json': 'skill',
  'techniques.json': 'technique',
  'items.json': 'item',
  'dialogues.json': 'dialogue'
};

function validateCrossReferences(recordsByFile, schemaErrors) {
  const idsByCategory = Object.fromEntries(Object.entries(RECORD_CATEGORY_BY_FILE).map(
    ([filename, category]) => [
      category,
      new Set((recordsByFile[filename] ?? [])
        .map(record => record?.id)
        .filter(id => isValidId(id, category)))
    ]
  ));

  function check(value, categories, label) {
    if (value === null || value === undefined || value === '') return;
    const category = categories.find(candidate => isValidId(value, candidate));
    if (!category) return;
    if (!idsByCategory[category]?.has(value)) {
      schemaErrors.push(`${label}: references unknown ${category} ID ${JSON.stringify(value)}`);
    }
  }

  for (const [index, character] of (recordsByFile['characters.json'] ?? []).entries()) {
    const label = recordLabel('characters.json', character, index);
    for (const [relIndex, relationship] of (character?.relationships ?? []).entries()) {
      check(relationship?.target, ['character'], `${label}.relationships[${relIndex}].target`);
    }
    for (const [skillIndex, skillId] of (character?.known_skills ?? []).entries()) {
      check(skillId, ['skill'], `${label}.known_skills[${skillIndex}]`);
    }
    for (const [skillIndex, skillId] of (character?.related_skills ?? []).entries()) {
      check(skillId, ['skill'], `${label}.related_skills[${skillIndex}]`);
    }
  }

  for (const [index, faction] of (recordsByFile['factions.json'] ?? []).entries()) {
    const label = recordLabel('factions.json', faction, index);
    check(faction?.location, ['location'], `${label}.location`);
    check(faction?.leader, ['character'], `${label}.leader`);
  }

  for (const [index, skill] of (recordsByFile['skills.json'] ?? []).entries()) {
    const label = recordLabel('skills.json', skill, index);
    for (const [techniqueIndex, technique] of (skill?.techniques ?? []).entries()) {
      check(technique?.id, ['technique'], `${label}.techniques[${techniqueIndex}].id`);
    }
  }

  for (const [index, technique] of (recordsByFile['techniques.json'] ?? []).entries()) {
    check(
      technique?.source_skill,
      ['skill'],
      `${recordLabel('techniques.json', technique, index)}.source_skill`
    );
  }

  for (const [index, item] of (recordsByFile['items.json'] ?? []).entries()) {
    const label = recordLabel('items.json', item, index);
    check(item?.owner, ['character', 'faction'], `${label}.owner`);
    for (const [characterIndex, characterId] of (item?.related_characters ?? []).entries()) {
      check(characterId, ['character'], `${label}.related_characters[${characterIndex}]`);
    }
    for (const [skillIndex, skillId] of (item?.related_skills ?? []).entries()) {
      check(skillId, ['skill'], `${label}.related_skills[${skillIndex}]`);
    }
  }

  for (const [index, dialogue] of (recordsByFile['dialogues.json'] ?? []).entries()) {
    const label = recordLabel('dialogues.json', dialogue, index);
    check(dialogue?.speaker, ['character'], `${label}.speaker`);
    check(dialogue?.listener, ['character'], `${label}.listener`);
  }

  for (const [index, summary] of (recordsByFile['chapter_summaries.json'] ?? []).entries()) {
    const label = recordLabel('chapter_summaries.json', summary, index);
    for (const [characterIndex, characterId] of (summary?.key_characters ?? []).entries()) {
      check(characterId, ['character'], `${label}.key_characters[${characterIndex}]`);
    }
  }
}

function finalDataRoot(novelDir, options = {}) {
  return options.dataRoot ? path.resolve(options.dataRoot) : path.join(novelDir, 'data');
}

function computeFinalDataHash(novelDir, options = {}) {
  const dataDir = finalDataRoot(novelDir, options);
  const hash = crypto.createHash('sha256');
  for (const filename of FINAL_DATA_FILES) {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) return null;
    try {
      hash.update(filename);
      hash.update('\0');
      hash.update(fs.readFileSync(filePath));
      hash.update('\0');
    } catch {
      return null;
    }
  }
  return hash.digest('hex');
}

function validateFinalData(novelDir, options = {}) {
  const dataDir = finalDataRoot(novelDir, options);
  const missingDataFiles = [];
  const invalidDataFiles = [];
  const schemaErrors = [];
  const enrichmentErrors = [];
  const recordsByFile = {};

  for (const filename of FINAL_DATA_FILES) {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) {
      missingDataFiles.push(filename);
      recordsByFile[filename] = [];
      continue;
    }
    let records;
    try {
      records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      invalidDataFiles.push(`${filename}: ${error.message}`);
      recordsByFile[filename] = [];
      continue;
    }
    if (!Array.isArray(records)) {
      invalidDataFiles.push(`${filename}: top-level value must be an array`);
      recordsByFile[filename] = [];
      continue;
    }
    recordsByFile[filename] = records;

    const seenIds = new Set();
    records.forEach((record, index) => {
      const label = recordLabel(filename, record, index);
      if (!isPlainObject(record)) {
        schemaErrors.push(`${label}: record must be an object`);
        return;
      }
      const id = String(record.id ?? '').trim();
      if (id) {
        if (seenIds.has(id)) schemaErrors.push(`${label}.id: duplicate id`);
        seenIds.add(id);
      }
      VALIDATORS[filename](record, label, schemaErrors, enrichmentErrors);
    });
  }

  validateCrossReferences(recordsByFile, schemaErrors);

  if (recordsByFile['characters.json']?.length === 0) {
    enrichmentErrors.push('characters.json: must contain at least one character');
  }

  return {
    missing_data_files: missingDataFiles,
    invalid_data_files: invalidDataFiles,
    schema_errors: schemaErrors,
    enrichment_errors: enrichmentErrors,
    final_data_hash: missingDataFiles.length || invalidDataFiles.length
      ? null
      : computeFinalDataHash(novelDir, { dataRoot: dataDir }),
    records_by_file: recordsByFile,
    counts: Object.fromEntries(FINAL_DATA_FILES.map(filename => [
      filename.replace('.json', ''),
      recordsByFile[filename]?.length ?? 0
    ]))
  };
}

function evidenceFieldsFor(filename, record) {
  return (EVIDENCE_FIELDS[filename] ?? []).filter(field => hasContent(record?.[field]));
}

module.exports = {
  ENUMS,
  EVIDENCE_FIELDS,
  FINAL_DATA_FILES,
  computeFinalDataHash,
  evidenceFieldsFor,
  hasContent,
  validateCrossReferences,
  validateFinalData,
  validateProvisionalRecord
};
