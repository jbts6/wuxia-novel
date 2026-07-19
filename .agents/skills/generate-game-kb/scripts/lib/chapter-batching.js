'use strict';

const {
  MAX_CHAPTERS_PER_JOB,
  MAX_CJK_CHARS_PER_JOB
} = require('./worker-pool');
const { GameKbError } = require('./errors');
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
const WORKER_DESCRIPTOR_FIELDS = Object.freeze(DESCRIPTOR_FIELDS.filter(field => field !== 'staging_path'));
const SUBMISSION_FIELDS = Object.freeze(['unit', 'attempt', 'input_hash']);
const JOB_FIELDS = Object.freeze(['batch_id', 'chapters', 'worker_write_paths', 'submissions']);
const JOB_FIELD_SET = new Set(JOB_FIELDS);

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

function submissionFor(descriptor) {
  return {
    unit: descriptor.unit,
    attempt: descriptor.attempt,
    input_hash: descriptor.input_hash
  };
}

function jobFor(chapters) {
  return {
    batch_id: batchId(chapters),
    chapters,
    worker_write_paths: [],
    submissions: chapters.map(submissionFor)
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
    jobs.push(jobFor(current));
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

function structuralJobIssues(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    return [issue('CHAPTER_JOB_INVALID', '$')];
  }
  const errors = [];
  for (const field of Object.keys(job).filter(field => !JOB_FIELD_SET.has(field)).sort()) {
    errors.push(issue('CHAPTER_JOB_FIELD_FORBIDDEN', field, field));
  }
  if (!Array.isArray(job.worker_write_paths) || job.worker_write_paths.length !== 0) {
    errors.push(issue('CHAPTER_JOB_WORKER_WRITES_FORBIDDEN', 'worker_write_paths', job.worker_write_paths));
  }

  const chapters = Array.isArray(job.chapters) ? job.chapters : [];
  const submissions = Array.isArray(job.submissions) ? job.submissions : [];
  if (!Array.isArray(job.submissions) || submissions.length !== chapters.length) {
    errors.push(issue('CHAPTER_JOB_SUBMISSIONS_MISMATCH', 'submissions.length', submissions.length));
  }
  submissions.forEach((submission, index) => {
    const base = `submissions[${index}]`;
    if (!submission || typeof submission !== 'object' || Array.isArray(submission)) {
      errors.push(issue('CHAPTER_SUBMISSION_INVALID', base));
      return;
    }
    for (const field of SUBMISSION_FIELDS) {
      if (!Object.hasOwn(submission, field)) {
        errors.push(issue('CHAPTER_SUBMISSION_FIELD_MISSING', `${base}.${field}`, field));
      }
    }
    for (const field of Object.keys(submission).filter(field => !SUBMISSION_FIELDS.includes(field)).sort()) {
      errors.push(issue('CHAPTER_SUBMISSION_FIELD_FORBIDDEN', `${base}.${field}`, field));
    }
    const descriptor = chapters[index];
    if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) return;
    const expected = submissionFor(descriptor);
    for (const field of SUBMISSION_FIELDS) {
      if (submission[field] !== expected[field]) {
        errors.push(issue('CHAPTER_SUBMISSION_MISMATCH', `${base}.${field}`, submission[field]));
      }
    }
  });
  return errors;
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

  const errors = structuralJobIssues(job);
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

function workerProjection(job) {
  const structuralErrors = structuralJobIssues(job);
  const chapters = Array.isArray(job?.chapters) ? job.chapters : [];
  chapters.forEach((descriptor, index) => {
    if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
      structuralErrors.push(issue('CHAPTER_DESCRIPTOR_INVALID', `chapters[${index}]`));
      return;
    }
    for (const field of Object.keys(descriptor).filter(field => !DESCRIPTOR_FIELD_SET.has(field)).sort()) {
      structuralErrors.push(issue('CHAPTER_DESCRIPTOR_FIELD_FORBIDDEN', `chapters[${index}].${field}`, field));
    }
  });
  if (structuralErrors.length > 0) {
    throw new GameKbError('CHAPTER_JOB_PROJECTION_INVALID', 'Worker projection requires a canonical zero-write job', {
      errors: structuralErrors.sort(compareIssues)
    });
  }
  return {
    batch_id: job.batch_id,
    worker_write_paths: [],
    chapters: chapters.map(descriptor => Object.fromEntries(
      WORKER_DESCRIPTOR_FIELDS.map(field => [field, descriptor[field]])
    )),
    submissions: job.submissions.map(submission => ({ ...submission }))
  };
}

module.exports = {
  DESCRIPTOR_FIELDS,
  packChapterJobs,
  validateChapterJob,
  workerProjection
};
