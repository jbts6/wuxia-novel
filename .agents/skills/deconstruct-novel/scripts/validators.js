const ENTITY_TYPES = ['characters', 'skills', 'techniques', 'factions', 'locations', 'items'];
const {
  RANK_VALUES,
  CHARACTER_IMPORTANCE_VALUES,
  ITEM_RARITY_VALUES,
} = require('./semantic-fields');

const PREFIX_BY_TYPE = {
  characters: 'char_',
  skills: 'skill_',
  techniques: 'tech_',
  factions: 'faction_',
  locations: 'loc_',
  items: 'item_',
};

const ANY_PREFIX = Object.values(PREFIX_BY_TYPE);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function chineseCharCount(value) {
  if (typeof value !== 'string') return 0;
  const matches = value.match(/[\u4e00-\u9fff]/g);
  return matches ? matches.length : 0;
}

function validateId(id, prefixes, label, name) {
  const allowed = Array.isArray(prefixes) ? prefixes : [prefixes];
  const errors = [];

  if (typeof id !== 'string' || !id) {
    return [`${label}: id 缺失或不是字符串`];
  }

  const prefix = allowed.find(p => id.startsWith(p));
  if (!prefix) {
    errors.push(`${label}: id "${id}" 缺少合法前缀 (${allowed.join(', ')})`);
    return errors;
  }

  const body = id.slice(prefix.length);
  if (!/^[a-z]+(?:_[a-z]+)*$/.test(body)) {
    errors.push(`${label}: id "${id}" 必须是前缀 + 小写拼音音节，下划线分隔；禁止中文、数字、大小写混用或连写`);
  }

  const nameChars = chineseCharCount(name);
  const bodySegments = body ? body.split('_').filter(Boolean).length : 0;
  if (nameChars > 1 && bodySegments < nameChars) {
    errors.push(`${label}: id "${id}" 疑似拼音连写；"${name}" 有 ${nameChars} 个汉字，ID 至少需要 ${nameChars} 个拼音段`);
  }

  return errors;
}

function validateSourceRefs(entity, label) {
  const refs = entity.source_refs;
  if (!Array.isArray(refs) || refs.length === 0) {
    return [`${label}: source_refs 必须是非空数组`];
  }
  const errors = [];
  refs.forEach((ref, i) => {
    if (!isObject(ref)) {
      errors.push(`${label}.source_refs[${i}]: 必须是对象`);
      return;
    }
    if (!Number.isInteger(ref.chapter) || ref.chapter < 1) {
      errors.push(`${label}.source_refs[${i}]: chapter 必须是正整数`);
    }
    if (!Number.isInteger(ref.line_start) || !Number.isInteger(ref.line_end)) {
      errors.push(`${label}.source_refs[${i}]: line_start/line_end 必须是整数`);
    }
    if (typeof ref.text !== 'string' || !ref.text.trim()) {
      errors.push(`${label}.source_refs[${i}]: text 必须是非空字符串`);
    }
  });
  return errors;
}

function validateEnum(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    return [`${label}: 必须是 ${allowed.join(' / ')} 之一`];
  }
  return [];
}

function validateLegacyAlias(entity, legacyKey, canonicalKey, auditKey, label) {
  if (entity[legacyKey] === undefined || entity[legacyKey] === null) return [];
  if (entity[legacyKey] === entity[canonicalKey]) return [];
  if (entity[auditKey] === entity[legacyKey]) return [];
  return [`${label}.${legacyKey}: legacy alias 必须等于 ${canonicalKey} 或记录在 ${auditKey}`];
}

function validateEntity(type, entity, label) {
  const errors = [];
  if (!isObject(entity)) return [`${label}: 实体必须是对象`];

  errors.push(...validateId(entity.id, PREFIX_BY_TYPE[type], label, entity.name));
  if (typeof entity.name !== 'string' || !entity.name.trim()) {
    errors.push(`${label}: name 必须是非空字符串`);
  }
  errors.push(...validateSourceRefs(entity, label));

  if (type === 'characters') {
    errors.push(...validateEnum(entity.power_rank, RANK_VALUES, `${label}.power_rank`));
    errors.push(...validateEnum(entity.importance, CHARACTER_IMPORTANCE_VALUES, `${label}.importance`));
    errors.push(...validateLegacyAlias(entity, 'rank', 'power_rank', 'legacy_rank', label));
    for (const [i, rel] of (entity.relationships || []).entries()) {
      if (isObject(rel) && rel.target) {
        errors.push(...validateId(rel.target, 'char_', `${label}.relationships[${i}].target`));
      }
    }
    for (const [i, skillId] of (entity.known_skills || []).entries()) {
      errors.push(...validateId(skillId, 'skill_', `${label}.known_skills[${i}]`));
    }
    for (const [i, skillId] of (entity.related_skills || []).entries()) {
      errors.push(...validateId(skillId, 'skill_', `${label}.related_skills[${i}]`));
    }
  }

  if (type === 'skills') {
    errors.push(...validateEnum(entity.mastery_rank, RANK_VALUES, `${label}.mastery_rank`));
    errors.push(...validateLegacyAlias(entity, 'rank', 'mastery_rank', 'legacy_rank', label));
    for (const [i, tech] of (entity.techniques || []).entries()) {
      if (isObject(tech) && tech.id) {
        errors.push(...validateId(tech.id, 'tech_', `${label}.techniques[${i}].id`, tech.name));
      }
    }
  }

  if (type === 'techniques' && entity.source_skill) {
    errors.push(...validateId(entity.source_skill, 'skill_', `${label}.source_skill`));
  }

  if (type === 'items') {
    errors.push(...validateEnum(entity.rarity_tier, ITEM_RARITY_VALUES, `${label}.rarity_tier`));
    errors.push(...validateLegacyAlias(entity, 'rarity', 'rarity_tier', 'legacy_rarity', label));
    if (entity.owner) errors.push(...validateId(entity.owner, 'char_', `${label}.owner`));
    for (const [i, charId] of (entity.related_characters || []).entries()) {
      errors.push(...validateId(charId, 'char_', `${label}.related_characters[${i}]`));
    }
    for (const [i, skillId] of (entity.related_skills || []).entries()) {
      errors.push(...validateId(skillId, 'skill_', `${label}.related_skills[${i}]`));
    }
  }

  return errors;
}

