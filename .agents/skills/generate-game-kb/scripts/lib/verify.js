'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { ITEM_REASONS } = require('./book-contract');
const { stableHash } = require('./accept');
const { applyBasicCurate, validateBasicCurateDraft } = require('./basic-curate');
const { acceptedArtifactHash, assertAcceptedArtifacts } = require('./candidate-ledger');
const { CANDIDATE_ARRAYS, validateChapterDraft } = require('./chapter-contract');
const { assembleDomainMergedBook, assembleGroundedBook } = require('./domain-assembly');
const { validateDomainDecisionDraft } = require('./domain-contract');
const { hashFinalData, stableValue } = require('./final-data-hash');
const { CATEGORY_FILES } = require('./finalize');
const { atomicWriteJson, readJson, readYaml } = require('./io');
const {
  CHARACTER_LEVELS,
  DOMAIN_UNITS,
  FINAL_FIELDS,
  FINAL_FILES,
  ITEM_TYPES,
  SEMANTIC_CONTRACT_VERSION,
  isPowerRank
} = require('./semantic-contract');
const { readWorkPlan } = require('./semantic-work');

const ID_PATTERN = /^(char|item|skill|faction)_[a-z]+(?:_[a-z]+)*$/;
const FILE_PREFIX = Object.freeze({
  'characters.yaml': 'char_',
  'skills.yaml': 'skill_',
  'items.yaml': 'item_',
  'factions.yaml': 'faction_'
});
const ITEM_INCLUSION_REASONS = new Set(['秘籍', '剧情关键', '高级药毒', '神兵利器', '其他稀有特殊']);

function loadData(dataRoot) {
  const data = {};
  const errors = [];
  for (const filename of Object.values(CATEGORY_FILES)) {
    const file = path.join(dataRoot, filename);
    if (!fs.existsSync(file)) {
      errors.push({ code: 'FINAL_FILE_MISSING', path: filename, target: '' });
      data[filename] = [];
      continue;
    }
    try {
      const content = fs.readFileSync(file, 'utf8');
      const records = yaml.load(content);
      if (!Array.isArray(records)) {
        errors.push({ code: 'FINAL_FILE_NOT_ARRAY', path: filename, target: '' });
        data[filename] = [];
      } else {
        data[filename] = records;
      }
    } catch (error) {
      errors.push({ code: 'FINAL_FILE_YAML_INVALID', path: filename, target: error.message });
      data[filename] = [];
    }
  }
  return { data, errors };
}

