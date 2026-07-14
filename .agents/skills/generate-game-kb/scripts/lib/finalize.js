'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { ENTITY_CATEGORIES, normalizeName, validateCleanedBook } = require('./book-contract');
const { atomicWriteJson } = require('./io');
const { assignStableIds } = require('./ids');

const CATEGORY_FILES = Object.freeze({
  characters: 'characters.json',
  events: 'events.json',
  items: 'items.json',
  skills: 'skills.json',
  techniques: 'techniques.json',
  factions: 'factions.json',
  locations: 'locations.json',
  dialogues: 'dialogues.json',
  chapter_summaries: 'chapter_summaries.json'
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

function makeResolver(idPlan, issues) {
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

  function resolve(category, target, path) {
    if (typeof target !== 'string' || target.trim() === '') return null;
    const index = indexes[category];
    const direct = index?.local.get(target);
    if (direct) return direct;
    const matches = index?.names.get(normalizeName(target)) || new Set();
    if (matches.size === 1) return [...matches][0];
    issues.push({
      code: matches.size === 0 ? 'REFERENCE_UNRESOLVED' : 'REFERENCE_AMBIGUOUS',
      path,
      target
    });
    return null;
  }

  function resolveMany(category, targets, path) {
    return uniqueSorted((Array.isArray(targets) ? targets : [])
      .map((target, index) => resolve(category, target, `${path}[${index}]`)));
  }

  function resolveAny(categories, target, path) {
    if (typeof target !== 'string' || target.trim() === '') return null;
    const matches = new Set();
    for (const category of categories) {
      const index = indexes[category];
      const direct = index?.local.get(target);
      if (direct) matches.add(direct);
      for (const id of index?.names.get(normalizeName(target)) || []) matches.add(id);
    }
    if (matches.size === 1) return [...matches][0];
    issues.push({
      code: matches.size === 0 ? 'REFERENCE_UNRESOLVED' : 'REFERENCE_AMBIGUOUS',
      path,
      target
    });
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
      target: resolver.resolve('characters', targetName, `characters[${index}].relationships[${relationshipIndex}].target`),
      type: typeof relationship === 'object' ? String(relationship.type || '关联') : '关联',
      dynamic: typeof relationship === 'object' ? String(relationship.dynamic || '') : ''
    };
  }).filter(relationship => relationship.target)
    .sort((left, right) => `${left.target}\0${left.type}`.localeCompare(`${right.target}\0${right.type}`));
}

