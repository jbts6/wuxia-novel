#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const { GameKbError } = require('./lib/errors');
const { acceptDraft, currentUnitInputHash, stableHash } = require('./lib/accept');
const { buildFinalData, writeFinalData } = require('./lib/finalize');
const { readJson } = require('./lib/io');
const { pathsFor } = require('./lib/paths');
const {
  loadProgress,
  resetUnit,
  saveProgress,
  setDeterministicUnit,
  statusReport
} = require('./lib/progress');
const { prepareNovel } = require('./lib/source');

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

function buildFinal(novelDir) {
  const paths = pathsFor(novelDir);
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
  const finalInputHash = stableHash({
    clean_input_hash: cleanState.input_hash,
    cleaned,
    chapters: manifest.chapters.map(chapter => ({ number: chapter.number, input_hash: chapter.input_hash }))
  });
  progress = setDeterministicUnit(progress, 'finalize:references', finalInputHash, result.issues);
  saveProgress(paths, progress);
  if (result.issues.length > 0) {
    fs.rmSync(paths.finalData, { recursive: true, force: true });
    throw new GameKbError('FINAL_PROJECTION_FAILED', 'Final IDs or references could not be projected uniquely', {
      issues: result.issues
    });
  }
  writeFinalData(paths, result);
  return {
    file_count: Object.keys(result.data).length,
    data_dir: paths.finalData,
    id_plan: paths.finalIdPlan
  };
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const args = argv.filter(value => value !== '--json');
  const [command, novelDir] = args;
  try {
    if (command === 'prepare') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'prepare requires <novel>');
      const manifest = prepareNovel(novelDir);
      const payload = {
        novel_dir: manifest.novel_dir,
        source_file: manifest.source_file,
        source_hash: manifest.source_hash,
        source_char_count: manifest.source_char_count,
        chapter_count: manifest.chapters.length,
        manifest: `${manifest.novel_dir}/.game-kb-work/manifest.json`
      };
      process.stdout.write(`${JSON.stringify(payload, null, json ? 0 : 2)}\n`);
      return;
    }
    if (command === 'status') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'status requires <novel>');
      const paths = pathsFor(novelDir);
      const manifest = readJson(paths.manifest);
      const progress = loadProgress(paths, manifest);
      process.stdout.write(`${JSON.stringify(statusReport(paths, manifest, progress), null, json ? 0 : 2)}\n`);
      return;
    }
    if (command === 'reset-unit') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'reset-unit requires <novel>');
      const unit = flagValue(args, '--unit');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'reset-unit requires --unit <id>');
      const paths = pathsFor(novelDir);
      const manifest = readJson(paths.manifest);
      const progress = loadProgress(paths, manifest);
      const reset = resetUnit(progress, unit, args.includes('--confirm'));
      saveProgress(paths, reset);
      process.stdout.write(`${JSON.stringify({ reset: unit })}\n`);
      return;
    }
    if (command === 'accept') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'accept requires <novel>');
      const unit = flagValue(args, '--unit');
      const draft = flagValue(args, '--draft');
      if (!unit) throw new GameKbError('UNIT_REQUIRED', 'accept requires --unit <id>');
      if (!draft) throw new GameKbError('DRAFT_REQUIRED', 'accept requires --draft <path>');
      const result = acceptDraft({ paths: pathsFor(novelDir), unit, draftPath: draft });
      process.stdout.write(`${JSON.stringify(result, null, json ? 0 : 2)}\n`);
      return;
    }
    if (command === 'build-final') {
      if (!novelDir) throw new GameKbError('NOVEL_DIR_REQUIRED', 'build-final requires <novel>');
      process.stdout.write(`${JSON.stringify(buildFinal(novelDir), null, json ? 0 : 2)}\n`);
      return;
    }
    throw new GameKbError('COMMAND_UNKNOWN', `Unknown command: ${command || '<missing>'}`);
  } catch (error) {
    fail(error, json);
  }
}

if (require.main === module) main();

module.exports = { main };
