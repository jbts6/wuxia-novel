#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./lib/errors');
const { archiveAbandoned, archiveExisting, archiveRun } = require('./lib/archive');
const { acceptDraft, currentUnitInputHash, semanticDecisionFile, stableHash } = require('./lib/accept');
const {
  acceptedArtifactHash,
  assertAcceptedArtifacts,
  buildCandidateLedger,
  recordAcceptedArtifact,
  releaseAcceptedDomainDecision,
  replaceInvalidDeterministicClean
} = require('./lib/candidate-ledger');
const { validateCleanedBook } = require('./lib/book-contract');
const { buildCandidateRegistry } = require('./lib/candidate-registry');
const {
  applyMergeDecision,
  assembleCleanedBook,
  assembleMergedBook,
  canonicalEventRefAliases,
  createMergeConsolidationWorkItem
} = require('./lib/book-assembly');
const { assembleDomainCleanedBook, assembleDomainMergedBook } = require('./lib/domain-assembly');
const { createDomainWorkPlan } = require('./lib/domain-work');
const { buildCleanObligations } = require('./lib/clean-obligations');
const { buildFinalData, writeFinalData } = require('./lib/finalize');
const { buildGameMaterials } = require('./lib/game-materials');
const { checkCoverage, checkResolution } = require('./lib/gaps');
const { installVerifiedData, verifyInstalled } = require('./lib/install');
const { atomicWriteJson, readJson } = require('./lib/io');
const { pathsFor } = require('./lib/paths');
const {
  loadProgress,
  freshUnit,
  reopenAcceptedDomainUnit,
  resetUnit,
  saveProgress,
  setDeterministicUnit,
  statusReport,
  syncPlannedUnits
} = require('./lib/progress');
const { buildChapterCoverage } = require('./lib/coverage');
const { buildQuantityReport } = require('./lib/quantity');
const { prepareNovel } = require('./lib/source');
const { SEMANTIC_PROFILE } = require('./lib/semantic-contract');
const {
  assertArchiveExistingAllowed,
  createOrResumeRun,
  resolveRun,
  resolveWritableRun
} = require('./lib/run');
const { recordScriptDuration } = require('./lib/timing');
const { ensureQualitySample, verifyFinal } = require('./lib/verify');
const { readWorkerPool, recordWorkerBackoff } = require('./lib/worker-pool');
const {
  createCleanWorkPlan,
  createMaterialWorkItem,
  createMergeWorkPlan,
  readWorkItem,
  readWorkPlan,
  writeWorkItem,
  writeWorkPlan
} = require('./lib/semantic-work');

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
    .filter(name => /^ch_\d+\.json$/.test(name))
    .sort()
    .map(name => readJson(`${paths.chapters}/${name}`));
}

function assertUnitsDone(progress, units, code = 'BOOK_ASSEMBLY_INCOMPLETE') {
  const incomplete = units.filter(unit => progress.units[unit]?.status !== 'done');
  if (incomplete.length > 0) {
    throw new GameKbError(code, 'All semantic dependencies must be accepted before deterministic assembly', {
      units: incomplete
    });
  }
}

function readDecisions(paths, units) {
  return Object.fromEntries(units.map(unit => {
    const inputHash = readWorkItem(paths, unit).input.input_hash;
    const file = semanticDecisionFile(paths, unit, inputHash);
    acceptedArtifactHash(paths, file);
    return [unit, readJson(file)];
  }));
}

function decisionHashes(paths, units) {
  return Object.fromEntries(units.map(unit => {
    const inputHash = readWorkItem(paths, unit).input.input_hash;
    return [unit, acceptedArtifactHash(paths, semanticDecisionFile(paths, unit, inputHash))];
  }));
}

function writeStableJson(file, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== content) {
      throw new GameKbError('WORK_ITEM_STALE', 'Existing deterministic work bytes differ', { file });
    }
    return false;
  }
  atomicWriteJson(file, value);
  return true;
}

