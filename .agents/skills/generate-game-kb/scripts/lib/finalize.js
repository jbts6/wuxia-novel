'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const {
  ENTITY_CATEGORIES,
  normalizeName,
  validateMergedBook
} = require('./book-contract');
const { atomicWriteJson } = require('./io');
const { assignStableIds } = require('./ids');
const { FINAL_FILES } = require('./semantic-contract');

const CATEGORY_FILES = FINAL_FILES;

function emptyData() {
  return Object.fromEntries(Object.values(CATEGORY_FILES).map(filename => [filename, []]));
}

function uniqueInOrder(values) {
  return [...new Set(values.filter(Boolean))];
}

function copySourceRefs(record) {
  return (Array.isArray(record?.source_refs) ? record.source_refs : []).map(ref => ({ ...ref }));
}

function makeResolver(idPlan, issues, warnings) {
  const indexes = {};
  for (const category of ENTITY_CATEGORIES) {
    const local = new Map();
    const names = new Map();
    for (const record of idPlan[category] || []) {
      if (record.local_key) local.set(record.local_key, record.id);
      if (record.registry_key) local.set(record.registry_key, record.id);
      for (const name of [record.canonical_name, ...(Array.isArray(record.aliases) ? record.aliases : [])]) {
        const normalized = normalizeName(name);
        if (!normalized) continue;
        if (!names.has(normalized)) names.set(normalized, new Set());
        names.get(normalized).add(record.id);
      }
    }
    indexes[category] = { local, names };
  }

  function resolve(category, target, path, { required = true } = {}) {
    if (typeof target !== 'string' || target.trim() === '') return null;
    const index = indexes[category];
    const direct = index?.local.get(target);
    if (direct) return direct;
    const issue = {
      code: 'REFERENCE_UNRESOLVED',
      path,
      target
    };
    issues.push(issue);
    return null;
  }

  function resolveMany(category, targets, path, options) {
    return uniqueInOrder((Array.isArray(targets) ? targets : [])
      .map((target, index) => resolve(category, target, `${path}[${index}]`, options)));
  }

  function resolveAny(categories, target, path, { required = true } = {}) {
    if (typeof target !== 'string' || target.trim() === '') return null;
    const matches = new Set();
    for (const category of categories) {
      const index = indexes[category];
      const direct = index?.local.get(target);
      if (direct) matches.add(direct);
      for (const id of index?.names.get(normalizeName(target)) || []) matches.add(id);
    }
    if (matches.size === 1) return [...matches][0];
    const issue = {
      code: matches.size === 0 ? 'REFERENCE_UNRESOLVED' : 'REFERENCE_AMBIGUOUS',
      path,
      target
    };
    issues.push(issue);
    return null;
  }

  return { resolve, resolveAny, resolveMany };
}

function projectRelationships(record, index, resolver) {
  const raw = Array.isArray(record.relationships) ? record.relationships : record.relationship_names || [];
  return raw.map((relationship, relationshipIndex) => {
    const targetName = typeof relationship === 'string'
      ? relationship
      : relationship?.target_name ?? relationship?.target ?? relationship?.name;
    return {
      target: resolver.resolve(
        'characters', targetName, `characters[${index}].relationships[${relationshipIndex}].target`,
        { required: false }
      ),
      type: typeof relationship === 'object' ? String(relationship.type || '关联') : '关联',
      dynamic: typeof relationship === 'object' ? String(relationship.dynamic || '') : ''
    };
  }).filter(relationship => relationship.target)
    .sort((left, right) => `${left.target}\0${left.type}`.localeCompare(`${right.target}\0${right.type}`));
}

function isGenericSpeakerReference(target) {
  return typeof target === 'string'
    && /(?:家丁|将军|教众|弟子|门人|帮众|官兵|侍卫|随从|士兵|众人|群雄|掌门人?|汉子|苗女|喽啰|仆役)$/u.test(target.trim());
}

function resolveReferences(recordsByCategory, idPlan) {
  const issues = [];
  const warnings = [];
  const resolver = makeResolver(idPlan, issues, warnings);
  const data = emptyData();

  data['characters.yaml'] = (recordsByCategory.characters || []).map((record, index) => {
    const aliases = Array.isArray(record.aliases) ? [...record.aliases] : [];
    const skills = resolver.resolveMany(
      'skills', record.skills, `characters[${index}].skills`, { required: false }
    );
    const factions = resolver.resolveMany(
      'factions', record.factions, `characters[${index}].factions`, { required: false }
    );
    return {
      id: record.id,
      name: record.name,
      aliases,
      identities: Array.isArray(record.identities) ? [...record.identities] : [],
      level: record.level ?? null,
      rank: record.rank ?? null,
      description: record.description ?? null,
      factions,
      skills
    };
  }).sort((left, right) => left.id.localeCompare(right.id));

  data['items.yaml'] = (recordsByCategory.items || []).map((record, index) => ({
    id: record.id,
    name: record.name,
    aliases: Array.isArray(record.aliases) ? [...record.aliases] : [],
    type: record.type ?? null,
    description: record.description ?? null
  })).sort((left, right) => left.id.localeCompare(right.id));

  data['skills.yaml'] = (recordsByCategory.skills || []).map((record, index) => {
    const factions = resolver.resolveMany(
      'factions', record.factions, `skills[${index}].factions`, { required: false }
    );
    return {
      id: record.id,
      name: record.name,
      aliases: Array.isArray(record.aliases) ? [...record.aliases] : [],
      types: Array.isArray(record.types) ? [...record.types] : [],
      factions,
      rank: record.rank ?? null,
      description: record.description ?? null,
      techniques: Array.isArray(record.techniques) ? record.techniques.map(tech => ({
        name: tech.name,
        description: tech.description ?? null
      })) : []
    };
  }).sort((left, right) => left.id.localeCompare(right.id));

  data['factions.yaml'] = (recordsByCategory.factions || []).map((record, index) => ({
    id: record.id,
    name: record.name,
    aliases: Array.isArray(record.aliases) ? [...record.aliases] : [],
    type: record.type ?? null,
    description: record.description ?? null
  })).sort((left, right) => left.id.localeCompare(right.id));

  data['chapter_summaries.yaml'] = (recordsByCategory.chapter_summaries || []).map((record, index) => ({
    chapter: record.chapter,
    title: record.title,
    summary: record.summary
  })).sort((left, right) => left.chapter - right.chapter);

  const deduplicatedIssues = [...new Map(issues.map(issue => [JSON.stringify(issue), issue])).values()]
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const deduplicatedWarnings = [...new Map(warnings.map(warning => [JSON.stringify(warning), warning])).values()]
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return { data, issues: deduplicatedIssues, warnings: deduplicatedWarnings };
}

