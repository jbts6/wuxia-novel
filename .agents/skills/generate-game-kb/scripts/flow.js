#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./lib/errors');
const { assembleRun } = require('./lib/assemble');
const { archiveAbandoned, archiveRun } = require('./lib/archive');
const { installVerifiedData } = require('./lib/install');
const { readJson } = require('./lib/io');
const { pathsFor } = require('./lib/paths');
const {
  createOrResumeRun,
  resolveRun,
  resolveRunReadOnly
} = require('./lib/run');

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function fail(error, json) {
  const normalized = error instanceof GameKbError
    ? error
    : new GameKbError('INTERNAL_ERROR', error.message || String(error));
  const payload = { code: normalized.code, message: normalized.message, details: normalized.details };
  process.stderr.write(json ? `${JSON.stringify(payload)}\n` : `[${payload.code}] ${payload.message}\n`);
  process.exitCode = 1;
}

function loadChapterProgress(paths, manifest) {
  const { createProgress } = require('./lib/chapter-progress');
  if (fs.existsSync(paths.progress)) {
    return readJson(paths.progress);
  }
  return createProgress(manifest);
}

function saveChapterProgress(paths, progress) {
  fs.mkdirSync(path.dirname(paths.progress), { recursive: true });
  fs.writeFileSync(paths.progress, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
}

function publicRunResult(run, next) {
  const progress = next.progress || null;
  const units = progress?.units && typeof progress.units === 'object'
    ? Object.values(progress.units)
    : [];
  return {
    semantic_contract_version: run.semantic_contract_version ?? 7,
    run_id: run.run_id,
    status: next.status === 'dispatched' ? 'jobs' : next.status,
    jobs: (next.jobs || []).map(job => ({
      unit: job.unit,
      cycle: job.cycle,
      attempt: job.attempt,
      producer: job.producer,
      input_file: job.input_file,
      output_file: job.output_file,
      input_hash: job.input_hash
    })),
    active_units: progress?.active_units || [],
    progress: progress ? {
      accepted: units.filter(state => state.status === 'accepted').length,
      total: units.length
    } : null,
    manual_review: Array.isArray(next.manual_review) && next.manual_review.length > 0
      ? next.manual_review
      : null
  };
}

function v7RunPipeline(novelDir, requestedRun) {
  const { receiveAvailableChapterOutputs } = require('./lib/chapter-receiver');
  const { advanceChapterWork } = require('./lib/chapter-work');
  const { prepareNovel } = require('./lib/source');

  const run = createOrResumeRun(novelDir, { runId: requestedRun });
  if (run.semantic_contract_version && run.semantic_contract_version < 7) {
    throw new GameKbError('LEGACY_SEMANTIC_CONTRACT', 'Cannot run a legacy contract version', {
      run_id: run.run_id, version: run.semantic_contract_version
    });
  }
  const paths = pathsFor(novelDir, run.run_id);
  if (!run.resumed) {
    prepareNovel(novelDir, { runId: run.run_id });
  }
  const manifest = readJson(paths.manifest);
  let progress = loadChapterProgress(paths, manifest);

  const received = receiveAvailableChapterOutputs({ paths, manifest, progress });
  progress = received.progress;

  const next = advanceChapterWork({ paths, manifest, progress });
  saveChapterProgress(paths, next.progress);

  if (next.status === 'ready-to-assemble') {
    const assembly = assembleRun({ paths });
    if (assembly.status === 'manual_review') {
      return publicRunResult(run, {
        status: 'manual_review',
        progress: next.progress,
        jobs: [],
        manual_review: assembly.manual_review
      });
    }
    const { verifyFinal } = require('./lib/verify');
    const workspace = verifyFinal(paths);
    if (!workspace.passed) {
      throw new GameKbError('WORKSPACE_VERIFICATION_FAILED', 'Workspace verification failed', workspace);
    }
    installVerifiedData(novelDir, { runId: run.run_id });
    const { verifyInstalled } = require('./lib/install');
    const installed = verifyInstalled(novelDir);
    if (!installed.passed) {
      throw new GameKbError('INSTALLED_VERIFICATION_FAILED', 'Installed verification failed', installed);
    }
    archiveRun(novelDir, run.run_id);
    return publicRunResult(run, { status: 'complete', progress: next.progress, jobs: [], manual_review: null });
  }

  return publicRunResult(run, next);
}

function v7Status(novelDir, requestedRun) {
  const { activeJobMetadata } = require('./lib/chapter-work');
  const run = resolveRunReadOnly(novelDir, requestedRun);
  const paths = pathsFor(novelDir, run.run_id);
  if (run.semantic_contract_version !== 7 || !fs.existsSync(paths.progress)) {
    return publicRunResult(run, {
      status: run.status === 'archived' ? 'complete' : 'waiting',
      progress: null,
      jobs: [],
      manual_review: null
    });
  }
  const progress = readJson(paths.progress);
  const chapterReview = Object.entries(progress.units)
    .filter(([, state]) => state.status === 'rejected' && state.attempt >= 2)
    .map(([unit]) => unit);
  const relationshipReview = fs.existsSync(paths.referenceRecovery)
    ? readJson(paths.referenceRecovery).recovery_units || []
    : [];
  const manualReview = [...new Set([...chapterReview, ...relationshipReview])].sort();
  const jobs = manualReview.length === 0 ? activeJobMetadata(paths, progress) : [];
  return publicRunResult(run, {
    status: manualReview.length > 0 ? 'manual_review' : (jobs.length > 0 ? 'jobs' : 'waiting'),
    progress,
    jobs,
    manual_review: manualReview
  });
}

function v7RetryUnit(novelDir, requestedRun, args) {
  const { issueRetryJob } = require('./lib/chapter-work');
  const unit = flagValue(args, '--unit');
  if (!unit) throw new GameKbError('UNIT_REQUIRED', 'retry-unit requires --unit <id>');
  if (!args.includes('--confirm')) {
    throw new GameKbError('CONFIRM_REQUIRED', 'retry-unit requires --confirm');
  }
  const run = resolveRun(novelDir, requestedRun);
  if (run.semantic_contract_version && run.semantic_contract_version < 7) {
    throw new GameKbError('LEGACY_SEMANTIC_CONTRACT', 'Cannot retry a legacy run', { run_id: run.run_id });
  }
  const paths = pathsFor(novelDir, run.run_id);
  const manifest = readJson(paths.manifest);
  const progress = loadChapterProgress(paths, manifest);
  const state = progress.units[unit];
  if (!state || (state.status !== 'rejected' || state.attempt < 2)) {
    throw new GameKbError('RETRY_UNIT_NOT_REVIEWABLE', `Unit ${unit} is not in manual_review`, { unit, status: state?.status });
  }
  const { transitionProgress } = require('./lib/chapter-progress');
  const reset = transitionProgress(progress, { type: 'retry-unit', unit, manifest });
  const result = issueRetryJob({ paths, manifest, progress: reset, unit });
  saveChapterProgress(paths, result.progress);
  return { semantic_contract_version: 7, run_id: run.run_id, status: 'retried', unit, job: result.job };
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const args = argv.filter(value => value !== '--json');
  const [command, novelDir] = args;
  const requestedRun = flagValue(args, '--run');
  const emit = result => {
    process.stdout.write(`${JSON.stringify(result, null, json ? 0 : 2)}\n`);
  };
  try {
    if (command === 'run') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'run requires <novel>');
      emit(v7RunPipeline(novelDir, requestedRun));
      return;
    }
    if (command === 'status') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'status requires <novel>');
      emit(v7Status(novelDir, requestedRun));
      return;
    }
    if (command === 'retry-unit') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'retry-unit requires <novel>');
      emit(v7RetryUnit(novelDir, requestedRun, args));
      return;
    }
    if (command === 'archive-abandoned') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'archive-abandoned requires <novel>');
      const runId = requestedRun || resolveRunReadOnly(novelDir).run_id;
      emit(archiveAbandoned(novelDir, runId));
      return;
    }
    throw new GameKbError('COMMAND_UNKNOWN', `Unknown command: ${command || '<missing>'}`);
  } catch (error) {
    fail(error, json);
  }
}

if (require.main === module) main();

module.exports = { main, publicCommands: () => ['archive-abandoned', 'retry-unit', 'run', 'status'] };
