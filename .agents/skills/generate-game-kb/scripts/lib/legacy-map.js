'use strict';

const crypto = require('node:crypto');

const { normalizeName } = require('./book-contract');
const { PREFIX, makeBaseId } = require('./ids');
const { CHARACTER_LEVELS } = require('./semantic-contract');

const ITEM_TYPE_RULES = Object.freeze([
  [/秘籍|经书|秘笈/u, '秘籍'],
  [/丹|药|毒/u, '丹药'],
  [/暗器|飞刀|毒针/u, '暗器'],
  [/异兽|灵兽|神兽|妖兽|猛兽/u, '异兽'],
  [/坐骑|乘骑|宝马|骏马|白马/u, '坐骑'],
  [/饰品|玉佩|玉镯|戒指|耳环|发簪|项链/u, '饰品'],
  [/甲|衣|袍|盔|护具|防具/u, '防具'],
  [/剑|刀|枪|棍|棒|鞭|兵器|武器/u, '武器']
]);
const PLACEHOLDERS = new Set(['', '未知', '不详', '暂无', '暂无描述', 'unknown', 'n/a', 'none', '?', '???']);
const LEVELS = new Set(CHARACTER_LEVELS);

function uniqueStrings(...values) {
  const result = [];
  const seen = new Set();
  const visit = value => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'string') return;
    const text = value.normalize('NFKC').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  };
  values.forEach(visit);
  return result;
}

function legacyText(value) {
  if (typeof value === 'string') return value.normalize('NFKC').trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return uniqueStrings(value.map(legacyText)).join('；');
  if (value && typeof value === 'object') {
    return uniqueStrings(Object.keys(value).sort().map(key => legacyText(value[key]))).join('；');
  }
  return '';
}

function isPlaceholder(text) {
  return PLACEHOLDERS.has(String(text).trim().toLowerCase());
}

