'use strict';

const { assignLocalKeys } = require('./book-assembly');
const { ENTITY_CATEGORIES, validateMergedBook } = require('./book-contract');
const { mergeRegistryRecords } = require('./candidate-registry');
const { validateDomainDecisionDraft } = require('./domain-contract');
const { GameKbError } = require('./errors');

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'zh-Hans-CN');
}

function uniqueValues(values) {
  const byValue = new Map();
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const marker = JSON.stringify(value);
    if (!byValue.has(marker)) byValue.set(marker, structuredClone(value));
  }
  return [...byValue.entries()].sort(([left], [right]) => compareText(left, right)).map(([, value]) => value);
}

function fail(message, details = {}) {
  throw new GameKbError('DOMAIN_ASSEMBLY_INCOMPLETE', message, details);
}

function privateFieldName(key) {
  if (key.endsWith('_refs')) return `${key.slice(0, -'_refs'.length)}_registry_keys`;
  if (key.endsWith('_ref')) return `${key.slice(0, -'_ref'.length)}_registry_key`;
  return key;
}

function restorePatch(value, registryByRef) {
  if (Array.isArray(value)) return value.map(entry => restorePatch(entry, registryByRef));
  if (!value || typeof value !== 'object') return registryByRef.get(value) || value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    privateFieldName(key),
    restorePatch(nested, registryByRef)
  ]));
}

function acceptedDecisionMap(workPlan, decisions) {
  const inputByUnit = new Map((workPlan?.inputs || []).map(input => [input.unit, input]));
  const bindingByRef = new Map((workPlan?.bindings || []).map(binding => [binding.entry_ref, binding]));
  const draftsByUnit = new Map();
  for (const draft of decisions || []) {
    if (draftsByUnit.has(draft?.unit)) fail('A domain decision document is duplicated', { unit: draft?.unit });
    draftsByUnit.set(draft?.unit, draft);
  }
  const byRegistry = new Map();
  for (const [unit, input] of [...inputByUnit.entries()].sort(([left], [right]) => compareText(left, right))) {
    const draft = draftsByUnit.get(unit);
    if (!draft) fail('A domain decision document is missing', { unit });
    const issues = validateDomainDecisionDraft(draft, input);
    if (issues.length > 0) fail('A domain decision document failed validation', { unit, issues });
    for (const decision of draft.decisions) {
      const binding = bindingByRef.get(decision.entry_ref);
      if (!binding || binding.unit !== unit) fail('A domain entry has no unique private binding', { unit, entry_ref: decision.entry_ref });
      if (byRegistry.has(binding.registry_key)) fail('A registry entry has multiple decisions', { registry_key: binding.registry_key });
      byRegistry.set(binding.registry_key, {
        ...structuredClone(decision),
        registry_key: binding.registry_key,
        category: binding.category
      });
    }
  }
  if (draftsByUnit.size !== inputByUnit.size) fail('Unknown domain decision documents were supplied');
  return { byRegistry, bindingByRef };
}

function resolutionFunction(byRegistry, bindingByRef) {
  const cache = new Map();
  const resolve = (registryKey, stack = []) => {
    if (cache.has(registryKey)) return cache.get(registryKey);
    if (stack.includes(registryKey)) fail('Domain merge decisions contain a cycle', { cycle: [...stack, registryKey] });
    const decision = byRegistry.get(registryKey);
    if (!decision) fail('A registry entry has no decision', { registry_key: registryKey });
    if (decision.action === 'pending') fail('A pending domain decision blocks assembly', { registry_key: registryKey });
    if (decision.action === 'reject') {
      cache.set(registryKey, null);
      return null;
    }
    if (decision.action === 'keep') {
      cache.set(registryKey, registryKey);
      return registryKey;
    }
    const target = bindingByRef.get(decision.target_ref)?.registry_key;
    if (!target) fail('A merge target has no private binding', { registry_key: registryKey, target_ref: decision.target_ref });
    const root = resolve(target, [...stack, registryKey]);
    if (!root) fail('A merge target was rejected', { registry_key: registryKey, target_registry_key: target });
    cache.set(registryKey, root);
    return root;
  };
  return resolve;
}

function registryEntries(registry) {
  return ENTITY_CATEGORIES.flatMap(category => Array.isArray(registry?.categories?.[category])
    ? registry.categories[category]
    : []);
}

function entityRecord(entry, decision, registryByRef) {
  const patch = restorePatch(decision.patch || {}, registryByRef);
  return { ...structuredClone(entry.record || {}), ...patch };
}

