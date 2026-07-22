'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const {
  ENTITY_CATEGORIES,
  validateMergedBook
} = require('./book-contract');
const { atomicWriteJson } = require('./io');
const { assignStableIds } = require('./ids');
const { createReferenceIndex, resolveReference } = require('./reference-resolution');
const { FINAL_FILES } = require('./semantic-contract');

const CATEGORY_FILES = FINAL_FILES;

function emptyData() {
  return Object.fromEntries(Object.values(CATEGORY_FILES).map(filename => [filename, []]));
}

function uniqueInOrder(values) {
  return [...new Set(values.filter(Boolean))];
}

function makeResolver(recordsByCategory, issues) {
  const indexes = {};

  for (const category of ENTITY_CATEGORIES) {
    indexes[category] = createReferenceIndex(recordsByCategory[category], {
      getValue: record => record.id,
      getInternalKeys: record => [
        record.local_key,
        record.registry_key,
        ...(Array.isArray(record.member_local_keys) ? record.member_local_keys : [])
      ]
    });
  }

  function resolve(category, target, path, options = {}) {
    if (typeof target !== 'string' || target.trim() === '') return null;
    const result = resolveReference(indexes[category], target);
    if (result.status === 'resolved') return result.value;
    const issue = {
      code: result.status === 'unresolved' ? 'REFERENCE_UNRESOLVED' : 'REFERENCE_AMBIGUOUS',
      path,
      target,
      owner_category: options.ownerCategory,
      owner_name: options.ownerName,
      relation_field: options.relationField,
      target_category: category
    };
    issues.push(issue);
    return null;
  }

  function resolveMany(category, targets, path, options) {
    return uniqueInOrder((Array.isArray(targets) ? targets : [])
      .map((target, index) => resolve(category, target, `${path}[${index}]`, options)));
  }

  return { resolve, resolveMany };
}

function byId(left, right) {
  return left.id.localeCompare(right.id);
}

function projectCharacter(record, index, resolver) {
  const owner = { ownerCategory: 'characters', ownerName: record.name };
  return {
    id: record.id,
    name: record.name,
    aliases: Array.isArray(record.aliases) ? [...record.aliases] : [],
    identities: Array.isArray(record.identities) ? [...record.identities] : [],
    level: record.level ?? null,
    rank: record.rank ?? null,
    description: record.description ?? null,
    factions: resolver.resolveMany(
      'factions', record.factions, `characters[${index}].factions`,
      { ...owner, relationField: 'factions' }
    ),
    skills: resolver.resolveMany(
      'skills', record.skills, `characters[${index}].skills`,
      { ...owner, relationField: 'skills' }
    )
  };
}

function projectSkill(record, index, resolver) {
  return {
    id: record.id,
    name: record.name,
    aliases: Array.isArray(record.aliases) ? [...record.aliases] : [],
    types: Array.isArray(record.types) ? [...record.types] : [],
    factions: resolver.resolveMany(
      'factions', record.factions, `skills[${index}].factions`, {
        ownerCategory: 'skills', ownerName: record.name, relationField: 'factions'
      }
    ),
    rank: record.rank ?? null,
    description: record.description ?? null,
    techniques: Array.isArray(record.techniques) ? record.techniques.map(technique => ({
      name: technique.name,
      description: technique.description ?? null
    })) : []
  };
}

function projectTypedEntity(record) {
  return {
    id: record.id,
    name: record.name,
    aliases: Array.isArray(record.aliases) ? [...record.aliases] : [],
    types: Array.isArray(record.types) ? [...record.types] : [],
    description: record.description ?? null
  };
}

function uniqueSortedIssues(values) {
  return [...new Map(values.map(value => [JSON.stringify(value), value])).values()]
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function resolveReferences(recordsByCategory) {
  const issues = [];
  const warnings = [];
  const resolver = makeResolver(recordsByCategory, issues);
  const data = emptyData();

  data['characters.yaml'] = (recordsByCategory.characters || [])
    .map((record, index) => projectCharacter(record, index, resolver)).sort(byId);
  data['items.yaml'] = (recordsByCategory.items || []).map(projectTypedEntity).sort(byId);
  data['skills.yaml'] = (recordsByCategory.skills || [])
    .map((record, index) => projectSkill(record, index, resolver)).sort(byId);
  data['factions.yaml'] = (recordsByCategory.factions || []).map(projectTypedEntity).sort(byId);

  data['chapter_summaries.yaml'] = (recordsByCategory.chapter_summaries || []).map((record, index) => ({
    chapter: record.chapter,
    title: record.title,
    summary: record.summary
  })).sort((left, right) => left.chapter - right.chapter);

  return { data, issues: uniqueSortedIssues(issues), warnings: uniqueSortedIssues(warnings) };
}

function buildFinalData(book, manifest, priorPlan = {}) {
  const contractIssues = validateMergedBook(book, manifest);
  if (contractIssues.length > 0) return { data: emptyData(), issues: contractIssues, warnings: [], id_plan: {} };
  const source = Object.fromEntries(ENTITY_CATEGORIES.map(category => [category, book[category] || []]));
  const assigned = assignStableIds(source, priorPlan);
  const projected = resolveReferences({
    ...assigned.recordsByCategory,
    chapter_summaries: book.chapter_summaries
  });
  return { ...projected, id_plan: assigned.idPlan };
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
