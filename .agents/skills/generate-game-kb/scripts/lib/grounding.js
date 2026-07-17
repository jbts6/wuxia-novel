'use strict';

const GROUNDING_ERROR_CODES = new Set([
  'SOURCE_REFS_REQUIRED',
  'SOURCE_REF_INVALID',
  'SOURCE_CHAPTER_MISMATCH',
  'SOURCE_TEXT_REQUIRED',
  'SOURCE_LINE_INVALID',
  'SOURCE_LINE_RANGE_INVALID',
  'SOURCE_QUOTE_NOT_FOUND',
  'SOURCE_NAME_NOT_FOUND'
]);

function issue(code, path, target = '') {
  return { code, path, target };
}

function normalizeEvidenceText(text) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim();
}

function sourceLines(text) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .normalize('NFKC')
    .split('\n');
}

function normalizedNames(record, label) {
  const names = [];
  if (typeof record?.name === 'string' && record.name.trim() !== '') {
    names.push({ path: `${label}.name`, name: record.name });
  }
  if (Array.isArray(record?.techniques)) {
    record.techniques.forEach((technique, index) => {
      if (typeof technique?.name === 'string' && technique.name.trim() !== '') {
        names.push({ path: `${label}.techniques[${index}].name`, name: technique.name });
      }
    });
  }
  return names;
}

function validateLineRange(ref, refPath, lines, errors) {
  for (const field of ['line_start', 'line_end']) {
    if (ref[field] !== undefined && !Number.isInteger(ref[field])) {
      errors.push(issue('SOURCE_LINE_INVALID', `${refPath}.${field}`, ref[field]));
    }
  }
  if (ref.line_start === undefined && ref.line_end === undefined) return null;
  if (ref.line_start === undefined || ref.line_end === undefined) {
    errors.push(issue(
      'SOURCE_LINE_RANGE_INVALID',
      refPath,
      `${ref.line_start ?? ''}-${ref.line_end ?? ''}`
    ));
    return null;
  }
  if (!Number.isInteger(ref.line_start) || !Number.isInteger(ref.line_end)) return null;
  if (ref.line_start < 1 || ref.line_end < ref.line_start || ref.line_end > lines.length) {
    errors.push(issue(
      'SOURCE_LINE_RANGE_INVALID',
      refPath,
      `${ref.line_start}-${ref.line_end}`
    ));
    return null;
  }
  return normalizeEvidenceText(lines.slice(ref.line_start - 1, ref.line_end).join('\n'));
}

function validateGroundedRecord(record, { chapterNumber, chapterText, label }) {
  const errors = [];
  const normalizedRefs = [];
  const evidence = [];
  const refs = record?.source_refs;
  if (!Array.isArray(refs) || refs.length === 0) {
    errors.push(issue('SOURCE_REFS_REQUIRED', `${label}.source_refs`));
    return { errors, normalizedRefs };
  }

  const normalizedChapter = normalizeEvidenceText(chapterText);
  const lines = sourceLines(chapterText);
  refs.forEach((ref, index) => {
    const refPath = `${label}.source_refs[${index}]`;
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
      errors.push(issue('SOURCE_REF_INVALID', refPath));
      return;
    }
    if (ref.chapter !== chapterNumber) {
      errors.push(issue('SOURCE_CHAPTER_MISMATCH', `${refPath}.chapter`, ref.chapter));
      return;
    }
    if (typeof ref.text !== 'string' || ref.text.trim() === '') {
      errors.push(issue('SOURCE_TEXT_REQUIRED', `${refPath}.text`));
      return;
    }

    const normalizedText = normalizeEvidenceText(ref.text);
    const normalizedRef = { chapter: ref.chapter, text: normalizedText };
    for (const field of ['line_start', 'line_end']) {
      if (ref[field] !== undefined) normalizedRef[field] = ref[field];
    }
    normalizedRefs.push(normalizedRef);

    const errorsBeforeRange = errors.length;
    const span = validateLineRange(ref, refPath, lines, errors);
    if (errors.length > errorsBeforeRange) return;
    const searchable = span ?? normalizedChapter;
    if (!searchable.includes(normalizedText)) {
      errors.push(issue('SOURCE_QUOTE_NOT_FOUND', `${refPath}.text`, normalizedText));
      return;
    }
    evidence.push(normalizedText);
  });

  if (evidence.length === 0) return { errors, normalizedRefs };
  for (const entry of normalizedNames(record, label)) {
    const normalizedName = normalizeEvidenceText(entry.name);
    if (!evidence.some(text => text.includes(normalizedName))) {
      errors.push(issue('SOURCE_NAME_NOT_FOUND', entry.path, entry.name));
    }
  }
  return { errors, normalizedRefs };
}

function isGroundingError(error) {
  return GROUNDING_ERROR_CODES.has(error?.code);
}

module.exports = {
  GROUNDING_ERROR_CODES,
  isGroundingError,
  normalizeEvidenceText,
  validateGroundedRecord
};
