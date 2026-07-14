'use strict';

const crypto = require('node:crypto');

const { ENTITY_CATEGORIES, validateMergedBook } = require('./book-contract');
const { validateMergeDecisionDraft } = require('./category-contract');
const { GameKbError } = require('./errors');
const { MAX_WORK_ITEM_BYTES, WORK_CONTRACT_VERSION } = require('./semantic-work');
const { sha256 } = require('./source');

const CATEGORY_PREFIX = Object.freeze({
  characters: 'character',
  events: 'event',
  items: 'item',
  skills: 'skill',
  techniques: 'technique',
  factions: 'faction',
  locations: 'location',
  dialogues: 'dialogue'
});

function assemblyError(code, message, details = {}) {
  return new GameKbError(code, message, details);
}

function compareText(left, right) {
  const a = String(left ?? '');
  const b = String(right ?? '');
  return a < b ? -1 : a > b ? 1 : 0;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.trim() !== ''))]
    .sort(compareText);
}

function unionSourceRefs(records) {
  const refs = new Map();
  for (const record of records) {
    for (const ref of Array.isArray(record?.source_refs) ? record.source_refs : []) {
      if (!ref || typeof ref !== 'object' || Array.isArray(ref)) continue;
      const key = JSON.stringify(ref);
      if (!refs.has(key)) refs.set(key, structuredClone(ref));
    }
  }
  return [...refs.values()].sort((left, right) =>
    Number(left.chapter) - Number(right.chapter)
    || Number(left.line_start || 0) - Number(right.line_start || 0)
    || compareText(left.text, right.text));
}

function mergeFieldValues(records, overrides = {}) {
  const inherited = {};
  for (const record of records) {
    const fields = record?.fields && typeof record.fields === 'object' ? record.fields : {};
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      if (!(key in inherited)) {
        inherited[key] = structuredClone(value);
      } else if (Array.isArray(inherited[key]) && Array.isArray(value)) {
        inherited[key] = uniqueSorted([...inherited[key], ...value]);
      }
    }
  }
  return { ...inherited, ...structuredClone(overrides || {}) };
}

function bindingRows(bindings) {
  if (Array.isArray(bindings)) return bindings;
  return Array.isArray(bindings?.bindings) ? bindings.bindings : [];
}

function inputSources(workItem) {
  const sources = new Map();
  for (const candidate of Array.isArray(workItem?.candidates) ? workItem.candidates : []) {
    sources.set(candidate.candidate_ref, {
      canonical_name: candidate.name,
      aliases: [],
      fields: candidate.facts || {},
      source_refs: candidate.source_refs || []
    });
  }
  for (const entity of Array.isArray(workItem?.entities) ? workItem.entities : []) {
    sources.set(entity.entity_ref, {
      canonical_name: entity.canonical_name,
      aliases: entity.aliases || [],
      fields: entity.fields || {},
      source_refs: entity.source_refs || []
    });
  }
  return sources;
}

function bindingRef(binding) {
  return binding?.candidate_ref || binding?.entity_ref;
}

function boundSource(binding, visibleSource) {
  if (binding?.source_entity) return binding.source_entity;
  return {
    provisional_key: null,
    category: binding?.category,
    canonical_name: visibleSource?.canonical_name,
    aliases: visibleSource?.aliases || [],
    fields: visibleSource?.fields || {},
    source_refs: visibleSource?.source_refs || [],
    candidate_keys: binding?.candidate_key ? [binding.candidate_key] : binding?.candidate_keys || []
  };
}

