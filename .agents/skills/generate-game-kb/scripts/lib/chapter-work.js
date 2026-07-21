'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { chapterAttemptPaths } = require('./paths');
const { MAX_ACTIVE_UNITS, transitionProgress } = require('./chapter-progress');
const { TYPE_TAXONOMIES } = require('./type-taxonomy');

function pendingUnitsInOrder(progress, manifest) {
  return manifest.chapters
    .map(ch => `chapter:${String(ch.number).padStart(3, '0')}`)
    .filter(unit => progress.units[unit].status === 'pending');
}

function issueNextWindow({ paths, manifest, progress }) {
  if (progress.active_units.length > 0) {
    return { progress, jobs: [] };
  }
  const pending = pendingUnitsInOrder(progress, manifest);
  const window = pending.slice(0, MAX_ACTIVE_UNITS);
  if (window.length === 0) {
    return { progress, jobs: [] };
  }
  const jobs = window.map(unit => {
    const state = progress.units[unit];
    const cycle = state.cycle + 1;
    const attempt = 1;
    const jobPaths = chapterAttemptPaths(paths, unit, cycle, attempt);
    return { unit, cycle, attempt, input: jobPaths.input, output: jobPaths.output };
  });
  const next = transitionProgress(progress, { type: 'issue-window', jobs, manifest });
  writeJobInputs(paths, manifest, jobs);
  return { progress: next, jobs };
}

function issueRetryJob({ paths, manifest, progress, unit }) {
  const state = progress.units[unit];
  if (!state) throw new GameKbError('UNIT_NOT_FOUND', `Unknown unit: ${unit}`, { unit });
  if (state.status !== 'rejected') {
    throw new GameKbError('UNIT_NOT_REJECTED', `Unit ${unit} is ${state.status}, cannot retry`, { unit, status: state.status });
  }
  const attempt = state.attempt + 1;
  if (attempt > 2) {
    throw new GameKbError('ATTEMPTS_EXHAUSTED', `Unit ${unit} has no remaining attempts`, { unit, attempt });
  }
  const jobPaths = chapterAttemptPaths(paths, unit, state.cycle, attempt);
  const job = { unit, cycle: state.cycle, attempt, input: jobPaths.input, output: jobPaths.output };
  const next = transitionProgress(progress, { type: 'issue-window', jobs: [job], manifest });
  writeJobInputs(paths, manifest, [job]);
  return { progress: next, job };
}

function writeJobInputs(paths, manifest, jobs) {
  for (const job of jobs) {
    const chapter = manifest.chapters.find(
      ch => `chapter:${String(ch.number).padStart(3, '0')}` === job.unit
    );
    const input = {
      semantic_contract_version: 7,
      unit: job.unit,
      cycle: job.cycle,
      attempt: job.attempt,
      chapter: chapter.number,
      title: chapter.title,
      source_file: chapter.file,
      source_hash: chapter.input_hash,
      output_file: job.output,
      taxonomies: TYPE_TAXONOMIES
    };
    fs.mkdirSync(path.dirname(job.input), { recursive: true });
    const content = `${JSON.stringify(input, null, 2)}\n`;
    if (fs.existsSync(job.input)) {
      const existing = fs.readFileSync(job.input, 'utf8');
      if (existing !== content) {
        throw new GameKbError('UNIT_ALREADY_ACTIVE', `Input file exists with different content: ${job.input}`, {
          unit: job.unit, input: job.input
        });
      }
    } else {
      fs.writeFileSync(job.input, content, { flag: 'wx' });
    }
  }
}

function advanceChapterWork({ paths, manifest, progress }) {
  const units = progress.units;
  const manualReview = Object.entries(units)
    .filter(([, state]) => state.status === 'rejected' && state.attempt >= 2)
    .map(([unit]) => unit);
  if (manualReview.length > 0) {
    return { status: 'manual_review', progress, jobs: [], manual_review: manualReview };
  }

  const allAccepted = Object.values(units).every(state => state.status === 'accepted');
  if (allAccepted) {
    return { status: 'ready-to-assemble', progress, jobs: [], manual_review: [] };
  }

  if (progress.active_units.length > 0) {
    const rejectedInWindow = progress.active_units.filter(u => units[u].status === 'rejected');
    const jobs = [];
    let next = progress;
    for (const unit of rejectedInWindow) {
      const state = next.units[unit];
      if (state.attempt < 2) {
        const result = issueRetryJob({ paths, manifest, progress: next, unit });
        next = result.progress;
        jobs.push(result.job);
      }
    }
    if (jobs.length > 0) {
      return { status: 'dispatched', progress: next, jobs, manual_review: [] };
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
    const jobPaths = chapterAttemptPaths(paths, unit, state.cycle, state.attempt);
    return { unit, cycle: state.cycle, attempt: state.attempt, input: jobPaths.input, output: jobPaths.output, status: state.status };
  });
}

module.exports = { activeJobMetadata, advanceChapterWork, issueNextWindow, issueRetryJob };