function buildFinalData(book, manifest, priorRegistry = {}) {
  const contractIssues = validateMergedBook(book, manifest);
  if (contractIssues.length > 0) return { data: emptyData(), issues: contractIssues, warnings: [], id_plan: {} };
  const source = Object.fromEntries(ENTITY_CATEGORIES.map(category => [category, book[category] || []]));
  const idPlan = assignStableIds(source, priorRegistry);
  const projected = resolveReferences({ ...idPlan, chapter_summaries: book.chapter_summaries }, idPlan);
  const serializablePlan = Object.fromEntries(ENTITY_CATEGORIES.map(category => [
    category,
    (idPlan[category] || []).map(record => ({
      id: record.id,
      registry_key: record.registry_key,
      local_key: record.local_key,
      identity_anchor: record.identity_anchor,
      disambiguator: record.disambiguator,
      canonical_name: record.name,
      aliases: Array.isArray(record.aliases) ? [...record.aliases] : []
    }))
  ]));
  return { ...projected, id_plan: serializablePlan };
}

function validateWrittenData(dataRoot) {
  const expected = Object.values(CATEGORY_FILES).sort();
  const actual = fs.readdirSync(dataRoot).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Final data file set is invalid: ${actual.join(', ')}`);
  }
  for (const filename of expected) {
    const parsed = yaml.load(fs.readFileSync(path.join(dataRoot, filename), 'utf8'));
    if (!Array.isArray(parsed)) throw new Error(`Final data file must contain an array: ${filename}`);
  }
}

function writeFinalDataAtomic(paths, result, options = {}) {
  if (result.issues.length > 0) throw new Error('Cannot write final data with unresolved issues');
  const finalRoot = paths.finalRoot || path.dirname(paths.finalData);
  const parent = path.dirname(finalRoot);
  fs.mkdirSync(parent, { recursive: true });
  const nextRoot = fs.mkdtempSync(path.join(parent, `${path.basename(finalRoot)}.next-`));
  const nextData = path.join(nextRoot, path.relative(finalRoot, paths.finalData));
  const nextIdPlan = path.join(nextRoot, path.relative(finalRoot, paths.finalIdPlan));
  const nextAssemblyReport = paths.assemblyReport
    ? path.join(nextRoot, path.relative(finalRoot, paths.assemblyReport))
    : null;
  const previous = `${finalRoot}.previous-${process.pid}-${Date.now()}`;
  let previousMoved = false;
  let nextInstalled = false;
  const maybeFault = point => {
    if (typeof options.injectFault === 'function') options.injectFault(point);
    if (options.faultAt === point) {
      const error = new Error(`Injected final publication fault at ${point}`);
      error.code = 'FINAL_PUBLICATION_FAULT_INJECTED';
      error.point = point;
      throw error;
    }
  };
  try {
    fs.mkdirSync(nextData, { recursive: true });
    for (const filename of Object.values(CATEGORY_FILES)) {
      const records = result.data[filename];
      const yamlContent = yaml.dump(records, { lineWidth: -1, noRefs: true });
      fs.writeFileSync(path.join(nextData, filename), yamlContent, 'utf8');
    }
    validateWrittenData(nextData);
    atomicWriteJson(nextIdPlan, result.id_plan);
    if (nextAssemblyReport && result.assembly_report !== undefined) {
      atomicWriteJson(nextAssemblyReport, result.assembly_report);
    }
    maybeFault('before-old-move');
    if (fs.existsSync(finalRoot)) {
      fs.renameSync(finalRoot, previous);
      previousMoved = true;
    }
    fs.renameSync(nextRoot, finalRoot);
    nextInstalled = true;
    maybeFault('after-new-promote');
    if (previousMoved) fs.rmSync(previous, { recursive: true, force: true });
  } catch (error) {
    fs.rmSync(nextRoot, { recursive: true, force: true });
    if (nextInstalled) fs.rmSync(finalRoot, { recursive: true, force: true });
    if (previousMoved && fs.existsSync(previous)) fs.renameSync(previous, finalRoot);
    throw error;
  }
  return paths.finalData;
}

function writeFinalData(paths, result) {
  return writeFinalDataAtomic(paths, result);
}

module.exports = {
  CATEGORY_FILES,
  buildFinalData,
  emptyData,
  resolveReferences,
  writeFinalData,
  writeFinalDataAtomic
};
