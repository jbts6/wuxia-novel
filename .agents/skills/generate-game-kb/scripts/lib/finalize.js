'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { ENTITY_CATEGORIES, normalizeName, validateCleanedBook } = require('./book-contract');
const { atomicWriteJson } = require('./io');
const { assignStableIds } = require('./ids');

const CATEGORY_FILES = Object.freeze({
  characters: 'characters.yaml',
  skills: 'skills.yaml',
  items: 'items.yaml',
  chapter_summaries: 'chapter_summaries.yaml'
});

function emptyData() {
  return Object.fromEntries(Object.values(CATEGORY_FILES).map(filename => [filename, []]));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function copySourceRefs(record) {
  return (Array.isArray(record?.source_refs) ? record.source_refs : []).map(ref => ({ ...ref }));
}

function makeResolver(idPlan, issues, warnings) {
  const indexes = {};
  for (const category of ENTITY_CATEGORIES) {
    const local = new Map();
    const names = new Map();
    for (const record of idPlan[category] || []) {
      if (record.local_key) local.set(record.local_key, record.id);
      for (const name of [record.canonical_name, ...(Array.isArray(record.aliases) ? record.aliases : [])]) {
        const normalized = normalizeName(name);
        if (!normalized) continue;
        if (!names.has(normalized)) names.set(normalized, new Set());
        names.get(normalized).add(record.id);
      }
    }
    indexes[category] = { local, names };
  }

  function resolve(category, target, path, { required = true } = {}) {
    if (typeof target !== 'string' || target.trim() === '') return null;
    const index = indexes[category];
    const direct = index?.local.get(target);
    if (direct) return direct;
    const matches = index?.names.get(normalizeName(target)) || new Set();
    if (matches.size === 1) return [...matches][0];
    const issue = {
      code: matches.size === 0 ? 'REFERENCE_UNRESOLVED' : 'REFERENCE_AMBIGUOUS',
      path,
      target
    };
    (required ? issues : warnings).push(required ? issue : { ...issue, disposition: 'omitted' });
    return null;
  }

  function resolveMany(category, targets, path, options) {
    return uniqueSorted((Array.isArray(targets) ? targets : [])
      .map((target, index) => resolve(category, target, `${path}[${index}]`, options)));
  }

  function resolveAny(categories, target, path, { required = true } = {}) {
    if (typeof target !== 'string' || target.trim() === '') return null;
    const matches = new Set();
    for (const category of categories) {
      const index = indexes[category];
      const direct = index?.local.get(target);
      if (direct) matches.add(direct);
      for (const id of index?.names.get(normalizeName(target)) || []) matches.add(id);
    }
    if (matches.size === 1) return [...matches][0];
    const issue = {
      code: matches.size === 0 ? 'REFERENCE_UNRESOLVED' : 'REFERENCE_AMBIGUOUS',
      path,
      target
    };
    (required ? issues : warnings).push(required ? issue : { ...issue, disposition: 'omitted' });
    return null;
  }

  return { resolve, resolveAny, resolveMany };
}

function projectRelationships(record, index, resolver) {
  const raw = Array.isArray(record.relationships) ? record.relationships : record.relationship_names || [];
  return raw.map((relationship, relationshipIndex) => {
    const targetName = typeof relationship === 'string'
      ? relationship
      : relationship?.target_name ?? relationship?.target ?? relationship?.name;
    return {
      target: resolver.resolve(
        'characters', targetName, `characters[${index}].relationships[${relationshipIndex}].target`,
        { required: false }
      ),
      type: typeof relationship === 'object' ? String(relationship.type || '关联') : '关联',
      dynamic: typeof relationship === 'object' ? String(relationship.dynamic || '') : ''
    };
  }).filter(relationship => relationship.target)
    .sort((left, right) => `${left.target}\0${left.type}`.localeCompare(`${right.target}\0${right.type}`));
}

function isGenericSpeakerReference(target) {
  return typeof target === 'string'
    && /(?:家丁|将军|教众|弟子|门人|帮众|官兵|侍卫|随从|士兵|众人|群雄|掌门人?|汉子|苗女|喽啰|仆役)$/u.test(target.trim());
}

function resolveReferences(recordsByCategory, idPlan) {
  const issues = [];
  const warnings = [];
  const resolver = makeResolver(idPlan, issues, warnings);
  const data = emptyData();

  data['characters.json'] = (recordsByCategory.characters || []).map((record, index) => {
    const aliases = Array.isArray(record.aliases) ? [...record.aliases] : [];
    const skills = resolver.resolveMany(
      'skills', record.skill_names, `characters[${index}].skill_names`, { required: false }
    );
    const items = resolver.resolveMany(
      'items', record.item_names, `characters[${index}].item_names`, { required: false }
    );
    return {
      id: record.id,
      name: record.canonical_name,
      alias: aliases,
      aliases,
      identity: String(record.identity || ''),
      role: record.level,
      archetype: String(record.archetype || ''),
      power_rank: String(record.power_rank || ''),
      importance: record.level,
      one_line: String(record.one_line || record.biography || record.identity || record.canonical_name),
      bio: String(record.biography || ''),
      biography: String(record.biography || ''),
      personality: {
        traits: Array.isArray(record.personality?.traits) ? [...record.personality.traits] : [],
        speech_style: String(record.personality?.speech_style || ''),
        temperament: String(record.personality?.temperament || '')
      },
      relationships: projectRelationships(record, index, resolver),
      known_skills: skills,
      related_skills: skills,
      skills,
      items,
      source_refs: copySourceRefs(record)
    };
  }).sort((left, right) => left.id.localeCompare(right.id));

  data['items.json'] = (recordsByCategory.items || []).map((record, index) => ({
    id: record.id,
    name: record.canonical_name,
    type: String(record.type || ''),
    tags: Array.isArray(record.tags) ? [...record.tags] : [],
    importance: record.inclusion_reason,
    inclusion_reason: record.inclusion_reason,
    owner: resolver.resolve(
      'characters', record.owner_name ?? record.holder_name,
      `items[${index}].owner_name`,
      { required: false }
    ),
    description: String(record.description || ''),
    one_line: String(record.one_line || record.description || record.canonical_name),
    effects: Array.isArray(record.effects) ? structuredClone(record.effects) : [],
    related_characters: resolver.resolveMany(
      'characters', record.related_character_names, `items[${index}].related_character_names`, { required: false }
    ),
    related_skills: resolver.resolveMany(
      'skills', record.related_skill_names, `items[${index}].related_skill_names`, { required: false }
    ),
    source_refs: copySourceRefs(record)
  })).sort((left, right) => left.id.localeCompare(right.id));

  data['skills.json'] = (recordsByCategory.skills || []).map((record, index) => ({
    id: record.id,
    name: record.canonical_name,
    type: String(record.type || ''),
    power_rank: String(record.power_rank || ''),
    description: String(record.description || ''),
    one_line: String(record.one_line || record.description || record.canonical_name),
    holders: resolver.resolveMany(
      'characters', record.holder_names, `skills[${index}].holder_names`, { required: false }
    ),
    // techniques 是嵌套数组，直接使用
    techniques: Array.isArray(record.techniques) ? record.techniques.map(tech => ({
      name: tech.canonical_name || tech.name,
      type: String(tech.type || '招式'),
      description: String(tech.description || '')
    })) : [],
    progression: String(record.progression || ''),
    effects: Array.isArray(record.effects) ? structuredClone(record.effects) : [],
    combat_style: record.combat_style ?? '',
    source_refs: copySourceRefs(record)
  })).sort((left, right) => left.id.localeCompare(right.id));

  data['chapter_summaries.json'] = (recordsByCategory.chapter_summaries || []).map((record, index) => ({
    chapter: record.chapter,
    title: record.title,
    summary: record.summary,
    key_characters: resolver.resolveMany(
      'characters', record.key_characters, `chapter_summaries[${index}].key_characters`, { required: false }
    ),
    key_skills: resolver.resolveMany(
      'skills', record.key_skills, `chapter_summaries[${index}].key_skills`, { required: false }
    ),
    source_refs: copySourceRefs(record)
  })).sort((left, right) => left.chapter - right.chapter);

  const deduplicatedIssues = [...new Map(issues.map(issue => [JSON.stringify(issue), issue])).values()]
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const deduplicatedWarnings = [...new Map(warnings.map(warning => [JSON.stringify(warning), warning])).values()]
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return { data, issues: deduplicatedIssues, warnings: deduplicatedWarnings };
}

function buildFinalData(cleaned, manifest) {
  const contractIssues = validateCleanedBook(cleaned, manifest);
  if (contractIssues.length > 0) return { data: emptyData(), issues: contractIssues, warnings: [], id_plan: {} };
  const source = Object.fromEntries(ENTITY_CATEGORIES.map(category => [category, cleaned[category] || []]));
  const idPlan = assignStableIds(source);
  const projected = resolveReferences({ ...idPlan, chapter_summaries: cleaned.chapter_summaries }, idPlan);
  const serializablePlan = Object.fromEntries(ENTITY_CATEGORIES.map(category => [
    category,
    (idPlan[category] || []).map(record => ({
      id: record.id,
      local_key: record.local_key,
      canonical_name: record.canonical_name,
      aliases: Array.isArray(record.aliases) ? [...record.aliases] : []
    }))
  ]));
  return { ...projected, id_plan: serializablePlan };
}

function writeFinalData(paths, result) {
  if (result.issues.length > 0) throw new Error('Cannot write final data with unresolved issues');
  fs.rmSync(paths.finalData, { recursive: true, force: true });
  fs.mkdirSync(paths.finalData, { recursive: true });
  for (const [filename, records] of Object.entries(result.data)) {
    const yamlContent = yaml.dump(records, { lineWidth: -1, noRefs: true });
    fs.writeFileSync(path.join(paths.finalData, filename), yamlContent, 'utf8');
  }
  atomicWriteJson(paths.finalIdPlan, result.id_plan);
}

module.exports = {
  CATEGORY_FILES,
  buildFinalData,
  emptyData,
  resolveReferences,
  writeFinalData
};
