'use strict';

const { buildChapterCoverage } = require('./coverage');
const { isPowerRank } = require('./semantic-contract');

const CANDIDATE_ARRAYS = Object.freeze([
  'characters',
  'events',
  'items',
  'skills',
  'techniques',
  'factions',
  'locations',
  'dialogues'
]);
const IMPORTANT_EVENT_LEVELS = new Set(['核心', '重要', 'core', 'important']);
const QUOTE_STATUSES = new Set(['quotable', 'not_quotable']);

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

function validateNamedCandidate(record, label, chapter, errors) {
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
  validateSourceRefs(record, label, chapter, errors);
}

function validatePowerRank(record, label, errors) {
  if (typeof record?.rank !== 'string' || record.rank === '') {
    errors.push(issue('POWER_RANK_REQUIRED', `${label}.rank`));
  } else if (!isPowerRank(record.rank)) {
    errors.push(issue('POWER_RANK_INVALID', `${label}.rank`, record.rank));
  }
}

function validateChapterDraft(draft, expected) {
  const errors = [];
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return [issue('CHAPTER_DRAFT_INVALID', '$')];
  }
  if (draft.chapter !== expected.number) errors.push(issue('CHAPTER_MISMATCH', 'chapter', draft.chapter));
  if (draft.source_hash !== expected.inputHash) errors.push(issue('SOURCE_HASH_MISMATCH', 'source_hash', draft.source_hash));
  if (typeof draft.title !== 'string' || draft.title.trim() === '') errors.push(issue('TITLE_REQUIRED', 'title'));

  for (const category of CANDIDATE_ARRAYS) {
    if (!Array.isArray(draft[category])) errors.push(issue('CATEGORY_ARRAY_REQUIRED', category));
  }
  if (errors.some(error => error.code === 'CATEGORY_ARRAY_REQUIRED')) return errors;

  for (const category of CANDIDATE_ARRAYS.filter(value => value !== 'dialogues')) {
    const localKeys = new Set();
    draft[category].forEach((record, index) => {
      const label = `${category}[${index}]`;
      validateNamedCandidate(record, label, expected.number, errors);
      if (category === 'characters' || category === 'skills') {
        validatePowerRank(record, label, errors);
      }
      if (typeof record?.local_key === 'string' && record.local_key.trim() !== '') {
        if (localKeys.has(record.local_key)) {
          errors.push(issue('LOCAL_KEY_DUPLICATE', `${label}.local_key`, record.local_key));
        }
        localKeys.add(record.local_key);
      }
      if (category === 'techniques' && record?.named_in_source !== true) {
        errors.push(issue('TECHNIQUE_NOT_NAMED', `${label}.named_in_source`, record?.name));
      }
    });
  }

  if (draft.dialogues.length > 0) {
    errors.push(issue('DIALOGUE_EXTRACTION_DISABLED', 'dialogues', draft.dialogues.length));
  }

  draft.events.forEach((event, index) => {
    if (!IMPORTANT_EVENT_LEVELS.has(event?.importance)) return;
    const label = `events[${index}]`;
    if (!QUOTE_STATUSES.has(event.quote_status)) {
      errors.push(issue('EVENT_QUOTE_STATUS_REQUIRED', `${label}.quote_status`, event.quote_status));
      return;
    }
    if (event.quote_status === 'not_quotable'
      && (typeof event.quote_reason !== 'string' || event.quote_reason.trim() === '')) {
      errors.push(issue('NOT_QUOTABLE_REASON_REQUIRED', `${label}.quote_reason`, event.local_key));
    }
  });

  if (!draft.summary || typeof draft.summary !== 'object' || Array.isArray(draft.summary)) {
    errors.push(issue('SUMMARY_REQUIRED', 'summary'));
  } else {
    if (typeof draft.summary.summary !== 'string' || draft.summary.summary.trim() === '') {
      errors.push(issue('SUMMARY_TEXT_REQUIRED', 'summary.summary'));
    }
    if (!Array.isArray(draft.summary.key_events)) errors.push(issue('SUMMARY_EVENTS_REQUIRED', 'summary.key_events'));
    if (!Array.isArray(draft.summary.key_characters)) errors.push(issue('SUMMARY_CHARACTERS_REQUIRED', 'summary.key_characters'));
    validateSourceRefs(draft.summary, 'summary', expected.number, errors);
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
  normalized.coverage = buildChapterCoverage([normalized]);
  return normalized;
}

module.exports = { CANDIDATE_ARRAYS, candidateKey, normalizeChapterDraft, validateChapterDraft };
