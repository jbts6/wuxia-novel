'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { commitSubmission } = require('./accept');
const { validateChapterDraft } = require('./chapter-contract');
const { GameKbError } = require('./errors');
const { atomicWriteFile, readJson, serializeYaml, writeImmutableJson } = require('./io');
const { loadProgress } = require('./progress');
const { stagingPathFor } = require('./paths');
const { sha256 } = require('./source');
const { unresolvedWorkerGuardReports } = require('./worker-guard');

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

function recoveryFiles(paths, unit, attempt) {
  const base = `${unit.replaceAll(':', '_')}_attempt_${String(attempt).padStart(2, '0')}_recovery`;
  return {
    binding: path.join(paths.draftRecoveries, `${base}-binding.json`),
    result: path.join(paths.draftRecoveries, `${base}-result.json`),
    receipt: path.join(paths.draftRecoveries, `${base}.json`)
  };
}

function openRecoveryBinding(file, candidate) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    let existing;
    try {
      existing = readJson(file);
    } catch (error) {
      throw new GameKbError('RECOVERY_RECEIPT_CONFLICT', 'Recovery binding is not valid JSON', {
        binding: file,
        cause: error.message
      });
    }
    const replayCandidate = { ...candidate, recovered_at: existing?.recovered_at };
    writeImmutableJson(file, replayCandidate, 'RECOVERY_RECEIPT_CONFLICT');
    return existing;
  }
  const binding = { ...candidate, recovered_at: new Date().toISOString() };
  writeImmutableJson(file, binding, 'RECOVERY_RECEIPT_CONFLICT');
  return binding;
}

function recoverChapterDraft({ repositoryRoot, paths, manifest, unit, sourcePath, confirmed, guardId, faultAt }) {
  if (!confirmed) {
    throw new GameKbError('RECOVERY_NOT_CONFIRMED', 'Recovery requires explicit confirmation', { unit });
  }

  const resolvedSource = path.resolve(sourcePath);
  const resolvedRoot = path.resolve(repositoryRoot);

  // Security checks before reading content
  assertSafeRecoverySource(resolvedSource, resolvedRoot, paths);

  // Verify guard-discovered source
  if (!guardId) {
    throw new GameKbError('RECOVERY_GUARD_REQUIRED', 'Recovery requires a guard ID', { unit });
  }
  const guardDir = paths.workerGuards;
  const guardFile = path.join(guardDir, `${guardId}.json`);
  if (!fs.existsSync(guardFile)) {
    throw new GameKbError('RECOVERY_GUARD_NOT_FOUND', 'Guard not found', { guard_id: guardId });
  }
  const normalizedSource = resolvedSource.split(path.sep).join('/');
  const reports = unresolvedWorkerGuardReports(paths);
  const matchingReport = reports.find(r => r.guard_id === guardId);
  if (!matchingReport) {
    throw new GameKbError('RECOVERY_GUARD_NO_VIOLATIONS', 'Guard has no unresolved violations', { guard_id: guardId });
  }
  const discovered = matchingReport.violations.some(v => {
    const violationPath = path.resolve(resolvedRoot, v.repository_relative).split(path.sep).join('/');
    return violationPath === normalizedSource;
  });
  if (!discovered) {
    throw new GameKbError('RECOVERY_SOURCE_NOT_GUARD_DISCOVERED', 'Source path not found in guard violations', {
      source: normalizedSource,
      guard_id: guardId
    });
  }

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

  const canonicalYaml = serializeYaml(draft);
  const sourceHash = sha256(raw);
  const destinationHash = sha256(canonicalYaml);

  // Derive current attempt from progress, while allowing one bound recovery to finish.
  const progress = loadProgress(paths, manifest);
  const existing = progress.units[unit];
  const completedAttempt = existing?.input_hash === chapter.input_hash && existing.status === 'done'
    ? existing.attempts
    : null;
  const completedFiles = completedAttempt ? recoveryFiles(paths, unit, completedAttempt) : null;
  const completedSubmissionId = completedAttempt
    ? `submission:${unit}:attempt:${completedAttempt}:${chapter.input_hash}`
    : null;
  const completedReplay = Boolean(
    completedFiles
    && fs.existsSync(completedFiles.binding)
    && existing.last_submission_id === completedSubmissionId
  );
  if (completedAttempt && !completedReplay) {
    throw new GameKbError('UNIT_ALREADY_DONE', 'Completed unchanged unit cannot be recovered', { unit });
  }
  if (existing?.input_hash === chapter.input_hash && existing.status === 'manual_review') {
    throw new GameKbError('UNIT_MANUAL_REVIEW', 'Manual-review unit requires an explicit reset', { unit });
  }
  const currentAttempt = completedReplay ? completedAttempt : nextAttempt(progress, unit, chapter.input_hash);
  const files = recoveryFiles(paths, unit, currentAttempt);
  const destinationPath = stagingPathFor(paths, unit, currentAttempt);

  if (fs.existsSync(files.receipt) && !fs.existsSync(files.binding)) {
    throw new GameKbError('RECOVERY_RECEIPT_CONFLICT', 'Recovery receipt already exists for this attempt', {
      receipt: files.receipt,
      unit,
      attempt: currentAttempt
    });
  }

  const binding = openRecoveryBinding(files.binding, {
    schema_version: 1,
    guard_id: guardId,
    unit,
    attempt: currentAttempt,
    source_path: resolvedSource,
    destination_path: destinationPath,
    source_hash: sourceHash,
    destination_hash: destinationHash
  });
  if (faultAt === 'binding') {
    throw new GameKbError('RECOVERY_FAULT_INJECTED', 'Fault after recovery phase', { phase: faultAt });
  }

  if (fs.existsSync(destinationPath)) {
    const existingDestinationHash = sha256(fs.readFileSync(destinationPath));
    if (existingDestinationHash !== destinationHash) {
      throw new GameKbError('RECOVERY_DESTINATION_EXISTS', 'Destination staging path already exists with different content', {
        destination: destinationPath,
        existing_hash: existingDestinationHash,
        expected_hash: destinationHash
      });
    }
  } else if (!completedReplay) {
    atomicWriteFile(destinationPath, canonicalYaml);
  }
  if (!completedReplay && faultAt === 'staging-written') {
    throw new GameKbError('RECOVERY_FAULT_INJECTED', 'Fault after recovery phase', { phase: faultAt });
  }

  const submissionId = `submission:${unit}:attempt:${currentAttempt}:${chapter.input_hash}`;
  const acceptance = commitSubmission({
    paths,
    unit,
    attempt: currentAttempt,
    inputHash: chapter.input_hash,
    submissionId,
    evidenceText: canonicalYaml,
    evidenceExtension: '.yaml',
    stagingPath: destinationPath,
    draft,
    prevalidationErrors: null,
    recordedAt: binding.recovered_at,
    checkpoint: phase => {
      if (faultAt === phase) {
        throw new GameKbError('RECOVERY_FAULT_INJECTED', 'Fault after recovery phase', { phase });
      }
    }
  });
  writeImmutableJson(files.result, acceptance, 'RECOVERY_RECEIPT_CONFLICT');
  if (faultAt === 'result') {
    throw new GameKbError('RECOVERY_FAULT_INJECTED', 'Fault after recovery phase', { phase: faultAt });
  }
  writeImmutableJson(files.receipt, binding, 'RECOVERY_RECEIPT_CONFLICT');

  return {
    unit,
    attempt: currentAttempt,
    source_path: resolvedSource,
    destination_path: destinationPath,
    receipt_path: files.receipt,
    acceptance
  };
}

module.exports = { recoverChapterDraft };
