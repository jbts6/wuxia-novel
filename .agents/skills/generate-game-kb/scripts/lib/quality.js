'use strict';

const crypto = require('node:crypto');

const QUOTAS = Object.freeze({ martial: 15, events: 10, characters: 5, items: 5, other: 5 });
const GROUP_ORDER = Object.freeze(Object.keys(QUOTAS));
const FILE_GROUPS = Object.freeze({
  'skills.json': 'martial',
  'techniques.json': 'martial',
  'events.json': 'events',
  'characters.json': 'characters',
  'items.json': 'items',
  'factions.json': 'other',
  'locations.json': 'other',
  'dialogues.json': 'other'
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
  const threshold = qualityThreshold(expected.size);
  const passed = errors.length === 0 && passCount >= threshold;
  return {
    errors,
    passed,
    pass_count: passCount,
    sample_size: expected.size,
    threshold,
    report: {
      schema_version: 1,
      sample_size: expected.size,
      pass_count: passCount,
      threshold,
      passed,
      results: normalized.sort((left, right) => left.id.localeCompare(right.id))
    }
  };
}

module.exports = {
  FILE_GROUPS,
  GROUP_ORDER,
  QUOTAS,
  qualityThreshold,
  selectQualitySample,
  validateQualityReview
};
