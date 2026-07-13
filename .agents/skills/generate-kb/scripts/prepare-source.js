#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { assertLegacyWriteAllowed } = require('./lib/managed-write');
const { buildSourceIndex } = require('./lib/source');

function computeSourceArtifacts(novelDir, options = {}) {
  const sourceIndex = buildSourceIndex(novelDir, options);
  return {
    sourceIndex,
    scanPlan: {
      schema_version: 2,
      source_hash: sourceIndex.source_hash,
      chapter_corpus_hash: sourceIndex.chapter_corpus_hash,
      source_alignment_valid: sourceIndex.source_alignment_valid,
      window_lines: sourceIndex.window_lines,
      overlap_lines: sourceIndex.overlap_lines,
      required_window_ids: sourceIndex.windows.map(window => window.id),
      required_chapters: sourceIndex.chapters.map(chapter => chapter.chapter)
    }
  };
}

function parseArgs(argv) {
  const positional = [];
  const options = { windowLines: 120, overlapLines: 20 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--window-lines') options.windowLines = Number(argv[++index]);
    else if (argv[index] === '--overlap-lines') options.overlapLines = Number(argv[++index]);
    else if (argv[index] === '--dry-run') options.dryRun = true;
    else positional.push(argv[index]);
  }
  if (positional.length !== 1) {
    throw new Error('Usage: node prepare-source.js <novel-dir> [--window-lines N] [--overlap-lines N] [--dry-run]');
  }
  return { novelDir: path.resolve(positional[0]), options };
}

function prepareSource(novelDir, options = {}) {
  assertLegacyWriteAllowed(novelDir, { operation: 'prepare-source' });
  const { sourceIndex } = computeSourceArtifacts(novelDir, options);
  const buildDir = path.join(novelDir, 'build');
  const indexPath = path.join(buildDir, 'source-index.json');
  const manifestPath = path.join(buildDir, 'scan-manifest.json');
  const previousIndex = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
    : null;
  const previousManifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : null;
  const sameSource = previousIndex && previousManifest &&
    previousIndex.source_hash === sourceIndex.source_hash &&
    previousIndex.chapter_corpus_hash === sourceIndex.chapter_corpus_hash &&
    previousIndex.window_lines === sourceIndex.window_lines &&
    previousIndex.overlap_lines === sourceIndex.overlap_lines;
  const requiredWindowIds = sourceIndex.windows.map(window => window.id);
  const requiredWindowSet = new Set(requiredWindowIds);
  const passes = {};
  for (const pass of ['named-inventory', 'event-dialogue', 'gap-audit']) {
    const completed = sameSource
      ? previousManifest.passes?.[pass]?.completed_window_ids ?? []
      : [];
    passes[pass] = {
      completed_window_ids: [...new Set(completed)].filter(id => requiredWindowSet.has(id))
    };
  }
  const scanManifest = {
    schema_version: 1,
    source_hash: sourceIndex.source_hash,
    chapter_corpus_hash: sourceIndex.chapter_corpus_hash,
    required_window_ids: requiredWindowIds,
    passes,
    chapter_summary_chapters: sameSource
      ? previousManifest.chapter_summary_chapters ?? []
      : []
  };

  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(indexPath, `${JSON.stringify(sourceIndex, null, 2)}\n`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(scanManifest, null, 2)}\n`);
  return { sourceIndex, scanManifest };
}

if (require.main === module) {
  try {
    const { novelDir, options } = parseArgs(process.argv.slice(2));
    const { sourceIndex } = options.dryRun
      ? computeSourceArtifacts(novelDir, options)
      : prepareSource(novelDir, options);
    console.log(`Prepared ${sourceIndex.chapters.length} chapters and ${sourceIndex.windows.length} source windows.`);
    console.log(`Source SHA-256: ${sourceIndex.source_hash}`);
  } catch (error) {
    console.error(`${error.code ? `${error.code}: ` : ''}${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { computeSourceArtifacts, parseArgs, prepareSource };
