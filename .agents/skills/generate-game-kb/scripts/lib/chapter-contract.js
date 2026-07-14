'use strict';

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
    draft[category].forEach((record, index) => {
      const label = `${category}[${index}]`;
      validateNamedCandidate(record, label, expected.number, errors);
      if (category === 'techniques' && record?.named_in_source !== true) {
        errors.push(issue('TECHNIQUE_NOT_NAMED', `${label}.named_in_source`, record?.name));
      }
    });
  }

  const eventKeys = new Set(draft.events.map(event => event?.local_key).filter(Boolean));
  const dialogueEvents = new Set();
  draft.dialogues.forEach((dialogue, index) => {
    const label = `dialogues[${index}]`;
    if (!dialogue || typeof dialogue !== 'object' || Array.isArray(dialogue)) {
      errors.push(issue('DIALOGUE_INVALID', label));
      return;
    }
    if (typeof dialogue.local_key !== 'string' || dialogue.local_key.trim() === '') {
      errors.push(issue('LOCAL_KEY_REQUIRED', `${label}.local_key`));
    }
    if (typeof dialogue.event_local_key !== 'string' || dialogue.event_local_key.trim() === '') {
      errors.push(issue('DIALOGUE_EVENT_REQUIRED', `${label}.event_local_key`));
    } else {
      if (!eventKeys.has(dialogue.event_local_key)) {
        errors.push(issue('DIALOGUE_EVENT_UNKNOWN', `${label}.event_local_key`, dialogue.event_local_key));
      }
      if (dialogueEvents.has(dialogue.event_local_key)) {
        errors.push(issue('DIALOGUE_EVENT_DUPLICATE', `${label}.event_local_key`, dialogue.event_local_key));
      }
      dialogueEvents.add(dialogue.event_local_key);
    }
    if (typeof dialogue.speaker_name !== 'string' || dialogue.speaker_name.trim() === '') {
      errors.push(issue('DIALOGUE_SPEAKER_REQUIRED', `${label}.speaker_name`));
    }
    if (typeof dialogue.text !== 'string' || dialogue.text.trim() === '') {
      errors.push(issue('DIALOGUE_TEXT_REQUIRED', `${label}.text`));
    }
    validateSourceRefs(dialogue, label, expected.number, errors);
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

module.exports = { CANDIDATE_ARRAYS, validateChapterDraft };
