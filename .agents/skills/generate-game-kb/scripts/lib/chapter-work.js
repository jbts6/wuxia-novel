'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { readJson, stableHash, writeImmutableJson } = require('./io');
const { chapterAttemptPaths } = require('./paths');
const {
  MAX_ACTIVE_UNITS,
  assertProgressInvariant,
  transitionProgress
} = require('./chapter-progress');
const { TYPE_TAXONOMIES } = require('./type-taxonomy');
const { createWorkerContract } = require('./chapter-worker-contract');
const { recordRunTimingEvent } = require('./timing-events');

function unitName(number) {
  return `chapter:${String(number).padStart(3, '0')}`;
}

function chapterForUnit(manifest, unit) {
  const chapter = manifest.chapters.find(entry => unitName(entry.number) === unit);
  if (!chapter) throw new GameKbError('UNIT_NOT_FOUND', `Unknown unit: ${unit}`, { unit });
  return chapter;
}

function pendingUnitsInOrder(progress, manifest) {
  return manifest.chapters
    .map(chapter => unitName(chapter.number))
    .filter(unit => progress.units[unit].status === 'pending');
}

function revisionPaths(paths, unit, cycle, attempt) {
  const safe = unit.replaceAll(':', '_');
  const dir = path.join(paths.revisions, safe, `cycle_${String(cycle).padStart(2, '0')}`);
  const base = `attempt_${String(attempt).padStart(2, '0')}`;
  return {
    draft: path.join(paths.drafts, safe, `cycle_${String(cycle).padStart(2, '0')}`, `${base}.yaml`),
    errors: path.join(dir, `${base}.errors.json`)
  };
}

function chapterWorkerInput({ chapter, job, previousErrors = [], recoveryContext = null }) {
  return {
    semantic_contract_version: 7,
    producer: 'chapter-worker',
    unit: job.unit,
    cycle: job.cycle,
    attempt: job.attempt,
    chapter: chapter.number,
    title: chapter.title,
    source_file: chapter.file,
    source_hash: chapter.input_hash,
    chapter_text: fs.readFileSync(chapter.file, 'utf8'),
    output_file: job.output_file,
    taxonomies: TYPE_TAXONOMIES,
    worker_contract: createWorkerContract(),
    ...(recoveryContext ? { recovery_context: recoveryContext } : {}),
    ...(previousErrors.length > 0 ? { previous_errors: structuredClone(previousErrors) } : {})
  };
}

function recoveryContextFor(paths, unit) {
  if (!fs.existsSync(paths.recoveryReceipt)) return null;
  const receipt = readJson(paths.recoveryReceipt);
  const unitContext = receipt.unit_context?.[unit];
  if (!unitContext) return null;
  return {
    parent_run: receipt.parent_run,
    report_hash: receipt.report_hash,
    parent_accepted_draft: unitContext.parent_accepted_draft,
    parent_accepted_hash: unitContext.parent_accepted_hash,
    relationship_errors: structuredClone(unitContext.relationship_errors || [])
  };
}

function repairInput({ paths, state, job }) {
  const rejected = revisionPaths(paths, job.unit, state.cycle, state.attempt);
  const allowedRepairCodes = state.errors
    .map(error => error?.code)
    .filter(code => typeof code === 'string');
  return {
    semantic_contract_version: 7,
    producer: 'main-agent-repair',
    unit: job.unit,
    cycle: job.cycle,
    attempt: job.attempt,
    rejected_draft: rejected.draft,
    error_report: rejected.errors,
    allowed_repair_codes: [...new Set(allowedRepairCodes)],
    output_file: job.output_file,
    worker_contract: createWorkerContract()
  };
}

function jobFromState({ paths, manifest, progress, unit }) {
  const state = progress.units[unit];
  if (!state) throw new GameKbError('UNIT_NOT_FOUND', `Unknown unit: ${unit}`, { unit });

  let cycle;
  let attempt;
  let producer;
  if (state.status === 'pending' && state.cycle === 0 && state.attempt === 0) {
    cycle = 1;
    attempt = 1;
    producer = 'chapter-worker';
  } else if (state.status === 'pending' && state.cycle >= 2 && state.attempt === 0
    && progress.active_units.includes(unit)) {
    cycle = state.cycle;
    attempt = 1;
    producer = 'chapter-worker';
  } else if (state.status === 'rejected' && state.attempt === 1
    && progress.active_units.includes(unit)) {
    cycle = state.cycle;
    attempt = 2;
    producer = state.repair_allowed ? 'main-agent-repair' : 'chapter-worker';
  } else {
    throw new GameKbError('UNIT_NOT_RETRYABLE', `Unit ${unit} cannot be issued`, {
      unit, status: state.status, cycle: state.cycle, attempt: state.attempt
    });
  }

  const attemptPaths = chapterAttemptPaths(paths, unit, cycle, attempt);
  const job = {
    unit,
    cycle,
    attempt,
    producer,
    input_file: attemptPaths.input,
    output_file: attemptPaths.output,
    input_hash: null
  };
  const input = producer === 'main-agent-repair'
    ? repairInput({ paths, state, job })
    : chapterWorkerInput({
      chapter: chapterForUnit(manifest, unit),
      job,
      recoveryContext: recoveryContextFor(paths, unit),
      previousErrors: state.errors
    });
  job.input_hash = stableHash(input);
  return { job, input };
}

