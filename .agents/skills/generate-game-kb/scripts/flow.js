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

function main(argv = process.argv.slice(2)) {
  const commandStartedAt = process.hrtime.bigint();
  let timingRunJson = null;
  let timingUnit = '';
  const json = argv.includes('--json');
  const args = argv.filter(value => value !== '--json');
  const [requestedCommand, novelDir] = args;
  const command = requestedCommand;
  const requestedRun = flagValue(args, '--run');
  const emit = result => {
    const elapsedMs = Number(process.hrtime.bigint() - commandStartedAt) / 1e6;
    const timing = recordScriptDuration(timingRunJson, elapsedMs, command, timingUnit);
    const output = timing?.metrics_hash && result?.status === 'archived'
      ? { ...result, metrics_hash: timing.metrics_hash }
      : result;
    process.stdout.write(`${JSON.stringify(output, null, json ? 0 : 2)}\n`);
  };
  try {
    if (command === 'prepare') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'prepare requires <novel>');
      const deep = deepFlag(args);
      let selectedRun = requestedRun;
      if (!selectedRun) {
        try {
          selectedRun = resolveRun(novelDir).run_id;
        } catch (error) {
          if (!(error instanceof GameKbError) || error.code !== 'RUN_REQUIRED') throw error;
          assertArchiveExistingAllowed(novelDir);
          archiveExisting(novelDir);
        }
      }
      const run = createOrResumeRun(novelDir, { runId: selectedRun, deep });
      const manifest = prepareNovel(novelDir, { runId: run.run_id });
      timingRunJson = pathsFor(novelDir, run.run_id).runJson;
      emit({
        run_id: run.run_id,
        run_dir: run.run_dir,
        deep: run.deep,
        resumed: run.resumed,
        novel_dir: manifest.novel_dir,
        source_file: manifest.source_file,
        source_hash: manifest.source_hash,
        source_char_count: manifest.source_char_count,
        chapter_count: manifest.chapters.length,
        manifest: pathsFor(novelDir, run.run_id).manifest
      });
      return;
    }
    if (command === 'extract-plan') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'extract-plan requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      emit(extractPlan(paths, readJson(paths.manifest), loadProgress(paths, readJson(paths.manifest)), run.deep));
      return;
    }
    if (command === 'submit') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'submit requires <novel>');
      const unit = flagValue(args, '--unit');
      const attempt = Number(flagValue(args, '--attempt'));
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'submit requires --unit <id>');
      if (!Number.isInteger(attempt) || attempt < 1) throw new GameKbError('ATTEMPT_REQUIRED', 'submit requires --attempt <n>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      timingUnit = unit;
      const rawInput = fs.readFileSync(0, 'utf8');
      emit(submitWorkerEnvelope({ paths, unit, attempt, rawInput }));
      return;
    }
    if (command === 'plan-domains') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'plan-domains requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      if (!run.deep) {
        throw new GameKbError(
          'DEEP_MODE_REQUIRED',
          'plan-domains is available only for runs created with prepare --deep',
          { run_id: run.run_id }
        );
      }
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      emit(planDomains(paths, readJson(paths.manifest)));
      return;
    }
    if (command === 'assemble') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'assemble requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const manifest = readJson(paths.manifest);
      const progress = loadProgress(paths, manifest);
      const selectedDeep = run.deep === true;
      assertAssembleInputs(progress, manifest, run.semantic_contract_version, selectedDeep);
      if (requiredDomainUnitsForMode(selectedDeep, run.semantic_contract_version).length === 0) {
        ensureCandidateRegistry(paths, manifest, progress);
      }
      emit(assembleRun({ paths, deep: selectedDeep }));
      return;
    }
    if (command === 'verify') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'verify requires <novel>');
      if (args.includes('--installed')) {
        const result = verifyInstalled(novelDir);
        if (!result.passed) {
          throw new GameKbError('INSTALLED_VERIFICATION_FAILED', 'Installed data did not pass verification', result);
        }
        emit(result);
        return;
      }
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      emit(verifyWorkspace(novelDir, run.run_id, run.deep));
      return;
    }
    if (command === 'install') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'install requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      assertAcceptedArtifacts(paths);
      emit(installVerifiedData(novelDir, { runId: run.run_id }));
      return;
    }
    if (command === 'archive-run') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'archive-run requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const result = archiveRun(novelDir, run.run_id);
      timingRunJson = path.join(result.archive_dir, 'run.json');
      emit(result);
      return;
    }
    if (command === 'archive-existing') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'archive-existing requires <novel>');
      try {
        const existing = resolveRun(novelDir, requestedRun);
        assertSemanticContract(existing, command, undefined);
      } catch (error) {
        if (!(error instanceof GameKbError) || !['RUN_REQUIRED', 'LEGACY_SEMANTIC_CONTRACT'].includes(error.code)) throw error;
      }
      assertArchiveExistingAllowed(novelDir);
      const result = archiveExisting(novelDir, {
        archiveId: flagValue(args, '--archive-id') || (requestedRun ? `before-${requestedRun}` : undefined)
      });
      emit(result);
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
    if (command === 'reset-unit' || command === 'retry-unit') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', `${command} requires <novel>`);
      const unit = flagValue(args, '--unit');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', `${command} requires --unit <id>`);
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      timingUnit = unit;
      const manifest = readJson(paths.manifest);
      const progress = loadProgress(paths, manifest);
      const updated = resetUnit(progress, unit, args.includes('--confirm'), command);
      saveProgress(paths, updated);
      emit({ reset: unit });
      return;
    }
    if (command === 'accept') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'accept requires <novel>');
      const unit = flagValue(args, '--unit');
      const draft = flagValue(args, '--draft');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'accept requires --unit <id>');
      if (!draft) throw new GameKbError('DRAFT_REQUIRED', 'accept requires --draft <path>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      timingUnit = unit;
      emit(acceptDraft({ paths, unit, draftPath: draft }));
      return;
    }
    if (command === 'run') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'run requires <novel>');
      const result = runPipeline(novelDir, requestedRun, deepFlag(args));
      timingRunJson = pathsFor(novelDir, result.run_id).runJson;
      emit(result);
      return;
    }
    throw new GameKbError('COMMAND_UNKNOWN', `Unknown command: ${command || '<missing>'}`);
  } catch (error) {
    fail(error, json);
  }
}

if (require.main === module) main();

module.exports = { main, runPipeline, extractPlan, planDomains, submitWorkerEnvelope };
