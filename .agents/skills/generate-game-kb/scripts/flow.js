#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./lib/errors');
const { assembleRun } = require('./lib/assemble');
const { archiveAbandoned, archiveExisting, archiveRun } = require('./lib/archive');
const { acceptDraft, stableHash } = require('./lib/accept');
const {
  assertAcceptedArtifacts,
  acceptedArtifactHash,
  recordAcceptedArtifact
} = require('./lib/candidate-ledger');
const { buildCandidateRegistry } = require('./lib/candidate-registry');
const { createDomainWorkPlan } = require('./lib/domain-work');
const { installVerifiedData, verifyInstalled } = require('./lib/install');
const { readJson, readYaml } = require('./lib/io');
const { pathsFor } = require('./lib/paths');
const { writeWorkPlan } = require('./lib/semantic-work');
const {
  loadProgress,
  resetUnit,
  saveProgress,
  syncPlannedUnits
} = require('./lib/progress');
const { prepareNovel } = require('./lib/source');
const {
  DOMAIN_UNITS,
  SEMANTIC_PROFILE,
  requiredDomainUnitsForMode
} = require('./lib/semantic-contract');
const {
  ACCEPTED_SERIALIZATION,
  assertArchiveExistingAllowed,
  assertSemanticContract,
  createOrResumeRun,
  resolveRun,
  resolveWritableRun
} = require('./lib/run');
const { recordScriptDuration } = require('./lib/timing');
const { verifyFinal } = require('./lib/verify');
const { readWorkerPool } = require('./lib/worker-pool');
const { submitWorkerEnvelope } = require('./lib/submit');

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function deepFlag(args) {
  return args.includes('--deep');
}

function fail(error, json) {
  const normalized = error instanceof GameKbError
    ? error
    : new GameKbError('INTERNAL_ERROR', error.message || String(error));
  const payload = { code: normalized.code, message: normalized.message, details: normalized.details };
  process.stderr.write(json ? `${JSON.stringify(payload)}\n` : `[${payload.code}] ${payload.message}\n`);
  process.exitCode = 1;
}

function nextAttempt(progress, unit, inputHash) {
  const state = progress.units?.[unit];
  return !state || state.input_hash !== inputHash ? 1 : (state.attempts || 0) + 1;
}

function acceptedChapters(paths) {
  if (!fs.existsSync(paths.chapters)) return [];
  return fs.readdirSync(paths.chapters)
    .filter(name => /^ch_\d+\.yaml$/.test(name))
    .sort()
    .map(name => readYaml(path.join(paths.chapters, name)));
}

function assertAssembleInputs(progress, manifest, semanticContractVersion, deep = false) {
  const chapterUnits = (manifest.chapters || []).map(chapter => (
    `chapter:${String(chapter.number).padStart(3, '0')}`
  ));
  const requiredDomains = requiredDomainUnitsForMode(deep, semanticContractVersion);
  const units = [...chapterUnits, ...requiredDomains];
  const incomplete = units.filter(unit => progress.units[unit]?.status !== 'done');
  if (incomplete.length > 0) {
    throw new GameKbError(
      'BOOK_ASSEMBLY_INCOMPLETE',
      'All accepted inputs required by this semantic contract must be complete before assembly',
      { units: incomplete }
    );
  }
}

function ensureCandidateRegistry(paths, manifest, progress) {
  assertAcceptedArtifacts(paths);
  const prog = progress || loadProgress(paths, manifest);
  const missing = manifest.chapters
    .map(chapter => `chapter:${String(chapter.number).padStart(3, '0')}`)
    .filter(unit => prog.units[unit]?.status !== 'done');
  if (missing.length > 0) {
    throw new GameKbError('DOMAIN_CHAPTERS_INCOMPLETE', 'Every chapter must be accepted before domain planning', {
      missing
    });
  }
  const chapters = acceptedChapters(paths);
  const acceptedHashes = Object.fromEntries(manifest.chapters.map(chapter => {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const file = path.join(paths.chapters, `ch_${String(chapter.number).padStart(3, '0')}.yaml`);
    return [unit, acceptedArtifactHash(paths, file)];
  }));
  const registry = buildCandidateRegistry(chapters);
  const registryInputHash = stableHash({
    semantic_profile: SEMANTIC_PROFILE,
    accepted_hashes: acceptedHashes
  });
  if (fs.existsSync(paths.candidateRegistry)) {
    acceptedArtifactHash(paths, paths.candidateRegistry);
    if (stableHash(readJson(paths.candidateRegistry)) !== stableHash(registry)) {
      throw new GameKbError('CANDIDATE_REGISTRY_STALE', 'Existing candidate registry differs from current chapters');
    }
  } else {
    recordAcceptedArtifact(paths, paths.candidateRegistry, registryInputHash, registry);
  }
  return { registry, acceptedHashes };
}

