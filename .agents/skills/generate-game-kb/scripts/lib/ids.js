'use strict';

const crypto = require('node:crypto');
const { pinyin } = require('pinyin-pro');

const PREFIX = Object.freeze({
  characters: 'char',
  items: 'item',
  skills: 'skill',
  techniques: 'tech',
  factions: 'faction'
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

function canonicalName(record) {
  return String(record?.name ?? '').normalize('NFKC').trim();
}

function rejectModelAuthoredIdentity(record, category) {
  if (record?.id === undefined && record?.disambiguator === undefined) return;
  throw idError('ID_DISAMBIGUATOR_FORBIDDEN', 'Entity input cannot author a final ID or disambiguator', {
    category,
    name: canonicalName(record)
  });
}

function priorByName(category, priorEntries) {
  const result = new Map();
  for (const entry of Array.isArray(priorEntries) ? priorEntries : []) {
    const name = String(entry?.canonical_name ?? '').normalize('NFKC').trim();
    const issuedId = entry?.issued_id || entry?.id;
    if (!name || typeof issuedId !== 'string' || !issuedId.startsWith(`${PREFIX[category]}_`)) {
      throw idError('ID_PLAN_INVALID', 'Prior ID plan contains an invalid entry', {
        category,
        canonical_name: name,
        issued_id: issuedId
      });
    }
    if (result.has(name)) {
      throw idError('ID_PLAN_INVALID', 'Prior ID plan repeats a canonical name', {
        category,
        canonical_name: name
      });
    }
    result.set(name, { ...entry, issued_id: issuedId });
  }
  return result;
}

function assignCategoryIds(category, records, priorEntries = []) {
  const entries = (Array.isArray(records) ? records : []).map(record => {
    rejectModelAuthoredIdentity(record, category);
    const name = canonicalName(record);
    return { record, canonicalName: name, baseId: makeBaseId(category, name) };
  });

  const namesSeen = new Set();
  for (const entry of entries) {
    if (namesSeen.has(entry.canonicalName)) {
      throw idError('IDENTITY_COLLISION_REVIEW_REQUIRED', `Duplicate same-name records in ${category}`, {
        category,
        name: entry.canonicalName
      });
    }
    namesSeen.add(entry.canonicalName);
  }

  const prior = priorByName(category, priorEntries);
  const byBase = new Map();
  for (const entry of entries) {
    const list = byBase.get(entry.baseId) || [];
    list.push(entry);
    byBase.set(entry.baseId, list);
  }

  const assigned = [];
  const plan = [];
  const issued = new Set();
  for (const [baseId, group] of [...byBase.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const collisions = [...group].sort((left, right) => left.canonicalName.localeCompare(right.canonicalName, 'zh-CN'));
    for (const entry of collisions) {
      const priorEntry = prior.get(entry.canonicalName);
      const collision = collisions.length > 1;
      const suffixInput = `${category}\0${entry.canonicalName}`;
      const generatedId = collision
        ? `${baseId}_${alphabeticDigest(suffixInput, 8)}`
        : baseId;
      const id = priorEntry?.issued_id || generatedId;
      if (issued.has(id)) {
        throw idError('ID_PLAN_COLLISION', 'Stable ID plan issued a duplicate ID', {
          category,
          issued_id: id
        });
      }
      issued.add(id);

      const keptUnhashedPrior = collision && priorEntry?.issued_id === baseId;
      assigned.push({ ...entry.record, name: entry.canonicalName, id });
      plan.push({
        category,
        canonical_name: entry.canonicalName,
        base_id: baseId,
        collision_reason: collision
          ? (keptUnhashedPrior ? 'pinyin_base_collision_prior_id_preserved' : 'pinyin_base_collision')
          : null,
        suffix_input: collision && !keptUnhashedPrior
          ? (priorEntry?.suffix_input || suffixInput)
          : null,
        issued_id: id
      });
    }
  }

  assigned.sort((left, right) => left.id.localeCompare(right.id));
  plan.sort((left, right) => left.issued_id.localeCompare(right.issued_id));
  return { records: assigned, plan };
}

function assignStableIds(recordsByCategory, priorPlan = {}) {
  const assigned = {};
  const idPlan = {};
  for (const category of Object.keys(recordsByCategory || {}).sort()) {
    if (!PREFIX[category]) continue;
    const result = assignCategoryIds(category, recordsByCategory[category], priorPlan?.[category]);
    assigned[category] = result.records;
    idPlan[category] = result.plan;
  }
  return { recordsByCategory: assigned, idPlan };
}

module.exports = { PREFIX, alphabeticDigest, assignStableIds, makeBaseId, nameSlug };
