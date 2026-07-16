'use strict';

const {
  DETAILED_CHARACTER_LEVELS,
  ENTITY_CATEGORIES,
  ITEM_REASONS,
  SUMMARY_CHARACTER_LEVELS,
  validateMergedBook
} = require('./book-contract');

function compareText(left, right) {
  const a = String(left ?? '');
  const b = String(right ?? '');
  return a < b ? -1 : a > b ? 1 : 0;
}

function cleanedAsMerged(book) {
  const value = structuredClone(book || {});
  value.stage = 'merged';
  delete value.quantity_review;
  delete value.game_material_candidates;
  return value;
}

function locationForPath(book, path) {
  if (!match) return { category: '', entity_key: '' };
  const category = match[1];
  const record = Array.isArray(book?.[category]) ? book[category][Number(match[2])] : null;
  return { category, entity_key: record?.local_key || '' };
}

function rawObligation(code, category, entityKey, path, detail = '') {
  return {
    code,
    category: category || '',
    entity_key: entityKey || '',
    path: path || '',
    detail: detail === undefined || detail === null ? '' : String(detail)
  };
}

function obligationKey(value) {
  return [value.code, value.category, value.entity_key, value.path, value.detail].join('\0');
}

function buildCleanObligations(book, manifest, chapters) {
  const obligations = [];
  const mergedShape = cleanedAsMerged(book);
  for (const error of validateMergedBook(mergedShape, manifest, chapters)) {
    const location = locationForPath(book, error.path);
    obligations.push(rawObligation(error.code, location.category, location.entity_key, error.path, error.target));
  }

  for (const [index, ambiguity] of (Array.isArray(book?.ambiguities) ? book.ambiguities : []).entries()) {
    obligations.push(rawObligation(
      'MERGE_AMBIGUITY_UNRESOLVED',
      ambiguity?.category,
      '',
      `ambiguities[${index}]`,
      ambiguity?.name
    ));
  }
  for (const [index, resolution] of (Array.isArray(book?.candidate_resolutions) ? book.candidate_resolutions : []).entries()) {
    if (resolution?.resolution === 'ambiguous') {
      obligations.push(rawObligation(
        'MERGE_AMBIGUITY_UNRESOLVED',
        '',
        '',
        `candidate_resolutions[${index}]`,
        resolution.candidate_key
      ));
    }
  }

  for (const [index, character] of (Array.isArray(book?.characters) ? book.characters : []).entries()) {
    const label = `characters[${index}]`;
    if (DETAILED_CHARACTER_LEVELS.has(character?.level)) {
      if (typeof character.biography !== 'string' || character.biography.trim() === '') {
        obligations.push(rawObligation(
          'DETAILED_CHARACTER_BIOGRAPHY_REQUIRED',
          'characters',
          character.local_key,
          `${label}.biography`,
          character.canonical_name
        ));
      }
      if (!character.personality || typeof character.personality !== 'object' || Array.isArray(character.personality)) {
        obligations.push(rawObligation(
          'DETAILED_CHARACTER_PERSONALITY_REQUIRED',
          'characters',
          character.local_key,
          `${label}.personality`,
          character.canonical_name
        ));
      }
    }
    if (SUMMARY_CHARACTER_LEVELS.has(character?.level)) {
      const biographyLength = typeof character.biography === 'string' ? [...character.biography].length : 0;
      const traitCount = Array.isArray(character.personality?.traits) ? character.personality.traits.length : 0;
      if (biographyLength > 200 || traitCount > 2) {
        obligations.push(rawObligation(
          'MINOR_CHARACTER_TOO_DETAILED',
          'characters',
          character.local_key,
          label,
          character.canonical_name
        ));
      }
    }
  }

  for (const [index, item] of (Array.isArray(book?.items) ? book.items : []).entries()) {
    if (!ITEM_REASONS.has(item?.inclusion_reason)) {
      obligations.push(rawObligation(
        'ITEM_NOT_IMPORTANT',
        'items',
        item?.local_key,
        `items[${index}].inclusion_reason`,
        item?.canonical_name
      ));
    }
  }
  for (const [index, technique] of (Array.isArray(book?.techniques) ? book.techniques : []).entries()) {
    if (technique?.named_in_source !== true) {
      obligations.push(rawObligation(
        'TECHNIQUE_NOT_NAMED',
        'techniques',
        technique?.local_key,
        `techniques[${index}].named_in_source`,
        technique?.canonical_name
      ));
    }
  }

  const eventKeys = new Set((Array.isArray(book?.events) ? book.events : []).map(event => event?.local_key));
  const dialogueByEvent = new Map();
    if (!eventKeys.has(dialogue?.event_key)) {
      obligations.push(rawObligation(
        'DIALOGUE_EVENT_UNKNOWN',
        dialogue?.local_key,
        dialogue?.event_key
      ));
    }
    if (typeof dialogue?.event_key === 'string') {
      if (!dialogueByEvent.has(dialogue.event_key)) dialogueByEvent.set(dialogue.event_key, []);
      dialogueByEvent.get(dialogue.event_key).push({ dialogue, index });
    }
    for (const [refIndex, ref] of (Array.isArray(dialogue?.source_refs) ? dialogue.source_refs : []).entries()) {
      if (ref?.chapter !== dialogue.chapter) {
        obligations.push(rawObligation(
          'SOURCE_CHAPTER_MISMATCH',
          dialogue?.local_key,
          ref?.chapter
        ));
      }
    }
  }
  for (const [eventKey, entries] of dialogueByEvent) {
    if (entries.length < 2) continue;
    for (const { dialogue, index } of entries.slice(1)) {
      obligations.push(rawObligation(
        'DIALOGUE_EVENT_DUPLICATE',
        dialogue?.local_key,
        eventKey
      ));
    }
  }

  const unique = [...new Map(obligations.map(value => [obligationKey(value), value])).values()]
    .sort((left, right) =>
      compareText(left.code, right.code)
      || compareText(left.category, right.category)
      || compareText(left.entity_key, right.entity_key)
      || compareText(left.path, right.path)
      || compareText(left.detail, right.detail));
  return unique.map((value, index) => ({
    obligation_ref: `o${String(index + 1).padStart(4, '0')}`,
    ...value
  }));
}

module.exports = { buildCleanObligations, obligationKey };
