'use strict';

function addMatch(index, key, value) {
  if (typeof key !== 'string' || key.trim() === '') return;
  if (!index.has(key)) index.set(key, new Set());
  index.get(key).add(value);
}

/** Builds the deterministic canonical/internal/alias indexes used by relation validation. */
function createReferenceIndex(records, options = {}) {
  const getValue = options.getValue || (record => record);
  const getInternalKeys = options.getInternalKeys || (() => []);
  const index = {
    canonical: new Map(),
    internal: new Map(),
    aliases: new Map()
  };

  for (const record of records || []) {
    const value = getValue(record);
    addMatch(index.canonical, record?.name, value);
    for (const key of getInternalKeys(record) || []) {
      addMatch(index.internal, key, value);
    }
    for (const alias of Array.isArray(record?.aliases) ? record.aliases : []) {
      addMatch(index.aliases, alias, value);
    }
  }
  return index;
}

/** Resolves one exact reference with canonical names taking precedence over internal keys and aliases. */
function resolveReference(index, target) {
  const matches = index?.canonical.get(target)
    || index?.internal.get(target)
    || index?.aliases.get(target)
    || new Set();
  if (matches.size === 1) return { status: 'resolved', value: [...matches][0] };
  return {
    status: matches.size === 0 ? 'unresolved' : 'ambiguous',
    value: null
  };
}

module.exports = { createReferenceIndex, resolveReference };
