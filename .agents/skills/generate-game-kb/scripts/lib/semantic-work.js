'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { ENTITY_CATEGORIES, normalizeName } = require('./book-contract');
const { GameKbError } = require('./errors');
const { atomicWriteFile, readJson } = require('./io');
const { sha256 } = require('./source');

const WORK_CONTRACT_VERSION = 2;
const MAX_WORK_ITEM_CANDIDATES = 120;
const MAX_WORK_ITEM_BYTES = 96 * 1024;
const HASH_PLACEHOLDER = `sha256:${'0'.repeat(64)}`;
const MECHANICAL_INPUT_KEY = /^(candidate_key|local_key|id|.*_id|.*_ids|.*_local_key|.*_local_keys)$/;

function shortRef(prefix, index) {
  return `${prefix}${String(index + 1).padStart(4, '0')}`;
}

function compareText(left, right) {
  const a = String(left ?? '');
  const b = String(right ?? '');
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortedHashMap(value) {
  return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => compareText(left, right)));
}

function cloneAiValue(value) {
  if (Array.isArray(value)) return value.map(cloneAiValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !MECHANICAL_INPUT_KEY.test(key))
    .map(([key, entry]) => [key, cloneAiValue(entry)]));
}

function semanticFacts(record, excluded = []) {
  const skipped = new Set(['candidate_key', 'local_key', 'name', 'canonical_name', 'aliases', 'source_refs', ...excluded]);
  return cloneAiValue(Object.fromEntries(Object.entries(record || {}).filter(([key]) => !skipped.has(key))));
}

