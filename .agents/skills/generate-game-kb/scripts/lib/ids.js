'use strict';

const crypto = require('node:crypto');
const { pinyin } = require('pinyin-pro');

const PREFIX = Object.freeze({
  characters: 'char',
  items: 'item',
  skills: 'skill',
  techniques: 'tech',
  factions: 'faction',
});
const HEX_LETTERS = 'abcdefghijklmnop';

function idError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function alphabeticDigest(value, length = 8) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, length)
    .split('')
    .map(value => HEX_LETTERS[Number.parseInt(value, 16)])
    .join('');
}

function nameSlug(name) {
  const tokens = pinyin(String(name ?? '').normalize('NFKC'), {
    toneType: 'none',
    type: 'array'
  });
  const normalized = tokens.map(token => String(token)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ''))
    .filter(Boolean);
  return normalized.join('_') || `x${alphabeticDigest(String(name ?? ''), 8)}`;
}

function makeBaseId(category, canonicalName) {
  const prefix = PREFIX[category];
  if (!prefix) throw new TypeError(`Unsupported ID category: ${category}`);
  return `${prefix}_${nameSlug(canonicalName)}`;
}

function normalizedSourceRefs(record) {
  return (Array.isArray(record?.source_refs) ? record.source_refs : [])
    .map(ref => ({ chapter: ref?.chapter, text: String(ref?.text ?? '').normalize('NFKC').trim() }))
    .sort((left, right) => (Number(left.chapter) - Number(right.chapter)) || left.text.localeCompare(right.text));
}

function identityAnchor(category, record) {
  const refs = normalizedSourceRefs(record);
  const identity = {
    controller_key: record?.local_key ?? record?.registry_key ?? null,
    evidence: refs
  };
  return alphabeticDigest(`${category}\0${JSON.stringify(identity)}`, 16);
}

function priorIndexes(priorRecords) {
  const byAnchor = new Map();
  const byRegistry = new Map();
  for (const record of Array.isArray(priorRecords) ? priorRecords : []) {
    if (typeof record?.identity_anchor === 'string') byAnchor.set(record.identity_anchor, record);
    if (typeof record?.registry_key === 'string' && typeof record?.identity_anchor !== 'string') {
      byRegistry.set(record.registry_key, record);
    }
  }
  return { byAnchor, byRegistry };
}

function validatePriorRecord(record, category) {
  if (!record) return;
  if (typeof record.id !== 'string' || !record.id.startsWith(`${PREFIX[category]}_`)) {
    throw idError('ID_PLAN_INVALID', 'Prior ID plan contains an invalid issued ID', { category, id: record.id });
  }
  if (record.disambiguator !== null && record.disambiguator !== undefined
    && !/^[a-p]{8}$/.test(record.disambiguator)) {
    throw idError('ID_PLAN_INVALID', 'Prior ID plan contains an invalid disambiguator', {
      category, disambiguator: record.disambiguator
    });
  }
}

function assignCategoryIds(category, records, priorPlan = {}) {
  const entries = (Array.isArray(records) ? records : []).map(record => ({
    record,
    canonicalName: String(record?.name ?? '').trim(),
    baseId: makeBaseId(category, record?.name)
  }));

  const namesSeen = new Set();
  for (const entry of entries) {
    if (namesSeen.has(entry.canonicalName)) {
      throw idError('IDENTITY_COLLISION_REVIEW_REQUIRED', `Duplicate same-name records in ${category}`, {
        category, name: entry.canonicalName
      });
    }
    namesSeen.add(entry.canonicalName);
  }

  const byBase = new Map();
  for (const entry of entries) {
    if (!byBase.has(entry.baseId)) byBase.set(entry.baseId, []);
    byBase.get(entry.baseId).push(entry);
  }

  const assigned = [];
  const plan = [];
  for (const [baseId, collisions] of byBase) {
    for (const entry of collisions) {
      const priorEntry = priorPlan[entry.canonicalName];
      let id;
      let suffix = null;

      if (priorEntry?.id) {
        id = priorEntry.id;
        suffix = priorEntry.suffix || null;
      } else if (collisions.length > 1) {
        suffix = alphabeticDigest(`${category}\0${entry.canonicalName}`, 8);
        id = `${baseId}_${suffix}`;
      } else {
        id = baseId;
      }

      assigned.push({ ...entry.record, id });
      plan.push({
        category,
        canonical_name: entry.canonicalName,
        base_id: baseId,
        collision: collisions.length > 1,
        suffix_input: suffix ? `${category}\0${entry.canonicalName}` : null,
        suffix,
        issued_id: id
      });
    }
  }
  return { records: assigned.sort((a, b) => a.id.localeCompare(b.id)), plan };
}

function assignStableIds(recordsByCategory, priorPlan = {}) {
  const assigned = {};
  const idPlan = {};
  for (const category of Object.keys(recordsByCategory || {}).sort()) {
    if (!PREFIX[category]) continue;
    const categoryPlan = priorPlan?.[category] || {};
    const planByName = {};
    for (const entry of Array.isArray(categoryPlan) ? categoryPlan : []) {
      if (entry.canonical_name) planByName[entry.canonical_name] = entry;
    }
    const result = assignCategoryIds(category, recordsByCategory[category], planByName);
    assigned[category] = result.records;
    idPlan[category] = result.plan;
  }
  return { recordsByCategory: assigned, idPlan };
}

module.exports = { PREFIX, alphabeticDigest, assignStableIds, makeBaseId, nameSlug };
