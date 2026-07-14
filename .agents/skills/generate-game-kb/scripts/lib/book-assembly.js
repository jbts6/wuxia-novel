'use strict';

const crypto = require('node:crypto');

const { ENTITY_CATEGORIES, validateCleanedBook, validateMergedBook } = require('./book-contract');
const { validateCleanDecisionDraft, validateMergeDecisionDraft } = require('./category-contract');
const { buildCleanObligations, obligationKey } = require('./clean-obligations');
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
  const resolutionByCandidate = new Map(finalResolutions.map(row => [row.candidate_key, row]));
  const resolvedEventRefMap = { ...eventRefMap };
  for (const binding of (plan?.bindings || []).filter(value => value.category === 'events')) {
    const resolution = resolutionByCandidate.get(binding.candidate_key);
    if (resolution?.resolution !== 'merged_to') continue;
    const localKey = localKeyByProvisional.get(resolution.provisional_key);
    if (localKey) resolvedEventRefMap[binding.candidate_ref] = localKey;
  }
  const categories = Object.fromEntries(ENTITY_CATEGORIES.map(category => [category, []]));
  for (const entity of finalEntities) {
    const localKey = localKeyByProvisional.get(entity.provisional_key);
    categories[entity.category].push(materializeEntity(entity, localKey, resolvedEventRefMap));
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

function isProtectedRemoval(binding) {
  const entity = binding?.source_entity || {};
  if (binding?.category === 'skills') return true;
  if (binding?.category === 'techniques' && entity.named_in_source === true) return true;
  return binding?.category === 'characters' && ['核心', '重要'].includes(entity.level);
}

function patchedEntity(source, patch, eventRefMap) {
  const result = structuredClone(source);
  for (const [key, value] of Object.entries(patch || {})) {
    if (key === 'event_ref') {
      result.event_key = eventRefMap?.[value];
    } else {
      result[key] = structuredClone(value);
    }
  }
  return result;
}

function applyCleanDecision(workItem, bindings, draft, options = {}) {
  const issues = validateCleanDecisionDraft(draft, workItem);
  if (issues.length > 0) {
    throw assemblyError('SEMANTIC_DECISION_INVALID', 'Clean decision draft failed its category contract', {
      unit: workItem?.unit,
      issues
    });
  }
  const rows = bindingRows(bindings);
  const byRef = new Map(rows.map(binding => [binding.entity_ref, binding]));
  const records = [];
  const transitions = [];
  const resolvedObligations = [];
  for (const decision of draft.decisions) {
    const binding = byRef.get(decision.entity_ref);
    if (!binding?.source_entity) {
      throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'A clean entity has no private source binding', {
        unit: workItem.unit,
        entity_ref: decision.entity_ref
      });
    }
    if (decision.action === 'drop' && isProtectedRemoval(binding)) {
      throw assemblyError('PROTECTED_ENTITY_REMOVAL', 'A named martial entity or detailed character cannot be dropped', {
        unit: workItem.unit,
        entity_ref: decision.entity_ref,
        local_key: binding.local_key
      });
    }
    resolvedObligations.push(...decision.resolves);
    if (decision.action === 'keep') {
      records.push(structuredClone(binding.source_entity));
      transitions.push({ action: 'keep', source_key: binding.local_key, target_key: binding.local_key });
    } else if (decision.action === 'edit') {
      records.push(patchedEntity(binding.source_entity, decision.patch, options.event_ref_map || {}));
      transitions.push({ action: 'edit', source_key: binding.local_key, target_key: binding.local_key });
    } else if (decision.action === 'merge_into') {
      const target = byRef.get(decision.target_ref);
      if (!target) {
        throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'A clean merge target has no private binding', {
          unit: workItem.unit,
          target_ref: decision.target_ref
        });
      }
      transitions.push({
        action: 'merge_into',
        source_key: binding.local_key,
        target_key: target.local_key,
        source_entity: structuredClone(binding.source_entity)
      });
    } else {
      transitions.push({
        action: 'drop',
        source_key: binding.local_key,
        reason: decision.reason,
        detail: decision.detail
      });
    }
  }
  return {
    category: workItem.category,
    unit: workItem.unit,
    records,
    transitions,
    resolved_obligations: uniqueSorted(resolvedObligations),
    quantity_explanation: draft.quantity_explanation
  };
}

function resolveTransitionTarget(sourceKey, transitions, visiting = new Set()) {
  if (visiting.has(sourceKey)) {
    throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'Clean merge transitions contain a cycle', { source_key: sourceKey });
  }
  const transition = transitions.get(sourceKey);
  if (!transition) {
    throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'Merged entity has no clean transition', { source_key: sourceKey });
  }
  if (transition.action === 'drop') return null;
  if (transition.action !== 'merge_into') return transition.target_key;
  const nextVisiting = new Set(visiting);
  nextVisiting.add(sourceKey);
  return resolveTransitionTarget(transition.target_key, transitions, nextVisiting);
}

function mergeRecordMetadata(target, source, category) {
  target.source_refs = unionSourceRefs([target, source]);
  if (category !== 'dialogues') {
    target.aliases = uniqueSorted([
      ...(target.aliases || []),
      ...(source.aliases || []),
      source.canonical_name
    ]).filter(alias => alias !== target.canonical_name);
  }
}

