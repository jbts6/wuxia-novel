#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./lib/errors');
const { workerProjection } = require('./lib/chapter-batching');
const { assembleRun } = require('./lib/assemble');
const { archiveAbandoned, archiveExisting, archiveRun } = require('./lib/archive');
const { acceptDraft, assertDraftPath, stableHash } = require('./lib/accept');
const {
  applyBasicCurate,
  canonicalizeBasicCurateDecisions,
  validateBasicCurateDraft
} = require('./lib/basic-curate');
const {
  acceptedArtifactHash,
  assertAcceptedArtifacts,
  recordAcceptedArtifact
} = require('./lib/candidate-ledger');
const { buildCandidateRegistry } = require('./lib/candidate-registry');
const { importAcceptedChapters } = require('./lib/chapter-import');
const { createDomainWorkPlan } = require('./lib/domain-work');
const {
  addDeferredTask,
  resolvePublishedLitePaths,
  runDeferredTask
} = require('./lib/deferred-task');
const { applyOverlay } = require('./lib/overlay');
const { installVerifiedData, verifyInstalled } = require('./lib/install');
const { atomicWriteFile, readJson, readYaml } = require('./lib/io');
const { resolveNextAction } = require('./lib/next-action');
const { pathsFor, repositoryRootFor } = require('./lib/paths');
const {
  loadProgress,
  projectProgress,
  resetUnit,
  saveProgress,
  setOptionalUnitState,
  statusReport,
  syncPlannedUnits
} = require('./lib/progress');
const { prepareNovel } = require('./lib/source');
const {
  DOMAIN_UNITS,
  PROFILE_LITE,
  PROFILE_V4,
  SEMANTIC_PROFILE,
  normalizeProfileForRead,
  requiredDomainUnitsForProfile
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
const {
  assertNoUnresolvedWorkerGuards,
  openWorkerGuard,
  checkWorkerGuard,
  unresolvedWorkerGuardReports
} = require('./lib/worker-guard');
const { submitChapterEnvelope } = require('./lib/draft-submission');
const { preflightChapterDraft } = require('./lib/draft-preflight');
const { recoverChapterDraft } = require('./lib/draft-recovery');
const { readWorkerPool, recordWorkerBackoff } = require('./lib/worker-pool');
const { readWorkPlan, refreshWorkPlanUnit, writeWorkPlan } = require('./lib/semantic-work');

const PROFILE_COMMANDS = Object.freeze({
  'reset-unit': { command: 'reset-unit', profile: undefined },
  'retry-unit': { command: 'retry-unit', profile: undefined },
  'lite-prepare': { command: 'prepare', profile: PROFILE_LITE },
  'lite-accept': { command: 'accept', profile: PROFILE_LITE },
  'lite-basic-curate': { command: 'basic-curate', profile: PROFILE_LITE },
  'lite-publish': { command: 'publish', profile: PROFILE_LITE },
  'lite-status': { command: 'status', profile: PROFILE_LITE },
  'lite-guard-open': { command: 'guard-open', profile: PROFILE_LITE },
  'lite-guard-check': { command: 'guard-check', profile: PROFILE_LITE },
  'lite-submit-draft': { command: 'submit-draft', profile: PROFILE_LITE },
  'lite-check-draft': { command: 'check-draft', profile: PROFILE_LITE },
  'lite-recover-draft': { command: 'recover-draft', profile: PROFILE_LITE }
});
const GUARD_WINDOW_COMMANDS = new Set([
  'guard-open',
  'guard-check',
  'check-draft',
  'recover-draft'
]);

function routeCommand(requestedCommand) {
  return PROFILE_COMMANDS[requestedCommand] || {
    command: requestedCommand,
    profile: PROFILE_V4
  };
}

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

function acceptedChapters(paths) {
  if (!fs.existsSync(paths.chapters)) return [];
  return fs.readdirSync(paths.chapters)
    .filter(name => /^ch_\d+\.yaml$/.test(name))
    .sort()
    .map(name => readYaml(path.join(paths.chapters, name)));
}

function assertAssembleInputs(progress, manifest, semanticContractVersion, profile = PROFILE_V4) {
  const chapterUnits = (manifest.chapters || []).map(chapter => (
    `chapter:${String(chapter.number).padStart(3, '0')}`
  ));
  const requiredDomains = requiredDomainUnitsForProfile(profile, semanticContractVersion);
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

function planDomains(paths, manifest) {
  assertAcceptedArtifacts(paths);
  let progress = loadProgress(paths, manifest);
  const missing = manifest.chapters
    .map(chapter => `chapter:${String(chapter.number).padStart(3, '0')}`)
    .filter(unit => progress.units[unit]?.status !== 'done');
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
  progress = syncPlannedUnits(progress, plan.inputs);
  saveProgress(paths, progress);
  return {
    stage: 'domain',
    units: plan.inputs.map(input => input.unit),
    registry: paths.candidateRegistry,
    registry_stats: registry.stats,
    plan: written.plan,
    written: written.written
  };
}

function assertRefreshPath(paths, target) {
  const runRoot = path.resolve(paths.run);
  const resolved = path.resolve(target);
  if (!resolved.startsWith(`${runRoot}${path.sep}`)) {
    throw new GameKbError('DOMAIN_REFRESH_PATH_INVALID', 'Domain refresh path escapes the current run', {
      path: resolved,
      run: runRoot
    });
  }
  return resolved;
}

function snapshotRefreshPath(paths, target) {
  const resolved = assertRefreshPath(paths, target);
  function capture(current) {
    if (!fs.existsSync(current)) return { type: 'missing' };
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new GameKbError('DOMAIN_REFRESH_PATH_INVALID', 'Domain refresh cannot snapshot a symbolic link', {
        path: current
      });
    }
    if (stat.isFile()) return { type: 'file', bytes: fs.readFileSync(current) };
    if (!stat.isDirectory()) {
      throw new GameKbError('DOMAIN_REFRESH_PATH_INVALID', 'Domain refresh path has an unsupported type', {
        path: current
      });
    }
    return {
      type: 'directory',
      entries: fs.readdirSync(current).sort().map(name => ({
        name,
        snapshot: capture(path.join(current, name))
      }))
    };
  }
  return { path: resolved, snapshot: capture(resolved) };
}

function restoreRefreshPath(entry) {
  fs.rmSync(entry.path, { recursive: true, force: true });
  function restore(target, snapshot) {
    if (snapshot.type === 'missing') return;
    if (snapshot.type === 'file') {
      atomicWriteFile(target, snapshot.bytes);
      return;
    }
    fs.mkdirSync(target, { recursive: true });
    for (const child of snapshot.entries) restore(path.join(target, child.name), child.snapshot);
  }
  restore(entry.path, entry.snapshot);
}

function maybeDomainRefreshFault(options, point) {
  if (typeof options.injectFault === 'function') options.injectFault(point);
  if (options.faultAt === point) {
    throw new GameKbError(
      'DOMAIN_REFRESH_FAULT_INJECTED',
      `Injected domain refresh fault at ${point}`,
      { point }
    );
  }
}

function refreshDomainWork(paths, manifest, unit, confirmed, options = {}) {
  if (!confirmed) {
    throw new GameKbError('DOMAIN_REFRESH_CONFIRM_REQUIRED', 'refresh-domain-work requires --confirm', { unit });
  }
  if (!['distill:characters', 'distill:skills'].includes(unit)) {
    throw new GameKbError('DOMAIN_REFRESH_INVALID', 'Only character or skill work can be refreshed', { unit });
  }
  assertAcceptedArtifacts(paths);
  const progress = loadProgress(paths, manifest);
  const current = progress.units[unit];
  if (!current || current.status !== 'pending' || current.attempts !== 0
    || (current.output_hashes || []).length !== 0) {
    throw new GameKbError(
      'DOMAIN_REFRESH_INVALID',
      'Domain refresh requires a pending zero-attempt work unit',
      { unit, status: current?.status ?? null, attempts: current?.attempts ?? null }
    );
  }
  const currentPlan = readWorkPlan(paths, 'domain');
  const currentInput = currentPlan.inputs.find(input => input.unit === unit);
  if (!currentInput || current.input_hash !== currentInput.input_hash) {
    throw new GameKbError('WORK_ITEM_STALE', 'Domain progress differs from its work plan', {
      unit,
      progress_input_hash: current.input_hash,
      plan_input_hash: currentInput?.input_hash ?? null
    });
  }

  const acceptedHashes = Object.fromEntries(manifest.chapters.map(chapter => {
    const chapterUnit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const file = path.join(paths.chapters, `ch_${String(chapter.number).padStart(3, '0')}.yaml`);
    return [chapterUnit, acceptedArtifactHash(paths, file)];
  }));
  const registry = readJson(paths.candidateRegistry);
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
  const nextInput = plan.inputs.find(input => input.unit === unit);
  const unitName = unit.replaceAll(':', '_');
  const unitDirectory = path.join(paths.domainWork, unitName);
  const staleRoot = path.join(paths.domainWork, '_stale');
  const staleRootExisted = fs.existsSync(staleRoot);
  const snapshots = [
    snapshotRefreshPath(paths, unitDirectory),
    snapshotRefreshPath(paths, path.join(staleRoot, unitName)),
    snapshotRefreshPath(paths, path.join(paths.domainWork, 'plan.json')),
    snapshotRefreshPath(paths, paths.progress),
    snapshotRefreshPath(paths, currentInput.staging_path)
  ];
  try {
    const result = refreshWorkPlanUnit(paths, plan, unit, {
      afterWorkWrite: () => maybeDomainRefreshFault(options, 'after-work-write'),
      afterPlanWrite: () => maybeDomainRefreshFault(options, 'after-plan-write')
    });
    if (current.input_hash !== nextInput.input_hash) {
      progress.units[unit] = {
        ...current,
        input_hash: nextInput.input_hash,
        updated_at: new Date().toISOString()
      };
      maybeDomainRefreshFault(options, 'during-progress-save');
      saveProgress(paths, progress);
    }
    return result;
  } catch (error) {
    let rollbackError = null;
    for (const snapshot of [...snapshots].reverse()) {
      try {
        restoreRefreshPath(snapshot);
      } catch (candidate) {
        if (!rollbackError) rollbackError = candidate;
      }
    }
    if (!staleRootExisted && fs.existsSync(staleRoot)) {
      try {
        if (fs.readdirSync(staleRoot).length === 0) fs.rmdirSync(staleRoot);
      } catch (candidate) {
        if (!rollbackError) rollbackError = candidate;
      }
    }
    if (rollbackError) {
      error.details = {
        ...(error.details || {}),
        rollback_error: rollbackError.message
      };
    }
    throw error;
  }
}

function runBasicCurate(paths, manifest, { draftPath, skip }) {
  if (!fs.existsSync(paths.candidateRegistry)) {
    throw new GameKbError('CANDIDATE_REGISTRY_MISSING', 'basic-curate requires a deterministic candidate registry');
  }
  assertAcceptedArtifacts(paths);
  acceptedArtifactHash(paths, paths.candidateRegistry);
  const registry = readJson(paths.candidateRegistry);
  const inputHash = stableHash(registry);
  const artifactPath = path.join(path.dirname(paths.candidateRegistry), 'basic-curate.json');
  let progress = loadProgress(paths, manifest);
  if (fs.existsSync(artifactPath)) {
    acceptedArtifactHash(paths, artifactPath);
    const artifact = readJson(artifactPath);
    const errors = validateBasicCurateDraft({
      schema_version: artifact.schema_version,
      decisions: artifact.decisions
    }, registry);
    const curatedHash = errors.length === 0
      ? stableHash(applyBasicCurate(registry, artifact.decisions))
      : null;
    if (artifact.input_hash !== inputHash
      || errors.length > 0
      || artifact.curated_registry_hash !== curatedHash) {
      throw new GameKbError(
        'BASIC_CURATE_ACCEPTED_INVALID',
        'Accepted basic curation is not bound to the current candidate registry',
        { errors }
      );
    }
    if (progress.units['basic-curate']?.input_hash !== inputHash
      || progress.units['basic-curate'].status !== 'done') {
      progress = setOptionalUnitState(progress, 'basic-curate', inputHash, 'done');
      saveProgress(paths, progress);
    }
  }
  if (progress.units['basic-curate']?.input_hash === inputHash
    && progress.units['basic-curate'].status === 'done') {
    throw new GameKbError('UNIT_ALREADY_DONE', 'Completed basic-curate cannot be resubmitted');
  }

  if (skip) {
    progress = setOptionalUnitState(progress, 'basic-curate', inputHash, 'skipped');
    saveProgress(paths, progress);
    return { unit: 'basic-curate', status: 'skipped', registry: paths.candidateRegistry };
  }

  const resolvedDraft = assertDraftPath(paths, draftPath, 'basic-curate', 1);
  let draft;
  try {
    draft = readYaml(resolvedDraft);
  } catch (error) {
    const errors = [{ code: 'BASIC_CURATE_DRAFT_INVALID', path: '', target: error.message }];
    progress = setOptionalUnitState(progress, 'basic-curate', inputHash, 'failed', errors);
    saveProgress(paths, progress);
    throw new GameKbError('BASIC_CURATE_INVALID', 'Basic curation draft cannot be parsed', { errors });
  }
  const errors = validateBasicCurateDraft(draft, registry);
  if (errors.length > 0) {
    progress = setOptionalUnitState(progress, 'basic-curate', inputHash, 'failed', errors);
    saveProgress(paths, progress);
    throw new GameKbError('BASIC_CURATE_INVALID', 'Basic curation draft is invalid', { errors });
  }

  const decisions = canonicalizeBasicCurateDecisions(draft.decisions);
  const curatedRegistry = applyBasicCurate(registry, decisions);
  const artifact = {
    schema_version: 1,
    input_hash: inputHash,
    decisions,
    curated_registry_hash: stableHash(curatedRegistry)
  };
  if (fs.existsSync(artifactPath)) {
    acceptedArtifactHash(paths, artifactPath);
    if (stableHash(readJson(artifactPath)) !== stableHash(artifact)) {
      throw new GameKbError('BASIC_CURATE_ALREADY_ACCEPTED', 'Accepted basic curation differs from this draft');
    }
  } else {
    recordAcceptedArtifact(paths, artifactPath, inputHash, artifact);
  }
  progress = setOptionalUnitState(progress, 'basic-curate', inputHash, 'done');
  saveProgress(paths, progress);
  return {
    unit: 'basic-curate',
    status: 'done',
    registry: paths.candidateRegistry,
    decisions: artifactPath,
    curated_registry_hash: artifact.curated_registry_hash
  };
}

function verifyWorkspace(novelDir, runId, profile) {
  const paths = pathsFor(novelDir, runId);
  const result = verifyFinal(paths, { profile });
  if (!result.passed) {
    throw new GameKbError('FINAL_VERIFICATION_FAILED', 'Final workspace did not pass verification', result);
  }
  return result;
}

function projectWorkerJobs(chapterJobs) {
  return chapterJobs.map(job => workerProjection(job));
}

function main(argv = process.argv.slice(2)) {
  const commandStartedAt = process.hrtime.bigint();
  let timingRunJson = null;
  let timingUnit = '';
  const json = argv.includes('--json');
  const args = argv.filter(value => value !== '--json');
  const [requestedCommand, novelDir] = args;
  const route = routeCommand(requestedCommand);
  const command = route.command;
  const profile = route.profile;
  const requestedRun = flagValue(args, '--run');
  const emit = result => {
    const elapsedMs = Number(process.hrtime.bigint() - commandStartedAt) / 1e6;
    // Guard snapshots include run.json, so controller timing writes during the
    // guarded window would be indistinguishable from worker mutations.
    const timing = GUARD_WINDOW_COMMANDS.has(command)
      ? null
      : recordScriptDuration(timingRunJson, elapsedMs, command, timingUnit);
    const output = timing?.metrics_hash && result?.status === 'archived'
      ? { ...result, metrics_hash: timing.metrics_hash }
      : result;
    process.stdout.write(`${JSON.stringify(output, null, json ? 0 : 2)}\n`);
  };
  try {
    if (command === 'archive-existing') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'archive-existing requires <novel>');
      try {
        const existing = resolveRun(novelDir, requestedRun);
        assertSemanticContract(existing, command, profile);
      } catch (error) {
        if (!(error instanceof GameKbError)
          || !['RUN_REQUIRED', 'LEGACY_SEMANTIC_CONTRACT'].includes(error.code)) throw error;
      }
      assertArchiveExistingAllowed(novelDir);
      const result = archiveExisting(novelDir, {
        archiveId: flagValue(args, '--archive-id') || (requestedRun ? `before-${requestedRun}` : undefined)
      });
      emit(result);
      return;
    }
    if (command === 'prepare') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'prepare requires <novel>');
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
      const run = createOrResumeRun(novelDir, { runId: selectedRun, profile });
      const manifest = prepareNovel(novelDir, { runId: run.run_id });
      timingRunJson = pathsFor(novelDir, run.run_id).runJson;
      const payload = {
        run_id: run.run_id,
        run_dir: run.run_dir,
        profile: run.profile,
        resumed: run.resumed,
        novel_dir: manifest.novel_dir,
        source_file: manifest.source_file,
        source_hash: manifest.source_hash,
        source_char_count: manifest.source_char_count,
        chapter_count: manifest.chapters.length,
        manifest: pathsFor(novelDir, run.run_id).manifest
      };
      emit(payload);
      return;
    }
    if (command === 'import-chapters') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'import-chapters requires <novel>');
      const sourceRunId = flagValue(args, '--from-run');
      if (!sourceRunId) {
        throw new GameKbError('SOURCE_RUN_REQUIRED', 'import-chapters requires --from-run <run-id>');
      }
      if (!requestedRun) {
        throw new GameKbError('RUN_REQUIRED', 'import-chapters requires --run <run-id>');
      }
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      emit(importAcceptedChapters({
        novelDir,
        sourceRunId,
        targetRunId: run.run_id,
        confirmed: args.includes('--confirm'),
        faultAt: flagValue(args, '--fault-at')
      }));
      return;
    }
    if (command === 'plan-domains') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'plan-domains requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      emit(planDomains(paths, readJson(paths.manifest)));
      return;
    }
    if (command === 'refresh-domain-work') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'refresh-domain-work requires <novel>');
      const unit = flagValue(args, '--unit');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'refresh-domain-work requires --unit <id>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      timingUnit = unit;
      emit(refreshDomainWork(paths, readJson(paths.manifest), unit, args.includes('--confirm')));
      return;
    }
    if (command === 'basic-curate') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'basic-curate requires <novel>');
      const draft = flagValue(args, '--draft');
      const skip = args.includes('--skip');
      if (skip === Boolean(draft)) {
        throw new GameKbError('BASIC_CURATE_MODE_REQUIRED', 'basic-curate requires exactly one of --draft <path> or --skip');
      }
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      timingUnit = 'basic-curate';
      emit(runBasicCurate(paths, readJson(paths.manifest), { draftPath: draft, skip }));
      return;
    }
    if (command === 'worker-backoff') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'worker-backoff requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      emit({
        run_id: run.run_id,
        ...recordWorkerBackoff(paths, {
          batchId: flagValue(args, '--batch'),
          reason: flagValue(args, '--reason')
        })
      });
      return;
    }
    if (command === 'status') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'status requires <novel>');
      const run = resolveRun(novelDir, requestedRun);
      const effectiveProfile = normalizeProfileForRead(run.profile);
      assertSemanticContract({ ...run, profile: effectiveProfile }, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      assertAcceptedArtifacts(paths);
      const manifest = readJson(paths.manifest);
      const progress = projectProgress(paths, manifest);
      const acceptedSerialization = run.accepted_serialization ?? null;
      const next = acceptedSerialization === ACCEPTED_SERIALIZATION
        ? resolveNextAction({
          paths,
          manifest,
          progress,
          installed: verifyInstalled(novelDir)
        })
        : { next_action: 'start-new-run', next_units: [] };
      const routedNext = profile === PROFILE_LITE && next.next_action === 'plan-domains'
        ? { next_action: 'lite-publish', next_units: [] }
        : next;
      // Apply worker projection to strip staging_path from chapter_jobs
      if (routedNext.chapter_jobs) {
        routedNext.chapter_jobs = projectWorkerJobs(routedNext.chapter_jobs);
      }
      emit({
        semantic_contract_version: run.semantic_contract_version ?? null,
        semantic_profile: run.semantic_profile ?? null,
        profile: effectiveProfile,
        accepted_serialization: acceptedSerialization,
        ...statusReport(paths, manifest, progress),
        ...routedNext,
        worker_pool: readWorkerPool(paths)
      });
      return;
    }
    if (command === 'reset-unit' || command === 'retry-unit') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', `${command} requires <novel>`);
      const unit = flagValue(args, '--unit');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', `${command} requires --unit <id>`);
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      timingUnit = unit;
      const manifest = readJson(paths.manifest);
      const progress = loadProgress(paths, manifest);
      const reset = resetUnit(progress, unit, args.includes('--confirm'), command);
      saveProgress(paths, reset);
      emit({ reset: unit });
      return;
    }
    if (command === 'accept') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'accept requires <novel>');
      const unit = flagValue(args, '--unit');
      const draft = flagValue(args, '--draft');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'accept requires --unit <id>');
      if (!draft) throw new GameKbError('DRAFT_REQUIRED', 'accept requires --draft <path>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const result = acceptDraft({ paths, unit, draftPath: draft });
      emit(result);
      return;
    }
    if (command === 'assemble') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'assemble requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      assertNoUnresolvedWorkerGuards(paths);
      const manifest = readJson(paths.manifest);
      assertAssembleInputs(loadProgress(paths, manifest), manifest, run.semantic_contract_version, profile);
      emit(assembleRun({ paths, profile }));
      return;
    }
    if (command === 'publish') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'publish requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      assertNoUnresolvedWorkerGuards(paths);
      const manifest = readJson(paths.manifest);
      assertAssembleInputs(loadProgress(paths, manifest), manifest, run.semantic_contract_version, profile);
      const assembled = assembleRun({ paths, profile });
      const verified = verifyWorkspace(novelDir, run.run_id, profile);
      const installed = installVerifiedData(novelDir, { runId: run.run_id, profile });
      const archived = archiveRun(novelDir, run.run_id);
      emit({ profile: run.profile ?? profile, assembled, verified, installed, archived });
      return;
    }
    if (command === 'install') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'install requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      assertNoUnresolvedWorkerGuards(paths);
      assertAcceptedArtifacts(paths);
      emit(installVerifiedData(novelDir, { runId: run.run_id }));
      return;
    }
    if (command === 'archive-run') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'archive-run requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const result = archiveRun(novelDir, run.run_id);
      timingRunJson = path.join(result.archive_dir, 'run.json');
      emit(result);
      return;
    }
    if (command === 'archive-abandoned') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'archive-abandoned requires <novel>');
      const run = resolveRun(novelDir, requestedRun, profile);
      emit(archiveAbandoned(novelDir, run.run_id, {
        confirm: args.includes('--confirm'),
        reason: flagValue(args, '--reason')
      }));
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
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      assertNoUnresolvedWorkerGuards(paths);
      emit(verifyWorkspace(novelDir, run.run_id, profile));
      return;
    }
    if (command === 'task-add') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'task-add requires <novel>');
      const paths = resolvePublishedLitePaths(novelDir, requestedRun);
      emit(addDeferredTask({
        paths,
        type: flagValue(args, '--type'),
        scope: flagValue(args, '--scope'),
        requestedBy: flagValue(args, '--requested-by') || 'manual'
      }));
      return;
    }
    if (command === 'task-run') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'task-run requires <novel>');
      const paths = resolvePublishedLitePaths(novelDir, requestedRun);
      emit(runDeferredTask({ paths, taskId: flagValue(args, '--task-id'), draftPath: flagValue(args, '--draft') }));
      return;
    }
    if (command === 'task-apply') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'task-apply requires <novel>');
      const paths = resolvePublishedLitePaths(novelDir, requestedRun);
      emit(applyOverlay({ paths, taskId: flagValue(args, '--task-id') }));
      return;
    }
    if (command === 'guard-open') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'guard-open requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const manifest = readJson(paths.manifest);
      const progress = loadProgress(paths, manifest);
      const next = resolveNextAction({ paths, manifest, progress, installed: null });
      if (!next.chapter_jobs) {
        throw new GameKbError('NO_CHAPTER_JOBS', 'No chapter jobs available for guard', {});
      }
      const repositoryRoot = repositoryRootFor(novelDir);
      emit({
        run_id: run.run_id,
        ...openWorkerGuard({
          repositoryRoot,
          paths,
          job: next.chapter_jobs[0]
        })
      });
      return;
    }
    if (command === 'guard-check') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'guard-check requires <novel>');
      const guardId = flagValue(args, '--guard-id');
      if (!guardId) throw new GameKbError('GUARD_ID_REQUIRED', 'guard-check requires --guard-id <id>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const repositoryRoot = repositoryRootFor(novelDir);
      emit({
        run_id: run.run_id,
        ...checkWorkerGuard({ repositoryRoot, paths, guardId })
      });
      return;
    }
    if (command === 'submit-draft') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'submit-draft requires <novel>');
      const unit = flagValue(args, '--unit');
      const batchId = flagValue(args, '--batch');
      const attempt = Number(flagValue(args, '--attempt'));
      const guardId = flagValue(args, '--guard-id');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'submit-draft requires --unit <id>');
      if (!batchId) throw new GameKbError('BATCH_REQUIRED', 'submit-draft requires --batch <id>');
      if (!Number.isInteger(attempt) || attempt < 1) throw new GameKbError('ATTEMPT_REQUIRED', 'submit-draft requires --attempt <n>');
      if (!guardId) throw new GameKbError('GUARD_ID_REQUIRED', 'submit-draft requires --guard-id <id>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      timingUnit = unit;
      // Read stdin synchronously
      const rawInput = fs.readFileSync(0, 'utf8');
      emit(submitChapterEnvelope({ paths, guardId, batchId, unit, attempt, rawInput }));
      return;
    }
    if (command === 'check-draft') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'check-draft requires <novel>');
      const unit = flagValue(args, '--unit');
      const draftPath = flagValue(args, '--draft');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'check-draft requires --unit <id>');
      if (!draftPath) throw new GameKbError('DRAFT_REQUIRED', 'check-draft requires --draft <path>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const manifest = readJson(paths.manifest);
      emit(preflightChapterDraft({ paths, manifest, unit, draftPath }));
      return;
    }
    if (command === 'recover-draft') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'recover-draft requires <novel>');
      const unit = flagValue(args, '--unit');
      const sourcePath = flagValue(args, '--source');
      const guardId = flagValue(args, '--guard-id');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'recover-draft requires --unit <id>');
      if (!sourcePath) throw new GameKbError('SOURCE_REQUIRED', 'recover-draft requires --source <path>');
      if (!guardId) throw new GameKbError('GUARD_ID_REQUIRED', 'recover-draft requires --guard-id <id>');
      if (!args.includes('--confirm')) throw new GameKbError('CONFIRM_REQUIRED', 'recover-draft requires --confirm');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const manifest = readJson(paths.manifest);
      emit(recoverChapterDraft({
        repositoryRoot: repositoryRootFor(novelDir),
        paths,
        manifest,
        unit,
        sourcePath,
        confirmed: true,
        guardId
      }));
      return;
    }
    throw new GameKbError('COMMAND_UNKNOWN', `Unknown command: ${command || '<missing>'}`);
  } catch (error) {
    fail(error, json);
  }
}

if (require.main === module) main();

module.exports = { main, projectWorkerJobs, refreshDomainWork };
