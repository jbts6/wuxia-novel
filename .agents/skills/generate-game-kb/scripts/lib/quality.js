'use strict';

const crypto = require('node:crypto');

const { isHighPriorityQualityItem } = require('./priority');

const QUOTAS = Object.freeze({ martial: 15, events: 10, characters: 5, items: 5, other: 5 });
const GROUP_ORDER = Object.freeze(Object.keys(QUOTAS));
const FILE_GROUPS = Object.freeze({
  'skills.json': 'martial',
  'techniques.json': 'martial',
  'events.json': 'events',
  'characters.json': 'characters',
  'items.json': 'items',
  'factions.json': 'other',
});

const FIXED_QUOTAS = Object.freeze({
  skills_techniques: 12,
  events: 8,
  characters: 5,
  items: 5,
  chapter_summaries: 2
});
const FIXED_GROUP_FILES = Object.freeze({
  skills_techniques: ['skills.json', 'techniques.json'],
  events: ['events.json'],
  characters: ['characters.json'],
  items: ['items.json'],
  chapter_summaries: ['chapter_summaries.json']
});

function categoryForFile(filename) {
  return filename.replace(/\.json$/, '');
}

function rank(seed, category, id) {
  return crypto.createHash('sha256').update(`${seed}\0${category}\0${id}`).digest('hex');
}

function selectQualitySample(finalData, seed) {
  const pools = Object.fromEntries(GROUP_ORDER.map(group => [group, []]));
  for (const [filename, group] of Object.entries(FILE_GROUPS)) {
    const category = categoryForFile(filename);
    for (const record of Array.isArray(finalData?.[filename]) ? finalData[filename] : []) {
      if (typeof record?.id !== 'string' || record.id === '') continue;
      pools[group].push({
        id: record.id,
        category,
        file: filename,
        group,
        priority: isHighPriorityQualityItem({ category, group }) ? 'hard' : 'soft',
        rank: rank(seed, category, record.id)
      });
    }
  }
  for (const group of GROUP_ORDER) {
    pools[group].sort((left, right) => `${left.rank}\0${left.id}`.localeCompare(`${right.rank}\0${right.id}`));
  }
  const totalAvailable = GROUP_ORDER.reduce((total, group) => total + pools[group].length, 0);
  const target = Math.min(40, totalAvailable);
  const selected = Object.fromEntries(GROUP_ORDER.map(group => [group, pools[group].slice(0, QUOTAS[group])]));
  let selectedCount = GROUP_ORDER.reduce((total, group) => total + selected[group].length, 0);
  for (const group of GROUP_ORDER) {
    if (selectedCount >= target) break;
    const remaining = pools[group].slice(selected[group].length);
    const taken = remaining.slice(0, target - selectedCount);
    selected[group].push(...taken);
    selectedCount += taken.length;
  }
  return GROUP_ORDER.flatMap(group => selected[group].map(({ rank: ignored, ...item }) => item));
}

function buildQualitySample(finalData, reviews = {}, options = {}) {
  const seed = options.seed || reviews.seed || 'fixed';
  const categories = {};
  const items = [];
  for (const [group, quota] of Object.entries(FIXED_QUOTAS)) {
    const pool = [];
    for (const filename of FIXED_GROUP_FILES[group]) {
      for (const record of Array.isArray(finalData?.[filename]) ? finalData[filename] : []) {
        const recordId = filename === 'chapter_summaries.json'
          ? `chapter_summary_${String(record?.chapter ?? '').padStart(3, '0')}`
          : record?.id;
        if (typeof recordId !== 'string' || recordId === '') continue;
        const category = categoryForFile(filename);
        pool.push({
          id: recordId,
          category,
          file: filename,
          group,
          priority: isHighPriorityQualityItem({ category, group }) ? 'hard' : 'soft',
          rank: rank(seed, category, recordId)
        });
      }
    }
    pool.sort((left, right) => `${left.rank}\0${left.id}`.localeCompare(`${right.rank}\0${right.id}`));
    const selected = pool.slice(0, quota).map(({ rank: ignored, ...item }) => item);
    const review = reviews?.[group] || reviews?.[group.split('_')[0]] || null;
    categories[group] = {
      quota,
      count: selected.length,
      kind: pool.length === 0 ? 'empty-review-required' : 'records',
      priority: isHighPriorityQualityItem({ group }) ? 'hard' : 'soft',
      review
    };
    items.push(...selected);
  }
  return {
    schema_version: 1,
    seed,
    quotas: { ...FIXED_QUOTAS },
    categories,
    items,
    total_checks: Object.values(FIXED_QUOTAS).reduce((sum, quota) => sum + quota, 0)
  };
}

