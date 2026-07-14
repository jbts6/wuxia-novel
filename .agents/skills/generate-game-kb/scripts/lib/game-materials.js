'use strict';

const { normalizeName } = require('./book-contract');

const MATERIAL_TYPES = new Set([
  '战斗系统原型',
  '经典剧情桥段',
  '角色原型/彩蛋',
  '标志性物品',
  '门派与世界观素材'
]);
const CATEGORY_FILES = Object.freeze({
  characters: 'characters.json',
  events: 'events.json',
  items: 'items.json',
  skills: 'skills.json',
  techniques: 'techniques.json',
  factions: 'factions.json',
  locations: 'locations.json',
  dialogues: 'dialogues.json'
});

function buildGameMaterials(finalData, candidates) {
  const issues = [];
  const indexes = {};
  for (const [category, filename] of Object.entries(CATEGORY_FILES)) {
    const index = new Map();
    for (const record of finalData?.[filename] || []) {
      for (const name of [record.name, ...(record.alias || []), ...(record.aliases || [])]) {
        const normalized = normalizeName(name);
        if (!normalized) continue;
        if (!index.has(normalized)) index.set(normalized, new Set());
        index.get(normalized).add(record.id);
      }
    }
    indexes[category] = index;
  }

  const entries = [];
  for (const [index, candidate] of (Array.isArray(candidates) ? candidates : []).entries()) {
    const label = `game_material_candidates[${index}]`;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      issues.push({ code: 'MATERIAL_CANDIDATE_INVALID', path: label, target: '' });
      continue;
    }
    let invalid = false;
    if ('entity' in candidate || 'record' in candidate) {
      issues.push({ code: 'MATERIAL_EMBEDDED_ENTITY_FORBIDDEN', path: label, target: candidate.source_name || '' });
      invalid = true;
    }
    if (!MATERIAL_TYPES.has(candidate.material_type)) {
      issues.push({ code: 'MATERIAL_TYPE_INVALID', path: `${label}.material_type`, target: candidate.material_type });
      invalid = true;
    }
    const category = candidate.source_category;
    const matches = indexes[category]?.get(normalizeName(candidate.source_name)) || new Set();
    if (matches.size !== 1) {
      issues.push({
        code: matches.size === 0 ? 'MATERIAL_SOURCE_UNRESOLVED' : 'MATERIAL_SOURCE_AMBIGUOUS',
        path: `${label}.source_name`,
        target: candidate.source_name
      });
      continue;
    }
    for (const field of ['relevance', 'suggested_use', 'reason']) {
      if (typeof candidate[field] !== 'string' || candidate[field].trim() === '') {
        issues.push({ code: 'MATERIAL_FIELD_REQUIRED', path: `${label}.${field}`, target: candidate.source_name });
        invalid = true;
      }
    }
    if (invalid) continue;
    entries.push({
      material_type: candidate.material_type,
      source_id: [...matches][0],
      relevance: candidate.relevance,
      suggested_use: candidate.suggested_use,
      reason: candidate.reason
    });
  }
  return {
    entries: entries.sort((left, right) =>
      `${left.material_type}\0${left.source_id}`.localeCompare(`${right.material_type}\0${right.source_id}`)),
    issues: [...new Map(issues.map(issue => [JSON.stringify(issue), issue])).values()]
  };
}

module.exports = { CATEGORY_FILES, MATERIAL_TYPES, buildGameMaterials };