function applyMergeDecision(workItem, bindings, draft) {
  const issues = validateMergeDecisionDraft(draft, workItem);
  if (issues.length > 0) {
    throw assemblyError('SEMANTIC_DECISION_INVALID', 'Merge decision draft failed its category contract', {
      unit: workItem?.unit,
      issues
    });
  }
  const rows = bindingRows(bindings);
  const byRef = new Map(rows.map(binding => [bindingRef(binding), binding]));
  const sources = inputSources(workItem);
  const entities = [];
  const resolutions = [];
  const ambiguities = [];
  const entries = [
    ...(Array.isArray(draft.decisions) ? draft.decisions : []),
    ...(Array.isArray(draft.ambiguities) ? draft.ambiguities : [])
  ];

  for (const decision of entries) {
    const members = decision.member_refs.map(ref => {
      const binding = byRef.get(ref);
      if (!binding) {
        throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'A merge ref has no private binding', {
          unit: workItem.unit,
          ref
        });
      }
      return boundSource(binding, sources.get(ref));
    });
    const candidateKeys = uniqueSorted(members.flatMap(member => member.candidate_keys || []));
    if (decision.action === 'merge') {
      const provisionalKey = `${workItem.unit}:${decision.entity_ref}`;
      const inheritedNames = members.map(member => member.canonical_name);
      const canonicalName = decision.canonical_name || inheritedNames.find(Boolean) || decision.fields?.text;
      entities.push({
        provisional_key: provisionalKey,
        category: workItem.category,
        canonical_name: canonicalName,
        aliases: uniqueSorted([
          ...(Array.isArray(decision.aliases) ? decision.aliases : []),
          ...members.flatMap(member => member.aliases || [])
        ]).filter(alias => alias !== canonicalName),
        fields: mergeFieldValues(members, decision.fields),
        source_refs: unionSourceRefs(members),
        candidate_keys: candidateKeys
      });
      resolutions.push(...candidateKeys.map(candidateKey => ({
        candidate_key: candidateKey,
        resolution: 'merged_to',
        provisional_key: provisionalKey
      })));
    } else if (decision.action === 'reject') {
      resolutions.push(...candidateKeys.map(candidateKey => ({
        candidate_key: candidateKey,
        resolution: 'rejected',
        reason: decision.reason,
        detail: decision.detail
      })));
    } else {
      const ambiguity = {
        category: workItem.category,
        name: members.map(member => member.canonical_name).filter(Boolean).join('/'),
        candidates: candidateKeys,
        detail: decision.detail
      };
      ambiguities.push(ambiguity);
      resolutions.push(...candidateKeys.map(candidateKey => ({
        candidate_key: candidateKey,
        resolution: 'ambiguous',
        detail: decision.detail
      })));
    }
  }
  return { category: workItem.category, unit: workItem.unit, entities, resolutions, ambiguities };
}

function createMergeConsolidationWorkItem(projections, descriptor, upstreamHashes = {}) {
  const sourceEntities = projections
    .filter(projection => projection?.category === descriptor?.category)
    .flatMap(projection => projection.entities || [])
    .sort((left, right) =>
      compareText(left.canonical_name, right.canonical_name)
      || compareText(left.provisional_key, right.provisional_key));
  const bindings = sourceEntities.map((entity, index) => ({
    unit: descriptor.unit,
    entity_ref: `e${String(index + 1).padStart(4, '0')}`,
    category: descriptor.category,
    candidate_keys: [...entity.candidate_keys],
    source_entity: structuredClone(entity)
  }));
  const visibleEntities = bindings.map(binding => ({
    entity_ref: binding.entity_ref,
    canonical_name: binding.source_entity.canonical_name,
    aliases: binding.source_entity.aliases
  }));
  const provisional = {
    schema_version: 1,
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: 'merge_decision',
    unit: descriptor.unit,
    category: descriptor.category,
    input_hash: `sha256:${'0'.repeat(64)}`,
    entities: visibleEntities
  };
  const inputHash = sha256(JSON.stringify({
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: 'merge_consolidation',
    unit: descriptor.unit,
    upstream_hashes: Object.fromEntries(Object.entries(upstreamHashes).sort()),
    ai_input: provisional,
    bindings: bindings.map(binding => ({
      entity_ref: binding.entity_ref,
      candidate_keys: binding.candidate_keys,
      source_hash: sha256(JSON.stringify(binding.source_entity))
    }))
  }));
  const input = { ...provisional, input_hash: inputHash };
  const inputBytes = Buffer.byteLength(JSON.stringify(input));
  if (inputBytes > MAX_WORK_ITEM_BYTES) {
    throw assemblyError('WORK_ITEM_TOO_LARGE', 'Consolidation summaries exceed the AI input limit', {
      unit: descriptor.unit,
      input_bytes: inputBytes,
      max_bytes: MAX_WORK_ITEM_BYTES
    });
  }
  return {
    input,
    bindings: {
      schema_version: 1,
      semantic_contract_version: WORK_CONTRACT_VERSION,
      unit: descriptor.unit,
      input_hash: inputHash,
      bindings: bindings.map(binding => ({ ...binding, input_hash: inputHash }))
    }
  };
}