function projectChapterSummaries(manifest, chapters, events) {
  const chaptersByNumber = new Map((chapters || []).map(chapter => [chapter.chapter, chapter]));
  return [...(manifest?.chapters || [])].sort((left, right) => left.number - right.number).map(item => {
    const chapterEvents = events.filter(event => (event.source_refs || []).some(ref => ref.chapter === item.number));
    const keyEvents = chapterEvents.map(event => event.canonical_name).filter(Boolean);
    const keyCharacters = uniqueValues(chapterEvents.flatMap(event => event.participant_names || []));
    const refs = uniqueValues(chapterEvents.flatMap(event => (event.source_refs || [])
      .filter(ref => ref.chapter === item.number)));
    const chapter = chaptersByNumber.get(item.number);
    const sourceRefs = refs.length > 0 ? refs : uniqueValues(chapter?.summary?.source_refs || []);
    const summary = chapterEvents.length === 0
      ? '本章未提取到关键事件。'
      : chapterEvents.map(event => event.result
        ? `${event.canonical_name}：${event.result}`
        : event.canonical_name).join('；');
    return {
      chapter: item.number,
      title: item.title,
      summary,
      key_events: keyEvents,
      key_characters: keyCharacters,
      source_refs: sourceRefs
    };
  });
}

function assembleDomainMergedBook({ manifest, chapters, registry, work_plan: workPlan, decisions } = {}) {
  const entries = registryEntries(registry);
  const entryByKey = new Map(entries.map(entry => [entry.registry_key, entry]));
  const registryByRef = new Map((workPlan?.bindings || []).map(binding => [binding.entry_ref, binding.registry_key]));
  const { byRegistry, bindingByRef } = acceptedDecisionMap(workPlan, decisions);
  if (byRegistry.size !== entries.length) fail('Domain decisions do not close the registry', {
    expected: entries.length,
    actual: byRegistry.size
  });
  const resolve = resolutionFunction(byRegistry, bindingByRef);
  const groups = new Map();
  for (const entry of entries) {
    const root = resolve(entry.registry_key);
    if (!root) continue;
    const list = groups.get(root) || [];
    list.push(entry);
    groups.set(root, list);
  }

  const entities = [];
  for (const [rootKey, group] of [...groups.entries()].sort(([left], [right]) => compareText(left, right))) {
    const rootEntry = entryByKey.get(rootKey);
    const ordered = [rootEntry, ...group.filter(entry => entry.registry_key !== rootKey)
      .sort((left, right) => compareText(left.registry_key, right.registry_key))];
    const records = ordered.map(entry => entityRecord(entry, byRegistry.get(entry.registry_key), registryByRef));
    const record = mergeRegistryRecords(records);
    const canonicalName = byRegistry.get(rootKey).patch?.canonical_name || rootEntry.canonical_name;
    const aliases = uniqueValues(ordered.flatMap(entry => [entry.canonical_name, ...(entry.aliases || [])]))
      .filter(alias => alias !== canonicalName);
    const sourceRefs = uniqueValues(ordered.flatMap(entry => entry.record?.source_refs || []))
      .sort((left, right) => (Number(left.chapter) - Number(right.chapter)) || compareText(left.text, right.text));
    const fields = structuredClone(record);
    for (const field of ['candidate_key', 'local_key', 'name', 'canonical_name', 'aliases', 'source_refs']) delete fields[field];
    entities.push({
      provisional_key: rootKey,
      category: rootEntry.category,
      canonical_name: canonicalName,
      aliases,
      fields,
      source_refs: sourceRefs,
      candidate_keys: uniqueValues(ordered.flatMap(entry => entry.member_refs || []))
    });
  }

  const localKeyByRoot = assignLocalKeys(entities);
  const localKeyByRegistry = new Map(entries.map(entry => {
    const root = resolve(entry.registry_key);
    return [entry.registry_key, root ? localKeyByRoot.get(root) : null];
  }));
  const canonicalNameByRegistry = new Map(entries.map(entry => {
    const root = resolve(entry.registry_key);
    const entity = root ? entities.find(value => value.provisional_key === root) : null;
    return [entry.registry_key, entity?.canonical_name ?? null];
  }));
  const categories = Object.fromEntries(ENTITY_CATEGORIES.map(category => [category, []]));
  for (const entity of entities) {
    const fields = structuredClone(entity.fields);
    let record;
    if (entity.category === 'dialogues') {
      const eventRegistryKey = fields.event_registry_key;
      const eventKey = localKeyByRegistry.get(eventRegistryKey);
      if (!eventKey) fail('A dialogue event reference is unresolved', { registry_key: entity.provisional_key, event_registry_key: eventRegistryKey });
      delete fields.event_registry_key;
      record = {
        local_key: localKeyByRoot.get(entity.provisional_key),
        event_key: eventKey,
        ...fields,
        chapter: fields.chapter || entity.source_refs[0]?.chapter,
        source_refs: entity.source_refs
      };
    } else {
      if (entity.category === 'techniques' && fields.source_skill_registry_key) {
        const skillName = canonicalNameByRegistry.get(fields.source_skill_registry_key);
        if (!skillName) fail('A technique skill reference is unresolved', {
          registry_key: entity.provisional_key,
          source_skill_registry_key: fields.source_skill_registry_key
        });
        fields.source_skill_name = skillName;
        delete fields.source_skill_registry_key;
      }
      record = {
        local_key: localKeyByRoot.get(entity.provisional_key),
        canonical_name: entity.canonical_name,
        aliases: entity.aliases,
        ...fields,
        source_refs: entity.source_refs
      };
    }
    categories[entity.category].push(record);
  }
  for (const category of ENTITY_CATEGORIES) categories[category].sort((left, right) => compareText(left.local_key, right.local_key));

  const candidateResolutions = [];
  for (const entry of entries) {
    const decision = byRegistry.get(entry.registry_key);
    const root = resolve(entry.registry_key);
    for (const candidateKey of entry.member_refs || []) {
      candidateResolutions.push(root
        ? { candidate_key: candidateKey, resolution: 'merged_to', merged_to: localKeyByRoot.get(root) }
        : { candidate_key: candidateKey, resolution: 'rejected', reason: decision.reason, detail: decision.detail });
    }
  }
  candidateResolutions.sort((left, right) => compareText(left.candidate_key, right.candidate_key));
  const book = {
    schema_version: 1,
    stage: 'merged',
    ...categories,
    chapter_summaries: projectChapterSummaries(manifest, chapters, categories.events),
    candidate_resolutions: candidateResolutions,
    ambiguities: []
  };
  const errors = validateMergedBook(book, manifest, chapters);
  if (errors.length > 0) fail('The assembled domain book violates the merged book contract', { errors });
  return book;
}

