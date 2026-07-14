#!/usr/bin/env node
'use strict';

const { GameKbError } = require('./lib/errors');
const { readJson } = require('./lib/io');
const { pathsFor } = require('./lib/paths');
const { loadProgress, resetUnit, saveProgress, statusReport } = require('./lib/progress');
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
    throw new GameKbError('COMMAND_UNKNOWN', `Unknown command: ${command || '<missing>'}`);
  } catch (error) {
    fail(error, json);
  }
}

if (require.main === module) main();

module.exports = { main };
