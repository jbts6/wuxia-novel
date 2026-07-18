#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./lib/errors');
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
const { createDomainWorkPlan } = require('./lib/domain-work');
const { installVerifiedData, verifyInstalled } = require('./lib/install');
const { readJson, readYaml } = require('./lib/io');
const { resolveNextAction } = require('./lib/next-action');
const { pathsFor } = require('./lib/paths');
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
  PROFILE_V4,
  PROFILE_V5,
  SEMANTIC_PROFILE,
  requiredDomainUnitsForContract
} = require('./lib/semantic-contract');
const {
  assertArchiveExistingAllowed,
  assertSemanticContract,
  createOrResumeRun,
  resolveRun,
  resolveWritableRun
} = require('./lib/run');
const { recordScriptDuration } = require('./lib/timing');
const { verifyFinal } = require('./lib/verify');
const { readWorkerPool, recordWorkerBackoff } = require('./lib/worker-pool');
const { writeWorkPlan } = require('./lib/semantic-work');

const PROFILE_COMMANDS = Object.freeze({
  'v5-prepare': { command: 'prepare', profile: PROFILE_V5 },
  'v5-accept': { command: 'accept', profile: PROFILE_V5 },
  'v5-basic-curate': { command: 'basic-curate', profile: PROFILE_V5 },
  'v5-publish': { command: 'publish', profile: PROFILE_V5 },
  'v5-status': { command: 'status', profile: PROFILE_V5 }
});

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

function assertAssembleInputs(progress, manifest, semanticContractVersion) {
  const chapterUnits = (manifest.chapters || []).map(chapter => (
    `chapter:${String(chapter.number).padStart(3, '0')}`
  ));
  const units = [...chapterUnits, ...requiredDomainUnitsForContract(semanticContractVersion)];
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
    accepted_hashes: acceptedHashes
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

function verifyWorkspace(novelDir, runId) {
  const paths = pathsFor(novelDir, runId);
  const result = verifyFinal(paths);
  if (!result.passed) {
    throw new GameKbError('FINAL_VERIFICATION_FAILED', 'Final workspace did not pass verification', result);
  }
  return result;
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
    const timing = recordScriptDuration(timingRunJson, elapsedMs, command, timingUnit);
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
          selectedRun = resolveRun(novelDir, undefined, profile).run_id;
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
    if (command === 'plan-domains') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'plan-domains requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      emit(planDomains(paths, readJson(paths.manifest)));
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
      const run = resolveRun(novelDir, requestedRun, profile);
      const paths = pathsFor(novelDir, run.run_id);
      assertAcceptedArtifacts(paths);
      const manifest = readJson(paths.manifest);
      const progress = projectProgress(paths, manifest);
      const next = resolveNextAction({
        paths,
        manifest,
        progress,
        installed: verifyInstalled(novelDir)
      });
      const routedNext = profile === PROFILE_V5 && next.next_action === 'plan-domains'
        ? { next_action: 'v5-publish', next_units: [] }
        : next;
      emit({
        semantic_contract_version: run.semantic_contract_version ?? null,
        semantic_profile: run.semantic_profile ?? null,
        profile: run.profile ?? profile,
        ...statusReport(paths, manifest, progress),
        ...routedNext,
        worker_pool: readWorkerPool(paths)
      });
      return;
    }
    if (command === 'reset-unit') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'reset-unit requires <novel>');
      const unit = flagValue(args, '--unit');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'reset-unit requires --unit <id>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      timingUnit = unit;
      const manifest = readJson(paths.manifest);
      const progress = loadProgress(paths, manifest);
      const reset = resetUnit(progress, unit, args.includes('--confirm'));
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
      const manifest = readJson(paths.manifest);
      assertAssembleInputs(loadProgress(paths, manifest), manifest, run.semantic_contract_version);
      emit(assembleRun({ paths }));
      return;
    }
    if (command === 'publish') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'publish requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const manifest = readJson(paths.manifest);
      assertAssembleInputs(loadProgress(paths, manifest), manifest, run.semantic_contract_version);
      emit({ profile: run.profile ?? profile, ...assembleRun({ paths }) });
      return;
    }
    if (command === 'install') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'install requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command, profile);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
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
      timingRunJson = pathsFor(novelDir, run.run_id).runJson;
      emit(verifyWorkspace(novelDir, run.run_id));
      return;
    }
    throw new GameKbError('COMMAND_UNKNOWN', `Unknown command: ${command || '<missing>'}`);
  } catch (error) {
    fail(error, json);
  }
}

if (require.main === module) main();

module.exports = { main };
