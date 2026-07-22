'use strict';

const {
  CHARACTER_LEVELS,
  isPowerRank,
  normalizeEntitySemantics,
  validateEntitySemantics
} = require('./semantic-contract');
const { validateGroundedRecord } = require('./grounding');
const { createReferenceIndex, resolveReference } = require('./reference-resolution');
const { normalizeTypeArray } = require('./type-taxonomy');

const CANDIDATE_ARRAYS = Object.freeze([
  'characters',
  'items',
  'skills',
  'factions'
]);
const CHAPTER_FIELDS = new Set([
  'schema_version', 'chapter', 'title', 'source_hash', ...CANDIDATE_ARRAYS, 'chapter_summary', 'normalizations'
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

function validateNamedCandidate(record, label, category, expected, errors) {
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
  errors.push(...validateEntitySemantics(category, record, {
    label,
    stageFields: ['local_key', 'source_refs']
  }));
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
  if (record?.techniques === undefined) return;
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
    for (const field of Object.keys(technique)) {
      if (!['name', 'description'].includes(field)) {
        errors.push(issue('ENTITY_FIELD_FORBIDDEN', `${techniquePath}.${field}`, field));
      }
    }
    if (technique.description !== undefined && technique.description !== null
      && (typeof technique.description !== 'string' || technique.description.trim() === '')) {
      errors.push(issue('ENTITY_VALUE_EMPTY', `${techniquePath}.description`, technique.description));
    }
    if (['未知', '其他', '暂无描述', '不详'].includes(technique.description?.trim())) {
      errors.push(issue('ENTITY_VALUE_PLACEHOLDER', `${techniquePath}.description`, technique.description));
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
  if (draft.schema_version !== 1 && draft.schema_version !== 7) {
    errors.push(issue('SCHEMA_VERSION_INVALID', 'schema_version', draft.schema_version));
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
      validateNamedCandidate(record, label, category, expected, errors);
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
      ...normalizeEntitySemantics(category, candidate),
      candidate_key: candidateKey(draft.chapter, category, candidate.local_key)
    }));
  }
  return normalized;
}

const V7_WORKER_TOP_LEVEL = new Set(['characters', 'skills', 'items', 'factions', 'chapter_summary']);
const V7_WORKER_FORBIDDEN_TOP = new Set([
  'schema_version', 'chapter', 'title', 'source_hash', 'unit', 'cycle', 'attempt',
  'input_hash', 'output_file', 'source_file', 'run_id', 'envelope'
]);
const V7_ENTITY_FORBIDDEN = new Set([
  'id', 'local_key', 'candidate_key', 'schema_version', 'chapter', 'title',
  'source_hash', 'unit', 'cycle', 'attempt', 'input_hash', 'output_file'
]);
const V7_TYPES_CATEGORIES = new Set(['skills', 'items', 'factions']);

function validateWorkerSourceRefs(record, label, errors, expected) {
  if (typeof expected?.chapterText === 'string') {
    const grounded = validateGroundedRecord({
      ...record,
      ...(Array.isArray(record?.source_refs) ? {
        source_refs: record.source_refs.map(ref => (
          ref && typeof ref === 'object' && !Array.isArray(ref)
            ? { ...ref, chapter: expected.number }
            : ref
        ))
      } : {})
    }, {
      chapterNumber: expected.number,
      chapterText: expected.chapterText,
      label
    });
    errors.push(...grounded.errors);
    return;
  }
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
    if (typeof ref.text !== 'string' || ref.text.trim() === '') errors.push(issue('SOURCE_TEXT_REQUIRED', `${refPath}.text`));
    for (const field of ['line_start', 'line_end']) {
      if (ref[field] !== undefined && !Number.isInteger(ref[field])) {
        errors.push(issue('SOURCE_LINE_INVALID', `${refPath}.${field}`, ref[field]));
      }
    }
  });
}

function validateWorkerReferenceClosure(draft, errors) {
  const indexes = {
    skills: createReferenceIndex(draft.skills),
    factions: createReferenceIndex(draft.factions)
  };
  const fields = [
    ['characters', 'skills', 'skills'],
    ['characters', 'factions', 'factions'],
    ['skills', 'factions', 'factions']
  ];

  for (const [ownerCategory, field, targetCategory] of fields) {
    draft[ownerCategory].forEach((record, recordIndex) => {
      if (!Array.isArray(record?.[field])) return;
      record[field].forEach((target, targetIndex) => {
        const result = resolveReference(indexes[targetCategory], target);
        if (result.status === 'resolved') return;
        errors.push(issue(
          result.status === 'unresolved' ? 'REFERENCE_UNRESOLVED' : 'REFERENCE_AMBIGUOUS',
          `${ownerCategory}[${recordIndex}].${field}[${targetIndex}]`,
          target
        ));
      });
    });
  }
}