function acceptedEventReferenceState(paths, plan, progress) {
  const eventInputs = (plan.inputs || []).filter(input => input.category === 'events');
  const descriptor = (plan.consolidations || []).find(value => value.category === 'events');
  const dependencyUnits = [
    ...eventInputs.map(input => input.unit),
    ...(descriptor ? [descriptor.unit] : [])
  ];
  if (dependencyUnits.some(unit => progress.units[unit]?.status !== 'done')) return null;
  assertUnitsDone(progress, dependencyUnits, 'MERGE_EVENTS_REQUIRED');
  const decisions = readDecisions(paths, dependencyUnits);
  const shardProjections = eventInputs.map(input => {
    const bindings = (plan.bindings || []).filter(binding => binding.unit === input.unit);
    return applyMergeDecision(input, bindings, decisions[input.unit]);
  });
  const finalProjection = descriptor
    ? (() => {
        const work = readWorkItem(paths, descriptor.unit);
        return applyMergeDecision(work.input, work.bindings, decisions[descriptor.unit]);
      })()
    : { resolutions: shardProjections.flatMap(projection => projection.resolutions || []) };
  return {
    aliases: canonicalEventRefAliases(finalProjection.resolutions, plan.bindings),
    dependency_units: dependencyUnits
  };
}

function prepareMerge(paths, manifest) {
  assertAcceptedArtifacts(paths);
  let progress = loadProgress(paths, manifest);
  const missing = manifest.chapters
    .map(chapter => `chapter:${String(chapter.number).padStart(3, '0')}`)
    .filter(unit => progress.units[unit]?.status !== 'done');
  if (missing.length > 0) {
    throw new GameKbError('MERGE_CHAPTERS_INCOMPLETE', 'Every chapter must be accepted before merge planning', {
      missing
    });
  }
  const chapters = acceptedChapters(paths);
  const acceptedHashes = Object.fromEntries(manifest.chapters.map(chapter => {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const file = path.join(paths.chapters, `ch_${String(chapter.number).padStart(3, '0')}.json`);
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
  const plan = createDomainWorkPlan({ registry, accepted_hashes: acceptedHashes });
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

function readWorkItemPath(paths, unit) {
  return path.join(paths.mergeWork, unit.replaceAll(':', '_'), 'input.json');
}

function assembleMerge(paths, manifest) {
  assertAcceptedArtifacts(paths);
  let progress = loadProgress(paths, manifest);
  const plan = readWorkPlan(paths, 'domain');
  const units = plan.inputs.map(input => input.unit);
  const pending = [];
  for (const input of plan.inputs) {
    const file = semanticDecisionFile(paths, input.unit, input.input_hash);
    if (!fs.existsSync(file)) continue;
    acceptedArtifactHash(paths, file);
    const entries = (readJson(file).decisions || []).filter(decision => decision.action === 'pending');
    if (entries.length > 0) pending.push({ input, file, entries });
  }
  if (pending.length > 0) {
    for (const recovery of pending) {
      progress = reopenAcceptedDomainUnit(progress, recovery.input.unit, {
        code: 'DOMAIN_PENDING_UNRESOLVED',
        path: 'decisions',
        target: recovery.entries.map(entry => entry.entry_ref).join(',')
      });
      releaseAcceptedDomainDecision(paths, recovery.file, recovery.input.input_hash);
    }
    saveProgress(paths, progress);
    throw new GameKbError('DOMAIN_PENDING_UNRESOLVED', 'Accepted domain decisions were reopened for semantic repair', {
      units: pending.map(recovery => ({
        unit: recovery.input.unit,
        entry_refs: recovery.entries.map(entry => entry.entry_ref)
      }))
    });
  }
  assertUnitsDone(progress, units);
  const decisions = Object.values(readDecisions(paths, units));
  const chapters = acceptedChapters(paths);
  acceptedArtifactHash(paths, paths.candidateRegistry);
  const book = assembleDomainMergedBook({
    work_plan: plan,
    decisions,
    registry: readJson(paths.candidateRegistry),
    chapters,
    manifest
  });
  const inputHash = currentUnitInputHash(paths, manifest, progress, 'merge:book');
  recordAcceptedArtifact(paths, paths.merged, inputHash, book);
  atomicWriteJson(
    paths.preCleanQuantity,
    buildQuantityReport(book, manifest.source_char_count, manifest.chapters.length)
  );
  progress = setDeterministicUnit(progress, 'merge:book', inputHash, []);
  saveProgress(paths, progress);
  return { unit: 'merge:book', status: 'done', attempts: 0, accepted_file: paths.merged };
}

function cleanDecisionState(paths, plan) {
  const units = plan.inputs.map(input => input.unit);
  return { units, decisions: readDecisions(paths, units), hashes: decisionHashes(paths, units) };
}

function prepareClean(paths, manifest) {
  assertAcceptedArtifacts(paths);
  let progress = loadProgress(paths, manifest);
  const mergeState = progress.units['merge:book'];
  if (mergeState?.status !== 'done' || !fs.existsSync(paths.merged)) {
    throw new GameKbError('CLEAN_MERGE_REQUIRED', 'A deterministic merged book is required before cleanup planning');
  }
  const currentMergeHash = currentUnitInputHash(paths, manifest, progress, 'merge:book');
  if (mergeState.input_hash !== currentMergeHash) {
    throw new GameKbError('CLEAN_MERGE_REQUIRED', 'The deterministic merged book is stale');
  }
  acceptedArtifactHash(paths, paths.merged);
  saveProgress(paths, progress);
  return {
    stage: 'clean',
    units: [],
    deterministic: true,
    written: false
  };
}

function materialCandidates(paths, draft) {
  const work = readWorkItem(paths, 'clean:materials:001');
  const byRef = new Map((work.bindings.bindings || []).map(binding => [binding.entity_ref, binding]));
  return draft.materials.map(material => {
    const binding = byRef.get(material.source_ref);
    if (!binding) {
      throw new GameKbError('WORK_REF_INVALID', 'Material source ref has no private binding', {
        source_ref: material.source_ref
      });
    }
    return {
      material_type: material.material_type,
      source_category: binding.source_category,
      source_name: binding.source_name,
      relevance: material.relevance,
      suggested_use: material.suggested_use,
      reason: material.reason
    };
  });
}

function assembleClean(paths, manifest) {
  assertAcceptedArtifacts(paths);
  let progress = loadProgress(paths, manifest);
  const book = assembleDomainCleanedBook(readJson(paths.merged));
  const chapters = acceptedChapters(paths);
  const errors = validateCleanedBook(book, manifest, chapters);
  if (errors.length > 0) {
    throw new GameKbError('DOMAIN_CLEAN_ASSEMBLY_INVALID', 'Deterministic domain clean violates the cleaned book contract', {
      errors
    });
  }
  const inputHash = currentUnitInputHash(paths, manifest, progress, 'clean:book');
  let repaired = false;
  if (fs.existsSync(paths.cleaned)) {
    acceptedArtifactHash(paths, paths.cleaned);
    const existing = readJson(paths.cleaned);
    if (stableHash(existing) !== stableHash(book)) {
      const existingErrors = validateCleanedBook(existing, manifest, chapters);
      if (existingErrors.length === 0) {
        throw new GameKbError('ACCEPTED_ARTIFACT_EXISTS', 'A valid cleaned artifact cannot be replaced', {
          accepted_file: paths.cleaned
        });
      }
      replaceInvalidDeterministicClean(paths, inputHash, book);
      repaired = true;
    }
  } else {
    recordAcceptedArtifact(paths, paths.cleaned, inputHash, book);
  }
  progress = setDeterministicUnit(progress, 'clean:book', inputHash, []);
  saveProgress(paths, progress);
  return { unit: 'clean:book', status: 'done', attempts: 0, repaired, accepted_file: paths.cleaned };
}

function ensureBoundedUnits(paths, manifest, units, inputHash) {
  let progress = loadProgress(paths, manifest);
  let changed = false;
  for (const unit of units) {
    const existing = progress.units[unit];
    if (!existing) {
      progress.units[unit] = freshUnit(inputHash);
      changed = true;
    } else if (existing.input_hash !== inputHash && existing.status !== 'done') {
      progress.units[unit] = freshUnit(inputHash, 'stale');
      changed = true;
    }
  }
  if (changed) progress = saveProgress(paths, progress);
  return progress;
}

function coverageInput(paths, manifest) {
  const chapters = acceptedChapters(paths);
  const coverage = buildChapterCoverage(chapters);
  const merged = fs.existsSync(paths.merged) ? readJson(paths.merged) : null;
  const ledger = merged ? buildCandidateLedger(chapters, merged) : null;
  const importantLevels = new Set(['核心', '重要', 'core', 'important']);
  const quotableEventChapters = new Set();
  for (const chapter of chapters) {
    for (const event of Array.isArray(chapter.events) ? chapter.events : []) {
      if (importantLevels.has(event.importance) && event.quote_status === 'quotable') {
        quotableEventChapters.add(chapter.chapter);
      }
    }
  }
  const itemRows = ledger ? ledger.rows.filter(row => row.category === 'items') : [];
  const noneFoundFile = `${paths.recalls}/items.json`;
  const noneFound = fs.existsSync(noneFoundFile) ? readJson(noneFoundFile).none_found : null;
  return {
    source_char_count: manifest.source_char_count,
    item_candidates: coverage.categories.items.candidate_count,
    merged_items: Array.isArray(merged?.items) ? merged.items.length : 0,
    item_resolutions_incomplete: Boolean(merged) && itemRows.some(row => row.resolution === 'ambiguous'),
    important_event_count: coverage.events.important_count,
    quotable_event_count: coverage.events.quotable_count,
    dialogue_covered: coverage.dialogues.quotable_event_count_with_candidates,
    quotable_event_chapters: [...quotableEventChapters].sort((a, b) => a - b),
    dialogue_chapters: [...coverage.dialogues.chapters],
    none_found: noneFound,
    chapter_coverage: coverage
  };
}

function checkCoverageForRun(paths, manifest) {
  assertAcceptedArtifacts(paths);
  const result = checkCoverage(coverageInput(paths, manifest));
  const report = {
    schema_version: 1,
    ...result,
    items: { recall_units: result.recall_units.filter(unit => unit.endsWith(':items')) },
    dialogue: { recall_units: result.recall_units.filter(unit => unit.endsWith(':dialogues')) }
  };
  atomicWriteJson(paths.coverage, report);
  ensureBoundedUnits(paths, manifest, result.recall_units, stableHash(report));
  return report;
}

function checkResolutionForRun(paths, manifest) {
  assertAcceptedArtifacts(paths);
  if (!fs.existsSync(paths.merged)) {
    throw new GameKbError('MERGED_BOOK_REQUIRED', 'check-resolution requires an accepted merge');
  }
  const chapters = acceptedChapters(paths);
  const merged = readJson(paths.merged);
  const cleaned = fs.existsSync(paths.cleaned) ? readJson(paths.cleaned) : null;
  const result = checkResolution({ chapters, merged, cleaned });
  const report = { schema_version: 1, ...result };
  atomicWriteJson(paths.candidateResolution, report);
  ensureBoundedUnits(paths, manifest, result.supplement_units, stableHash(report));
  return report;
}

function buildFinal(novelDir, runId) {
  const paths = pathsFor(novelDir, runId);
  const manifest = readJson(paths.manifest);
  let progress = loadProgress(paths, manifest);
  const blockingManual = Object.entries(progress.units)
    .filter(([unit, state]) => unit !== 'finalize:references' && state.status === 'manual_review')
    .map(([unit]) => unit);
  if (blockingManual.length > 0) {
    throw new GameKbError('MANUAL_REVIEW_BLOCKS_FINAL', 'Manual-review issues must be resolved before build-final', {
      units: blockingManual
    });
  }
  const unresolvedGaps = Object.entries(progress.units)
    .filter(([unit, state]) => /^(recall|supplement):/.test(unit) && state.status !== 'done')
    .map(([unit]) => unit);
  if (unresolvedGaps.length > 0) {
    throw new GameKbError('GAP_UNITS_BLOCK_FINAL', 'Bounded recall or supplement units must be resolved before build-final', {
      units: unresolvedGaps
    });
  }
  const cleanState = progress.units['clean:book'];
  if (cleanState?.status !== 'done' || !fs.existsSync(paths.cleaned)) {
    throw new GameKbError('CLEAN_BOOK_REQUIRED', 'A completed clean:book unit is required before build-final');
  }
  const currentCleanHash = currentUnitInputHash(paths, manifest, progress, 'clean:book');
  if (cleanState.input_hash !== currentCleanHash) {
    throw new GameKbError('CLEAN_BOOK_STALE', 'The accepted cleaned book does not match current upstream inputs');
  }

  const cleaned = readJson(paths.cleaned);
  const result = buildFinalData(cleaned, manifest);
  const materials = buildGameMaterials(result.data, cleaned.game_material_candidates);
  const finalIssues = [...result.issues, ...materials.issues];
  const finalInputHash = stableHash({
    clean_input_hash: cleanState.input_hash,
    cleaned,
    chapters: manifest.chapters.map(chapter => ({ number: chapter.number, input_hash: chapter.input_hash }))
  });
  progress = setDeterministicUnit(progress, 'finalize:references', finalInputHash, finalIssues);
  saveProgress(paths, progress);
  if (finalIssues.length > 0) {
    fs.rmSync(paths.finalData, { recursive: true, force: true });
    fs.rmSync(paths.finalReports, { recursive: true, force: true });
    throw new GameKbError('FINAL_PROJECTION_FAILED', 'Final IDs or references could not be projected uniquely', {
      issues: finalIssues
    });
  }
  writeFinalData(paths, result);
  atomicWriteJson(path.join(paths.finalReports, 'reference_projection_report.json'), {
    schema_version: 1,
    warnings: result.warnings
  });
  atomicWriteJson(paths.gameMaterials, { schema_version: 1, entries: materials.entries });
  const quantity = buildQuantityReport(cleaned, manifest.source_char_count, manifest.chapters.length);
  atomicWriteJson(paths.quantityReport, {
    ...quantity,
    review_consumed: true,
    explanations: [...cleaned.quantity_review.explanations]
  });
  return {
    file_count: Object.keys(result.data).length,
    data_dir: paths.finalData,
    id_plan: paths.finalIdPlan
  };
}

function verifyWorkspace(novelDir, runId) {
  const paths = pathsFor(novelDir, runId);
  assertAcceptedArtifacts(paths);
  const manifest = readJson(paths.manifest);
  ensureQualitySample(paths, manifest);
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
  const [command, novelDir] = args;
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
      const run = createOrResumeRun(novelDir, { runId: selectedRun });
      const manifest = prepareNovel(novelDir, { runId: run.run_id });
      timingRunJson = pathsFor(novelDir, run.run_id).runJson;
      const payload = {
        run_id: run.run_id,
        run_dir: run.run_dir,
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
    if (command === 'check-coverage') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'check-coverage requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const manifest = readJson(paths.manifest);
      emit(checkCoverageForRun(paths, manifest));
      return;
    }
    if (command === 'prepare-merge') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'prepare-merge requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      emit(prepareMerge(paths, readJson(paths.manifest)));
      return;
    }
    if (command === 'assemble-merge') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'assemble-merge requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      emit(assembleMerge(paths, readJson(paths.manifest)));
      return;
    }
    if (command === 'prepare-clean') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'prepare-clean requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      emit(prepareClean(paths, readJson(paths.manifest)));
      return;
    }
    if (command === 'assemble-clean') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'assemble-clean requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      emit(assembleClean(paths, readJson(paths.manifest)));
      return;
    }
    if (command === 'worker-backoff') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'worker-backoff requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
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
    if (command === 'check-resolution') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'check-resolution requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const manifest = readJson(paths.manifest);
      emit(checkResolutionForRun(paths, manifest));
      return;
    }
    if (command === 'status') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'status requires <novel>');
      const run = resolveRun(novelDir, requestedRun);
      const paths = pathsFor(novelDir, run.run_id);
      assertAcceptedArtifacts(paths);
      const manifest = readJson(paths.manifest);
      const progress = loadProgress(paths, manifest);
      emit({
        semantic_contract_version: run.semantic_contract_version ?? null,
        semantic_profile: run.semantic_profile ?? null,
        ...statusReport(paths, manifest, progress),
        worker_pool: readWorkerPool(paths)
      });
      return;
    }
    if (command === 'reset-unit') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'reset-unit requires <novel>');
      const unit = flagValue(args, '--unit');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'reset-unit requires --unit <id>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
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
      const run = resolveWritableRun(novelDir, requestedRun, command);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const result = acceptDraft({ paths, unit, draftPath: draft });
      emit(result);
      return;
    }
    if (command === 'build-final') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'build-final requires <novel>');
      const run = resolveWritableRun(novelDir, requestedRun, command);
      timingRunJson = pathsFor(novelDir, run.run_id).runJson;
      emit(buildFinal(novelDir, run.run_id));
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
    if (command === 'archive-abandoned') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'archive-abandoned requires <novel>');
      const run = resolveRun(novelDir, requestedRun);
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
      const run = resolveWritableRun(novelDir, requestedRun, command);
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
