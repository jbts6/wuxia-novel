'use strict';

const crypto = require('node:crypto');
const { pinyin } = require('pinyin-pro');

const PREFIX = Object.freeze({
  characters: 'char',
  events: 'event',
  items: 'item',
  skills: 'skill',
  techniques: 'tech',
  factions: 'faction',
  locations: 'loc',
  dialogues: 'dialogue'
});
const HEX_LETTERS = 'abcdefghijklmnop';

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

function assignCategoryIds(category, records) {
  const entries = (Array.isArray(records) ? records : []).map(record => ({
    record,
    canonicalName: String(record?.canonical_name ?? record?.name ?? '').trim(),
    baseId: makeBaseId(category, record?.canonical_name ?? record?.name)
  }));
  const byBase = new Map();
  for (const entry of entries) {
    if (!byBase.has(entry.baseId)) byBase.set(entry.baseId, []);
    byBase.get(entry.baseId).push(entry);
  }
  const assigned = [];
  for (const collisions of byBase.values()) {
    const canonicalCounts = new Map();
    for (const entry of collisions) {
      canonicalCounts.set(entry.canonicalName, (canonicalCounts.get(entry.canonicalName) || 0) + 1);
    }
    for (const entry of collisions) {
      let id = entry.baseId;
      if (collisions.length > 1) {
        const duplicateName = canonicalCounts.get(entry.canonicalName) > 1;
        const discriminator = duplicateName ? `\0${String(entry.record?.local_key ?? '')}` : '';
        const suffix = alphabeticDigest(`${category}\0${entry.canonicalName}${discriminator}`, 8);
        id = `${entry.baseId}_${suffix}`;
      }
      assigned.push({ ...entry.record, id });
    }
  }
  return assigned.sort((left, right) => left.id.localeCompare(right.id));
}

function assignStableIds(recordsByCategory) {
  const assigned = {};
  for (const category of Object.keys(recordsByCategory || {}).sort()) {
    if (!PREFIX[category]) continue;
    assigned[category] = assignCategoryIds(category, recordsByCategory[category]);
  }
  return assigned;
}

module.exports = { PREFIX, alphabeticDigest, assignStableIds, makeBaseId, nameSlug };
