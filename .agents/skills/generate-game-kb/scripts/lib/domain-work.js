'use strict';

const { GameKbError } = require('./errors');
const { DOMAIN_UNITS, POWER_RANK_CONTRACT, SEMANTIC_PROFILE } = require('./semantic-contract');
const {
  WORK_CONTRACT_VERSION,
  semanticInputHash,
  serializedInputBytes
} = require('./semantic-work');

const DOMAIN_DEFINITIONS = Object.freeze(Object.fromEntries(DOMAIN_UNITS.map(unit => {
  const domain = unit.slice('distill:'.length);
  return [domain, Object.freeze([domain])];
})));
const MAX_DOMAIN_WORK_ITEM_BYTES = 512 * 1024;

const DOMAIN_PATCH_FIELDS = Object.freeze({
  characters: Object.freeze([
    'canonical_name', 'aliases', 'level', 'identity', 'rank', 'biography', 'personality',
    'faction', 'relationships'
  ]),
  skills: Object.freeze([
    'canonical_name', 'aliases', 'type', 'rank', 'description', 'faction', 'holder_names',
    'techniques'
  ]),
  items: Object.freeze([
    'canonical_name', 'aliases', 'type', 'description', 'inclusion_reason',
    'holder_names', 'owner_name'
  ]),
  factions: Object.freeze([
    'canonical_name', 'aliases', 'type', 'description', 'member_names'
  ])
});

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'zh-Hans-CN');
}

function sortedHashMap(value) {
  return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => compareText(left, right)));
}

function entryRef(index) {
  return `r${String(index + 1).padStart(6, '0')}`;
}

function visibleFieldName(key) {
  if (key.endsWith('_registry_keys')) return `${key.slice(0, -'_registry_keys'.length)}_refs`;
  if (key.endsWith('_registry_key')) return `${key.slice(0, -'_registry_key'.length)}_ref`;
  return key;
}

function visibleValue(value, refs, key = '') {
  if (Array.isArray(value)) return value.map(item => visibleValue(item, refs, key));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && refs.has(value)) return refs.get(value);
    return value;
  }
  const skipped = new Set(['candidate_key', 'local_key', 'member_refs', 'registry_key', 'normalized_name']);
  return Object.fromEntries(Object.entries(value)
    .filter(([field]) => !skipped.has(field))
    .sort(([left], [right]) => compareText(left, right))
    .map(([field, nested]) => [visibleFieldName(field), visibleValue(nested, refs, field)]));
}

function domainForCategory(category) {
  return Object.entries(DOMAIN_DEFINITIONS).find(([, categories]) => categories.includes(category))?.[0] ?? null;
}

function normalizeSourceFiles(sourceFiles) {
  if (!Array.isArray(sourceFiles)) return [];
  return sourceFiles.map(descriptor => ({
    chapter: descriptor.chapter,
    title: descriptor.title,
    source_file: descriptor.source_file,
    input_hash: descriptor.input_hash
  }));
}

function pendingForDomain(registry, domain, refs) {
  const allowed = new Set(DOMAIN_DEFINITIONS[domain]);
  return (registry.pending || []).map(row => {
    const entries = (row.registry_keys || [])
      .filter(key => allowed.has(String(key).split(':')[1]))
      .map(key => refs.get(key))
      .filter(Boolean)
      .sort(compareText);
    return entries.length === 0 ? null : { reason: row.reason, entry_refs: entries };
  }).filter(Boolean);
}

function createDomainWorkPlan({
  registry,
  source_hash: sourceHash,
  accepted_hashes: acceptedHashes = {},
  source_files: sourceFiles = []
} = {}) {
  if (!registry || typeof registry !== 'object' || !registry.categories || !registry.bindings) {
    throw new GameKbError('DOMAIN_REGISTRY_INVALID', 'Domain planning requires a candidate registry');
  }
  const orderedEntries = [];
  for (const category of Object.values(DOMAIN_DEFINITIONS).flat()) {
    for (const entry of Array.isArray(registry.categories[category]) ? registry.categories[category] : []) {
      orderedEntries.push(entry);
    }
  }
  const refs = new Map(orderedEntries.map((entry, index) => [entry.registry_key, entryRef(index)]));
  const factionRefs = orderedEntries
    .filter(entry => entry.category === 'factions')
    .map(entry => refs.get(entry.registry_key))
    .sort(compareText);
  const inputs = [];
  const bindings = [];

  for (const [domain, categories] of Object.entries(DOMAIN_DEFINITIONS)) {
    const unit = `distill:${domain}`;
    const domainEntries = orderedEntries.filter(entry => categories.includes(entry.category));
    const visibleEntries = domainEntries.map(entry => ({
      entry_ref: refs.get(entry.registry_key),
      category: entry.category,
      canonical_name: entry.canonical_name,
      aliases: structuredClone(entry.aliases || []),
      source_chapters: structuredClone(entry.source_chapters || []),
      source_refs: structuredClone(entry.record?.source_refs || []),
      facts: visibleValue(entry.record || {}, refs)
    }));
    const provisional = {
      schema_version: 1,
      semantic_contract_version: WORK_CONTRACT_VERSION,
      semantic_profile: SEMANTIC_PROFILE,
      stage: 'domain_distill',
      unit,
      domain,
      categories: [...categories],
      quality_tier: 'hard',
      allowed_patch_fields: [...DOMAIN_PATCH_FIELDS[domain]],
      ...(['characters', 'skills'].includes(domain) ? { allowed_faction_refs: [...factionRefs] } : {}),
      ...(['characters', 'skills'].includes(domain) && sourceFiles.length > 0 ? {
        source_files: normalizeSourceFiles(sourceFiles),
        rank_contract: structuredClone(POWER_RANK_CONTRACT)
      } : {}),
      entries: visibleEntries,
      pending: pendingForDomain(registry, domain, refs),
      decision_contract: {
        actions: ['keep', 'merge', 'reject', 'pending'],
        every_entry_exactly_once: true,
        controller_fields_forbidden: true
      }
    };
    const unitBindings = domainEntries.map(entry => ({
      unit,
      entry_ref: refs.get(entry.registry_key),
      registry_key: entry.registry_key,
      category: entry.category,
      member_refs: structuredClone(entry.member_refs || [])
    }));
    const inputHash = semanticInputHash(provisional, unitBindings, acceptedHashes);
    const input = { ...provisional, input_hash: inputHash };
    const inputBytes = serializedInputBytes(input);
    if (inputBytes > MAX_DOMAIN_WORK_ITEM_BYTES) {
      throw new GameKbError('DOMAIN_INPUT_TOO_LARGE', 'A domain work item cannot fit without truncation', {
        unit,
        input_bytes: inputBytes,
        max_bytes: MAX_DOMAIN_WORK_ITEM_BYTES
      });
    }
    inputs.push(input);
    bindings.push(...unitBindings.map(binding => ({ ...binding, input_hash: inputHash })));
  }

  return {
    schema_version: 1,
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: 'domain',
    source_hash: sourceHash,
    upstream_hashes: sortedHashMap(acceptedHashes),
    inputs,
    bindings,
    consolidations: []
  };
}

module.exports = {
  DOMAIN_DEFINITIONS,
  DOMAIN_PATCH_FIELDS,
  MAX_DOMAIN_WORK_ITEM_BYTES,
  createDomainWorkPlan,
  domainForCategory
};