function verifyDataRoot(dataRoot, { chapters = [], expectedHash } = {}) {
  const loaded = loadData(dataRoot);
  const finalDataHash = hashFinalData(loaded.data);
  const blockingErrors = [...loaded.errors];
  const expectedFiles = Object.values(FINAL_FILES).sort();
  const actualFiles = fs.existsSync(dataRoot)
    ? fs.readdirSync(dataRoot).sort()
    : [];
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    blockingErrors.push({
      code: 'FINAL_FILE_SET_INVALID',
      path: dataRoot,
      target: actualFiles.join(',')
    });
  }
  for (const [category, filename] of Object.entries(FINAL_FILES)) {
    const expectedFields = [...FINAL_FIELDS[category]].sort();
    loaded.data[filename].forEach((record, index) => {
      const actualFields = record && typeof record === 'object' && !Array.isArray(record)
        ? Object.keys(record).sort()
        : [];
      if (JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
        blockingErrors.push({
          code: 'FINAL_FIELDS_INVALID',
          path: `${filename}[${index}]`,
          target: actualFields.join(',')
        });
      }
    });
  }
  const idSets = {};
  for (const [category, filename] of Object.entries(FINAL_FILES)) {
    if (category === 'chapter_summaries') continue;
    const ids = new Set();
    idSets[category] = ids;
    loaded.data[filename].forEach((record, index) => {
      const label = `${filename}[${index}]`;
      const id = record?.id;
      if (typeof id !== 'string' || !ID_PATTERN.test(id) || !id.startsWith(FILE_PREFIX[filename])) {
        blockingErrors.push({ code: 'FINAL_ID_INVALID', path: `${label}.id`, target: id ?? '' });
      } else if (ids.has(id)) {
        blockingErrors.push({ code: 'FINAL_ID_DUPLICATE', path: `${label}.id`, target: id });
      } else {
        ids.add(id);
      }
      if (category === 'characters') {
        if (!CHARACTER_LEVELS.includes(record?.level)) {
          blockingErrors.push({ code: 'CHARACTER_LEVEL_INVALID', path: `${label}.level`, target: record?.level ?? '' });
        }
        if (!isPowerRank(record?.rank)) {
          blockingErrors.push({ code: 'POWER_RANK_INVALID', path: `${label}.rank`, target: record?.rank ?? '' });
        }
      }
      if (category === 'skills') {
        if (!isPowerRank(record?.rank)) {
          blockingErrors.push({ code: 'POWER_RANK_INVALID', path: `${label}.rank`, target: record?.rank ?? '' });
        }
        if (!Array.isArray(record?.techniques)) {
          blockingErrors.push({ code: 'TECHNIQUES_ARRAY_REQUIRED', path: `${label}.techniques`, target: '' });
        } else {
          record.techniques.forEach((technique, techniqueIndex) => {
            if (typeof technique?.name !== 'string' || technique.name.trim() === '') {
              blockingErrors.push({
                code: 'TECHNIQUE_NAME_REQUIRED',
                path: `${label}.techniques[${techniqueIndex}].name`,
                target: ''
              });
            }
          });
        }
      }
      if (category === 'items' && !ITEM_TYPES.includes(record?.type)) {
        blockingErrors.push({ code: 'ITEM_TYPE_INVALID', path: `${label}.type`, target: record?.type ?? '' });
      }
    });
  }

  const reference = (category, value, referencePath) => {
    if (value === null || value === undefined || value === '') return;
    if (typeof value !== 'string' || !idSets[category].has(value)) {
      blockingErrors.push({ code: 'FINAL_REFERENCE_MISSING', path: referencePath, target: value ?? '' });
    }
  };
  loaded.data[FINAL_FILES.characters].forEach((record, index) => {
    reference('factions', record?.faction, `characters.yaml[${index}].faction`);
    if (!Array.isArray(record?.skills)) {
      blockingErrors.push({ code: 'FINAL_REFERENCE_ARRAY_REQUIRED', path: `characters.yaml[${index}].skills`, target: '' });
    } else {
      record.skills.forEach((value, refIndex) => reference('skills', value, `characters.yaml[${index}].skills[${refIndex}]`));
    }
    if (!Array.isArray(record?.items)) {
      blockingErrors.push({ code: 'FINAL_REFERENCE_ARRAY_REQUIRED', path: `characters.yaml[${index}].items`, target: '' });
    } else {
      record.items.forEach((value, refIndex) => reference('items', value, `characters.yaml[${index}].items[${refIndex}]`));
    }
  });
  loaded.data[FINAL_FILES.skills].forEach((record, index) => {
    reference('factions', record?.faction, `skills.yaml[${index}].faction`);
  });

  const requiredChapters = new Set(chapters.map(chapter => (
    Number.isInteger(chapter) ? chapter : chapter?.number
  )).filter(Number.isInteger));
  const summaryChapters = new Set();
  loaded.data[FINAL_FILES.chapter_summaries].forEach((summary, index) => {
    const label = `chapter_summaries.yaml[${index}]`;
    if (!Number.isInteger(summary?.chapter) || summary.chapter < 1) {
      blockingErrors.push({ code: 'SUMMARY_CHAPTER_INVALID', path: `${label}.chapter`, target: summary?.chapter ?? '' });
    } else if (summaryChapters.has(summary.chapter)) {
      blockingErrors.push({ code: 'SUMMARY_CHAPTER_DUPLICATE', path: `${label}.chapter`, target: summary.chapter });
    } else {
      summaryChapters.add(summary.chapter);
    }
    if (typeof summary?.title !== 'string' || summary.title.trim() === '') {
      blockingErrors.push({ code: 'SUMMARY_TITLE_REQUIRED', path: `${label}.title`, target: '' });
    }
    if (typeof summary?.summary !== 'string' || summary.summary.trim() === '') {
      blockingErrors.push({ code: 'SUMMARY_TEXT_REQUIRED', path: `${label}.summary`, target: '' });
    }
  });
  for (const chapter of requiredChapters) {
    if (!summaryChapters.has(chapter)) {
      blockingErrors.push({ code: 'SUMMARY_CHAPTER_MISSING', path: 'chapter_summaries.yaml', target: chapter });
    }
  }
  if (expectedHash && expectedHash !== finalDataHash) {
    blockingErrors.push({
      code: 'FINAL_DATA_HASH_MISMATCH',
      path: dataRoot,
      target: `${expectedHash} != ${finalDataHash}`
    });
  }
  const counts = Object.fromEntries(Object.entries(FINAL_FILES)
    .map(([category, filename]) => [category, loaded.data[filename].length]));
  return {
    passed: blockingErrors.length === 0,
    final_data_hash: finalDataHash,
    counts,
    blocking_errors: blockingErrors,
    warnings: []
  };
}

