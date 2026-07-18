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
    controller_key: record?.registry_key ?? record?.local_key ?? null,
    evidence: refs
  };
  return alphabeticDigest(`${category}\0${JSON.stringify(identity)}`, 16);
}

function priorIndexes(priorRecords) {
  const byAnchor = new Map();
  const byRegistry = new Map();
  for (const record of Array.isArray(priorRecords) ? priorRecords : []) {
    if (typeof record?.identity_anchor === 'string') byAnchor.set(record.identity_anchor, record);
    if (typeof record?.registry_key === 'string') byRegistry.set(record.registry_key, record);
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

function assignCategoryIds(category, records, priorRecords = []) {
  const prior = priorIndexes(priorRecords);
  const entries = (Array.isArray(records) ? records : []).map(record => ({
    record,
    canonicalName: String(record?.name ?? record?.canonical_name ?? '').trim(),
    baseId: makeBaseId(category, record?.name ?? record?.canonical_name),
    identityAnchor: identityAnchor(category, record)
  }));
  for (const entry of entries) {
    for (const field of ['identity_anchor', 'disambiguator', 'issued_id']) {
      if (Object.hasOwn(entry.record || {}, field)) {
        throw idError('ID_DISAMBIGUATOR_FORBIDDEN', 'Entity records cannot author controller ID state', {
          category, field
        });
      }
    }
    entry.prior = prior.byAnchor.get(entry.identityAnchor)
      || prior.byRegistry.get(entry.record?.registry_key)
      || null;
    validatePriorRecord(entry.prior, category);
  }
  const byBase = new Map();
  for (const entry of entries) {
    if (!byBase.has(entry.baseId)) byBase.set(entry.baseId, []);
    byBase.get(entry.baseId).push(entry);
  }
  const assigned = [];
  for (const collisions of byBase.values()) {
    for (const entry of collisions) {
      const needsDisambiguator = collisions.length > 1 || Boolean(entry.prior?.disambiguator);
      const disambiguator = entry.prior?.disambiguator
        || (needsDisambiguator ? alphabeticDigest(`${category}\0${entry.identityAnchor}`, 8) : null);
      const id = entry.prior?.id || `${entry.baseId}${disambiguator ? `_${disambiguator}` : ''}`;
      assigned.push({
        ...entry.record,
        id,
        identity_anchor: entry.prior?.identity_anchor || entry.identityAnchor,
        disambiguator
      });
    }
  }
  return assigned.sort((left, right) => left.id.localeCompare(right.id));
}

function assignStableIds(recordsByCategory, priorRegistry = {}) {
  const assigned = {};
  for (const category of Object.keys(recordsByCategory || {}).sort()) {
    if (!PREFIX[category]) continue;
    assigned[category] = assignCategoryIds(category, recordsByCategory[category], priorRegistry?.[category]);
  }
  return assigned;
}

module.exports = { PREFIX, alphabeticDigest, assignStableIds, identityAnchor, makeBaseId, nameSlug };
