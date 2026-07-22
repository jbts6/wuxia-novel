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

function normalizedChapterIndex(text) {
  const lines = sourceLines(text);
  let normalized = '';
  const lineByOffset = [];
  let pendingWhitespaceLine = null;

  function append(value, lineNumber) {
    normalized += value;
    for (let index = 0; index < value.length; index += 1) lineByOffset.push(lineNumber);
  }

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0 && pendingWhitespaceLine === null) {
      pendingWhitespaceLine = lineIndex + 1;
    }
    for (const character of line) {
      if (/\s/u.test(character)) {
        if (pendingWhitespaceLine === null) pendingWhitespaceLine = lineIndex + 1;
        continue;
      }
      if (pendingWhitespaceLine !== null && normalized !== '') append(' ', pendingWhitespaceLine);
      pendingWhitespaceLine = null;
      append(character, lineIndex + 1);
    }
  });
  return { lines, normalized, lineByOffset };
}

function locateSourceRange(index, normalizedText) {
  const startOffset = index.normalized.indexOf(normalizedText);
  if (startOffset < 0) return null;
  const endOffset = startOffset + normalizedText.length - 1;
  return {
    line_start: index.lineByOffset[startOffset],
    line_end: index.lineByOffset[endOffset]
  };
}

function deriveSourceRefs(refs, { chapterNumber, chapterText }) {
  const index = normalizedChapterIndex(chapterText);
  return (Array.isArray(refs) ? refs : []).map(ref => {
    const text = normalizeEvidenceText(ref?.text);
    return {
      chapter: chapterNumber,
      text,
      ...locateSourceRange(index, text)
    };
  });
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

function validateGroundedSourceRef(ref, {
  chapterNumber, chapterIndex, refPath, lineRangeMode
}) {
  const errors = [];
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    return { errors: [issue('SOURCE_REF_INVALID', refPath)], normalizedRef: null, evidence: null };
  }
  if (ref.chapter !== chapterNumber) {
    return {
      errors: [issue('SOURCE_CHAPTER_MISMATCH', `${refPath}.chapter`, ref.chapter)],
      normalizedRef: null,
      evidence: null
    };
  }
  if (typeof ref.text !== 'string' || ref.text.trim() === '') {
    return {
      errors: [issue('SOURCE_TEXT_REQUIRED', `${refPath}.text`)],
      normalizedRef: null,
      evidence: null
    };
  }

  const normalizedText = normalizeEvidenceText(ref.text);
  const normalizedRef = { chapter: ref.chapter, text: normalizedText };
  let span = null;
  if (lineRangeMode === 'derive') {
    Object.assign(normalizedRef, locateSourceRange(chapterIndex, normalizedText));
  } else {
    for (const field of ['line_start', 'line_end']) {
      if (ref[field] !== undefined) normalizedRef[field] = ref[field];
    }
    span = validateLineRange(ref, refPath, chapterIndex.lines, errors);
    if (errors.length > 0) return { errors, normalizedRef, evidence: null };
  }
  if (!(span ?? chapterIndex.normalized).includes(normalizedText)) {
    errors.push(issue('SOURCE_QUOTE_NOT_FOUND', `${refPath}.text`, normalizedText));
  }
  return { errors, normalizedRef, evidence: errors.length === 0 ? normalizedText : null };
}

function validateGroundedRecord(record, {
  chapterNumber, chapterText, label, lineRangeMode = 'validate'
}) {
  const errors = [];
  const normalizedRefs = [];
  const evidence = [];
  const refs = record?.source_refs;
  if (!Array.isArray(refs) || refs.length === 0) {
    errors.push(issue('SOURCE_REFS_REQUIRED', `${label}.source_refs`));
    return { errors, normalizedRefs };
  }

  const chapterIndex = normalizedChapterIndex(chapterText);
  refs.forEach((ref, index) => {
    const refPath = `${label}.source_refs[${index}]`;
    const result = validateGroundedSourceRef(ref, {
      chapterNumber, chapterIndex, refPath, lineRangeMode
    });
    errors.push(...result.errors);
    if (result.normalizedRef) normalizedRefs.push(result.normalizedRef);
    if (result.evidence) evidence.push(result.evidence);
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
  deriveSourceRefs,
  isGroundingError,
  normalizeEvidenceText,
  validateGroundedRecord
};