function inspectWorkspaceFinal(paths, { chapters = [], expectedHash } = {}) {
  return verifyDataRoot(paths.finalData, { chapters, expectedHash });
}

function acceptedChapterDraft(chapter) {
  const draft = structuredClone(chapter);
  for (const category of CANDIDATE_ARRAYS) {
    draft[category] = (draft[category] || []).map(record => {
      const value = { ...record };
      delete value.candidate_key;
      return value;
    });
  }
  return draft;
}

function verificationError(error, fallbackPath) {
  return {
    code: error?.code || 'WORKSPACE_EVIDENCE_INVALID',
    path: fallbackPath,
    target: error?.message || String(error)
  };
}

function candidateTotal(registry) {
  return Object.values(registry?.categories || {}).flatMap(entries => entries || [])
    .reduce((total, entry) => total + (Array.isArray(entry.member_refs) ? entry.member_refs.length : 0), 0);
}

function verifyFinalV4(paths) {
  const blockingErrors = [];
  const warnings = [];
  let manifest;
  try {
    manifest = readJson(paths.manifest);
  } catch (error) {
    return {
      passed: false,
      final_data_hash: null,
      counts: {},
      blocking_errors: [verificationError(error, paths.manifest)],
      warnings
    };
  }

  const portable = verifyDataRoot(paths.finalData, { chapters: manifest.chapters });
  blockingErrors.push(...portable.blocking_errors);
  warnings.push(...portable.warnings);

  try {
    assertAcceptedArtifacts(paths);
  } catch (error) {
    blockingErrors.push(verificationError(error, paths.artifactManifest));
  }

  const acceptedHashes = {};
  const chapters = [];
  for (const chapter of manifest.chapters || []) {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const file = path.join(paths.chapters, `ch_${String(chapter.number).padStart(3, '0')}.yaml`);
    try {
      acceptedHashes[unit] = acceptedArtifactHash(paths, file);
      const accepted = readYaml(file);
      chapters.push(accepted);
      const issues = validateChapterDraft(acceptedChapterDraft(accepted), {
        number: chapter.number,
        inputHash: chapter.input_hash
      });
      blockingErrors.push(...issues.map(issue => ({
        ...issue,
        path: `${unit}.${issue.path}`
      })));
    } catch (error) {
      blockingErrors.push(verificationError(error, file));
    }
  }

  let plan = null;
  let registry = null;
  let assembledBook = null;
  const decisionHashes = {};
  try {
    plan = readWorkPlan(paths, 'domain');
    const units = (plan.inputs || []).map(input => input.unit);
    if (JSON.stringify(units) !== JSON.stringify(DOMAIN_UNITS)) {
      blockingErrors.push({ code: 'DOMAIN_PLAN_INVALID', path: paths.domainWork, target: units.join(',') });
    }
    const decisions = [];
    for (const input of plan.inputs || []) {
      const file = path.join(paths.domainDecisions, `${input.unit.replaceAll(':', '_')}.yaml`);
      decisionHashes[input.unit] = acceptedArtifactHash(paths, file);
      const decision = readYaml(file);
      decisions.push(decision);
      blockingErrors.push(...validateDomainDecisionDraft(decision, input).map(issue => ({
        ...issue,
        path: `${input.unit}.${issue.path}`
      })));
    }
    acceptedArtifactHash(paths, paths.candidateRegistry);
    registry = readJson(paths.candidateRegistry);
    assembledBook = assembleDomainMergedBook({
      manifest,
      chapters,
      registry,
      work_plan: plan,
      decisions
    });
    assembledBook.items.forEach((item, index) => {
      if (!ITEM_REASONS.has(item.inclusion_reason)) {
        blockingErrors.push({
          code: 'ITEM_NOT_IMPORTANT',
          path: `assembled.items[${index}].inclusion_reason`,
          target: item.canonical_name
        });
      }
    });
  } catch (error) {
    blockingErrors.push(verificationError(error, paths.domainWork));
  }

  let assemblyReport = null;
  try {
    assemblyReport = readJson(paths.assemblyReport);
  } catch (error) {
    blockingErrors.push(verificationError(error, paths.assemblyReport));
  }
  if (assemblyReport) {
    const expectedCounts = Object.fromEntries(Object.entries(FINAL_FILES)
      .map(([category, filename]) => [filename, portable.counts[category]]));
    const checks = [
      ['ASSEMBLY_CONTRACT_STALE', assemblyReport.semantic_contract_version, SEMANTIC_CONTRACT_VERSION],
      ['ASSEMBLY_SOURCE_STALE', assemblyReport.source_hash, manifest.source_hash],
      ['ASSEMBLY_ACCEPTED_HASH_STALE', stableValue(assemblyReport.accepted_hashes), stableValue(acceptedHashes)],
      ['ASSEMBLY_DECISION_HASH_STALE', stableValue(assemblyReport.decision_hashes), stableValue(decisionHashes)],
      ['ASSEMBLY_FINAL_HASH_STALE', assemblyReport.final_data_hash, portable.final_data_hash],
      ['ASSEMBLY_COUNTS_STALE', stableValue(assemblyReport.counts), stableValue(expectedCounts)],
      ['ASSEMBLY_CANDIDATE_COUNT_STALE', assemblyReport.candidate_count, registry ? candidateTotal(registry) : null],
      [
        'ASSEMBLY_RESOLUTION_COUNT_STALE',
        assemblyReport.candidate_resolution_count,
        assembledBook ? assembledBook.candidate_resolutions.length : null
      ]
    ];
    for (const [code, actual, expected] of checks) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        blockingErrors.push({ code, path: paths.assemblyReport, target: '' });
      }
    }
  }

  try {
    const manual = readJson(paths.manualReview);
    if (!Array.isArray(manual) || manual.length > 0) {
      blockingErrors.push({
        code: 'MANUAL_REVIEW_BLOCKS_FINAL',
        path: paths.manualReview,
        target: Array.isArray(manual) ? manual.length : ''
      });
    }
  } catch (error) {
    blockingErrors.push(verificationError(error, paths.manualReview));
  }

  const deduplicated = [...new Map(blockingErrors.map(issue => [JSON.stringify(issue), issue])).values()];
  const result = {
    passed: deduplicated.length === 0,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    source_hash: manifest.source_hash,
    final_data_hash: portable.final_data_hash,
    counts: portable.counts,
    blocking_errors: deduplicated,
    warnings
  };
  if (result.passed) {
    fs.mkdirSync(paths.finalReports, { recursive: true });
    atomicWriteJson(paths.verificationReport, result);
  }
  return result;
}