function assembleDomainCleanedBook(merged) {
  const characters = (merged?.characters || []).map(record => {
    const normalized = structuredClone(record);
    if (['核心', '重要'].includes(normalized.level)
      && (!normalized.personality || typeof normalized.personality !== 'object' || Array.isArray(normalized.personality))) {
      normalized.personality = { traits: [], speech_style: '' };
    }
    if (['核心', '重要'].includes(normalized.level)
      && (typeof normalized.biography !== 'string' || normalized.biography.trim() === '')) {
      normalized.biography = String(normalized.identity || normalized.canonical_name || '');
    }
    if (['次要', '龙套', '背景'].includes(normalized.level)) {
      if (typeof normalized.biography === 'string') {
        normalized.biography = [...normalized.biography].slice(0, 200).join('');
      }
      if (Array.isArray(normalized.personality?.traits)) {
        normalized.personality.traits = normalized.personality.traits.slice(0, 2);
      }
    }
    return normalized;
  });
  const materialCategories = new Set(['characters', 'events', 'items', 'skills', 'techniques']);
  const gameMaterials = ENTITY_CATEGORIES.filter(category => materialCategories.has(category))
    .flatMap(category => (merged?.[category] || []).map(record => ({
      material_type: category === 'characters'
        ? '角色原型/彩蛋'
        : category === 'events'
          ? '经典剧情桥段'
          : category === 'items'
            ? '标志性物品'
            : '战斗系统原型',
      source_category: category,
      source_name: record.canonical_name || record.text,
      relevance: '高',
      suggested_use: `${record.canonical_name || record.text}游戏化原型`,
      reason: '来自 fast-domain 重点类别的原文证据记录。'
    })));
  return {
    ...structuredClone(merged),
    characters,
    stage: 'cleaned',
    quantity_review: {
      consumed: true,
      explanations: ['数量只作一次确定性提醒，未为凑数新增条目。']
    },
    game_material_candidates: gameMaterials
  };
}

module.exports = { assembleDomainCleanedBook, assembleDomainMergedBook };
