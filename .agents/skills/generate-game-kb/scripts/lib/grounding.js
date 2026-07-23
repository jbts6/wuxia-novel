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

const TYPOGRAPHY_FOLD = Object.freeze({
  '。': '.',
  '“': '"',
  '”': '"',
  '「': '"',
  '」': '"',
  '『': '"',
  '』': '"',
  '‘': "'",
  '’': "'"
});

const TYPOGRAPHY_NORMALIZATION_RULE = 'grounding.typography-fold.v1';

function issue(code, path, target = '') {
  return { code, path, target };
}

function normalizeCompatibleText(text) {
  return Array.from(String(text ?? '').normalize('NFC'), character => {
    const compatible = character.normalize('NFKC');
    return Array.from(compatible).length === 1 ? compatible : character;
  }).join('');
}

function normalizeSourceText(text) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(normalizeCompatibleText)
    .join('\n');
}

function normalizeEvidenceText(text) {
  return normalizeSourceText(text)
    .replace(/\s+/gu, ' ')
    .trim();
}

function sourceLines(text) {
  return normalizeSourceText(text).split('\n');
}

function foldTypography(text) {
  return Array.from(text, character => TYPOGRAPHY_FOLD[character] ?? character).join('');
}

function allMatchOffsets(text, target) {
  const offsets = [];
  let offset = text.indexOf(target);
  while (offset >= 0) {
    offsets.push(offset);
    offset = text.indexOf(target, offset + 1);
  }
  return offsets;
}

function locateNormalizedQuote(sourceText, submittedText) {
  const exactOffset = sourceText.indexOf(submittedText);
  if (exactOffset >= 0) {
    return {
      mode: 'exact',
      startOffset: exactOffset,
      text: sourceText.slice(exactOffset, exactOffset + submittedText.length)
    };
  }

  const foldedText = foldTypography(submittedText);
  const offsets = allMatchOffsets(foldTypography(sourceText), foldedText);
  if (offsets.length !== 1) return null;
  const startOffset = offsets[0];
  return {
    mode: 'typography',
    startOffset,
    text: sourceText.slice(startOffset, startOffset + submittedText.length)
  };
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

function locateSourceMatch(index, normalizedText) {
  const match = locateNormalizedQuote(index.normalized, normalizedText);
  if (!match) return null;
  const endOffset = match.startOffset + match.text.length - 1;
  return {
    ...match,
    line_start: index.lineByOffset[match.startOffset],
    line_end: index.lineByOffset[endOffset]
  };
}

function deriveSourceRefs(refs, {
  chapterNumber, chapterText, fieldPath = '$.source_refs', normalizations = null
}) {
  const index = normalizedChapterIndex(chapterText);
  return (Array.isArray(refs) ? refs : []).map((ref, refIndex) => {
    const submittedText = normalizeEvidenceText(ref?.text);
    const match = locateSourceMatch(index, submittedText);
    const text = match?.text ?? submittedText;
    if (match?.mode === 'typography' && Array.isArray(normalizations)) {
      normalizations.push({
        field_path: `${fieldPath}[${refIndex}].text`,
        original_value: submittedText,
        normalized_value: text,
        normalization_rule: TYPOGRAPHY_NORMALIZATION_RULE
      });
    }
    return {
      chapter: chapterNumber,
      text,
      ...(match ? { line_start: match.line_start, line_end: match.line_end } : {})
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
  let match = null;
  if (lineRangeMode === 'derive') {
    match = locateSourceMatch(chapterIndex, normalizedText);
    if (match) {
      normalizedRef.text = match.text;
      normalizedRef.line_start = match.line_start;
      normalizedRef.line_end = match.line_end;
    }
  } else {
    for (const field of ['line_start', 'line_end']) {
      if (ref[field] !== undefined) normalizedRef[field] = ref[field];
    }
    span = validateLineRange(ref, refPath, chapterIndex.lines, errors);
    if (errors.length > 0) return { errors, normalizedRef, evidence: null };
    match = locateNormalizedQuote(span ?? chapterIndex.normalized, normalizedText);
    if (match) normalizedRef.text = match.text;
  }
  if (!match) {
    errors.push(issue('SOURCE_QUOTE_NOT_FOUND', `${refPath}.text`, normalizedText));
  }
  return { errors, normalizedRef, evidence: errors.length === 0 ? normalizedRef.text : null };
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