function serializedInputBytes(value) {
  return Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`);
}

function workItemError(code, message, details = {}) {
  return new GameKbError(code, message, details);
}

function mergeInputShape(category, shard, candidates, requiresConsolidation, inputHash = HASH_PLACEHOLDER) {
  return {
    schema_version: 1,
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: 'merge_decision',
    unit: `merge:${category}:${String(shard).padStart(3, '0')}`,
    category,
    input_hash: inputHash,
    requires_consolidation: requiresConsolidation,
    candidates: candidates.map(member => member.visible)
  };
}

function cleanInputShape(category, shard, entities, obligations, inputHash = HASH_PLACEHOLDER) {
  return {
    schema_version: 1,
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: 'clean_decision',
    unit: `clean:${category}:${String(shard).padStart(3, '0')}`,
    category,
    input_hash: inputHash,
    entities: entities.map(member => member.visible),
    obligations
  };
}

function assertFits(input, unit) {
  const bytes = serializedInputBytes(input);
  if (bytes > MAX_WORK_ITEM_BYTES) {
    throw workItemError('WORK_ITEM_TOO_LARGE', 'A semantic member cannot fit without truncation', {
      unit,
      input_bytes: bytes,
      max_bytes: MAX_WORK_ITEM_BYTES
    });
  }
}

function groupByNormalizedName(members) {
  const groups = [];
  let current = null;
  for (const member of members) {
    if (!current || current.name !== member.normalized_name) {
      current = { name: member.normalized_name, members: [] };
      groups.push(current);
    }
    current.members.push(member);
  }
  return groups;
}

function splitNameGroups(category, groups) {
  const shards = [];
  let current = [];
  let splitGroup = false;

  function fits(members) {
    if (members.length > MAX_WORK_ITEM_CANDIDATES) return false;
    return serializedInputBytes(mergeInputShape(category, shards.length + 1, members, false)) <= MAX_WORK_ITEM_BYTES;
  }

  function flush() {
    if (current.length > 0) shards.push(current);
    current = [];
  }

  for (const group of groups) {
    if (fits([...current, ...group.members])) {
      current.push(...group.members);
      continue;
    }
    flush();
    if (fits(group.members)) {
      current.push(...group.members);
      continue;
    }

    splitGroup = true;
    for (const member of group.members) {
      if (fits([...current, member])) {
        current.push(member);
        continue;
      }
      flush();
      const single = mergeInputShape(category, shards.length + 1, [member], false);
      assertFits(single, single.unit);
      current.push(member);
    }
  }
  flush();
  return { shards, splitGroup };
}

function mergeWorkHash(inputWithoutHash, bindings, acceptedHashes) {
  return sha256(JSON.stringify({
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: 'merge_decision',
    unit: inputWithoutHash.unit,
    accepted_hashes: sortedHashMap(acceptedHashes),
    ai_input: inputWithoutHash,
    bindings: bindings.map(({ unit, ...binding }) => binding)
  }));
}

function createMergeWorkPlan({ chapters, accepted_hashes: acceptedHashes } = {}) {
  const categoryIndex = new Map(ENTITY_CATEGORIES.map((category, index) => [category, index]));
  const members = [];
  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    for (const category of ENTITY_CATEGORIES) {
      for (const candidate of Array.isArray(chapter?.[category]) ? chapter[category] : []) {
        if (typeof candidate?.candidate_key !== 'string' || candidate.candidate_key.trim() === '') {
          throw workItemError('WORK_PLAN_INPUT_INVALID', 'Accepted candidate key is required', {
            category,
            chapter: chapter?.chapter ?? null
          });
        }
        members.push({ category, chapter: chapter?.chapter, candidate });
      }
    }
  }
  members.sort((left, right) =>
    categoryIndex.get(left.category) - categoryIndex.get(right.category)
    || compareText(normalizeName(left.candidate.name), normalizeName(right.candidate.name))
    || Number(left.chapter) - Number(right.chapter)
    || compareText(left.candidate.candidate_key, right.candidate.candidate_key));

  const planned = members.map((member, index) => {
    const candidateRef = shortRef('c', index);
    return {
      category: member.category,
      normalized_name: normalizeName(member.candidate.name),
      visible: {
        candidate_ref: candidateRef,
        name: member.candidate.name,
        chapter: member.chapter,
        source_refs: cloneAiValue(member.candidate.source_refs || []),
        facts: semanticFacts(member.candidate)
      },
      binding: {
        candidate_ref: candidateRef,
        candidate_key: member.candidate.candidate_key,
        category: member.category,
        chapter: member.chapter,
        ...(member.category === 'events' ? { source_local_key: member.candidate.local_key } : {}),
        ...(member.category === 'dialogues' ? { event_local_key: member.candidate.event_local_key } : {})
      }
    };
  });

  const eventRefByChapterKey = new Map(planned
    .filter(member => member.category === 'events')
    .map(member => [
      `${member.binding.chapter}\0${member.binding.source_local_key}`,
      member.binding.candidate_ref
    ]));
  for (const member of planned.filter(value => value.category === 'dialogues')) {
    const eventRef = eventRefByChapterKey.get(`${member.binding.chapter}\0${member.binding.event_local_key}`);
    if (!eventRef) {
      throw workItemError('WORK_PLAN_INPUT_INVALID', 'Dialogue candidate event cannot be bound to a chapter event', {
        candidate_key: member.binding.candidate_key,
        chapter: member.binding.chapter
      });
    }
    member.visible.facts.event_ref = eventRef;
    member.binding.event_ref = eventRef;
  }

  const inputs = [];
  const bindings = [];
  const consolidations = [];
  for (const category of ENTITY_CATEGORIES) {
    const categoryMembers = planned.filter(member => member.category === category);
    if (categoryMembers.length === 0) continue;
    const { shards, splitGroup } = splitNameGroups(category, groupByNormalizedName(categoryMembers));
    const requiresConsolidation = shards.length > 1 || splitGroup;
    const dependencyUnits = [];
    shards.forEach((shardMembers, index) => {
      const provisional = mergeInputShape(category, index + 1, shardMembers, requiresConsolidation);
      const shardBindings = shardMembers.map(member => ({ ...member.binding, unit: provisional.unit }));
      const inputHash = mergeWorkHash(provisional, shardBindings, acceptedHashes);
      const input = { ...provisional, input_hash: inputHash };
      assertFits(input, input.unit);
      inputs.push(input);
      bindings.push(...shardBindings.map(binding => ({ ...binding, input_hash: inputHash })));
      dependencyUnits.push(input.unit);
    });
    if (requiresConsolidation) {
      consolidations.push({
        unit: `merge:${category}:consolidate`,
        category,
        dependency_units: dependencyUnits
      });
    }
  }
  return {
    schema_version: 1,
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: 'merge',
    upstream_hashes: sortedHashMap(acceptedHashes),
    inputs,
    bindings,
    consolidations
  };
}

function cleanBindingsByEntity(merged) {
  const keys = new Map();
  for (const resolution of Array.isArray(merged?.candidate_resolutions) ? merged.candidate_resolutions : []) {
    if (resolution?.resolution !== 'merged_to' || typeof resolution.merged_to !== 'string') continue;
    if (!keys.has(resolution.merged_to)) keys.set(resolution.merged_to, []);
    keys.get(resolution.merged_to).push(resolution.candidate_key);
  }
  for (const values of keys.values()) values.sort(compareText);
  return keys;
}

function visibleObligation(obligation, entityRef) {
  return cloneAiValue({
    obligation_ref: obligation.obligation_ref,
    code: obligation.code,
    entity_ref: entityRef,
    path: obligation.path,
    detail: obligation.detail
  });
}

function cleanWorkHash(inputWithoutHash, bindings, upstreamHashes) {
  return sha256(JSON.stringify({
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: 'clean_decision',
    unit: inputWithoutHash.unit,
    upstream_hashes: sortedHashMap(upstreamHashes),
    ai_input: inputWithoutHash,
    bindings: bindings.map(({ unit, ...binding }) => binding)
  }));
}

function splitCleanMembers(category, members, obligationMap) {
  const shards = [];
  let current = [];
  function obligationsFor(values) {
    return values.flatMap(member => obligationMap.get(member.binding.local_key) || []);
  }
  function fits(values) {
    if (values.length > MAX_WORK_ITEM_CANDIDATES) return false;
    return serializedInputBytes(cleanInputShape(
      category,
      shards.length + 1,
      values,
      obligationsFor(values)
    )) <= MAX_WORK_ITEM_BYTES;
  }
  for (const member of members) {
    if (fits([...current, member])) {
      current.push(member);
      continue;
    }
    if (current.length > 0) shards.push(current);
    current = [];
    const single = cleanInputShape(category, shards.length + 1, [member], obligationsFor([member]));
    assertFits(single, single.unit);
    current.push(member);
  }
  if (current.length > 0) shards.push(current);
  return shards;
}

function createCleanWorkPlan({ merged, merged_hash: mergedHash, obligations = [] } = {}) {
  const candidateKeysByEntity = cleanBindingsByEntity(merged);
  const records = [];
  for (const category of ENTITY_CATEGORIES) {
    for (const record of Array.isArray(merged?.[category]) ? merged[category] : []) {
      if (typeof record?.local_key !== 'string' || record.local_key.trim() === '') {
        throw workItemError('WORK_PLAN_INPUT_INVALID', 'Merged entity local key is required', { category });
      }
      records.push({ category, record });
    }
  }
  records.sort((left, right) =>
    ENTITY_CATEGORIES.indexOf(left.category) - ENTITY_CATEGORIES.indexOf(right.category)
    || compareText(normalizeName(left.record.canonical_name || left.record.text), normalizeName(right.record.canonical_name || right.record.text))
    || compareText(left.record.local_key, right.record.local_key));

  const entityRefByKey = new Map();
  const planned = records.map((entry, index) => {
    const entityRef = shortRef('e', index);
    entityRefByKey.set(entry.record.local_key, entityRef);
    const candidateKeys = candidateKeysByEntity.get(entry.record.local_key) || [];
    return {
      category: entry.category,
      visible: {
        entity_ref: entityRef,
        canonical_name: entry.record.canonical_name,
        aliases: cloneAiValue(entry.record.aliases || []),
        source_refs: cloneAiValue(entry.record.source_refs || []),
        candidate_count: candidateKeys.length,
        obligation_refs: [],
        facts: semanticFacts(entry.record, ['event_key'])
      },
      binding: {
        entity_ref: entityRef,
        local_key: entry.record.local_key,
        category: entry.category,
        candidate_keys: candidateKeys,
        source_entity: structuredClone(entry.record)
      }
    };
  });

  const obligationMap = new Map();
  for (const obligation of Array.isArray(obligations) ? obligations : []) {
    const entityKey = obligation?.entity_key || obligation?.local_key;
    const entityRef = entityRefByKey.get(entityKey);
    if (!entityRef) continue;
    if (!obligationMap.has(entityKey)) obligationMap.set(entityKey, []);
    obligationMap.get(entityKey).push(visibleObligation(obligation, entityRef));
  }
  for (const values of obligationMap.values()) {
    values.sort((left, right) => compareText(left.obligation_ref, right.obligation_ref));
  }
  for (const member of planned) {
    member.visible.obligation_refs = (obligationMap.get(member.binding.local_key) || [])
      .map(obligation => obligation.obligation_ref);
  }

  const upstreamHashes = {
    merged: mergedHash,
    obligations: sha256(JSON.stringify(obligations))
  };
  const inputs = [];
  const bindings = [];
  for (const category of ENTITY_CATEGORIES) {
    const categoryMembers = planned.filter(member => member.category === category);
    if (categoryMembers.length === 0) continue;
    const shards = splitCleanMembers(category, categoryMembers, obligationMap);
    shards.forEach((shardMembers, index) => {
      const visibleObligations = shardMembers.flatMap(member => obligationMap.get(member.binding.local_key) || []);
      const provisional = cleanInputShape(category, index + 1, shardMembers, visibleObligations);
      const shardBindings = shardMembers.map(member => ({ ...member.binding, unit: provisional.unit }));
      const inputHash = cleanWorkHash(provisional, shardBindings, upstreamHashes);
      const input = { ...provisional, input_hash: inputHash };
      assertFits(input, input.unit);
      inputs.push(input);
      bindings.push(...shardBindings.map(binding => ({ ...binding, input_hash: inputHash })));
    });
  }
  return {
    schema_version: 1,
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: 'clean',
    upstream_hashes: sortedHashMap(upstreamHashes),
    inputs,
    bindings,
    consolidations: []
  };
}

function materialSignals(category, record) {
  const fields = {
    characters: ['level', 'identity'],
    events: ['importance'],
    items: ['inclusion_reason', 'type'],
    skills: ['type'],
    techniques: ['named_in_source', 'source_skill_name'],
    factions: ['type'],
    locations: ['region'],
    dialogues: ['speaker_name', 'chapter']
  }[category] || [];
  return cloneAiValue(Object.fromEntries(fields
    .filter(field => record?.[field] !== undefined)
    .map(field => [field, record[field]])));
}

function createMaterialWorkItem({ cleaned, upstream_hashes: upstreamHashes = {} } = {}) {
  const records = ENTITY_CATEGORIES.flatMap(category => (Array.isArray(cleaned?.[category])
    ? cleaned[category].map(record => ({ category, record }))
    : []));
  records.sort((left, right) =>
    ENTITY_CATEGORIES.indexOf(left.category) - ENTITY_CATEGORIES.indexOf(right.category)
    || compareText(left.record.canonical_name || left.record.text, right.record.canonical_name || right.record.text)
    || compareText(left.record.local_key, right.record.local_key));
  const bindings = records.map((entry, index) => ({
    unit: 'clean:materials:001',
    entity_ref: shortRef('m', index),
    source_category: entry.category,
    source_name: entry.record.canonical_name || entry.record.text,
    local_key: entry.record.local_key
  }));
  const provisional = {
    schema_version: 1,
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: 'material_decision',
    unit: 'clean:materials:001',
    input_hash: HASH_PLACEHOLDER,
    catalog: bindings.map((binding, index) => ({
      entity_ref: binding.entity_ref,
      category: binding.source_category,
      name: binding.source_name,
      signals: materialSignals(records[index].category, records[index].record)
    }))
  };
  const inputHash = sha256(JSON.stringify({
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: 'material_decision',
    unit: provisional.unit,
    upstream_hashes: sortedHashMap(upstreamHashes),
    ai_input: provisional,
    bindings
  }));
  const input = { ...provisional, input_hash: inputHash };
  assertFits(input, input.unit);
  return {
    input,
    bindings: {
      schema_version: 1,
      semantic_contract_version: WORK_CONTRACT_VERSION,
      unit: input.unit,
      input_hash: inputHash,
      bindings: bindings.map(binding => ({ ...binding, input_hash: inputHash }))
    }
  };
}

function workRoot(paths, stage) {
  if (stage === 'merge') return paths.mergeWork;
  if (stage === 'clean') return paths.cleanWork;
  throw workItemError('WORK_PLAN_INVALID', 'Unknown semantic work-plan stage', { stage });
}

function unitDirectory(root, unit) {
  if (typeof unit !== 'string'
    || !(/^(merge|clean):(characters|events|items|skills|techniques|factions|locations|dialogues):(\d{3}|consolidate)$/.test(unit)
      || unit === 'clean:materials:001')) {
    throw workItemError('WORK_UNIT_INVALID', 'Semantic work unit is invalid', { unit });
  }
  return path.join(root, unit.replaceAll(':', '_'));
}

function jsonBytes(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function planDocument(plan) {
  return {
    schema_version: 1,
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: plan.stage,
    upstream_hashes: plan.upstream_hashes,
    units: plan.inputs.map(input => ({
      unit: input.unit,
      category: input.category,
      input_hash: input.input_hash,
      input_bytes: serializedInputBytes(input)
    })),
    consolidations: plan.consolidations || []
  };
}

function writeWorkPlan(paths, plan) {
  const root = workRoot(paths, plan?.stage);
  const files = [{ file: path.join(root, 'plan.json'), content: jsonBytes(planDocument(plan)) }];
  for (const input of plan.inputs || []) {
    const directory = unitDirectory(root, input.unit);
    const unitBindings = (plan.bindings || []).filter(binding => binding.unit === input.unit);
    files.push(
      { file: path.join(directory, 'input.json'), content: jsonBytes(input) },
      {
        file: path.join(directory, 'bindings.json'),
        content: jsonBytes({
          schema_version: 1,
          semantic_contract_version: WORK_CONTRACT_VERSION,
          unit: input.unit,
          input_hash: input.input_hash,
          bindings: unitBindings
        })
      }
    );
  }

  for (const entry of files) {
    if (fs.existsSync(entry.file) && fs.readFileSync(entry.file, 'utf8') !== entry.content) {
      throw workItemError('WORK_ITEM_STALE', 'Existing semantic work bytes differ', {
        file: entry.file
      });
    }
  }
  let written = false;
  for (const entry of files) {
    if (fs.existsSync(entry.file)) continue;
    atomicWriteFile(entry.file, entry.content);
    written = true;
  }
  return { written, plan: path.join(root, 'plan.json') };
}

function writeWorkItem(paths, stage, input, bindingsDocument) {
  const root = workRoot(paths, stage);
  const directory = unitDirectory(root, input?.unit);
  const files = [
    { file: path.join(directory, 'input.json'), content: jsonBytes(input) },
    { file: path.join(directory, 'bindings.json'), content: jsonBytes(bindingsDocument) }
  ];
  for (const entry of files) {
    if (fs.existsSync(entry.file) && fs.readFileSync(entry.file, 'utf8') !== entry.content) {
      throw workItemError('WORK_ITEM_STALE', 'Existing semantic work bytes differ', { file: entry.file });
    }
  }
  let written = false;
  for (const entry of files) {
    if (fs.existsSync(entry.file)) continue;
    atomicWriteFile(entry.file, entry.content);
    written = true;
  }
  return { written, input: files[0].file, bindings: files[1].file };
}

function readWorkItem(paths, unit) {
  const stage = unit.startsWith('merge:') ? 'merge' : unit.startsWith('clean:') ? 'clean' : null;
  const directory = unitDirectory(workRoot(paths, stage), unit);
  const inputFile = path.join(directory, 'input.json');
  const bindingsFile = path.join(directory, 'bindings.json');
  if (!fs.existsSync(inputFile) || !fs.existsSync(bindingsFile)) {
    throw workItemError('WORK_ITEM_MISSING', 'Semantic work item is incomplete', { unit });
  }
  const input = readJson(inputFile);
  const bindings = readJson(bindingsFile);
  if (input?.unit !== unit || bindings?.unit !== unit || input?.input_hash !== bindings?.input_hash) {
    throw workItemError('WORK_ITEM_STALE', 'Semantic input and private bindings disagree', { unit });
  }
  return { input, bindings, input_file: inputFile, bindings_file: bindingsFile };
}

function readWorkPlan(paths, stage) {
  const root = workRoot(paths, stage);
  const file = path.join(root, 'plan.json');
  if (!fs.existsSync(file)) {
    throw workItemError('WORK_PLAN_MISSING', 'Semantic work plan is missing', { stage });
  }
  const document = readJson(file);
  if (document?.stage !== stage || !Array.isArray(document.units)) {
    throw workItemError('WORK_PLAN_INVALID', 'Semantic work plan is invalid', { stage });
  }
  const workItems = document.units.map(descriptor => readWorkItem(paths, descriptor.unit));
  for (let index = 0; index < workItems.length; index += 1) {
    if (workItems[index].input.input_hash !== document.units[index].input_hash) {
      throw workItemError('WORK_ITEM_STALE', 'Work item differs from its plan descriptor', {
        unit: document.units[index].unit
      });
    }
  }
  return {
    schema_version: document.schema_version,
    semantic_contract_version: document.semantic_contract_version,
    stage,
    upstream_hashes: document.upstream_hashes,
    inputs: workItems.map(work => work.input),
    bindings: workItems.flatMap(work => work.bindings.bindings || []),
    consolidations: document.consolidations || []
  };
}

module.exports = {
  MAX_WORK_ITEM_BYTES,
  MAX_WORK_ITEM_CANDIDATES,
  WORK_CONTRACT_VERSION,
  createCleanWorkPlan,
  createMaterialWorkItem,
  createMergeWorkPlan,
  readWorkPlan,
  readWorkItem,
  serializedInputBytes,
  shortRef,
  writeWorkItem,
  writeWorkPlan
};