function writeJobInput(paths, job, input) {
  fs.mkdirSync(path.dirname(job.input_file), { recursive: true });
  fs.mkdirSync(path.dirname(job.output_file), { recursive: true });
  const checked = chapterAttemptPaths(paths, job.unit, job.cycle, job.attempt);
  if (checked.input !== job.input_file || checked.output !== job.output_file) {
    throw new GameKbError('ACTIVE_WINDOW_INVALID', 'Job paths changed before immutable input write', {
      unit: job.unit,
      input_file: job.input_file,
      output_file: job.output_file
    });
  }
  writeImmutableJson(job.input_file, input, 'UNIT_ALREADY_ACTIVE');
}

function windowSequenceFor(units) {
  const first = Number(String(units[0] || '').split(':')[1]);
  if (!Number.isInteger(first) || first < 1) {
    throw new GameKbError('ACTIVE_WINDOW_INVALID', 'Cannot derive timing window sequence', { units });
  }
  return Math.floor((first - 1) / MAX_ACTIVE_UNITS) + 1;
}

function recordIssuedJobs(paths, jobs, windowSequence) {
  if (windowSequence) {
    recordRunTimingEvent(paths, { type: 'window_issued', window_sequence: windowSequence });
  }
  for (const job of jobs) {
    recordRunTimingEvent(paths, {
      type: 'attempt_issued',
      unit: job.unit,
      cycle: job.cycle,
      attempt: job.attempt,
      producer: job.producer
    });
  }
}

function issueJobs({ paths, manifest, progress, units, windowSequence }) {
  const prepared = units.map(unit => jobFromState({ paths, manifest, progress, unit }));
  for (const { job, input } of prepared) writeJobInput(paths, job, input);
  const jobs = prepared.map(entry => entry.job);
  recordIssuedJobs(paths, jobs, windowSequence);
  const next = transitionProgress(progress, {
    type: 'issue-window', jobs, manifest, paths
  });
  return { progress: next, jobs };
}

function issueNextWindow({ paths, manifest, progress }) {
  assertProgressInvariant(progress, manifest, paths);
  if (progress.active_units.length > 0) return { progress, jobs: [] };
  const window = pendingUnitsInOrder(progress, manifest).slice(0, MAX_ACTIVE_UNITS);
  if (window.length === 0) return { progress, jobs: [] };
  return issueJobs({
    paths,
    manifest,
    progress,
    units: window,
    windowSequence: windowSequenceFor(window)
  });
}

function issueRetryJob({ paths, manifest, progress, unit }) {
  assertProgressInvariant(progress, manifest, paths);
  const result = issueJobs({ paths, manifest, progress, units: [unit] });
  return { progress: result.progress, job: result.jobs[0] };
}

function advanceChapterWork({ paths, manifest, progress }) {
  assertProgressInvariant(progress, manifest, paths);
  const units = progress.units;
  const manualReview = Object.entries(units)
    .filter(([, state]) => state.status === 'rejected' && state.attempt >= 2)
    .map(([unit]) => unit);
  if (manualReview.length > 0) {
    return { status: 'manual_review', progress, jobs: [], manual_review: manualReview };
  }

  if (Object.values(units).every(state => state.status === 'accepted')) {
    return { status: 'ready-to-assemble', progress, jobs: [], manual_review: [] };
  }

  if (progress.active_units.length > 0) {
    const retryable = progress.active_units.filter(unit => {
      const state = units[unit];
      return (state.status === 'rejected' && state.attempt < 2)
        || (state.status === 'pending' && state.cycle >= 2 && state.attempt === 0);
    });
    if (retryable.length > 0) {
      const result = issueJobs({ paths, manifest, progress, units: retryable });
      return { status: 'dispatched', progress: result.progress, jobs: result.jobs, manual_review: [] };
    }
    return { status: 'waiting', progress, jobs: [], manual_review: [] };
  }

  const result = issueNextWindow({ paths, manifest, progress });
  if (result.jobs.length > 0) {
    return { status: 'dispatched', progress: result.progress, jobs: result.jobs, manual_review: [] };
  }
  return { status: 'waiting', progress, jobs: [], manual_review: [] };
}

function activeJobMetadata(paths, progress) {
  return progress.active_units.map(unit => {
    const state = progress.units[unit];
    return {
      unit,
      cycle: state.cycle,
      attempt: state.attempt,
      producer: state.producer,
      input_file: state.input_file,
      output_file: state.output_file,
      input_hash: state.input_hash,
      status: state.status
    };
  });
}

module.exports = {
  activeJobMetadata,
  advanceChapterWork,
  issueNextWindow,
  issueRetryJob,
  windowSequenceFor
};
