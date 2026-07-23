'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { atomicWriteFile, atomicWriteJson, readJson } = require('./io');
const { pathsFor } = require('./paths');
const { buildEventRunMetrics, buildRunMetrics, derivePhaseDurations } = require('./timing');
const { assertSemanticContract, assertTimingContract } = require('./run');
const { recordRunTimingEvent } = require('./timing-events');
const archiveIntegrity = require('./archive-integrity');

const ARCHIVE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function assertNovelDirectory(novelDir) {
  const novel = path.resolve(novelDir);
  if (!fs.existsSync(novel) || !fs.statSync(novel).isDirectory()) {
    throw new GameKbError('NOVEL_DIR_MISSING', 'Novel directory does not exist', { novel });
  }
  return novel;
}

function sourceFileInRoot(novel) {
  const candidates = fs.readdirSync(novel, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.txt'))
    .map(entry => path.join(novel, entry.name))
    .sort();
  if (candidates.length === 0) throw new GameKbError('SOURCE_MISSING', 'No root novel text file found', { novel });
  if (candidates.length !== 1) {
    throw new GameKbError('SOURCE_AMBIGUOUS', 'Multiple root novel text files found', {
      candidates: candidates.map(file => path.basename(file))
    });
  }
  return candidates[0];
}

function archiveId(options = {}) {
  const value = options.archiveId || `before-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  if (!ARCHIVE_ID_PATTERN.test(value)) {
    throw new GameKbError('ARCHIVE_NESTED_TARGET', 'Archive id must be a single safe path segment', { archive_id: value });
  }
  return value;
}

function archiveReason(options = {}) {
  if (options.reason === undefined) return undefined;
  const reason = options.reason;
  if (!reason || typeof reason !== 'object' || Array.isArray(reason)
    || typeof reason.code !== 'string' || reason.code.trim() === '') {
    throw new GameKbError('ARCHIVE_REASON_INVALID', 'Archive reason must contain a non-empty code', {
      reason
    });
  }
  return reason;
}

function inspectEntry(root, sourcePath, archiveDir, relativePath, entries) {
  const target = path.join(root, relativePath);
  const manifestPath = relativePath.split(path.sep).join('/');
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) {
    const resolved = fs.realpathSync(target);
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new GameKbError('ARCHIVE_SYMLINK_ESCAPE', 'Archive input contains an out-of-root symlink', {
        path: target,
        target: resolved
      });
    }
    throw new GameKbError('ARCHIVE_SYMLINK_UNSUPPORTED', 'Archive input contains a symlink', { path: target });
  }
  const archivePath = path.join(archiveDir, relativePath);
  if (stat.isDirectory()) {
    entries.push({ relative_path: manifestPath, source_path: target, archive_path: archivePath, kind: 'directory' });
    for (const child of fs.readdirSync(target).sort()) {
      inspectEntry(root, sourcePath, archiveDir, path.join(relativePath, child), entries);
    }
    return;
  }
  if (!stat.isFile()) {
    throw new GameKbError('ARCHIVE_ENTRY_UNSUPPORTED', 'Archive input contains an unsupported filesystem entry', { path: target });
  }
  entries.push({
    relative_path: manifestPath,
    source_path: target,
    archive_path: archivePath,
    kind: 'file',
    size: stat.size,
    sha256: sha256File(target)
  });
}

function buildArchivePlan(novelDir, options = {}) {
  const reason = archiveReason(options);
  const novel = assertNovelDirectory(novelDir);
  const sourceFile = sourceFileInRoot(novel);
  const sourceName = path.basename(sourceFile);
  const archive = path.join(novel, '_archive');
  const id = archiveId(options);
  const archiveDir = path.join(archive, id);
  if (fs.existsSync(archiveDir)) {
    throw new GameKbError('ARCHIVE_PATH_COLLISION', 'Archive destination already exists', { archive_dir: archiveDir });
  }

  const retained = [sourceName, 'ch_split', '_archive'];
  const entries = [];
  const moves = [];
  for (const entry of fs.readdirSync(novel, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === sourceName || entry.name === 'ch_split' || entry.name === '_archive') continue;
    const sourcePath = path.join(novel, entry.name);
    moves.push({ source_path: sourcePath, archive_path: path.join(archiveDir, entry.name), relative_path: entry.name });
    inspectEntry(novel, sourceFile, archiveDir, entry.name, entries);
  }
  return {
    schema_version: 1,
    archive_id: id,
    novel_dir: novel,
    source_file: sourceFile,
    retained,
    archive_dir: archiveDir,
    moves,
    entries,
    ...(reason === undefined ? {} : { reason }),
    status: 'planned'
  };
}

function moveEntry(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(source, destination);
}

function rollbackMoves(moved) {
  for (const entry of [...moved].reverse()) {
    if (!fs.existsSync(entry.archive_path)) continue;
    fs.mkdirSync(path.dirname(entry.source_path), { recursive: true });
    fs.renameSync(entry.archive_path, entry.source_path);
  }
}

function assertCleanNovelRoot(novelDir) {
  const novel = assertNovelDirectory(novelDir);
  const source = sourceFileInRoot(novel);
  const allowed = new Set([path.basename(source), 'ch_split', '_archive']);
  const extra = fs.readdirSync(novel).filter(name => !allowed.has(name));
  if (extra.length > 0) {
    throw new GameKbError('DIRTY_NOVEL_ROOT', 'Novel root contains entries outside the archive allowlist', { extra });
  }
  if (!fs.existsSync(path.join(novel, 'ch_split')) || !fs.statSync(path.join(novel, 'ch_split')).isDirectory()) {
    throw new GameKbError('CH_SPLIT_REQUIRED', 'ch_split directory is required after archival', { novel });
  }
  if (!fs.existsSync(path.join(novel, '_archive')) || !fs.statSync(path.join(novel, '_archive')).isDirectory()) {
    throw new GameKbError('ARCHIVE_ROOT_REQUIRED', '_archive directory is required after archival', { novel });
  }
}

function archiveExisting(novelDir, options = {}) {
  const plan = buildArchivePlan(novelDir, options);
  const archiveRoot = path.dirname(plan.archive_dir);
  const archiveRootExisted = fs.existsSync(archiveRoot);
  fs.mkdirSync(archiveRoot, { recursive: true });
  fs.mkdirSync(plan.archive_dir);
  atomicWriteJson(path.join(plan.archive_dir, 'archive-manifest.json'), plan);
  const moved = [];
  try {
    for (const move of plan.moves) {
      if (options.failAfterMoves !== undefined && moved.length >= options.failAfterMoves) {
        throw new Error('fault injected after move count');
      }
      moveEntry(move.source_path, move.archive_path);
      moved.push(move);
    }
    fs.mkdirSync(path.join(plan.novel_dir, 'ch_split'), { recursive: true });
    const receipt = { ...plan, status: 'archived', archived_at: new Date().toISOString() };
    atomicWriteJson(path.join(plan.archive_dir, 'archive-manifest.json'), receipt);
    assertCleanNovelRoot(plan.novel_dir);
    return { archive_dir: plan.archive_dir, status: 'archived', entries: plan.entries.length };
  } catch (cause) {
    rollbackMoves(moved);
    fs.rmSync(plan.archive_dir, { recursive: true, force: true });
    if (!archiveRootExisted && fs.existsSync(archiveRoot) && fs.readdirSync(archiveRoot).length === 0) {
      fs.rmdirSync(archiveRoot);
    }
    throw new GameKbError('ARCHIVE_MOVE_FAILED', 'Archive failed and was rolled back', { cause: cause.message });
  }
}

function maybeArchiveFault(options, point) {
  if (typeof options.injectFault === 'function') options.injectFault(point);
  if (options.faultAt === point) {
    throw new GameKbError('ARCHIVE_FAULT_INJECTED', `Injected archive fault at ${point}`, { point });
  }
}

function archiveTimestamp(options) {
  const value = typeof options.now === 'function' ? options.now() : new Date();
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new GameKbError('TIMING_EVENTS_INVALID', 'Archive completion timestamp is invalid');
  }
  return parsed.toISOString();
}

function previousArchiveState(paths) {
  return {
    runJson: fs.readFileSync(paths.runJson),
    metrics: fs.existsSync(paths.runMetrics) ? fs.readFileSync(paths.runMetrics) : null,
    events: fs.existsSync(paths.events) ? fs.readFileSync(paths.events) : null
  };
}

function restoreArchiveFile(file, content) {
  if (content === null) fs.rmSync(file, { force: true });
  else atomicWriteFile(file, content);
}

function writeArchiveMetrics(paths, metadata, archivedAt) {
  if (metadata.timing_contract_version !== undefined
    && metadata.timing_contract_version !== 1) {
    throw new GameKbError('TIMING_CONTRACT_UNSUPPORTED', 'Timing contract version is unsupported', {
      timing_contract_version: metadata.timing_contract_version
    });
  }
  if (metadata.timing_contract_version === 1) {
    recordRunTimingEvent(paths, { type: 'phase_completed', phase: 'archive' }, {
      occurredAt: archivedAt
    });
    const metrics = buildEventRunMetrics(paths, metadata, archivedAt);
    atomicWriteJson(paths.runMetrics, metrics);
    return metrics.phase_durations;
  }
  const progress = fs.existsSync(paths.progress) ? readJson(paths.progress) : { units: {} };
  const durations = derivePhaseDurations(metadata, progress, archivedAt);
  const metrics = buildRunMetrics(paths, metadata, progress, archivedAt);
  atomicWriteJson(paths.runMetrics, { ...metrics, phase_durations: durations });
  return durations;
}

function rollbackArchive(paths, archiveDir, previous) {
  if (!fs.existsSync(paths.run) && fs.existsSync(archiveDir)) {
    fs.renameSync(archiveDir, paths.run);
  }
  if (!fs.existsSync(paths.run)) return;
  restoreArchiveFile(paths.runJson, previous.runJson);
  restoreArchiveFile(paths.runMetrics, previous.metrics);
  restoreArchiveFile(paths.events, previous.events);
  fs.rmSync(path.join(paths.run, 'archive-receipt.json'), { force: true });
}

function removeEmptyRunParents(paths) {
  const runsDir = path.dirname(paths.run);
  if (fs.existsSync(runsDir) && fs.readdirSync(runsDir).length === 0) fs.rmdirSync(runsDir);
  const workDir = path.dirname(runsDir);
  if (fs.existsSync(workDir) && fs.readdirSync(workDir).length === 0) fs.rmdirSync(workDir);
}

function completeArchiveTransaction(context, paths, archiveDir, options) {
  const previous = previousArchiveState(paths);
  fs.mkdirSync(path.dirname(archiveDir), { recursive: true });
  try {
    fs.renameSync(paths.run, archiveDir);
    maybeArchiveFault(options, 'after_move');
    const archivedPaths = archiveIntegrity.relocateRunPaths(paths, archiveDir);
    archiveIntegrity.verifyRunArtifacts(archivedPaths);
    maybeArchiveFault(options, 'after_archive_verification');
    const archivedAt = archiveTimestamp(options);
    const durations = writeArchiveMetrics(archivedPaths, context.metadata, archivedAt);
    atomicWriteJson(archivedPaths.runJson, {
      ...context.metadata,
      status: 'archived',
      archived_at: archivedAt,
      phase_durations: durations
    });
    maybeArchiveFault(options, 'after_metadata_write');
    maybeArchiveFault(options, 'after_timing_write');
    const receipt = archiveIntegrity.buildArchiveReceipt(
      context, archivedPaths, archiveDir, archivedAt
    );
    atomicWriteJson(path.join(archiveDir, 'archive-receipt.json'), receipt);
    maybeArchiveFault(options, 'after_receipt_write');
    archiveIntegrity.verifyArchivedTimingEvidence(archiveDir);
    removeEmptyRunParents(paths);
    return receipt;
  } catch (error) {
    try {
      rollbackArchive(paths, archiveDir, previous);
    } catch (rollbackError) {
      throw new GameKbError('ARCHIVE_ROLLBACK_FAILED', 'Run archive failed and rollback was incomplete', {
        cause: error.message,
        rollback_cause: rollbackError.message
      });
    }
    throw new GameKbError('ARCHIVE_MOVE_FAILED', 'Run archive failed and was rolled back', {
      cause: error.message
    });
  }
}

function archiveRun(novelDir, runId, options = {}) {
  const novel = assertNovelDirectory(novelDir);
  if (typeof runId !== 'string' || !ARCHIVE_ID_PATTERN.test(runId)) {
    throw new GameKbError('RUN_REQUIRED', 'archive-run requires a safe run id', { run_id: runId });
  }
  const paths = pathsFor(novel, runId);
  if (!fs.existsSync(paths.runJson)) {
    throw new GameKbError('RUN_MISSING', 'Requested run does not exist', { run_id: runId });
  }
  const metadata = readJson(paths.runJson);
  assertSemanticContract(metadata, 'archive-run');
  assertTimingContract(metadata, 'archive-run');
  const archiveDir = path.join(novel, '_archive', 'generate-game-kb', runId);
  if (fs.existsSync(archiveDir)) {
    throw new GameKbError('ARCHIVE_PATH_COLLISION', 'Run archive destination already exists', {
      archive_dir: archiveDir
    });
  }
  const context = archiveIntegrity.collectArchiveEvidence(novel, paths, metadata, runId);
  return completeArchiveTransaction({ ...context, metadata }, paths, archiveDir, options);
}

function archiveAbandoned(novelDir, runId) {
  const novel = assertNovelDirectory(novelDir);
  if (typeof runId !== 'string' || !ARCHIVE_ID_PATTERN.test(runId)) {
    throw new GameKbError('RUN_REQUIRED', 'archive-abandoned requires a safe run id', { run_id: runId });
  }
  const paths = pathsFor(novel, runId);
  if (!fs.existsSync(paths.runJson)) {
    throw new GameKbError('RUN_MISSING', 'Requested run does not exist', { run_id: runId });
  }
  const archiveDir = path.join(novel, '_archive', 'generate-game-kb', 'abandoned', runId);
  if (fs.existsSync(archiveDir)) {
    throw new GameKbError('ARCHIVE_PATH_COLLISION', 'Abandoned archive destination already exists', {
      archive_dir: archiveDir
    });
  }
  fs.mkdirSync(path.dirname(archiveDir), { recursive: true });
  try {
    fs.renameSync(paths.run, archiveDir);
    const runsDir = path.dirname(paths.run);
    if (fs.existsSync(runsDir) && fs.readdirSync(runsDir).length === 0) fs.rmdirSync(runsDir);
    const workDir = path.dirname(runsDir);
    if (fs.existsSync(workDir) && fs.readdirSync(workDir).length === 0) fs.rmdirSync(workDir);
    return { status: 'archived-abandoned', run_id: runId, archiveDir };
  } catch (error) {
    if (!fs.existsSync(paths.run) && fs.existsSync(archiveDir)) fs.renameSync(archiveDir, paths.run);
    throw new GameKbError('ARCHIVE_MOVE_FAILED', 'Abandoned run archive failed and was rolled back intact', {
      cause: error.message
    });
  }
}

module.exports = {
  archiveAbandoned,
  archiveExisting,
  archiveRun,
  assertCleanNovelRoot,
  buildArchivePlan,
  sha256File,
  verifyRunArtifacts: archiveIntegrity.verifyRunArtifacts
};
