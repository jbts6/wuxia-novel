'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { stableHash } = require('./io');
const { GameKbError } = require('./errors');
const { atomicWriteFile, atomicWriteJson, readJson } = require('./io');
const { pathsFor } = require('./paths');
const { assertAcceptedArtifacts, readArtifactManifest } = require('./candidate-ledger');
const { buildRunMetrics, derivePhaseDurations } = require('./timing');
const { SEMANTIC_CONTRACT_VERSION, assertSemanticContract } = require('./run');
const { inspectWorkspaceFinal } = require('./verify');

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

function verifyRunArtifacts(paths) {
  const manifest = readArtifactManifest(paths);
  const mismatches = [];
  for (const entry of manifest.entries) {
    const file = path.join(paths.run, ...entry.relative_path.split('/'));
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      mismatches.push({ relative_path: entry.relative_path, expected_hash: entry.content_hash, actual_hash: null });
      continue;
    }
    const actual = sha256File(file);
    if (actual !== entry.content_hash) {
      mismatches.push({ relative_path: entry.relative_path, expected_hash: entry.content_hash, actual_hash: actual });
    }
  }
  if (mismatches.length > 0) {
    throw new GameKbError('ACCEPTED_ARTIFACT_MUTATED', 'Run contains mutated accepted artifacts', { mismatches });
  }
  return manifest;
}

function assertInstalledIdentity(metadata, installed, runId) {
  const requested = {
    semantic_contract_version: metadata.semantic_contract_version ?? null,
    source_hash: metadata.source_hash ?? null,
    final_data_hash: metadata.final_data_hash ?? null
  };
  const actual = {
    semantic_contract_version: installed.semantic_contract_version ?? null,
    source_hash: installed.source_hash ?? null,
    final_data_hash: installed.final_data_hash ?? null
  };
  const mismatches = Object.keys(requested)
    .filter(key => requested[key] !== actual[key])
    .map(key => ({ field: key, requested: requested[key], installed: actual[key] }));
  if (mismatches.length > 0) {
    throw new GameKbError(
      'ARCHIVE_INSTALLED_IDENTITY_MISMATCH',
      'Requested run does not match the installed data identity',
      { run_id: runId, requested, installed: actual, mismatches }
    );
  }
}

