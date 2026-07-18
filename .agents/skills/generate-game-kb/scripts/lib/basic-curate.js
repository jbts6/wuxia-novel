'use strict';

const { mergeRegistryRecords } = require('./candidate-registry');
const { GameKbError } = require('./errors');

const ACTIONS = new Set(['keep', 'merge', 'drop']);
const BASE_FIELDS = new Set(['action', 'registry_key']);
const MERGE_FIELDS = new Set([...BASE_FIELDS, 'target_registry_key']);

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'zh-Hans-CN');
}

function error(code, path, target = '') {
  return { code, path, target };
}

function registryIndex(registry) {
  const entries = new Map();
  for (const [category, values] of Object.entries(registry?.categories || {})) {
    for (const entry of Array.isArray(values) ? values : []) {
      if (typeof entry?.registry_key === 'string' && !entries.has(entry.registry_key)) {
        entries.set(entry.registry_key, { category, entry });
      }
    }
  }
  return entries;
}

function validateBasicCurateDraft(draft, registry) {
  const errors = [];
  const entries = registryIndex(registry);
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return [error('BASIC_CURATE_DRAFT_INVALID', '', 'draft')];
  }
  for (const field of Object.keys(draft)) {
    if (!['schema_version', 'decisions'].includes(field)) {
      errors.push(error('BASIC_CURATE_FIELD_FORBIDDEN', field, field));
    }
  }
  if (draft.schema_version !== 1) {
    errors.push(error('BASIC_CURATE_DRAFT_INVALID', 'schema_version', String(draft.schema_version ?? '')));
  }
  if (!Array.isArray(draft.decisions)) {
    errors.push(error('BASIC_CURATE_DRAFT_INVALID', 'decisions', 'array'));
    return errors;
  }

  const seen = new Set();
  const mergeTargets = new Map();
  const dropped = new Set();
  draft.decisions.forEach((decision, index) => {
    const basePath = `decisions[${index}]`;
    if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
      errors.push(error('BASIC_CURATE_DECISION_INVALID', basePath, 'object'));
      return;
    }
    const action = decision.action;
    const allowedFields = action === 'merge' ? MERGE_FIELDS : BASE_FIELDS;
    for (const field of Object.keys(decision)) {
      if (!allowedFields.has(field)) {
        errors.push(error('BASIC_CURATE_FIELD_FORBIDDEN', `${basePath}.${field}`, field));
      }
    }
    if (!ACTIONS.has(action)) {
      errors.push(error('BASIC_CURATE_ACTION_INVALID', `${basePath}.action`, String(action ?? '')));
    }
    const registryKey = decision.registry_key;
    if (typeof registryKey !== 'string' || !entries.has(registryKey)) {
      errors.push(error('BASIC_CURATE_REFERENCE_UNKNOWN', `${basePath}.registry_key`, String(registryKey ?? '')));
    }
    if (typeof registryKey === 'string') {
      if (seen.has(registryKey)) {
        errors.push(error('BASIC_CURATE_DECISION_DUPLICATE', `${basePath}.registry_key`, registryKey));
      }
      seen.add(registryKey);
      if (action === 'drop') dropped.add(registryKey);
    }
    if (action !== 'merge') return;

    const targetKey = decision.target_registry_key;
    if (typeof targetKey !== 'string' || !entries.has(targetKey)) {
      errors.push(error('BASIC_CURATE_REFERENCE_UNKNOWN', `${basePath}.target_registry_key`, String(targetKey ?? '')));
      return;
    }
    if (registryKey === targetKey) {
      errors.push(error('BASIC_CURATE_MERGE_SELF', `${basePath}.target_registry_key`, targetKey));
    }
    if (entries.has(registryKey) && entries.get(registryKey).category !== entries.get(targetKey).category) {
      errors.push(error('BASIC_CURATE_MERGE_CATEGORY_MISMATCH', `${basePath}.target_registry_key`, targetKey));
    }
    if (typeof registryKey === 'string') mergeTargets.set(registryKey, targetKey);
  });

  for (const [source, target] of mergeTargets) {
    if (dropped.has(target)) {
      errors.push(error('BASIC_CURATE_MERGE_TARGET_DROPPED', 'decisions', `${source}->${target}`));
    }
    const visited = new Set([source]);
    let cursor = target;
    while (mergeTargets.has(cursor)) {
      if (visited.has(cursor)) {
        errors.push(error('BASIC_CURATE_MERGE_CYCLE', 'decisions', source));
        break;
      }
      visited.add(cursor);
      cursor = mergeTargets.get(cursor);
    }
  }
  return errors.sort((left, right) => (
    compareText(left.path, right.path)
    || compareText(left.code, right.code)
    || compareText(left.target, right.target)
  ));
}