function planDomains(paths, manifest, progress) {
  const { registry, acceptedHashes } = ensureCandidateRegistry(paths, manifest, progress);
  const plan = createDomainWorkPlan({
    registry,
    source_hash: manifest.source_hash,
    accepted_hashes: acceptedHashes,
    source_files: manifest.chapters.map(chapter => ({
      chapter: chapter.number,
      title: chapter.title,
      source_file: chapter.file,
      input_hash: chapter.input_hash
    }))
  });
  const written = writeWorkPlan(paths, plan);
  const nextProgress = syncPlannedUnits(progress || loadProgress(paths, manifest), plan.inputs);
  saveProgress(paths, nextProgress);
  return {
    stage: 'domain',
    units: plan.inputs.map(input => input.unit),
    registry: paths.candidateRegistry,
    registry_stats: registry.stats,
    plan: written.plan,
    written: written.written
  };
}

function verifyWorkspace(novelDir, runId, deep) {
  const paths = pathsFor(novelDir, runId);
  const result = verifyFinal(paths, { deep });
  if (!result.passed) {
    throw new GameKbError('FINAL_VERIFICATION_FAILED', 'Final workspace did not pass verification', result);
  }
  return result;
}

function extractPlan(paths, manifest, progress, deep = false) {
  const chapters = manifest.chapters.map(chapter => {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const inputHash = chapter.input_hash;
    return {
      unit,
      number: chapter.number,
      title: chapter.title,
      source_file: chapter.file,
      input_hash: inputHash,
      attempt: nextAttempt(progress, unit, inputHash)
    };
  });
  const incomplete = chapters
    .filter(chapter => progress.units[chapter.unit]?.status !== 'done')
    .map(chapter => chapter.unit);
  return {
    stage: 'extract',
    run_id: manifest.run_id,
    deep,
    concurrency: readWorkerPool(paths).concurrency_limit,
    chapters,
    incomplete,
    count: chapters.length
  };
}

// `run` is a progressive orchestrator. It advances as far as the current run
// state allows, returning either the next stage the controller (AI) must drive
// (chapter extraction or domain planning) or the final archived result. The AI
// is responsible for dispatching per-chapter sub-agents; the script only
// enforces the contract and the hard gates.
function runPipeline(novelDir, runId, deep = false) {
  const run = createOrResumeRun(novelDir, { runId, deep });
  const paths = pathsFor(novelDir, run.run_id);
  let manifest;
  try {
    manifest = readJson(paths.manifest);
  } catch (error) {
    manifest = prepareNovel(novelDir, { runId: run.run_id });
  }
  const resolvedDeep = run.deep === true;
  let progress = loadProgress(paths, manifest);

  // Phase 1: chapters
  const incompleteChapters = manifest.chapters.filter(chapter => {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    return progress.units[unit]?.status !== 'done';
  });
  if (incompleteChapters.length > 0) {
    return {
      ...extractPlan(paths, manifest, progress, resolvedDeep),
      incomplete: incompleteChapters.map(chapter => `chapter:${String(chapter.number).padStart(3, '0')}`)
    };
  }

  // Phase 2: domains (only for --deep runs)
  if (resolvedDeep) {
    const requiredDomains = DOMAIN_UNITS;
    const incompleteDomains = requiredDomains.filter(unit => progress.units[unit]?.status !== 'done');
    if (incompleteDomains.length > 0) {
      const result = planDomains(paths, manifest, progress);
      return {
        stage: 'plan-domains',
        run_id: run.run_id,
        deep: true,
        units: result.units,
        incomplete: incompleteDomains
      };
    }
  } else {
    // Lite assembly needs the immutable chapter-derived registry, but it must
    // not create any full-book domain work items.
    ensureCandidateRegistry(paths, manifest, progress);
  }

  // Phase 3-7: assemble -> verify -> install -> verify --installed -> archive
  const assembled = assembleRun({ paths, deep: resolvedDeep });
  verifyWorkspace(novelDir, run.run_id, resolvedDeep);
  const installed = installVerifiedData(novelDir, { runId: run.run_id, deep: resolvedDeep });
  const installedVerification = verifyInstalled(novelDir);
  if (!installedVerification.passed) {
    throw new GameKbError('INSTALLED_VERIFICATION_FAILED', 'Installed data did not pass verification', installedVerification);
  }
  const archived = archiveRun(novelDir, run.run_id);
  return {
    stage: 'archived',
    run_id: run.run_id,
    deep: resolvedDeep,
    assembled,
    installed,
    archived
  };
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
  return {
    semantic_contract_version: 7,
    run_id: run.run_id,
    novel_dir: run.novel_dir || run.novelDir,
    status: next.status,
    jobs: (next.jobs || []).map(job => ({ unit: job.unit, cycle: job.cycle, attempt: job.attempt, input: job.input, output: job.output })),
    active_units: next.progress?.active_units || [],
    manual_review: next.manual_review || []
  };
}