function collisionSuffix(candidateKeys) {
  return crypto.createHash('sha256')
    .update(JSON.stringify([...candidateKeys].sort(compareText)))
    .digest('hex')
    .slice(0, 8);
}

function entityBaseKey(entity) {
  const prefix = CATEGORY_PREFIX[entity.category];
  const name = entity.canonical_name || entity.fields?.text || entity.provisional_key;
  return `${prefix}:${name}`;
}

function assignLocalKeys(entities) {
  const byBase = new Map();
  for (const entity of entities) {
    const base = entityBaseKey(entity);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(entity);
  }
  const localKeyByProvisional = new Map();
  for (const [base, values] of byBase) {
    for (const entity of values) {
      const localKey = values.length === 1
        ? base
        : `${base}#${collisionSuffix(entity.candidate_keys)}`;
      localKeyByProvisional.set(entity.provisional_key, localKey);
    }
  }
  if (new Set(localKeyByProvisional.values()).size !== localKeyByProvisional.size) {
    throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'Controller-generated local keys collided');
  }
  return localKeyByProvisional;
}

function materializeEntity(entity, localKey, eventRefMap = {}) {
  if (entity.category === 'dialogues') {
    const fields = { ...entity.fields };
    const eventRef = fields.event_ref;
    delete fields.event_ref;
    const eventKey = eventRef ? eventRefMap[eventRef] : fields.event_key;
    delete fields.event_key;
    return {
      local_key: localKey,
      event_key: eventKey,
      ...fields,
      source_refs: entity.source_refs
    };
  }
  return {
    local_key: localKey,
    canonical_name: entity.canonical_name,
    aliases: entity.aliases,
    ...entity.fields,
    source_refs: entity.source_refs
  };
}

function projectChapterSummaries(manifest, chapters) {
  const byChapter = new Map((Array.isArray(chapters) ? chapters : [])
    .map(chapter => [chapter?.chapter, chapter]));
  return (Array.isArray(manifest?.chapters) ? manifest.chapters : [])
    .slice()
    .sort((left, right) => left.number - right.number)
    .map(manifestChapter => {
      const chapter = byChapter.get(manifestChapter.number);
      const summary = chapter?.summary;
      if (!summary || typeof summary !== 'object') {
        throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'Accepted chapter summary is missing', {
          chapter: manifestChapter.number
        });
      }
      return {
        chapter: manifestChapter.number,
        title: summary.title || manifestChapter.title,
        summary: summary.summary,
        key_events: Array.isArray(summary.key_events) ? structuredClone(summary.key_events) : [],
        key_characters: Array.isArray(summary.key_characters) ? structuredClone(summary.key_characters) : [],
        source_refs: structuredClone(summary.source_refs || [])
      };
    });
}

function assertResolutionClosure(plan, resolutions) {
  const expected = new Set((plan?.bindings || []).map(binding => binding.candidate_key));
  const counts = new Map();
  for (const resolution of resolutions) {
    counts.set(resolution.candidate_key, (counts.get(resolution.candidate_key) || 0) + 1);
  }
  const invalid = [];
  for (const key of expected) {
    if (counts.get(key) !== 1) invalid.push(key);
  }
  for (const [key, count] of counts) {
    if (!expected.has(key) || count !== 1) invalid.push(key);
  }
  if (invalid.length > 0) {
    throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'Candidate resolution closure is incomplete', {
      invalid_candidate_keys: uniqueSorted(invalid)
    });
  }
}

