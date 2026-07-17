'use strict';

const { REJECTION_REASONS: DOMAIN_REJECTION_REASONS } = require('./domain-contract');
const { isPowerRank } = require('./semantic-contract');

const ENTITY_CATEGORIES = Object.freeze([
  'characters',
  'skills',
  'items',
  'factions'
]);
const BOOK_CATEGORIES = Object.freeze([...ENTITY_CATEGORIES, 'chapter_summaries']);
const CHARACTER_LEVELS = new Set(['核心', '重要', '次要', '龙套', '背景']);
const ITEM_REASONS = new Set(['秘籍', '剧情关键', '高级药毒', '神兵利器', '其他稀有特殊']);
const RESOLUTIONS = new Set(['merged_to', 'rejected']);
const REJECTION_REASONS = new Set(Object.values(DOMAIN_REJECTION_REASONS).flat());

function issue(code, path, target = '') {
  return { code, path, target };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeName(name) {
  return String(name ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/^[《〈「『【〔〖（(]+/u, '')
    .replace(/[》〉」』】〕〗）)]+$/u, '')
    .replace(/\s+/gu, '')
    .toLowerCase();
}

function groupCandidates(chapters) {
  const grouped = Object.fromEntries(ENTITY_CATEGORIES.map(category => [category, []]));
  for (const category of ENTITY_CATEGORIES) {
    const byName = new Map();
    for (const chapter of Array.isArray(chapters) ? chapters : []) {
      for (const candidate of Array.isArray(chapter?.[category]) ? chapter[category] : []) {
        const normalizedName = normalizeName(candidate?.name);
        if (!normalizedName) continue;
        if (!byName.has(normalizedName)) byName.set(normalizedName, []);
        byName.get(normalizedName).push(candidate);
      }
    }
    grouped[category] = [...byName.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
      .map(([normalizedName, candidates]) => {
        const identities = new Set(candidates
          .map(candidate => normalizeName(candidate?.identity))
          .filter(Boolean));
        return {
          normalized_name: normalizedName,
          ambiguous: identities.size > 1,
          candidates
        };
      });
  }
  return grouped;
}

function validateSourceRefs(record, label, chapterNumbers, errors, expectedChapter) {
  if (!Array.isArray(record?.source_refs) || record.source_refs.length === 0) {
    errors.push(issue('SOURCE_REFS_REQUIRED', `${label}.source_refs`));
    return;
  }
  record.source_refs.forEach((ref, index) => {
    const refPath = `${label}.source_refs[${index}]`;
    if (!isObject(ref)) {
      errors.push(issue('SOURCE_REF_INVALID', refPath));
      return;
    }
    if (!chapterNumbers.has(ref.chapter)) {
      errors.push(issue('SOURCE_CHAPTER_UNKNOWN', `${refPath}.chapter`, ref.chapter));
    }
    if (expectedChapter !== undefined && ref.chapter !== expectedChapter) {
      errors.push(issue('SOURCE_CHAPTER_MISMATCH', `${refPath}.chapter`, ref.chapter));
    }
    if (typeof ref.text !== 'string' || ref.text.trim() === '') {
      errors.push(issue('SOURCE_TEXT_REQUIRED', `${refPath}.text`));
    }
    for (const field of ['line_start', 'line_end']) {
      if (ref[field] !== undefined && !Number.isInteger(ref[field])) {
        errors.push(issue('SOURCE_LINE_INVALID', `${refPath}.${field}`, ref[field]));
      }
    }
  });
}

function findFormalIds(value, label, errors) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findFormalIds(entry, `${label}[${index}]`, errors));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const path = label ? `${label}.${key}` : key;
    if (key === 'id' || key.endsWith('_id') || key.endsWith('_ids')) {
      errors.push(issue('FORMAL_ID_FORBIDDEN', path, entry));
    }
    findFormalIds(entry, path, errors);
  }
}