function v7RunPipeline(novelDir, requestedRun) {
  const { receiveAvailableChapterOutputs } = require('./lib/chapter-receiver');
  const { advanceChapterWork } = require('./lib/chapter-work');

  const run = createOrResumeRun(novelDir, { runId: requestedRun });
  if (run.semantic_contract_version && run.semantic_contract_version < 7) {
    throw new GameKbError('LEGACY_SEMANTIC_CONTRACT', 'Cannot run a legacy contract version', {
      run_id: run.run_id, version: run.semantic_contract_version
    });
  }
  const paths = pathsFor(novelDir, run.run_id);
  const manifest = readJson(paths.manifest);
  let progress = loadChapterProgress(paths, manifest);

  const received = receiveAvailableChapterOutputs({ paths, manifest, progress });
  progress = received.progress;

  const next = advanceChapterWork({ paths, manifest, progress });
  saveChapterProgress(paths, next.progress);

  if (next.status === 'ready-to-assemble') {
    assembleRun({ paths });
    const { verifyFinal } = require('./lib/verify');
    verifyFinal(novelDir, run.run_id);
    installVerifiedData(novelDir, { runId: run.run_id });
    archiveRun(novelDir, run.run_id);
    return publicRunResult(run, { status: 'complete', progress: next.progress, jobs: [], manual_review: [] });
  }

  return publicRunResult(run, next);
}

function v7Status(novelDir, requestedRun) {
  const { activeJobMetadata } = require('./lib/chapter-work');
  const run = resolveRun(novelDir, requestedRun);
  const paths = pathsFor(novelDir, run.run_id);
  const result = {
    semantic_contract_version: run.semantic_contract_version || 7,
    run_id: run.run_id,
    status: 'ok'
  };
  if (fs.existsSync(paths.progress)) {
    const progress = readJson(paths.progress);
    result.active_units = progress.active_units;
    result.jobs = activeJobMetadata(paths, progress);
    const manualReview = Object.entries(progress.units)
      .filter(([, state]) => state.status === 'rejected' && state.attempt >= 2)
      .map(([unit]) => unit);
    result.manual_review = manualReview;
  }
  return result;
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
      const run = resolveRun(novelDir, requestedRun);
      emit(archiveAbandoned(novelDir, run.run_id, {
        confirm: args.includes('--confirm'),
        reason: flagValue(args, '--reason')
      }));
      return;
    }
    throw new GameKbError('COMMAND_UNKNOWN', `Unknown command: ${command || '<missing>'}`);
  } catch (error) {
    fail(error, json);
  }
}

if (require.main === module) main();

module.exports = { main, publicCommands: () => ['archive-abandoned', 'retry-unit', 'run', 'status'] };
