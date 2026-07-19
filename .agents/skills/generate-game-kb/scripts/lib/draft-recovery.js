'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { acceptDraft } = require('./accept');
const { validateChapterDraft } = require('./chapter-contract');
const { GameKbError } = require('./errors');
const { atomicWriteFile, atomicWriteJson, serializeYaml } = require('./io');
const { loadProgress } = require('./progress');
const { stagingPathFor } = require('./paths');
const { sha256 } = require('./source');

function comparisonPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isWithin(parent, candidate) {
  const relative = path.relative(comparisonPath(parent), comparisonPath(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSafeRecoverySource(resolvedSource, repositoryRoot, paths) {
  // Check lstatSync - must be a regular file and not a symlink
  let stat;
  try {
    stat = fs.lstatSync(resolvedSource);
  } catch (error) {
    throw new GameKbError('RECOVERY_SOURCE_MISSING', 'Source file does not exist', { source: resolvedSource });
  }

  if (!stat.isFile()) {
    throw new GameKbError('RECOVERY_SOURCE_MISSING', 'Source path is not a file', { source: resolvedSource });
  }

  if (stat.isSymbolicLink()) {
    throw new GameKbError('RECOVERY_SOURCE_SYMLINK', 'Recovery source must not be a symbolic link', {
      source: resolvedSource
    });
  }

  // Verify realpath matches lexical path (no junctions)
  const realSource = fs.realpathSync(resolvedSource);
  const normalizedLexical = comparisonPath(resolvedSource);
  const normalizedReal = comparisonPath(realSource);

  if (normalizedLexical !== normalizedReal) {
    throw new GameKbError('RECOVERY_SOURCE_SYMLINK', 'Recovery source resolves to a different path (junction detected)', {
      source: resolvedSource,
      real_path: realSource
    });
  }

  // Real source must be within repository root
  const resolvedRoot = path.resolve(repositoryRoot);
  const realRoot = fs.realpathSync(resolvedRoot);
  if (!isWithin(realRoot, realSource)) {
    throw new GameKbError('RECOVERY_SOURCE_OUTSIDE', 'Source path must be within the repository', {
      source: resolvedSource,
      repositoryRoot: resolvedRoot
    });
  }

  // Source must not be under another run's .game-kb-work/runs/<run-id>/
  const runsDir = path.resolve(paths.runs);
  if (isWithin(runsDir, resolvedSource)) {
    const relativeToRuns = path.relative(runsDir, resolvedSource);
    const firstSegment = relativeToRuns.split(path.sep)[0];
    if (firstSegment && firstSegment !== paths.runId) {
      throw new GameKbError('RECOVERY_SOURCE_CROSS_RUN', 'Recovery source is in another run directory', {
        source: resolvedSource,
        current_run: paths.runId,
        source_run: firstSegment
      });
    }
  }
}

function nextAttempt(progress, unit, inputHash) {
  const state = progress.units[unit];
  return !state || state.input_hash !== inputHash ? 1 : state.attempts + 1;
}

function recoverChapterDraft({ repositoryRoot, paths, manifest, unit, sourcePath, confirmed, guardId }) {
  if (!confirmed) {
    throw new GameKbError('RECOVERY_NOT_CONFIRMED', 'Recovery requires explicit confirmation', { unit });
  }

  const resolvedSource = path.resolve(sourcePath);
  const resolvedRoot = path.resolve(repositoryRoot);

  // Security checks before reading content
  assertSafeRecoverySource(resolvedSource, resolvedRoot, paths);

  const chapterMatch = /^chapter:(\d{3})$/.exec(unit);
  if (!chapterMatch) {
    throw new GameKbError('UNIT_UNSUPPORTED', 'Only chapter units are supported by recovery', { unit });
  }

  const chapterNumber = Number(chapterMatch[1]);
  const chapter = manifest.chapters.find(c => c.number === chapterNumber);
  if (!chapter) {
    throw new GameKbError('UNIT_UNKNOWN', 'Chapter unit is not present in the manifest', { unit });
  }

  // Validate content
  const raw = fs.readFileSync(resolvedSource, 'utf8');
  let draft;
  try {
    draft = yaml.load(raw);
  } catch (error) {
    throw new GameKbError('RECOVERY_INVALID_CONTENT', 'Source file contains invalid YAML', {
      source: resolvedSource,
      parse_error: error.message
    });
  }

  const errors = validateChapterDraft(draft, {
    number: chapter.number,
    title: chapter.title,
    inputHash: chapter.input_hash,
    chapterText: fs.readFileSync(chapter.file, 'utf8')
  });

  if (errors.length > 0) {
    throw new GameKbError('RECOVERY_INVALID_CONTENT', 'Source file contains invalid draft content', {
      source: resolvedSource,
      errors
    });
  }

  // Derive current attempt from progress
  const progress = loadProgress(paths, manifest);
  const currentAttempt = nextAttempt(progress, unit, chapter.input_hash);

  // Determine destination (staging path for current attempt)
  const destinationPath = stagingPathFor(paths, unit, currentAttempt);

  if (fs.existsSync(destinationPath)) {
    throw new GameKbError('RECOVERY_DESTINATION_EXISTS', 'Destination staging path already exists', {
      destination: destinationPath
    });
  }

  // Write canonical YAML to destination
  const canonicalYaml = serializeYaml(draft);
  atomicWriteFile(destinationPath, canonicalYaml);

  // Create immutable receipt
  const receiptDir = paths.draftRecoveries;
  fs.mkdirSync(receiptDir, { recursive: true });
  const receiptFile = path.join(receiptDir, `${unit.replaceAll(':', '_')}_recovery.json`);

  const receipt = {
    schema_version: 1,
    guard_id: guardId || null,
    unit,
    attempt: currentAttempt,
    source_path: resolvedSource,
    destination_path: destinationPath,
    source_hash: sha256(raw),
    destination_hash: sha256(canonicalYaml),
    recovered_at: new Date().toISOString()
  };

  atomicWriteJson(receiptFile, receipt);

  // Call acceptDraft with the destination path
  const acceptance = acceptDraft({ paths, unit, draftPath: destinationPath });

  return {
    unit,
    attempt: currentAttempt,
    source_path: resolvedSource,
    destination_path: destinationPath,
    receipt_path: receiptFile,
    acceptance
  };
}

module.exports = { recoverChapterDraft };