function validatePowerRank(record, label, errors) {
  if (typeof record?.rank !== 'string' || record.rank === '') {
    errors.push(issue('POWER_RANK_REQUIRED', `${label}.rank`));
  } else if (!isPowerRank(record.rank)) {
    errors.push(issue('POWER_RANK_INVALID', `${label}.rank`, record.rank));
  }
}

function validateAmbiguities(ambiguities, errors) {
  if (!Array.isArray(ambiguities)) {
    errors.push(issue('AMBIGUITIES_ARRAY_REQUIRED', 'ambiguities'));
    return;
  }
  ambiguities.forEach((ambiguity, index) => {
    const label = `ambiguities[${index}]`;
    if (!isObject(ambiguity)
      || typeof ambiguity.category !== 'string'
      || typeof ambiguity.name !== 'string'
      || !Array.isArray(ambiguity.candidates)
      || ambiguity.candidates.length < 2) {
      errors.push(issue('AMBIGUITY_INVALID', label));
    }
  });
}

function validateCandidateResolutions(book, chapters) {
  if (!Array.isArray(book?.candidate_resolutions)) {
    return [issue('CANDIDATE_RESOLUTIONS_ARRAY_REQUIRED', 'candidate_resolutions')];
  }
  const errors = [];
  const counts = new Map();
  const knownKeys = new Set();
  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    for (const category of ENTITY_CATEGORIES) {
      for (const candidate of Array.isArray(chapter?.[category]) ? chapter[category] : []) {
        if (typeof candidate?.candidate_key === 'string') knownKeys.add(candidate.candidate_key);
      }
    }
  }
  book.candidate_resolutions.forEach((decision, index) => {
    const label = `candidate_resolutions[${index}]`;
    if (!isObject(decision) || typeof decision.candidate_key !== 'string') {
      errors.push(issue('CANDIDATE_RESOLUTION_INVALID', label));
      return;
    }
    counts.set(decision.candidate_key, (counts.get(decision.candidate_key) || 0) + 1);
    if (knownKeys.size > 0 && !knownKeys.has(decision.candidate_key)) {
      errors.push(issue('CANDIDATE_RESOLUTION_UNKNOWN', `${label}.candidate_key`, decision.candidate_key));
    }
    if (!RESOLUTIONS.has(decision.resolution)) {
      errors.push(issue('CANDIDATE_RESOLUTION_INVALID', `${label}.resolution`, decision.resolution));
      return;
    }
    if (decision.resolution === 'merged_to'
      && (typeof decision.merged_to !== 'string' || decision.merged_to.trim() === '')) {
      errors.push(issue('CANDIDATE_RESOLUTION_INVALID', `${label}.merged_to`, decision.merged_to));
    }
    if (decision.resolution === 'rejected'
      && (!REJECTION_REASONS.has(decision.reason)
        || typeof decision.detail !== 'string'
        || decision.detail.trim() === '')) {
      errors.push(issue('CANDIDATE_RESOLUTION_INVALID', label, decision.candidate_key));
    }
    if (decision.resolution === 'ambiguous'
      && (typeof decision.detail !== 'string' || decision.detail.trim() === '')) {
      errors.push(issue('CANDIDATE_RESOLUTION_INVALID', `${label}.detail`, decision.candidate_key));
    }
  });
  for (const [candidateKey, count] of counts) {
    if (count > 1) errors.push(issue('CANDIDATE_RESOLUTION_DUPLICATE', 'candidate_resolutions', candidateKey));
  }
  for (const candidateKey of knownKeys) {
    if (!counts.has(candidateKey)) {
      errors.push(issue('CANDIDATE_RESOLUTION_MISSING', 'candidate_resolutions', candidateKey));
    }
  }
  return errors;
}