function verifyFinalV5(paths) {
  const blockingErrors = [];
  const warnings = [];
  let manifest;
  try {
    manifest = readJson(paths.manifest);
  } catch (error) {
    return {
      passed: false,
      final_data_hash: null,
      counts: {},
      blocking_errors: [verificationError(error, paths.manifest)],
      warnings
    };
  }

  const portable = verifyDataRoot(paths.finalData, { chapters: manifest.chapters });
  blockingErrors.push(...portable.blocking_errors);
  try {
    assertAcceptedArtifacts(paths);
  } catch (error) {
    blockingErrors.push(verificationError(error, paths.artifactManifest));
  }

  const acceptedHashes = {};
  const chapters = [];
  for (const chapter of manifest.chapters || []) {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const file = path.join(paths.chapters, `ch_${String(chapter.number).padStart(3, '0')}.yaml`);
    try {
      acceptedHashes[unit] = acceptedArtifactHash(paths, file);
      const accepted = readYaml(file);
      chapters.push(accepted);
      blockingErrors.push(...validateChapterDraft(acceptedChapterDraft(accepted), {
        number: chapter.number,
        inputHash: chapter.input_hash
      }).map(issue => ({ ...issue, path: `${unit}.${issue.path}` })));
    } catch (error) {
      blockingErrors.push(verificationError(error, file));
    }
  }

  let registry = null;
  let assembledBook = null;
  let registryHash = null;
  try {
    registryHash = acceptedArtifactHash(paths, paths.candidateRegistry);
    registry = readJson(paths.candidateRegistry);
    let effectiveRegistry = registry;
    const curatePath = path.join(path.dirname(paths.candidateRegistry), 'basic-curate.json');
    if (fs.existsSync(curatePath)) {
      acceptedArtifactHash(paths, curatePath);
      const curate = readJson(curatePath);
      const curateIssues = validateBasicCurateDraft(curate, registry);
      if (curateIssues.length > 0 || curate.input_hash !== stableHash(registry)) {
        blockingErrors.push({ code: 'BASIC_CURATE_ACCEPTED_INVALID', path: curatePath, target: '' });
      } else {
        effectiveRegistry = applyBasicCurate(registry, curate.decisions);
        if (curate.curated_registry_hash !== stableHash(effectiveRegistry)) {
          blockingErrors.push({ code: 'BASIC_CURATE_ACCEPTED_INVALID', path: curatePath, target: '' });
        }
      }
    }
    assembledBook = assembleGroundedBook({
      manifest,
      chapters,
      registry: effectiveRegistry,
      source_registry: registry
    });
  } catch (error) {
    blockingErrors.push(verificationError(error, paths.candidateRegistry));
  }

  let assemblyReport = null;
  try {
    assemblyReport = readJson(paths.assemblyReport);
  } catch (error) {
    blockingErrors.push(verificationError(error, paths.assemblyReport));
  }
  if (assemblyReport) {
    const expectedCounts = Object.fromEntries(Object.entries(FINAL_FILES)
      .map(([category, filename]) => [filename, portable.counts[category]]));
    const checks = [
      ['ASSEMBLY_CONTRACT_STALE', assemblyReport.semantic_contract_version, SEMANTIC_CONTRACT_VERSION],
      ['ASSEMBLY_SOURCE_STALE', assemblyReport.source_hash, manifest.source_hash],
      ['ASSEMBLY_ACCEPTED_HASH_STALE', stableValue(assemblyReport.accepted_hashes), stableValue(acceptedHashes)],
      ['ASSEMBLY_REGISTRY_HASH_STALE', assemblyReport.registry_hash, registryHash],
      ['ASSEMBLY_FINAL_HASH_STALE', assemblyReport.final_data_hash, portable.final_data_hash],
      ['ASSEMBLY_COUNTS_STALE', stableValue(assemblyReport.counts), stableValue(expectedCounts)],
      ['ASSEMBLY_CANDIDATE_COUNT_STALE', assemblyReport.candidate_count, registry ? candidateTotal(registry) : null],
      ['ASSEMBLY_RESOLUTION_COUNT_STALE', assemblyReport.candidate_resolution_count,
        assembledBook ? assembledBook.candidate_resolutions.length : null]
    ];
    for (const [code, actual, expected] of checks) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        blockingErrors.push({ code, path: paths.assemblyReport, target: '' });
      }
    }
  }

  try {
    const manual = readJson(paths.manualReview);
    if (!Array.isArray(manual) || manual.length > 0) {
      blockingErrors.push({ code: 'MANUAL_REVIEW_BLOCKS_FINAL', path: paths.manualReview, target: '' });
    }
  } catch (error) {
    blockingErrors.push(verificationError(error, paths.manualReview));
  }

  const deduplicated = [...new Map(blockingErrors.map(issue => [JSON.stringify(issue), issue])).values()];
  const result = {
    passed: deduplicated.length === 0,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    source_hash: manifest.source_hash,
    final_data_hash: portable.final_data_hash,
    counts: portable.counts,
    blocking_errors: deduplicated,
    warnings
  };
  if (result.passed) {
    fs.mkdirSync(paths.finalReports, { recursive: true });
    atomicWriteJson(paths.verificationReport, result);
  }
  return result;
}

function verifyFinal(paths, options = {}) {
  const profile = options.profile || readJson(paths.runJson).profile || 'v4';
  return profile === 'v5' ? verifyFinalV5(paths) : verifyFinalV4(paths);
}

module.exports = {
  ID_PATTERN,
  hashFinalData,
  inspectWorkspaceFinal,
  loadData,
  verifyDataRoot,
  verifyFinal
};
