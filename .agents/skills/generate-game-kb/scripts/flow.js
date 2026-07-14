#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./lib/errors');
const { archiveExisting, archiveRun } = require('./lib/archive');
const { acceptDraft, currentUnitInputHash, stableHash } = require('./lib/accept');
const { assertAcceptedArtifacts, buildCandidateLedger } = require('./lib/candidate-ledger');
const { buildFinalData, writeFinalData } = require('./lib/finalize');
const { buildGameMaterials } = require('./lib/game-materials');
const { checkCoverage, checkResolution } = require('./lib/gaps');
const { installVerifiedData, verifyInstalled } = require('./lib/install');
const { atomicWriteJson, readJson } = require('./lib/io');
const { pathsFor } = require('./lib/paths');
const {
  loadProgress,
  freshUnit,
  resetUnit,
  saveProgress,
  setDeterministicUnit,
  statusReport
} = require('./lib/progress');
const { buildChapterCoverage } = require('./lib/coverage');
const { buildQuantityReport } = require('./lib/quantity');
const { prepareNovel } = require('./lib/source');
const { createOrResumeRun, resolveRun } = require('./lib/run');
const { recordScriptDuration } = require('./lib/timing');
const { ensureQualitySample, verifyFinal } = require('./lib/verify');
const { readWorkerPool, recordWorkerBackoff } = require('./lib/worker-pool');

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
  const json = argv.includes('--json');
  const args = argv.filter(value => value !== '--json');
  const [command, novelDir] = args;
  const requestedRun = flagValue(args, '--run');
  const emit = result => {
    const elapsedMs = Number(process.hrtime.bigint() - commandStartedAt) / 1e6;
    recordScriptDuration(timingRunJson, elapsedMs);
    process.stdout.write(`${JSON.stringify(result, null, json ? 0 : 2)}\n`);
  };
  try {
    if (command === 'archive-existing') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'archive-existing requires <novel>');
      const result = archiveExisting(novelDir, {
        archiveId: flagValue(args, '--archive-id') || (requestedRun ? `before-${requestedRun}` : undefined)
      });
      emit(result);
      return;
    }
    if (command === 'prepare') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'prepare requires <novel>');
      if (!requestedRun) archiveExisting(novelDir);
      const run = createOrResumeRun(novelDir, { runId: requestedRun });
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
      const run = resolveRun(novelDir, requestedRun);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const manifest = readJson(paths.manifest);
      emit(checkCoverageForRun(paths, manifest));
      return;
    }
    if (command === 'worker-backoff') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'worker-backoff requires <novel>');
      const run = resolveRun(novelDir, requestedRun);
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
      const run = resolveRun(novelDir, requestedRun);
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
        ...statusReport(paths, manifest, progress),
        worker_pool: readWorkerPool(paths)
      });
      return;
    }
    if (command === 'reset-unit') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'reset-unit requires <novel>');
      const unit = flagValue(args, '--unit');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'reset-unit requires --unit <id>');
      const run = resolveRun(novelDir, requestedRun);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
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
      const run = resolveRun(novelDir, requestedRun);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      const result = acceptDraft({ paths, unit, draftPath: draft });
      emit(result);
      return;
    }
    if (command === 'build-final') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'build-final requires <novel>');
      const run = resolveRun(novelDir, requestedRun);
      timingRunJson = pathsFor(novelDir, run.run_id).runJson;
      emit(buildFinal(novelDir, run.run_id));
      return;
    }
    if (command === 'install') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'install requires <novel>');
      const run = resolveRun(novelDir, requestedRun);
      const paths = pathsFor(novelDir, run.run_id);
      timingRunJson = paths.runJson;
      assertAcceptedArtifacts(paths);
      emit(installVerifiedData(novelDir, { runId: run.run_id }));
      return;
    }
    if (command === 'archive-run') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'archive-run requires <novel>');
      const run = resolveRun(novelDir, requestedRun);
      const result = archiveRun(novelDir, run.run_id);
      timingRunJson = path.join(result.archive_dir, 'run.json');
      emit(result);
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
      const run = resolveRun(novelDir, requestedRun);
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