function assembleMergedBook({
  plan,
  decisions = {},
  consolidation_work_items: consolidationWorkItems = {},
  chapters,
  manifest,
  event_ref_map: eventRefMap = {}
} = {}) {
  const shardProjections = [];
  for (const input of Array.isArray(plan?.inputs) ? plan.inputs : []) {
    const draft = decisions[input.unit];
    if (!draft) {
      throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'A merge shard decision is missing', { unit: input.unit });
    }
    const bindings = (plan.bindings || []).filter(binding => binding.unit === input.unit);
    shardProjections.push(applyMergeDecision(input, bindings, draft));
  }

  const finalEntities = [];
  const finalResolutions = [];
  const ambiguities = [];
  for (const category of ENTITY_CATEGORIES) {
    const categoryProjections = shardProjections.filter(projection => projection.category === category);
    if (categoryProjections.length === 0) continue;
    const descriptor = (plan.consolidations || []).find(value => value.category === category);
    if (descriptor) {
      const work = consolidationWorkItems[descriptor.unit];
      const draft = decisions[descriptor.unit];
      if (!work || !draft) {
        throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'A required consolidation decision is missing', {
          unit: descriptor.unit
        });
      }
      const consolidated = applyMergeDecision(work.input, work.bindings, draft);
      finalEntities.push(...consolidated.entities);
      finalResolutions.push(...consolidated.resolutions);
      ambiguities.push(...consolidated.ambiguities);
      for (const projection of categoryProjections) {
        finalResolutions.push(...projection.resolutions.filter(row => row.resolution !== 'merged_to'));
        ambiguities.push(...projection.ambiguities);
      }
    } else {
      for (const projection of categoryProjections) {
        finalEntities.push(...projection.entities);
        finalResolutions.push(...projection.resolutions);
        ambiguities.push(...projection.ambiguities);
      }
    }
  }

  if (ambiguities.length > 0 || finalResolutions.some(row => row.resolution === 'ambiguous')) {
    throw assemblyError('MERGE_AMBIGUITY_UNRESOLVED', 'Merge ambiguities block deterministic assembly', {
      ambiguities
    });
  }
  assertResolutionClosure(plan, finalResolutions);
  const localKeyByProvisional = assignLocalKeys(finalEntities);
  const categories = Object.fromEntries(ENTITY_CATEGORIES.map(category => [category, []]));
  for (const entity of finalEntities) {
    const localKey = localKeyByProvisional.get(entity.provisional_key);
    categories[entity.category].push(materializeEntity(entity, localKey, eventRefMap));
  }
  for (const category of ENTITY_CATEGORIES) {
    categories[category].sort((left, right) => compareText(left.local_key, right.local_key));
  }
  const candidateResolutions = finalResolutions.map(row => {
    if (row.resolution !== 'merged_to') return { ...row };
    const mergedTo = localKeyByProvisional.get(row.provisional_key);
    if (!mergedTo) {
      throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'A merged candidate has no final local key', {
        candidate_key: row.candidate_key
      });
    }
    return { candidate_key: row.candidate_key, resolution: 'merged_to', merged_to: mergedTo };
  }).sort((left, right) => compareText(left.candidate_key, right.candidate_key));
  const book = {
    schema_version: 1,
    stage: 'merged',
    ...categories,
    chapter_summaries: projectChapterSummaries(manifest, chapters),
    candidate_resolutions: candidateResolutions,
    ambiguities: []
  };
  const errors = validateMergedBook(book, manifest, chapters);
  if (errors.length > 0) {
    throw assemblyError('BOOK_ASSEMBLY_INVALID', 'Deterministically assembled merged book is invalid', { errors });
  }
  return book;
}

module.exports = {
  CATEGORY_PREFIX,
  applyMergeDecision,
  assembleMergedBook,
  assignLocalKeys,
  createMergeConsolidationWorkItem,
  unionSourceRefs
};