function finalMergeTarget(source, mergeTargets) {
  let target = mergeTargets.get(source);
  while (mergeTargets.has(target)) target = mergeTargets.get(target);
  return target;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value))].sort(compareText);
}

function canonicalizeBasicCurateDecisions(decisions) {
  return decisions.map(decision => (decision.action === 'merge'
    ? {
        action: decision.action,
        registry_key: decision.registry_key,
        target_registry_key: decision.target_registry_key
      }
    : { action: decision.action, registry_key: decision.registry_key }))
    .sort((left, right) => (
      compareText(left.registry_key, right.registry_key)
      || compareText(left.action, right.action)
      || compareText(left.target_registry_key || '', right.target_registry_key || '')
    ));
}

function mergeEntries(target, sources) {
  const entries = [target, ...sources].sort((left, right) => compareText(left.registry_key, right.registry_key));
  return {
    ...structuredClone(target),
    aliases: uniqueSorted(entries.flatMap(entry => [entry.canonical_name, ...(entry.aliases || [])]))
      .filter(name => name !== target.canonical_name),
    member_refs: uniqueSorted(entries.flatMap(entry => entry.member_refs || [])),
    record: mergeRegistryRecords(entries.map(entry => entry.record || {}))
  };
}

function applyBasicCurate(registry, decisions) {
  const errors = validateBasicCurateDraft({ schema_version: 1, decisions }, registry);
  if (errors.length > 0) {
    throw new GameKbError('BASIC_CURATE_INVALID', 'Basic curation decisions are invalid', { errors });
  }

  const output = structuredClone(registry);
  const entries = registryIndex(registry);
  const mergeTargets = new Map();
  const removed = new Set();
  for (const decision of decisions) {
    if (decision.action === 'drop') removed.add(decision.registry_key);
    if (decision.action === 'merge') {
      mergeTargets.set(decision.registry_key, decision.target_registry_key);
      removed.add(decision.registry_key);
    }
  }

  const sourcesByTarget = new Map();
  for (const source of [...mergeTargets.keys()].sort(compareText)) {
    const target = finalMergeTarget(source, mergeTargets);
    const sources = sourcesByTarget.get(target) || [];
    sources.push(entries.get(source).entry);
    sourcesByTarget.set(target, sources);
  }

  for (const [category, values] of Object.entries(output.categories || {})) {
    output.categories[category] = values
      .filter(entry => !removed.has(entry.registry_key))
      .map(entry => sourcesByTarget.has(entry.registry_key)
        ? mergeEntries(entry, sourcesByTarget.get(entry.registry_key))
        : entry)
      .sort((left, right) => compareText(left.registry_key, right.registry_key));
  }

  output.bindings = Object.fromEntries(Object.entries(output.bindings || {})
    .filter(([, registryKey]) => !removed.has(registryKey) || mergeTargets.has(registryKey))
    .map(([member, registryKey]) => [
      member,
      mergeTargets.has(registryKey) ? finalMergeTarget(registryKey, mergeTargets) : registryKey
    ])
    .sort(([left], [right]) => compareText(left, right)));
  if (output.stats && typeof output.stats === 'object') {
    const registeredEntries = Object.values(output.categories || {})
      .reduce((sum, values) => sum + values.length, 0);
    if (Object.hasOwn(output.stats, 'registered_entries')) output.stats.registered_entries = registeredEntries;
    if (Number.isInteger(output.stats.input_candidates) && Object.hasOwn(output.stats, 'exact_merges')) {
      output.stats.exact_merges = output.stats.input_candidates - registeredEntries;
    }
  }
  return output;
}

module.exports = {
  applyBasicCurate,
  canonicalizeBasicCurateDecisions,
  validateBasicCurateDraft
};