function migrateCleanResolution(row, transitions) {
  if (row.resolution === 'rejected') return structuredClone(row);
  if (row.resolution !== 'merged_to') {
    return { ...structuredClone(row), resolution: 'ambiguous' };
  }
  const transition = transitions.get(row.merged_to);
  if (!transition) {
    throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'Candidate target has no clean transition', {
      candidate_key: row.candidate_key,
      merged_to: row.merged_to
    });
  }
  const targetKey = resolveTransitionTarget(row.merged_to, transitions);
  if (targetKey) return { candidate_key: row.candidate_key, resolution: 'merged_to', merged_to: targetKey };
  return {
    candidate_key: row.candidate_key,
    resolution: 'rejected',
    reason: transition.reason,
    detail: transition.detail
  };
}

function validateCleanClosure({
  original_obligations: originalObligations = [],
  claimed_obligation_refs: claimedObligationRefs = [],
  cleaned,
  manifest,
  chapters
} = {}) {
  const claimed = new Set(claimedObligationRefs);
  const remaining = buildCleanObligations(cleaned, manifest, chapters);
  const remainingKeys = new Set(remaining.map(obligationKey));
  const originalKeys = new Set(originalObligations.map(obligationKey));
  const errors = [];
  for (const obligation of originalObligations) {
    if (!claimed.has(obligation.obligation_ref) || remainingKeys.has(obligationKey(obligation))) {
      errors.push({
        code: 'CLEAN_OBLIGATION_UNRESOLVED',
        path: obligation.obligation_ref,
        target: obligation.code
      });
    }
  }
  for (const obligation of remaining) {
    if (!originalKeys.has(obligationKey(obligation))) {
      errors.push({
        code: 'CLEAN_OBLIGATION_UNRESOLVED',
        path: obligation.path,
        target: obligation.code
      });
    }
  }
  return { errors, remaining_obligations: remaining };
}

function assembleCleanedBook({
  merged,
  plan,
  decisions = {},
  obligations = [],
  manifest,
  chapters,
  materials = [],
  event_ref_map: eventRefMap = {}
} = {}) {
  const projections = [];
  for (const input of Array.isArray(plan?.inputs) ? plan.inputs : []) {
    const draft = decisions[input.unit];
    if (!draft) {
      throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'A clean category decision is missing', { unit: input.unit });
    }
    const bindings = (plan.bindings || []).filter(binding => binding.unit === input.unit);
    projections.push(applyCleanDecision(input, bindings, draft, { event_ref_map: eventRefMap }));
  }

  const transitions = new Map();
  const recordByKey = new Map();
  for (const projection of projections) {
    for (const transition of projection.transitions) {
      if (transitions.has(transition.source_key)) {
        throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'An entity has multiple clean transitions', {
          source_key: transition.source_key
        });
      }
      transitions.set(transition.source_key, transition);
    }
    for (const record of projection.records) recordByKey.set(record.local_key, record);
  }

  for (const transition of transitions.values()) {
    if (transition.action !== 'merge_into') continue;
    const targetKey = resolveTransitionTarget(transition.source_key, transitions);
    const target = recordByKey.get(targetKey);
    if (!target) {
      throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'A clean merge target does not survive', {
        source_key: transition.source_key,
        target_key: targetKey
      });
    }
    mergeRecordMetadata(target, transition.source_entity, transition.source_entity?.local_key?.split(':')[0] === 'dialogue'
      ? 'dialogues'
      : transition.source_entity?.category);
  }

  const categories = Object.fromEntries(ENTITY_CATEGORIES.map(category => [category, []]));
  for (const [localKey, record] of recordByKey) {
    const binding = (plan.bindings || []).find(value => value.local_key === localKey);
    if (!binding) throw assemblyError('BOOK_ASSEMBLY_INCOMPLETE', 'A surviving clean record lost its category binding', { local_key: localKey });
    categories[binding.category].push(record);
  }
  for (const category of ENTITY_CATEGORIES) {
    categories[category].sort((left, right) => compareText(left.local_key, right.local_key));
  }

  const candidateResolutions = (Array.isArray(merged?.candidate_resolutions) ? merged.candidate_resolutions : [])
    .map(row => migrateCleanResolution(row, transitions))
    .sort((left, right) => compareText(left.candidate_key, right.candidate_key));
  const explanations = projections.map(value => value.quantity_explanation).filter(value => typeof value === 'string' && value.trim() !== '');
  const cleaned = {
    schema_version: 1,
    stage: 'cleaned',
    ...categories,
    chapter_summaries: structuredClone(merged?.chapter_summaries || []),
    candidate_resolutions: candidateResolutions,
    ambiguities: [],
    quantity_review: { consumed: true, explanations },
    game_material_candidates: structuredClone(materials)
  };
  const closure = validateCleanClosure({
    original_obligations: obligations,
    claimed_obligation_refs: projections.flatMap(value => value.resolved_obligations),
    cleaned,
    manifest,
    chapters
  });
  if (closure.errors.length > 0) {
    throw assemblyError('CLEAN_OBLIGATION_UNRESOLVED', 'Cleanup obligations remain after explicit decisions', closure);
  }
  const errors = validateCleanedBook(cleaned, manifest, chapters);
  if (errors.length > 0) {
    throw assemblyError('BOOK_ASSEMBLY_INVALID', 'Deterministically assembled cleaned book is invalid', { errors });
  }
  return cleaned;
}

module.exports = {
  CATEGORY_PREFIX,
  applyCleanDecision,
  applyMergeDecision,
  assembleCleanedBook,
  assembleMergedBook,
  assignLocalKeys,
  createMergeConsolidationWorkItem,
  unionSourceRefs,
  validateCleanClosure
};