function maybeArchiveFault(options, point) {
  if (typeof options.injectFault === 'function') options.injectFault(point);
  if (options.faultAt === point) {
    throw new GameKbError('ARCHIVE_FAULT_INJECTED', `Injected archive fault at ${point}`, { point });
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
  const archiveDir = path.join(novel, '_archive', 'generate-game-kb', runId);
  if (fs.existsSync(archiveDir)) {
    throw new GameKbError('ARCHIVE_PATH_COLLISION', 'Run archive destination already exists', { archive_dir: archiveDir });
  }
  const { INSTALL_RECEIPT, verifyInstalled } = require('./install');
  const installed = verifyInstalled(novel);
  if (!installed.passed) {
    throw new GameKbError('INSTALLED_VERIFICATION_REQUIRED', 'verify --installed must pass before archive-run', installed);
  }
  assertInstalledIdentity(metadata, installed, runId);
  const manifest = readJson(paths.manifest);
  const assembly = readJson(paths.assemblyReport);
  const verification = readJson(paths.verificationReport);
  const installedReceiptFile = path.join(novel, 'reports', INSTALL_RECEIPT);
  const installedReceipt = readJson(installedReceiptFile);
  const assemblyReportHash = sha256File(paths.assemblyReport);
  const verificationReportHash = sha256File(paths.verificationReport);
  const installReceiptHash = sha256File(installedReceiptFile);
  const reviewReportHash = sha256File(paths.reviewReport);
  const idPlanHash = stableHash(readJson(paths.finalIdPlan));
  const migrationReceiptHash = fs.existsSync(paths.chapterImportReceipt)
    ? sha256File(paths.chapterImportReceipt)
    : null;
  const expectedHash = assembly?.final_data_hash;
  const workspace = inspectWorkspaceFinal(paths, {
    chapters: manifest.chapters,
    expectedHash
  });
  const blockingErrors = [...workspace.blocking_errors];
  const warnings = [];
  if (typeof expectedHash !== 'string' || expectedHash === '') {
    blockingErrors.push({ code: 'ASSEMBLY_FINAL_HASH_MISSING', path: paths.assemblyReport, target: '' });
  }
  if (verification?.passed !== true) {
    blockingErrors.push({ code: 'VERIFICATION_NOT_PASSED', path: paths.verificationReport, target: '' });
  }
  if (verification?.source_hash !== manifest.source_hash) {
    blockingErrors.push({
      code: 'VERIFICATION_SOURCE_HASH_STALE',
      path: paths.verificationReport,
      target: verification?.source_hash ?? ''
    });
  }
  if (verification?.final_data_hash !== expectedHash) {
    blockingErrors.push({
      code: 'VERIFICATION_FINAL_HASH_STALE',
      path: paths.verificationReport,
      target: verification?.final_data_hash ?? ''
    });
  }
  const reportBindings = [
    ['ASSEMBLY_SOURCE_HASH_STALE', assembly?.source_hash, manifest.source_hash, paths.assemblyReport],
    ['ASSEMBLY_REVIEW_HASH_STALE', assembly?.review_report_hash, reviewReportHash, paths.assemblyReport],
    ['VERIFICATION_REVIEW_HASH_STALE', verification?.review_report_hash, reviewReportHash, paths.verificationReport],
    ['INSTALL_SOURCE_HASH_STALE', installedReceipt?.source_hash, manifest.source_hash, installedReceiptFile],
    ['INSTALL_FINAL_HASH_STALE', installedReceipt?.final_data_hash, expectedHash, installedReceiptFile],
    ['INSTALL_VERIFICATION_HASH_STALE', installedReceipt?.verification_report_hash, verificationReportHash, installedReceiptFile],
    ['INSTALL_REVIEW_HASH_STALE', installedReceipt?.review_report_hash, reviewReportHash, installedReceiptFile]
  ];
  for (const [code, actual, expected, reportPath] of reportBindings) {
    if (actual !== expected) blockingErrors.push({ code, path: reportPath, target: actual ?? '' });
  }
  if (metadata.verification_report_hash !== verificationReportHash) {
    warnings.push({
      code: 'VERIFICATION_REPORT_HASH_MISMATCH',
      path: paths.verificationReport,
      target: metadata.verification_report_hash ?? ''
    });
  }
  if (metadata.id_plan_hash !== idPlanHash) {
    warnings.push({
      code: 'ID_PLAN_HASH_MISMATCH',
      path: paths.finalIdPlan,
      target: metadata.id_plan_hash ?? ''
    });
  }
  if ((metadata.migration_receipt_hash ?? null) !== migrationReceiptHash) {
    warnings.push({
      code: 'MIGRATION_RECEIPT_HASH_MISMATCH',
      path: paths.chapterImportReceipt,
      target: metadata.migration_receipt_hash ?? ''
    });
  }
  if (blockingErrors.length > 0) {
    throw new GameKbError(
      'ARCHIVE_WORKSPACE_FINAL_INVALID',
      'Current workspace final data must match assembly and verification evidence before archive-run',
      {
        run_id: runId,
        expected_final_data_hash: expectedHash ?? null,
        actual_final_data_hash: workspace.final_data_hash,
        blocking_errors: blockingErrors,
        warnings
      }
    );
  }
  assertAcceptedArtifacts(paths);
  const artifactManifest = verifyRunArtifacts(paths);
  const archivedAt = new Date().toISOString();
  const progress = fs.existsSync(paths.progress) ? readJson(paths.progress) : { units: {} };
  const durations = derivePhaseDurations(metadata, progress, archivedAt);
  const metrics = buildRunMetrics(paths, metadata, progress, archivedAt);
  const previousRunJson = fs.readFileSync(paths.runJson);
  const previousMetrics = fs.existsSync(paths.runMetrics) ? fs.readFileSync(paths.runMetrics) : null;
  fs.mkdirSync(path.dirname(archiveDir), { recursive: true });
  try {
    atomicWriteJson(paths.runMetrics, { ...metrics, phase_durations: durations });
    atomicWriteJson(paths.runJson, {
      ...metadata,
      status: 'archived',
      archived_at: archivedAt,
      phase_durations: durations
    });
    maybeArchiveFault(options, 'after_metadata_write');
    fs.renameSync(paths.run, archiveDir);
    maybeArchiveFault(options, 'after_move');
    const archivedManifest = path.join(archiveDir, 'artifact-manifest.json');
    verifyRunArtifacts({ ...paths, run: archiveDir, artifactManifest: archivedManifest });
    maybeArchiveFault(options, 'after_archive_verification');
    const receipt = {
      schema_version: 1,
      semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
      status: 'archived',
      run_id: runId,
      archive_dir: archiveDir,
      archived_at: archivedAt,
      artifact_manifest_hash: sha256File(archivedManifest),
      assembly_report_hash: assemblyReportHash,
      verification_report_hash: verificationReportHash,
      install_receipt_hash: installReceiptHash,
      review_report_hash: reviewReportHash,
      source_hash: manifest.source_hash,
      final_data_hash: expectedHash,
      id_plan_hash: idPlanHash,
      migration_receipt_hash: migrationReceiptHash,
      warnings,
      artifact_count: artifactManifest.entries.length,
      metrics_hash: sha256File(path.join(archiveDir, 'reports', 'run-metrics.json'))
    };
    atomicWriteJson(path.join(archiveDir, 'archive-receipt.json'), receipt);
    maybeArchiveFault(options, 'after_receipt_write');
    const runsDir = path.dirname(paths.run);
    if (fs.existsSync(runsDir) && fs.readdirSync(runsDir).length === 0) fs.rmdirSync(runsDir);
    const workDir = path.dirname(runsDir);
    if (fs.existsSync(workDir) && fs.readdirSync(workDir).length === 0) fs.rmdirSync(workDir);
    return receipt;
  } catch (error) {
    let rollbackError = null;
    try {
      if (!fs.existsSync(paths.run) && fs.existsSync(archiveDir)) {
        fs.renameSync(archiveDir, paths.run);
      }
      if (fs.existsSync(paths.run)) {
        atomicWriteFile(paths.runJson, previousRunJson);
        if (previousMetrics === null) fs.rmSync(paths.runMetrics, { force: true });
        else atomicWriteFile(paths.runMetrics, previousMetrics);
        fs.rmSync(path.join(paths.run, 'archive-receipt.json'), { force: true });
      }
    } catch (recoveryError) {
      rollbackError = recoveryError;
    }
    if (rollbackError) {
      throw new GameKbError('ARCHIVE_ROLLBACK_FAILED', 'Run archive failed and rollback was incomplete', {
        cause: error.message,
        rollback_cause: rollbackError.message
      });
    }
    throw new GameKbError('ARCHIVE_MOVE_FAILED', 'Run archive failed and was rolled back', { cause: error.message });
  }
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
  verifyRunArtifacts
};