function resolveReferences(recordsByCategory, idPlan) {
  const issues = [];
  const resolver = makeResolver(idPlan, issues);
  const data = emptyData();

  data['characters.json'] = (recordsByCategory.characters || []).map((record, index) => {
    const aliases = Array.isArray(record.aliases) ? [...record.aliases] : [];
    const skills = resolver.resolveMany('skills', record.skill_names, `characters[${index}].skill_names`);
    const items = resolver.resolveMany('items', record.item_names, `characters[${index}].item_names`);
    const faction = resolver.resolve('factions', record.faction_name ?? record.faction, `characters[${index}].faction`);
    return {
      id: record.id,
      name: record.canonical_name,
      alias: aliases,
      aliases,
      identity: String(record.identity || ''),
      role: record.level,
      archetype: String(record.archetype || ''),
      power_rank: String(record.power_rank || ''),
      faction,
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

  data['events.json'] = (recordsByCategory.events || []).map((record, index) => ({
    id: record.id,
    name: record.canonical_name,
    cause: String(record.cause || ''),
    process: String(record.process || ''),
    result: String(record.result || ''),
    participants: resolver.resolveMany('characters', record.participant_names, `events[${index}].participant_names`),
    locations: resolver.resolveMany('locations', record.location_names, `events[${index}].location_names`),
    importance: String(record.importance || ''),
    source_refs: copySourceRefs(record)
  })).sort((left, right) => left.id.localeCompare(right.id));

  data['items.json'] = (recordsByCategory.items || []).map((record, index) => ({
    id: record.id,
    name: record.canonical_name,
    type: String(record.type || ''),
    tags: Array.isArray(record.tags) ? [...record.tags] : [],
    importance: record.inclusion_reason,
    inclusion_reason: record.inclusion_reason,
    owner: resolver.resolveAny(
      ['characters', 'factions'],
      record.owner_name ?? record.holder_name,
      `items[${index}].owner_name`
    ),
    description: String(record.description || ''),
    one_line: String(record.one_line || record.description || record.canonical_name),
    effects: Array.isArray(record.effects) ? structuredClone(record.effects) : [],
    related_characters: resolver.resolveMany(
      'characters', record.related_character_names, `items[${index}].related_character_names`
    ),
    related_skills: resolver.resolveMany('skills', record.related_skill_names, `items[${index}].related_skill_names`),
    rarity_tier: String(record.rarity_tier || '未知'),
    source_refs: copySourceRefs(record)
  })).sort((left, right) => left.id.localeCompare(right.id));

  data['skills.json'] = (recordsByCategory.skills || []).map((record, index) => ({
    id: record.id,
    name: record.canonical_name,
    type: String(record.type || ''),
    faction: resolver.resolve('factions', record.faction_name, `skills[${index}].faction_name`),
    mastery_rank: String(record.mastery_rank || ''),
    description: String(record.description || ''),
    one_line: String(record.one_line || record.description || record.canonical_name),
    holders: resolver.resolveMany('characters', record.holder_names, `skills[${index}].holder_names`),
    techniques: resolver.resolveMany('techniques', record.technique_names, `skills[${index}].technique_names`),
    progression: String(record.progression || ''),
    effects: Array.isArray(record.effects) ? structuredClone(record.effects) : [],
    combat_style: record.combat_style ?? '',
    source_refs: copySourceRefs(record)
  })).sort((left, right) => left.id.localeCompare(right.id));

  data['techniques.json'] = (recordsByCategory.techniques || []).map((record, index) => {
    const sourceSkill = resolver.resolve(
      'skills', record.source_skill_name, `techniques[${index}].source_skill_name`
    );
    return {
      id: record.id,
      name: record.canonical_name,
      skill: sourceSkill,
      source_skill: sourceSkill,
      type: String(record.type || ''),
      description: String(record.description || ''),
      source_refs: copySourceRefs(record)
    };
  }).sort((left, right) => left.id.localeCompare(right.id));

  data['factions.json'] = (recordsByCategory.factions || []).map((record, index) => ({
    id: record.id,
    name: record.canonical_name,
    type: String(record.type || ''),
    location: resolver.resolve('locations', record.location_name, `factions[${index}].location_name`),
    leader: resolver.resolve('characters', record.leader_name, `factions[${index}].leader_name`),
    description: String(record.description || ''),
    one_line: String(record.one_line || record.description || record.canonical_name),
    members: resolver.resolveMany('characters', record.member_names, `factions[${index}].member_names`),
    sub_organizations: Array.isArray(record.sub_organizations) ? [...record.sub_organizations] : [],
    sub_divisions: Array.isArray(record.sub_divisions) ? [...record.sub_divisions] : [],
    source_refs: copySourceRefs(record)
  })).sort((left, right) => left.id.localeCompare(right.id));

  data['locations.json'] = (recordsByCategory.locations || []).map((record, index) => ({
    id: record.id,
    name: record.canonical_name,
    region: String(record.region || ''),
    description: String(record.description || ''),
    one_line: String(record.one_line || record.description || record.canonical_name),
    factions: resolver.resolveMany('factions', record.faction_names, `locations[${index}].faction_names`),
    characters: resolver.resolveMany('characters', record.character_names, `locations[${index}].character_names`),
    source_refs: copySourceRefs(record)
  })).sort((left, right) => left.id.localeCompare(right.id));

  data['dialogues.json'] = (recordsByCategory.dialogues || []).map((record, index) => ({
    id: record.id,
    event_id: resolver.resolve('events', record.event_key, `dialogues[${index}].event_key`),
    speaker: resolver.resolve('characters', record.speaker_name, `dialogues[${index}].speaker_name`),
    speaker_name: record.speaker_name,
    listener: resolver.resolve('characters', record.listener_name, `dialogues[${index}].listener_name`),
    chapter: record.chapter,
    line_start: record.line_start ?? record.source_refs?.[0]?.line_start,
    line_end: record.line_end ?? record.source_refs?.[0]?.line_end,
    text: record.text,
    tone: String(record.tone || ''),
    context: String(record.context || ''),
    source_refs: copySourceRefs(record)
  })).sort((left, right) => left.id.localeCompare(right.id));

  data['chapter_summaries.json'] = (recordsByCategory.chapter_summaries || []).map((record, index) => ({
    chapter: record.chapter,
    title: record.title,
    summary: record.summary,
    key_events: resolver.resolveMany('events', record.key_events, `chapter_summaries[${index}].key_events`),
    key_characters: resolver.resolveMany(
      'characters', record.key_characters, `chapter_summaries[${index}].key_characters`
    ),
    source_refs: copySourceRefs(record)
  })).sort((left, right) => left.chapter - right.chapter);

  const deduplicatedIssues = [...new Map(issues.map(issue => [JSON.stringify(issue), issue])).values()]
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return { data, issues: deduplicatedIssues };
}

function buildFinalData(cleaned, manifest) {
  const contractIssues = validateCleanedBook(cleaned, manifest);
  if (contractIssues.length > 0) return { data: emptyData(), issues: contractIssues, id_plan: {} };
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
    atomicWriteJson(path.join(paths.finalData, filename), records);
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