function validateEntityCollections(collections, context) {
  const errors = [];
  if (!isObject(collections)) return [`${context}: new_entities/entity_registry 必须是对象`];

  for (const type of ENTITY_TYPES) {
    const arr = collections[type] || [];
    if (!Array.isArray(arr)) {
      errors.push(`${context}.${type}: 必须是数组`);
      continue;
    }
    arr.forEach((entity, i) => {
      errors.push(...validateEntity(type, entity, `${context}.${type}[${i}]`));
    });
  }

  return errors;
}

function validateDialogue(dialogue, label) {
  const errors = [];
  if (!isObject(dialogue)) return [`${label}: dialogue 必须是对象`];
  if (dialogue.speaker !== null && dialogue.speaker !== undefined) {
    errors.push(...validateId(dialogue.speaker, 'char_', `${label}.speaker`));
  }
  if (dialogue.listener !== null && dialogue.listener !== undefined) {
    errors.push(...validateId(dialogue.listener, 'char_', `${label}.listener`));
  }
  return errors;
}

function validateEntityUpdate(update, label) {
  const errors = [];
  if (!isObject(update)) return [`${label}: entity_update 必须是对象`];
  errors.push(...validateId(update.id, ANY_PREFIX, `${label}.id`));
  for (const [i, rel] of (update.relationship_updates || []).entries()) {
    if (isObject(rel) && rel.target) {
      errors.push(...validateId(rel.target, 'char_', `${label}.relationship_updates[${i}].target`));
    }
  }
  return errors;
}

function validateChapterData(data, context) {
  const errors = [];
  if (!isObject(data)) return [`${context}: 章节 JSON 必须是对象`];
  if (!Number.isInteger(data.chapter) || data.chapter < 1) {
    errors.push(`${context}.chapter: 必须是正整数`);
  }
  if (typeof data.chapter_summary !== 'string') {
    errors.push(`${context}.chapter_summary: 必须是字符串`);
  }
  if (!Array.isArray(data.dialogues)) {
    errors.push(`${context}.dialogues: 必须是数组`);
  } else {
    data.dialogues.forEach((dialogue, i) => {
      errors.push(...validateDialogue(dialogue, `${context}.dialogues[${i}]`));
    });
  }
  errors.push(...validateEntityCollections(data.new_entities, `${context}.new_entities`));
  if (!Array.isArray(data.entity_updates)) {
    errors.push(`${context}.entity_updates: 必须是数组`);
  } else {
    data.entity_updates.forEach((update, i) => {
      errors.push(...validateEntityUpdate(update, `${context}.entity_updates[${i}]`));
    });
  }
  return errors;
}

function validateRegistry(registry, context = 'entity_registry') {
  const errors = validateEntityCollections(registry, context);
  if (errors.length > 0) return errors;

  const ids = new Set();
  for (const type of ENTITY_TYPES) {
    for (const entity of registry[type] || []) ids.add(entity.id);
  }

  for (const char of registry.characters || []) {
    for (const rel of char.relationships || []) {
      if (rel.target && !ids.has(rel.target)) errors.push(`${char.id}.relationships: target ${rel.target} 不存在`);
    }
    for (const skillId of [...(char.known_skills || []), ...(char.related_skills || [])]) {
      if (!ids.has(skillId)) errors.push(`${char.id}: skill ${skillId} 不存在`);
    }
  }

  for (const item of registry.items || []) {
    for (const charId of item.related_characters || []) {
      if (!ids.has(charId)) errors.push(`${item.id}: related character ${charId} 不存在`);
    }
    for (const skillId of item.related_skills || []) {
      if (!ids.has(skillId)) errors.push(`${item.id}: related skill ${skillId} 不存在`);
    }
  }

  return errors;
}

module.exports = {
  ENTITY_TYPES,
  PREFIX_BY_TYPE,
  validateChapterData,
  validateEntityCollections,
  validateId,
  validateRegistry,
};