function mergeLegacyDescription(parts) {
  const result = [];
  const seen = new Set();
  for (const [label, value] of Array.isArray(parts) ? parts : []) {
    const text = legacyText(value);
    const normalized = text.normalize('NFKC').trim();
    if (!normalized || isPlaceholder(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(`${label}：${normalized}`);
  }
  return result.length > 0 ? result.join('\n') : null;
}

function mapLegacyItemType(value) {
  const text = typeof value === 'string' ? value.normalize('NFKC').trim() : '';
  if (!text || isPlaceholder(text)) return null;
  return ITEM_TYPE_RULES.find(([pattern]) => pattern.test(text))?.[1] || '其他';
}

function copySourceRefs(record) {
  return (Array.isArray(record?.source_refs) ? record.source_refs : [])
    .filter(ref => ref && typeof ref === 'object' && !Array.isArray(ref))
    .map(ref => JSON.parse(JSON.stringify(ref)));
}

function stableRecordKey(category, record) {
  const sourceRefs = copySourceRefs(record)
    .map(ref => ({ chapter: ref.chapter, text: ref.text ?? ref.anchor ?? '' }))
    .sort((left, right) => (
      (Number(left.chapter) - Number(right.chapter))
      || String(left.text).localeCompare(String(right.text), 'zh-CN')
    ));
  const identity = {
    legacy_id: typeof record?.id === 'string' ? record.id : null,
    name: typeof record?.name === 'string' ? record.name.normalize('NFKC').trim() : null,
    source_refs: sourceRefs
  };
  const digest = crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 16);
  return `legacy:${category}:${digest}`;
}

function normalizedTechniques(value) {
  return (Array.isArray(value) ? value : [])
    .filter(entry => entry && typeof entry === 'object' && typeof entry.name === 'string' && entry.name.trim())
    .map(entry => ({
      name: entry.name.normalize('NFKC').trim(),
      description: mergeLegacyDescription([
        ['说明', entry.description],
        ['效果', entry.effect ?? entry.effects]
      ])
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function mapCharacter(record, key) {
  const level = uniqueStrings(record.importance, record.role)[0] || null;
  return {
    registry_key: key,
    local_key: key,
    name: record.name.normalize('NFKC').trim(),
    aliases: uniqueStrings(record.aliases, record.alias),
    identities: uniqueStrings(record.identity, record.identities),
    level: LEVELS.has(level) ? level : null,
    rank: null,
    description: mergeLegacyDescription([
      ['简介', record.description],
      ['生平', record.biography || record.bio],
      ['性格', record.personality],
      ['概述', record.one_line]
    ]),
    factions: [],
    skills: [],
    source_refs: copySourceRefs(record)
  };
}

function mapSkill(record, key) {
  return {
    registry_key: key,
    local_key: key,
    name: record.name.normalize('NFKC').trim(),
    aliases: uniqueStrings(record.aliases, record.alias),
    types: uniqueStrings(record.types, record.type),
    factions: [],
    rank: null,
    description: mergeLegacyDescription([
      ['说明', record.description],
      ['概述', record.one_line],
      ['修炼', record.progression],
      ['效果', record.effects ?? record['效果']],
      ['战斗风格', record.combat_style]
    ]),
    techniques: normalizedTechniques(record.techniques),
    source_refs: copySourceRefs(record)
  };
}

function mapItem(record, key) {
  return {
    registry_key: key,
    local_key: key,
    name: record.name.normalize('NFKC').trim(),
    aliases: uniqueStrings(record.aliases, record.alias),
    type: mapLegacyItemType(record.type),
    description: mergeLegacyDescription([
      ['说明', record.description],
      ['概述', record.one_line],
      ['来历', record.origin],
      ['效果', record.effects ?? record['效果']]
    ]),
    source_refs: copySourceRefs(record)
  };
}

function mapFaction(record, key) {
  const type = uniqueStrings(record.type)[0] || null;
  return {
    registry_key: key,
    local_key: key,
    name: record.name.normalize('NFKC').trim(),
    aliases: uniqueStrings(record.aliases, record.alias),
    type: type && !isPlaceholder(type) ? type : null,
    description: mergeLegacyDescription([
      ['说明', record.description],
      ['概述', record.one_line],
      ['驻地', record.headquarters ?? record.location ?? record.locations],
      ['势力', record.power_level]
    ]),
    source_refs: copySourceRefs(record)
  };
}

const MAPPERS = Object.freeze({
  characters: mapCharacter,
  skills: mapSkill,
  items: mapItem,
  factions: mapFaction
});

function legacyIdIsCompatible(category, id) {
  return typeof id === 'string'
    && new RegExp(`^${PREFIX[category]}_[a-z]+(?:_[a-z]+)*$`).test(id);
}

function makeReferenceIndex(entries) {
  const byId = new Map();
  const byName = new Map();
  for (const entry of entries) {
    if (typeof entry.legacy.id === 'string' && entry.legacy.id.trim()) {
      if (!byId.has(entry.legacy.id)) byId.set(entry.legacy.id, new Set());
      byId.get(entry.legacy.id).add(entry.mapped.local_key);
    }
    for (const name of [entry.legacy.name, ...entry.mapped.aliases]) {
      const normalized = normalizeName(name);
      if (!normalized) continue;
      if (!byName.has(normalized)) byName.set(normalized, new Set());
      byName.get(normalized).add(entry.mapped.local_key);
    }
  }
  return { byId, byName };
}

function referenceValue(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') return String(value.id ?? value.name ?? '').trim();
  return '';
}

function uniqueReferenceValues(...values) {
  const result = [];
  const seen = new Set();
  const visit = value => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const target = referenceValue(value).normalize('NFKC').trim();
    if (!target || seen.has(target)) return;
    seen.add(target);
    result.push(target);
  };
  values.forEach(visit);
  return result;
}

function resolveReferences(values, targetCategory, indexes, context, unresolved) {
  const resolved = [];
  for (const target of uniqueReferenceValues(values)) {
    const exact = indexes[targetCategory].byId.get(target);
    const named = indexes[targetCategory].byName.get(normalizeName(target));
    const matches = exact?.size ? exact : named;
    if (matches?.size === 1) {
      resolved.push([...matches][0]);
      continue;
    }
    unresolved.push({
      code: matches?.size > 1 ? 'LEGACY_REFERENCE_AMBIGUOUS' : 'LEGACY_REFERENCE_UNRESOLVED',
      ...context,
      target
    });
  }
  return [...new Set(resolved)].sort();
}

function mapEntities(input, rejected) {
  const entries = {};
  for (const [category, mapper] of Object.entries(MAPPERS)) {
    const collisions = new Map();
    entries[category] = [];
    for (const [index, record] of (Array.isArray(input?.[category]) ? input[category] : []).entries()) {
      if (!record || typeof record !== 'object' || typeof record.name !== 'string' || !record.name.trim()) {
        rejected.push({ code: 'LEGACY_RECORD_NAME_REQUIRED', category, index, legacy_id: record?.id ?? null });
        continue;
      }
      const baseKey = stableRecordKey(category, record);
      const occurrence = (collisions.get(baseKey) || 0) + 1;
      collisions.set(baseKey, occurrence);
      const key = occurrence === 1 ? baseKey : `${baseKey}:${occurrence}`;
      entries[category].push({ legacy: record, mapped: mapper(record, key), index });
    }
  }
  return entries;
}

function buildPriorRegistry(entries) {
  const priorRegistry = {};
  for (const category of Object.keys(MAPPERS)) {
    const idCounts = new Map();
    for (const entry of entries[category]) {
      const id = entry.legacy.id;
      if (legacyIdIsCompatible(category, id)) idCounts.set(id, (idCounts.get(id) || 0) + 1);
    }
    const generatedBases = entries[category].map(entry => ({
      entry,
      base: makeBaseId(category, entry.mapped.name)
    }));
    priorRegistry[category] = entries[category].flatMap(entry => {
      const id = entry.legacy.id;
      const conflictsWithGenerated = generatedBases.some(candidate => (
        candidate.entry !== entry && candidate.base === id
      ));
      if (!legacyIdIsCompatible(category, id) || idCounts.get(id) !== 1 || conflictsWithGenerated) return [];
      return [{ id, registry_key: entry.mapped.registry_key }];
    }).sort((left, right) => left.id.localeCompare(right.id));
  }
  return priorRegistry;
}

function mapChapterSummaries(input, rejected) {
  return (Array.isArray(input?.chapter_summaries) ? input.chapter_summaries : []).flatMap((record, index) => {
    const chapter = Number(record?.chapter);
    if (!Number.isInteger(chapter) || chapter < 1 || typeof record?.summary !== 'string' || !record.summary.trim()) {
      rejected.push({ code: 'LEGACY_CHAPTER_SUMMARY_INVALID', category: 'chapter_summaries', index });
      return [];
    }
    return [{
      chapter,
      title: typeof record.title === 'string' ? record.title.trim() : '',
      summary: record.summary.trim(),
      source_refs: copySourceRefs(record)
    }];
  }).sort((left, right) => left.chapter - right.chapter);
}

function mapLegacyBook(input) {
  const rejected = [];
  const unresolved = [];
  const entries = mapEntities(input, rejected);
  const indexes = Object.fromEntries(Object.entries(entries).map(([category, records]) => [
    category,
    makeReferenceIndex(records)
  ]));

  for (const entry of entries.characters) {
    entry.mapped.factions = resolveReferences(
      [entry.legacy.factions, entry.legacy.faction], 'factions', indexes,
      { category: 'characters', record: entry.mapped.registry_key, field: 'factions' }, unresolved
    );
    entry.mapped.skills = resolveReferences(
      [entry.legacy.skills, entry.legacy.known_skills, entry.legacy.related_skills], 'skills', indexes,
      { category: 'characters', record: entry.mapped.registry_key, field: 'skills' }, unresolved
    );
  }
  for (const entry of entries.skills) {
    entry.mapped.factions = resolveReferences(
      [entry.legacy.factions, entry.legacy.faction], 'factions', indexes,
      { category: 'skills', record: entry.mapped.registry_key, field: 'factions' }, unresolved
    );
  }

  return {
    book: {
      schema_version: 1,
      stage: 'merged',
      characters: entries.characters.map(entry => entry.mapped),
      skills: entries.skills.map(entry => entry.mapped),
      items: entries.items.map(entry => entry.mapped),
      factions: entries.factions.map(entry => entry.mapped),
      chapter_summaries: mapChapterSummaries(input, rejected),
      candidate_resolutions: [],
      ambiguities: []
    },
    priorRegistry: buildPriorRegistry(entries),
    rejected,
    unresolved
  };
}

module.exports = {
  mapLegacyBook,
  mapLegacyItemType,
  mergeLegacyDescription
};