function validateWorkerChapterDraft(draft, expected) {
  const errors = [];
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return [issue('CHAPTER_DRAFT_INVALID', '$')];
  }
  const topFields = Object.keys(draft);
  const hasForbidden = topFields.some(field => V7_WORKER_FORBIDDEN_TOP.has(field));
  const hasUnknown = topFields.some(field => !V7_WORKER_TOP_LEVEL.has(field));
  if (hasForbidden || hasUnknown) {
    errors.push(issue('WORKER_TOP_LEVEL_FIELDS_INVALID', '$', topFields.join(',')));
  }
  for (const category of CANDIDATE_ARRAYS) {
    if (!Array.isArray(draft[category])) {
      errors.push(issue('CATEGORY_ARRAY_REQUIRED', category));
    }
  }
  if (errors.some(error => error.code === 'CATEGORY_ARRAY_REQUIRED')) return errors;

  for (const category of CANDIDATE_ARRAYS) {
    draft[category].forEach((record, index) => {
      const label = `${category}[${index}]`;
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        errors.push(issue('CANDIDATE_INVALID', label));
        return;
      }
      if (Object.hasOwn(record, 'type')) {
        errors.push(issue('LEGACY_TYPE_FIELD', `${label}.type`, record.type));
      }
      for (const field of Object.keys(record)) {
        if (V7_ENTITY_FORBIDDEN.has(field)) {
          errors.push(issue('WORKER_FIELD_FORBIDDEN', `${label}.${field}`, field));
        }
      }
      if (typeof record.name !== 'string' || record.name.trim() === '') {
        errors.push(issue('NAME_REQUIRED', `${label}.name`));
      }
      if (V7_TYPES_CATEGORIES.has(category) && record.types !== undefined) {
        const typeResult = normalizeTypeArray(category, record.types, `$.${label}.types`);
        errors.push(...typeResult.errors);
      }
      validateWorkerSourceRefs(record, label, errors, expected);
    });
  }
  validateWorkerReferenceClosure(draft, errors);

  if (!draft.chapter_summary || typeof draft.chapter_summary !== 'object' || Array.isArray(draft.chapter_summary)) {
    errors.push(issue('SUMMARY_REQUIRED', 'chapter_summary'));
  } else {
    if (typeof draft.chapter_summary.summary !== 'string' || draft.chapter_summary.summary.trim() === '') {
      errors.push(issue('SUMMARY_TEXT_REQUIRED', 'chapter_summary.summary'));
    }
    validateWorkerSourceRefs(draft.chapter_summary, 'chapter_summary', errors, expected);
  }
  return errors;
}

function normalizeAcceptedChapterDraft(draft, expected) {
  const errors = [];
  for (const category of CANDIDATE_ARRAYS) {
    (Array.isArray(draft?.[category]) ? draft[category] : []).forEach((record, index) => {
      const label = `${category}[${index}]`;
      for (const field of V7_ENTITY_FORBIDDEN) {
        if (Object.hasOwn(record || {}, field)) {
          errors.push(issue('WORKER_FIELD_FORBIDDEN', `${label}.${field}`, field));
        }
      }
    });
  }
  for (const field of V7_WORKER_FORBIDDEN_TOP) {
    if (Object.hasOwn(draft || {}, field)) {
      errors.push(issue('WORKER_TOP_LEVEL_FIELDS_INVALID', field, field));
    }
  }
  if (errors.length > 0) {
    return { chapter: null, normalizations: [], errors };
  }

  const allNormalizations = [];
  const chapter = {
    schema_version: 7,
    chapter: expected.number,
    title: expected.title,
    source_hash: expected.inputHash
  };

  for (const category of CANDIDATE_ARRAYS) {
    chapter[category] = (Array.isArray(draft[category]) ? draft[category] : []).map((record, index) => {
      const entity = { ...record };
      entity.local_key = `${category.slice(0, -1)}:${record.name}`;
      if (Array.isArray(entity.source_refs)) {
        entity.source_refs = entity.source_refs.map(ref => ({ ...ref, chapter: expected.number }));
      }
      if (V7_TYPES_CATEGORIES.has(category) && Array.isArray(entity.types)) {
        const typeResult = normalizeTypeArray(category, entity.types, `$.${category}[${index}].types`);
        entity.types = typeResult.values;
        allNormalizations.push(...typeResult.normalizations);
      }
      return entity;
    });
  }

  chapter.chapter_summary = {
    ...draft.chapter_summary,
    ...(Array.isArray(draft.chapter_summary?.source_refs)
      ? { source_refs: draft.chapter_summary.source_refs.map(ref => ({ ...ref, chapter: expected.number })) }
      : {})
  };
  chapter.normalizations = allNormalizations;
  return { chapter, normalizations: allNormalizations, errors: [] };
}

module.exports = {
  CANDIDATE_ARRAYS,
  candidateKey,
  normalizeAcceptedChapterDraft,
  normalizeChapterDraft,
  validateChapterDraft,
  validateWorkerChapterDraft
};