function validateBook(book, manifest, expectedStage, chapters) {
  if (!isObject(book)) return [issue('BOOK_DRAFT_INVALID', '$')];
  const errors = [];
  const allowed = new Set(['schema_version', 'stage', ...BOOK_CATEGORIES, 'ambiguities', 'candidate_resolutions']);
  for (const key of Object.keys(book)) {
    if (!allowed.has(key)) errors.push(issue('TOP_LEVEL_FIELD_UNKNOWN', key));
  }
  if (book.schema_version !== 1) errors.push(issue('SCHEMA_VERSION_INVALID', 'schema_version', book.schema_version));
  if (book.stage !== expectedStage) errors.push(issue('BOOK_STAGE_INVALID', 'stage', book.stage));

  for (const category of BOOK_CATEGORIES) {
    if (!Array.isArray(book[category])) errors.push(issue('CATEGORY_ARRAY_REQUIRED', category));
  }
  errors.push(...validateCandidateResolutions(book, chapters));
  validateAmbiguities(book.ambiguities, errors);
  findFormalIds(book, '', errors);
  if (errors.some(error => error.code === 'CATEGORY_ARRAY_REQUIRED')) return errors;

  const chapterNumbers = new Set((Array.isArray(manifest?.chapters) ? manifest.chapters : [])
    .map(chapter => chapter.number));
  for (const category of ENTITY_CATEGORIES) {
    const localKeys = new Set();
    book[category].forEach((record, index) => {
      const label = `${category}[${index}]`;
      if (!isObject(record)) {
        errors.push(issue('BOOK_RECORD_INVALID', label));
        return;
      }
      if (typeof record.local_key !== 'string' || record.local_key.trim() === '') {
        errors.push(issue('LOCAL_KEY_REQUIRED', `${label}.local_key`));
      } else if (localKeys.has(record.local_key)) {
        errors.push(issue('LOCAL_KEY_DUPLICATE', `${label}.local_key`, record.local_key));
      } else {
        localKeys.add(record.local_key);
      }
      if (typeof record.canonical_name !== 'string' || record.canonical_name.trim() === '') {
        errors.push(issue('CANONICAL_NAME_REQUIRED', `${label}.canonical_name`));
      }
      if (record.aliases !== undefined && !Array.isArray(record.aliases)) {
        errors.push(issue('ALIASES_ARRAY_REQUIRED', `${label}.aliases`));
      }
      if (category === 'characters' || category === 'skills') {
        validatePowerRank(record, label, errors);
      }
      // skills 必须有 techniques 数组
      if (category === 'skills' && !Array.isArray(record.techniques)) {
        errors.push(issue('TECHNIQUES_ARRAY_REQUIRED', `${label}.techniques`));
      }
      validateSourceRefs(record, label, chapterNumbers, errors);
    });
  }

  const summariesByChapter = new Map();
  book.chapter_summaries.forEach((summary, index) => {
    const label = `chapter_summaries[${index}]`;
    if (!isObject(summary)) {
      errors.push(issue('CHAPTER_SUMMARY_INVALID', label));
      return;
    }
    if (!chapterNumbers.has(summary.chapter)) {
      errors.push(issue('SUMMARY_CHAPTER_UNKNOWN', `${label}.chapter`, summary.chapter));
    } else if (summariesByChapter.has(summary.chapter)) {
      errors.push(issue('SUMMARY_CHAPTER_DUPLICATE', `${label}.chapter`, summary.chapter));
    } else {
      summariesByChapter.set(summary.chapter, summary);
    }
    if (typeof summary.summary !== 'string' || summary.summary.trim() === '') {
      errors.push(issue('SUMMARY_TEXT_REQUIRED', `${label}.summary`));
    }
  });
  for (const chapter of chapterNumbers) {
    if (!summariesByChapter.has(chapter)) errors.push(issue('SUMMARY_CHAPTER_MISSING', 'chapter_summaries', chapter));
  }
  return errors;
}

function validateMergedBook(book, manifest, chapters) {
  return validateBook(book, manifest, 'merged', chapters);
}

module.exports = {
  BOOK_CATEGORIES,
  ENTITY_CATEGORIES,
  ITEM_REASONS,
  groupCandidates,
  normalizeName,
  validateCandidateResolutions,
  validateMergedBook
};
