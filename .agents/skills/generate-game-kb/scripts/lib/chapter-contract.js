'use strict';

const { CHARACTER_LEVELS, isPowerRank } = require('./semantic-contract');
const { validateGroundedRecord } = require('./grounding');

const CANDIDATE_ARRAYS = Object.freeze([
  'characters',
  'items',
  'skills',
  'factions'
]);
const CHAPTER_FIELDS = new Set([
  'schema_version', 'chapter', 'title', 'source_hash', ...CANDIDATE_ARRAYS, 'chapter_summary'
]);
const CHARACTER_LEVEL_SET = new Set(CHARACTER_LEVELS);

function issue(code, path, target = '') {
  return { code, path, target };
}

function validateSourceRefs(record, label, chapter, errors) {
  if (!Array.isArray(record?.source_refs) || record.source_refs.length === 0) {
    errors.push(issue('SOURCE_REFS_REQUIRED', `${label}.source_refs`));
    return;
  }
  record.source_refs.forEach((ref, index) => {
    const refPath = `${label}.source_refs[${index}]`;
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
      errors.push(issue('SOURCE_REF_INVALID', refPath));
      return;
    }
    if (ref.chapter !== chapter) errors.push(issue('SOURCE_CHAPTER_MISMATCH', `${refPath}.chapter`, ref.chapter));
    if (typeof ref.text !== 'string' || ref.text.trim() === '') errors.push(issue('SOURCE_TEXT_REQUIRED', `${refPath}.text`));
    for (const field of ['line_start', 'line_end']) {
      if (ref[field] !== undefined && !Number.isInteger(ref[field])) {
        errors.push(issue('SOURCE_LINE_INVALID', `${refPath}.${field}`, ref[field]));
      }
    }
  });
}

function validateEvidence(record, label, expected, errors) {
  if (typeof expected.chapterText === 'string') {
    errors.push(...validateGroundedRecord(record, {
      chapterNumber: expected.number,
      chapterText: expected.chapterText,
      label
    }).errors);
    return;
  }
  validateSourceRefs(record, label, expected.number, errors);
}

function findFormalIds(value, path, errors) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findFormalIds(entry, `${path}[${index}]`, errors));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (key === 'id' || key.endsWith('_id') || key.endsWith('_ids')) {
      errors.push(issue('FORMAL_ID_FORBIDDEN', fieldPath, entry));
    }
    findFormalIds(entry, fieldPath, errors);
  }
}

function validateNamedCandidate(record, label, expected, errors) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    errors.push(issue('CANDIDATE_INVALID', label));
    return;
  }
  if (typeof record.local_key !== 'string' || record.local_key.trim() === '') {
    errors.push(issue('LOCAL_KEY_REQUIRED', `${label}.local_key`));
  }
  if (typeof record.name !== 'string' || record.name.trim() === '') {
    errors.push(issue('NAME_REQUIRED', `${label}.name`));
  }
  validateEvidence(record, label, expected, errors);
}

function validatePowerRank(record, label, errors) {
  if (!Object.hasOwn(record || {}, 'rank') || record.rank === null) return;
  if (!isPowerRank(record.rank)) {
    errors.push(issue('POWER_RANK_INVALID', `${label}.rank`, record.rank));
  }
}

function validateCharacterLevel(record, label, errors) {
  if (!Object.hasOwn(record || {}, 'level') || record.level === null) return;
  if (!CHARACTER_LEVEL_SET.has(record.level)) {
    errors.push(issue('CHARACTER_LEVEL_INVALID', `${label}.level`, record.level));
  }
}

function validateTechniques(record, label, errors) {
  if (!Array.isArray(record?.techniques)) {
    errors.push(issue('TECHNIQUES_REQUIRED', `${label}.techniques`));
    return;
  }
  record.techniques.forEach((technique, index) => {
    const techniquePath = `${label}.techniques[${index}]`;
    if (!technique || typeof technique !== 'object' || Array.isArray(technique)) {
      errors.push(issue('TECHNIQUE_INVALID', techniquePath));
      return;
    }
    if (typeof technique.name !== 'string' || technique.name.trim() === '') {
      errors.push(issue('TECHNIQUE_NAME_REQUIRED', `${techniquePath}.name`));
    }
    if (technique.named_in_source !== true) {
      errors.push(issue('TECHNIQUE_NOT_NAMED', `${techniquePath}.named_in_source`, technique.name));
    }
  });
}

function validateChapterDraft(draft, expected) {
  const errors = [];
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return [issue('CHAPTER_DRAFT_INVALID', '$')];
  }
  for (const field of Object.keys(draft)) {
    if (!CHAPTER_FIELDS.has(field)) errors.push(issue('CHAPTER_FIELD_FORBIDDEN', field, field));
  }
  if (draft.chapter !== expected.number) errors.push(issue('CHAPTER_MISMATCH', 'chapter', draft.chapter));
  if (draft.source_hash !== expected.inputHash) errors.push(issue('SOURCE_HASH_MISMATCH', 'source_hash', draft.source_hash));
  if (typeof draft.title !== 'string' || draft.title.trim() === '') errors.push(issue('TITLE_REQUIRED', 'title'));

  for (const category of CANDIDATE_ARRAYS) {
    if (!Array.isArray(draft[category])) errors.push(issue('CATEGORY_ARRAY_REQUIRED', category));
  }
  if (errors.some(error => error.code === 'CATEGORY_ARRAY_REQUIRED')) return errors;

  for (const category of CANDIDATE_ARRAYS) {
    const localKeys = new Set();
    draft[category].forEach((record, index) => {
      const label = `${category}[${index}]`;
      validateNamedCandidate(record, label, expected, errors);
      if (category === 'characters' || category === 'skills') {
        validatePowerRank(record, label, errors);
      }
      if (category === 'characters') validateCharacterLevel(record, label, errors);
      if (category === 'skills') validateTechniques(record, label, errors);
      if (typeof record?.local_key === 'string' && record.local_key.trim() !== '') {
        if (localKeys.has(record.local_key)) {
          errors.push(issue('LOCAL_KEY_DUPLICATE', `${label}.local_key`, record.local_key));
        }
        localKeys.add(record.local_key);
      }
    });
  }

  if (!draft.chapter_summary || typeof draft.chapter_summary !== 'object' || Array.isArray(draft.chapter_summary)) {
    errors.push(issue('SUMMARY_REQUIRED', 'chapter_summary'));
  } else {
    if (typeof draft.chapter_summary.summary !== 'string' || draft.chapter_summary.summary.trim() === '') {
      errors.push(issue('SUMMARY_TEXT_REQUIRED', 'chapter_summary.summary'));
    }
    validateEvidence(draft.chapter_summary, 'chapter_summary', expected, errors);
  }

  findFormalIds(draft, '', errors);
  return errors;
}

function candidateKey(chapter, category, localKey) {
  return `ch${String(chapter).padStart(3, '0')}:${category}:${localKey}`;
}

function normalizeChapterDraft(draft) {
  const normalized = { ...draft };
  for (const category of CANDIDATE_ARRAYS) {
    normalized[category] = (Array.isArray(draft?.[category]) ? draft[category] : []).map(candidate => ({
      ...candidate,
      candidate_key: candidateKey(draft.chapter, category, candidate.local_key)
    }));
  }
  return normalized;
}

module.exports = { CANDIDATE_ARRAYS, candidateKey, normalizeChapterDraft, validateChapterDraft };
