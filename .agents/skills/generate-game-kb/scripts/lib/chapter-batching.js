'use strict';

const {
  MAX_CHAPTERS_PER_JOB,
  MAX_CJK_CHARS_PER_JOB
} = require('./worker-pool');
const { pathsFor, stagingPathFor } = require('./paths');

const DESCRIPTOR_FIELDS = Object.freeze([
  'unit',
  'number',
  'title',
  'source_file',
  'input_hash',
  'source_char_count',
  'attempt',
  'staging_path'
]);
const DESCRIPTOR_FIELD_SET = new Set(DESCRIPTOR_FIELDS);

function issue(code, path, target = '') {
  return { code, path, target };
}

function chapterUnit(number) {
  return `chapter:${String(number).padStart(3, '0')}`;
}

function batchId(chapters) {
  const first = String(chapters[0].number).padStart(3, '0');
  const last = String(chapters.at(-1).number).padStart(3, '0');
  return first === last ? `chapter-batch-${first}` : `chapter-batch-${first}-${last}`;
}

function currentAttempt(chapter, progress) {
  const state = progress?.units?.[chapterUnit(chapter.number)];
  if (!state || state.input_hash !== chapter.input_hash) return 1;
  return Math.min(2, (state.attempts || 0) + 1);
}

function descriptorFor(chapter, manifest, progress) {
  const attempt = currentAttempt(chapter, progress);
  const paths = pathsFor(manifest.novel_dir, manifest.run_id);
  return {
    unit: chapterUnit(chapter.number),
    number: chapter.number,
    title: chapter.title,
    source_file: chapter.file,
    input_hash: chapter.input_hash,
    source_char_count: chapter.source_char_count,
    attempt,
    staging_path: stagingPathFor(paths, chapterUnit(chapter.number), attempt)
  };
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

function packChapterJobs(manifest, {
  maxChapters = MAX_CHAPTERS_PER_JOB,
  maxCjkChars = MAX_CJK_CHARS_PER_JOB,
  progress = null
} = {}) {
  const effectiveMaxChapters = Math.min(
    assertPositiveInteger(maxChapters, 'maxChapters'),
    MAX_CHAPTERS_PER_JOB
  );
  const effectiveMaxCjkChars = Math.min(
    assertPositiveInteger(maxCjkChars, 'maxCjkChars'),
    MAX_CJK_CHARS_PER_JOB
  );
  const chapters = [...(manifest?.chapters || [])]
    .sort((left, right) => left.number - right.number)
    .map(chapter => descriptorFor(chapter, manifest, progress));
  const jobs = [];
  let current = [];
  let currentChars = 0;

  function flush() {
    if (current.length === 0) return;
    jobs.push({ batch_id: batchId(current), chapters: current });
    current = [];
    currentChars = 0;
  }

  for (const chapter of chapters) {
    const previous = current.at(-1);
    const adjacent = !previous || chapter.number === previous.number + 1;
    const fitsCount = current.length < effectiveMaxChapters;
    const fitsChars = currentChars + chapter.source_char_count <= effectiveMaxCjkChars;
    if (current.length > 0 && (!adjacent || !fitsCount || !fitsChars)) flush();
    current.push(chapter);
    currentChars += chapter.source_char_count;
  }
  flush();
  return jobs;
}

function stableTarget(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value) ?? String(value);
}

function compareIssues(left, right) {
  return left.path.localeCompare(right.path)
    || left.code.localeCompare(right.code)
    || stableTarget(left.target).localeCompare(stableTarget(right.target));
}

function validateChapterJob(job, manifest, progress = null) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    return [issue('CHAPTER_JOB_INVALID', '$')];
  }

  const errors = [];
  const chapters = Array.isArray(job.chapters) ? job.chapters : [];
  const descriptorsValid = chapters.every(descriptor => (
    descriptor && typeof descriptor === 'object' && !Array.isArray(descriptor)
  ));
  if (!Array.isArray(job.chapters) || chapters.length === 0) {
    errors.push(issue('CHAPTER_JOB_CHAPTERS_REQUIRED', 'chapters'));
  } else if (chapters.length > MAX_CHAPTERS_PER_JOB) {
    errors.push(issue('CHAPTER_JOB_COUNT_EXCEEDED', 'chapters.length', chapters.length));
  }

  const manifestByNumber = new Map((manifest?.chapters || []).map(chapter => [chapter.number, chapter]));
  chapters.forEach((descriptor, index) => {
    const base = `chapters[${index}]`;
    if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
      errors.push(issue('CHAPTER_DESCRIPTOR_INVALID', base));
      return;
    }
    for (const field of DESCRIPTOR_FIELDS) {
      if (!Object.hasOwn(descriptor, field)) errors.push(issue('CHAPTER_DESCRIPTOR_FIELD_MISSING', `${base}.${field}`, field));
    }
    for (const field of Object.keys(descriptor).filter(field => !DESCRIPTOR_FIELD_SET.has(field)).sort()) {
      errors.push(issue('CHAPTER_DESCRIPTOR_FIELD_FORBIDDEN', `${base}.${field}`, field));
    }

    const source = manifestByNumber.get(descriptor.number);
    if (!source) {
      errors.push(issue('CHAPTER_DESCRIPTOR_UNKNOWN', `${base}.number`, descriptor.number));
      return;
    }
    const expected = descriptorFor(source, manifest, progress);
    for (const field of DESCRIPTOR_FIELDS) {
      if (JSON.stringify(descriptor[field]) !== JSON.stringify(expected[field])) {
        errors.push(issue('CHAPTER_DESCRIPTOR_MISMATCH', `${base}.${field}`, descriptor[field]));
      }
    }
  });

  for (let index = 1; index < chapters.length; index += 1) {
    if (chapters[index]?.number !== chapters[index - 1]?.number + 1) {
      errors.push(issue('CHAPTER_JOB_NOT_ADJACENT', `chapters[${index}].number`, chapters[index]?.number));
    }
  }
  const sourceChars = chapters.reduce((sum, chapter) => sum + (chapter?.source_char_count || 0), 0);
  if (chapters.length > 1 && sourceChars > MAX_CJK_CHARS_PER_JOB) {
    errors.push(issue('CHAPTER_JOB_CJK_LIMIT_EXCEEDED', 'chapters', sourceChars));
  }
  if (chapters.length > 0 && descriptorsValid && job.batch_id !== batchId(chapters)) {
    errors.push(issue('CHAPTER_JOB_BATCH_ID_MISMATCH', 'batch_id', job.batch_id));
  }
  return errors.sort(compareIssues);
}

module.exports = {
  DESCRIPTOR_FIELDS,
  packChapterJobs,
  validateChapterJob
};