function qualityThreshold(size) {
  return size === 40 ? 38 : Math.ceil(size * 0.95);
}

function validateQualityReview(review, sample) {
  const expected = new Map((Array.isArray(sample) ? sample : []).map(item => [item.id, item]));
  const errors = [];
  const results = Array.isArray(review?.results) ? review.results : null;
  if (!review || typeof review !== 'object' || Array.isArray(review) || review.schema_version !== 1) {
    errors.push({ code: 'QUALITY_REVIEW_INVALID', path: '$', target: '' });
  }
  if (!results) {
    errors.push({ code: 'QUALITY_RESULTS_REQUIRED', path: 'results', target: '' });
  }
  const seen = new Set();
  const normalized = [];
  for (const [index, result] of (results || []).entries()) {
    const label = `results[${index}]`;
    if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.id !== 'string') {
      errors.push({ code: 'QUALITY_RESULT_INVALID', path: label, target: '' });
      continue;
    }
    if (seen.has(result.id)) errors.push({ code: 'QUALITY_RESULT_DUPLICATE', path: `${label}.id`, target: result.id });
    seen.add(result.id);
    if (!expected.has(result.id)) errors.push({ code: 'QUALITY_RESULT_UNKNOWN', path: `${label}.id`, target: result.id });
    const checks = result.checks;
    const checkNames = ['name', 'category', 'key_facts', 'chapter'];
    const checksValid = checks && typeof checks === 'object' && !Array.isArray(checks)
      && checkNames.every(name => typeof checks[name] === 'boolean');
    if (!checksValid) errors.push({ code: 'QUALITY_CHECKS_INVALID', path: `${label}.checks`, target: result.id });
    if (typeof result.passed !== 'boolean') {
      errors.push({ code: 'QUALITY_PASS_REQUIRED', path: `${label}.passed`, target: result.id });
    } else if (checksValid && result.passed !== checkNames.every(name => checks[name] === true)) {
      errors.push({ code: 'QUALITY_PASS_INCONSISTENT', path: `${label}.passed`, target: result.id });
    }
    normalized.push({
      id: result.id,
      passed: result.passed === true,
      checks: checksValid ? Object.fromEntries(checkNames.map(name => [name, checks[name]])) : {},
      notes: typeof result.notes === 'string' ? result.notes : ''
    });
  }
  for (const id of expected.keys()) {
    if (!seen.has(id)) errors.push({ code: 'QUALITY_RESULT_MISSING', path: 'results', target: id });
  }
  const passCount = normalized.filter(result => result.passed).length;
  const hardIds = new Set([...expected.entries()]
    .filter(([, item]) => isHighPriorityQualityItem(item))
    .map(([id]) => id));
  const hardResults = normalized.filter(result => hardIds.has(result.id));
  const softResults = normalized.filter(result => expected.has(result.id) && !hardIds.has(result.id));
  const hardPassCount = hardResults.filter(result => result.passed).length;
  const softPassCount = softResults.filter(result => result.passed).length;
  const hardThreshold = qualityThreshold(hardIds.size);
  const warnings = [];
  if (softPassCount < softResults.length) {
    warnings.push({
      code: 'QUALITY_SOFT_SAMPLE_FAILED',
      failed: softResults.length - softPassCount,
      sample_size: softResults.length
    });
  }
  const passed = errors.length === 0 && hardPassCount >= hardThreshold;
  return {
    errors,
    warnings,
    passed,
    pass_count: passCount,
    sample_size: expected.size,
    threshold: hardThreshold,
    hard_pass_count: hardPassCount,
    hard_sample_size: hardIds.size,
    hard_threshold: hardThreshold,
    soft_pass_count: softPassCount,
    soft_sample_size: softResults.length,
    report: {
      schema_version: 1,
      sample_size: expected.size,
      pass_count: passCount,
      threshold: hardThreshold,
      hard_sample_size: hardIds.size,
      hard_pass_count: hardPassCount,
      hard_threshold: hardThreshold,
      soft_sample_size: softResults.length,
      soft_pass_count: softPassCount,
      passed,
      warnings,
      results: normalized.sort((left, right) => left.id.localeCompare(right.id))
    }
  };
}

module.exports = {
  FILE_GROUPS,
  FIXED_QUOTAS,
  GROUP_ORDER,
  QUOTAS,
  buildQualitySample,
  qualityThreshold,
  selectQualitySample,
  validateQualityReview
};
