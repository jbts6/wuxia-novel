'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { stableHash } = require('./accept');
const { GameKbError } = require('./errors');
const { assertAcceptedArtifacts } = require('./candidate-ledger');
const { atomicWriteFile, atomicWriteJson, readJson } = require('./io');
const { deferredPathsFor, pathsFor } = require('./paths');
const { SEMANTIC_CONTRACT_VERSION, resolveWritableRun } = require('./run');
const { FINAL_FILES } = require('./semantic-contract');
const { verifyDataRoot, verifyFinal } = require('./verify');

const DATA_FILES = Object.freeze(Object.values(FINAL_FILES).sort());
const REPORT_FILES = Object.freeze([
  'verification-report.json'
]);
const INSTALL_RECEIPT = 'generate_game_kb_install.json';
const INSTALL_RECEIPT_SCHEMA_VERSION = 2;
const PENDING_RECEIPT = 'generate_game_kb_install.pending.json';
const RECOVERY_REPORT = 'generate_game_kb_install_recovery.json';

function installPaths(novelDir) {
  const novel = path.resolve(novelDir);
  const reports = path.join(novel, 'reports');
  return {
    novel,
    data: path.join(novel, 'data'),
    reports,
    receipt: path.join(reports, INSTALL_RECEIPT),
    pending: path.join(reports, PENDING_RECEIPT),
    recovery: path.join(reports, RECOVERY_REPORT),
    archive: path.join(novel, '_archive')
  };
}

function fileHash(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function dataFileHashes(dataRoot) {
  return Object.fromEntries(DATA_FILES.map(filename => [filename, fileHash(path.join(dataRoot, filename))]));
}

function validDataFileHashes(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(DATA_FILES)
    && DATA_FILES.every(filename => /^sha256:[a-f0-9]{64}$/.test(value[filename]));
}

function jsonHash(file) {
  return stableHash(readJson(file));
}

function publishedRunArtifact(novelDir, runId, field) {
  if (typeof runId !== 'string' || runId === '') return null;
  let candidates;
  try {
    candidates = [pathsFor(novelDir, runId), deferredPathsFor(novelDir, runId)];
  } catch {
    return null;
  }
  return candidates.map(candidate => candidate[field]).find(file => fs.existsSync(file)) || null;
}

function publishedMigrationReceipt(novelDir, runId) {
  return publishedRunArtifact(novelDir, runId, 'migrationReceipt')
    || publishedRunArtifact(novelDir, runId, 'chapterImportReceipt');
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function assertPendingPaths(paths, pending) {
  if (path.resolve(pending.data_path || '') !== paths.data) {
    throw new GameKbError('INSTALL_RECOVERY_STATE_INVALID', 'Pending install has an invalid data path');
  }
  if (pending.archive_data !== null && pending.archive_data !== undefined
    && !isInside(paths.archive, path.resolve(pending.archive_data))) {
    throw new GameKbError('INSTALL_RECOVERY_STATE_INVALID', 'Pending install has an invalid archive path');
  }
  const nextData = path.resolve(pending.next_data || '');
  if (path.dirname(nextData) !== paths.novel
    || !path.basename(nextData).startsWith('data.next-generate-game-kb-')) {
    throw new GameKbError('INSTALL_RECOVERY_STATE_INVALID', 'Pending install has an invalid staging path');
  }
}

function recoverInterruptedInstall(novelDir) {
  const paths = installPaths(novelDir);
  if (!fs.existsSync(paths.pending)) return { recovered: false, state: 'none' };

  let pending;
  try {
    pending = readJson(paths.pending);
  } catch (error) {
    throw new GameKbError('INSTALL_RECOVERY_STATE_INVALID', 'Pending install receipt cannot be read', {
      cause: error.message
    });
  }
  assertPendingPaths(paths, pending);

  const archiveData = pending.archive_data ? path.resolve(pending.archive_data) : null;
  const nextData = path.resolve(pending.next_data);
  const dataExists = fs.existsSync(paths.data);
  const archiveExists = Boolean(archiveData && fs.existsSync(archiveData));
  if (dataExists && archiveExists) {
    throw new GameKbError('INSTALL_RECOVERY_AMBIGUOUS', 'Both data and its pending archive exist; refusing to guess', {
      data: paths.data,
      archive_data: archiveData,
      phase: pending.phase
    });
  }

  if (archiveExists && !dataExists) {
    fs.renameSync(archiveData, paths.data);
    fs.rmSync(nextData, { recursive: true, force: true });
    fs.rmSync(paths.pending, { force: true });
    return { recovered: true, state: 'archive_restored', data: paths.data };
  }

  if (dataExists && !archiveExists) {
    if (pending.phase !== 'before_old_move') {
      throw new GameKbError('INSTALL_RECOVERY_AMBIGUOUS', 'Installed data exists but the recorded archive is absent', {
        data: paths.data,
        archive_data: archiveData,
        phase: pending.phase
      });
    }
    fs.rmSync(nextData, { recursive: true, force: true });
    fs.rmSync(paths.pending, { force: true });
    return { recovered: true, state: 'original_unchanged', data: paths.data };
  }

  if (pending.original_data_state === 'nonempty') {
    throw new GameKbError('INSTALL_RECOVERY_BACKUP_MISSING', 'Original data and its recorded archive are both missing', {
      archive_data: archiveData,
      phase: pending.phase
    });
  }
  fs.rmSync(nextData, { recursive: true, force: true });
  if (pending.original_data_state === 'empty') fs.mkdirSync(paths.data, { recursive: true });
  fs.rmSync(paths.pending, { force: true });
  return { recovered: true, state: 'empty_original_restored', data: paths.data };
}

function readReceipt(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function verifyInstalledWithReceiptV4(novelDir, receipt) {
  const paths = installPaths(novelDir);
  const receiptErrors = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return {
      passed: false,
      source_hash: null,
      final_data_hash: null,
      chapters: [],
      counts: {},
      blocking_errors: [{ code: 'INSTALL_RECEIPT_INVALID', path: paths.receipt, target: '' }],
      warnings: [],
      scope: 'installed'
    };
  }
  if (receipt.schema_version !== INSTALL_RECEIPT_SCHEMA_VERSION
    || receipt.installer !== 'generate-game-kb') {
    receiptErrors.push({ code: 'INSTALL_RECEIPT_INVALID', path: paths.receipt, target: receipt.schema_version });
  }
  if (receipt.semantic_contract_version !== SEMANTIC_CONTRACT_VERSION) {
    receiptErrors.push({
      code: 'LEGACY_SEMANTIC_CONTRACT',
      path: 'receipt.semantic_contract_version',
      target: receipt.semantic_contract_version ?? null
    });
  }
  if (typeof receipt.source_hash !== 'string' || receipt.source_hash === '') {
    receiptErrors.push({ code: 'INSTALL_SOURCE_HASH_MISSING', path: 'receipt.source_hash', target: '' });
  }
  if (!Array.isArray(receipt.chapters)
    || receipt.chapters.some(chapter => !Number.isInteger(chapter?.number)
      || typeof chapter.title !== 'string'
      || typeof chapter.input_hash !== 'string'
      || chapter.input_hash === '')
    || new Set(receipt.chapters.map(chapter => chapter.number)).size !== receipt.chapters.length) {
    receiptErrors.push({ code: 'INSTALL_CHAPTERS_INVALID', path: 'receipt.chapters', target: '' });
  }
  if (JSON.stringify(receipt.data_files) !== JSON.stringify(DATA_FILES)) {
    receiptErrors.push({ code: 'INSTALL_DATA_FILES_INVALID', path: 'receipt.data_files', target: '' });
  }
  if (!validDataFileHashes(receipt.data_file_hashes)) {
    receiptErrors.push({
      code: 'INSTALL_DATA_FILE_HASHES_INVALID',
      path: 'receipt.data_file_hashes',
      target: ''
    });
  } else {
    for (const filename of DATA_FILES) {
      const file = path.join(paths.data, filename);
      const actualHash = fs.existsSync(file) ? fileHash(file) : null;
      if (actualHash !== receipt.data_file_hashes[filename]) {
        receiptErrors.push({
          code: 'INSTALL_DATA_FILE_HASH_MISMATCH',
          path: file,
          target: receipt.data_file_hashes[filename],
          actual_hash: actualHash
        });
      }
    }
  }
  if (typeof receipt.run_id !== 'string' || receipt.run_id === '') {
    receiptErrors.push({ code: 'INSTALL_RUN_ID_MISSING', path: 'receipt.run_id', target: '' });
  }
  if (typeof receipt.id_plan_hash !== 'string' || receipt.id_plan_hash === '') {
    receiptErrors.push({ code: 'INSTALL_ID_PLAN_HASH_MISSING', path: 'receipt.id_plan_hash', target: '' });
  } else {
    const idPlanFile = publishedRunArtifact(novelDir, receipt.run_id, 'finalIdPlan');
    if (!idPlanFile) {
      receiptErrors.push({ code: 'INSTALL_ID_PLAN_MISSING', path: 'receipt.id_plan_hash', target: receipt.run_id });
    } else {
      try {
        if (jsonHash(idPlanFile) !== receipt.id_plan_hash) {
          receiptErrors.push({
            code: 'INSTALL_ID_PLAN_HASH_MISMATCH',
            path: idPlanFile,
            target: receipt.id_plan_hash
          });
        }
      } catch (error) {
        receiptErrors.push({ code: 'INSTALL_ID_PLAN_INVALID', path: idPlanFile, target: error.message });
      }
    }
  }
  if (receipt.migration_receipt_hash !== null
    && (typeof receipt.migration_receipt_hash !== 'string' || receipt.migration_receipt_hash === '')) {
    receiptErrors.push({
      code: 'INSTALL_MIGRATION_RECEIPT_HASH_INVALID',
      path: 'receipt.migration_receipt_hash',
      target: receipt.migration_receipt_hash ?? ''
    });
  } else if (typeof receipt.migration_receipt_hash === 'string') {
    const migrationFile = publishedMigrationReceipt(novelDir, receipt.run_id);
    if (!migrationFile) {
      receiptErrors.push({
        code: 'INSTALL_MIGRATION_RECEIPT_MISSING',
        path: 'receipt.migration_receipt_hash',
        target: receipt.run_id
      });
    } else if (fileHash(migrationFile) !== receipt.migration_receipt_hash) {
      receiptErrors.push({
        code: 'INSTALL_MIGRATION_RECEIPT_HASH_MISMATCH',
        path: migrationFile,
        target: receipt.migration_receipt_hash
      });
    }
  }

  const result = verifyDataRoot(paths.data, {
    chapters: Array.isArray(receipt.chapters) ? receipt.chapters : [],
    expectedHash: receipt.final_data_hash
  });
  const verificationFile = path.join(paths.reports, 'verification-report.json');
  if (typeof receipt.verification_report_hash !== 'string') {
    receiptErrors.push({
      code: 'INSTALL_VERIFICATION_REPORT_HASH_MISSING',
      path: 'receipt.verification_report_hash',
      target: ''
    });
  } else if (!fs.existsSync(verificationFile)) {
    receiptErrors.push({ code: 'INSTALL_VERIFICATION_REPORT_MISSING', path: verificationFile, target: '' });
  } else if (fileHash(verificationFile) !== receipt.verification_report_hash) {
    receiptErrors.push({
      code: 'INSTALL_VERIFICATION_REPORT_HASH_MISMATCH',
      path: verificationFile,
      target: receipt.verification_report_hash
    });
  } else {
    try {
      const verification = readJson(verificationFile);
      if (verification.passed !== true || verification.final_data_hash !== receipt.final_data_hash) {
        receiptErrors.push({ code: 'INSTALL_VERIFICATION_REPORT_STALE', path: verificationFile, target: '' });
      }
    } catch (error) {
      receiptErrors.push({ code: 'INSTALL_VERIFICATION_REPORT_INVALID', path: verificationFile, target: error.message });
    }
  }
  result.semantic_contract_version = receipt.semantic_contract_version ?? null;
  result.run_id = typeof receipt.run_id === 'string' ? receipt.run_id : null;
  result.source_hash = typeof receipt.source_hash === 'string' ? receipt.source_hash : null;
  result.id_plan_hash = typeof receipt.id_plan_hash === 'string' ? receipt.id_plan_hash : null;
  result.migration_receipt_hash = typeof receipt.migration_receipt_hash === 'string'
    ? receipt.migration_receipt_hash
    : null;
  result.chapters = Array.isArray(receipt.chapters) ? receipt.chapters : [];
  result.blocking_errors.push(...receiptErrors);
  result.passed = result.blocking_errors.length === 0;
  return { ...result, scope: 'installed' };
}

function verifyInstalled(novelDir) {
  const paths = installPaths(novelDir);
  if (!fs.existsSync(paths.receipt)) {
    return {
      passed: false,
      source_hash: null,
      final_data_hash: null,
      chapters: [],
      counts: {},
      blocking_errors: [{ code: 'INSTALL_RECEIPT_MISSING', path: paths.receipt, target: '' }],
      warnings: [],
      scope: 'installed'
    };
  }
  let receipt;
  try {
    receipt = readJson(paths.receipt);
  } catch (error) {
    return {
      passed: false,
      source_hash: null,
      final_data_hash: null,
      chapters: [],
      counts: {},
      blocking_errors: [{ code: 'INSTALL_RECEIPT_INVALID', path: paths.receipt, target: error.message }],
      warnings: [],
      scope: 'installed'
    };
  }
  return verifyInstalledWithReceiptV4(novelDir, receipt);
}

function utcToken(now) {
  return now.toISOString().replace(/[:.]/g, '-');
}

function uniqueArchiveRoot(paths, now) {
  fs.mkdirSync(paths.archive, { recursive: true });
  const base = `${utcToken(now)}-pre-generate-game-kb`;
  let candidate = path.join(paths.archive, base);
  let suffix = 2;
  while (fs.existsSync(candidate)) candidate = path.join(paths.archive, `${base}-${suffix++}`);
  fs.mkdirSync(candidate);
  return candidate;
}

function originalDataState(data) {
  if (!fs.existsSync(data)) return 'missing';
  if (!fs.statSync(data).isDirectory()) {
    throw new GameKbError('INSTALL_DATA_NOT_DIRECTORY', 'Existing data path is not a directory', { path: data });
  }
  return fs.readdirSync(data).length === 0 ? 'empty' : 'nonempty';
}

function maybeFault(options, point) {
  if (typeof options.injectFault === 'function') options.injectFault(point);
  if (options.faultAt === point) {
    throw new GameKbError('INSTALL_FAULT_INJECTED', `Injected installation fault at ${point}`, { point });
  }
}

function restoreReports(previous, reportsDir) {
  for (const [filename, content] of previous.entries()) {
    const file = path.join(reportsDir, filename);
    if (content === null) fs.rmSync(file, { force: true });
    else atomicWriteFile(file, content);
  }
}

function promoteVerifiedData(novelDir, options) {
  const installed = installPaths(novelDir);
  recoverInterruptedInstall(novelDir);
  const previousReceipt = readReceipt(installed.receipt);
  const sourceData = path.resolve(options.sourceData);
  const chapters = options.chapters;
  const previousInstalled = options.expectedPreviousHash ? verifyInstalled(novelDir) : null;
  if (options.expectedPreviousHash
    && (!previousInstalled.passed || previousInstalled.final_data_hash !== options.expectedPreviousHash)) {
    throw new GameKbError('DEFERRED_TASK_STALE', 'Installed data changed before promotion', {
      expected_data_hash: options.expectedPreviousHash,
      installed_data_hash: previousInstalled.final_data_hash
    });
  }

  const now = typeof options.now === 'function' ? options.now() : new Date();
  const runToken = `${utcToken(now)}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  const nextData = path.join(installed.novel, `data.next-generate-game-kb-${runToken}`);
  fs.mkdirSync(nextData);
  let archiveRoot = null;
  let archiveData = null;
  let pending = null;
  let oldMoved = false;
  let dataPromoted = false;
  let reportsWritten = false;
  let receiptWritten = false;
  let commitStarted = false;
  const previousReports = new Map(REPORT_FILES.map(filename => {
    const file = path.join(installed.reports, filename);
    return [filename, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null];
  }));
  const previousReceiptText = fs.existsSync(installed.receipt)
    ? fs.readFileSync(installed.receipt, 'utf8')
    : null;
  let state;

  try {
    for (const filename of DATA_FILES) {
      fs.copyFileSync(path.join(sourceData, filename), path.join(nextData, filename));
    }
    const entries = { preserved: [], removed: [] };
    const staged = verifyDataRoot(nextData, {
      chapters,
      expectedHash: options.finalDataHash
    });
    if (!staged.passed) {
      throw new GameKbError('INSTALL_STAGING_VERIFICATION_FAILED', 'Staged data did not pass verification', staged);
    }

    state = originalDataState(installed.data);
    if (options.expectedPreviousHash && state !== 'nonempty') {
      throw new GameKbError('INSTALL_BACKUP_REQUIRED', 'Overlay promotion requires current installed data to back up');
    }
    archiveRoot = uniqueArchiveRoot(installed, now);
    archiveData = path.join(archiveRoot, 'data');
    pending = {
      schema_version: 1,
      phase: 'before_old_move',
      data_path: installed.data,
      archive_root: archiveRoot,
      archive_data: state === 'nonempty' ? archiveData : null,
      next_data: nextData,
      original_data_state: state,
      started_at: now.toISOString()
    };
    atomicWriteJson(installed.pending, pending);
    maybeFault(options, 'before-old-move');

    if (state === 'nonempty') fs.renameSync(installed.data, archiveData);
    else if (state === 'empty') fs.rmSync(installed.data, { recursive: true });
    oldMoved = true;
    pending.phase = 'old_moved';
    atomicWriteJson(installed.pending, pending);
    maybeFault(options, 'after-old-move');

    if (options.expectedPreviousHash) {
      const backup = verifyDataRoot(archiveData, {
        chapters: previousInstalled.chapters,
        expectedHash: options.expectedPreviousHash
      });
      if (!backup.passed) {
        throw new GameKbError('INSTALL_BACKUP_VERIFICATION_FAILED', 'Installed data backup failed verification', backup);
      }
    }

    try {
      fs.renameSync(nextData, installed.data);
    } catch (error) {
      throw new GameKbError('INSTALL_SWAP_FAILED', 'Could not promote staged data', { cause: error.message });
    }
    dataPromoted = true;
    pending.phase = 'data_promoted';
    atomicWriteJson(installed.pending, pending);

    const postSwap = verifyDataRoot(installed.data, {
      chapters,
      expectedHash: options.finalDataHash
    });
    if (!postSwap.passed) {
      throw new GameKbError('INSTALL_POST_SWAP_VERIFICATION_FAILED', 'Installed data failed post-swap verification', postSwap);
    }

    fs.mkdirSync(installed.reports, { recursive: true });
    reportsWritten = true;
    atomicWriteFile(
      path.join(installed.reports, 'verification-report.json'),
      options.verificationReportContent
    );
    const verificationReportHash = fileHash(path.join(installed.reports, 'verification-report.json'));
    const receipt = {
      ...(options.receiptExtras || {}),
      schema_version: INSTALL_RECEIPT_SCHEMA_VERSION,
      semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
      profile: options.profile || 'v4',
      installer: 'generate-game-kb',
      run_id: options.runId || previousReceipt?.run_id || options.receiptExtras?.base_run_id,
      source_hash: options.sourceHash,
      final_data_hash: options.finalDataHash,
      id_plan_hash: options.idPlanHash ?? previousReceipt?.id_plan_hash ?? null,
      migration_receipt_hash: options.migrationReceiptHash
        ?? previousReceipt?.migration_receipt_hash
        ?? null,
      data_files: [...DATA_FILES],
      data_file_hashes: dataFileHashes(installed.data),
      verification_report_hash: verificationReportHash,
      chapters,
      archive_root: archiveRoot,
      archive_data: state === 'nonempty' ? archiveData : null,
      backup_path: state === 'nonempty' ? archiveData : null,
      previous_final_data_hash: options.expectedPreviousHash || null,
      backup_final_data_hash: options.expectedPreviousHash || null,
      original_data_state: state,
      preserved_entries: entries.preserved,
      removed_stale_markers: entries.removed,
      started_at: now.toISOString(),
      installed_at: new Date().toISOString()
    };
    const candidate = verifyInstalledWithReceiptV4(novelDir, receipt);
    if (!candidate.passed) {
      throw new GameKbError('INSTALLED_VERIFICATION_FAILED', 'Installed artifacts failed verification before receipt', candidate);
    }
    atomicWriteJson(installed.receipt, receipt);
    receiptWritten = true;
    const finalCheck = verifyInstalled(novelDir);
    if (!finalCheck.passed) {
      throw new GameKbError('INSTALLED_VERIFICATION_FAILED', 'Installed artifacts failed final verification', finalCheck);
    }
    commitStarted = true;
    if (typeof options.commit === 'function') options.commit(receipt);
    fs.rmSync(installed.pending, { force: true });
    return receipt;
  } catch (error) {
    let recoveryError = null;
    try {
      if (dataPromoted && fs.existsSync(installed.data)) {
        fs.rmSync(installed.data, { recursive: true, force: true });
      }
      if (oldMoved) {
        if (state === 'nonempty') {
          if (!archiveData || !fs.existsSync(archiveData)) {
            throw new Error('Previous data archive is missing during restoration');
          }
          fs.renameSync(archiveData, installed.data);
        } else if (state === 'empty') {
          fs.mkdirSync(installed.data, { recursive: true });
        }
      }
      if (reportsWritten) restoreReports(previousReports, installed.reports);
      if (receiptWritten) {
        if (previousReceiptText === null) fs.rmSync(installed.receipt, { force: true });
        else atomicWriteFile(installed.receipt, previousReceiptText);
      }
      if (commitStarted && typeof options.rollbackCommit === 'function') options.rollbackCommit();
      fs.rmSync(nextData, { recursive: true, force: true });
      fs.rmSync(installed.pending, { force: true });
      if (archiveRoot) fs.rmSync(archiveRoot, { recursive: true, force: true });
    } catch (restoreError) {
      recoveryError = restoreError;
    }
    if (recoveryError) {
      atomicWriteJson(installed.recovery, {
        schema_version: 1,
        code: 'INSTALL_RECOVERY_FAILED',
        data_path: installed.data,
        archive_data: archiveData,
        next_data: nextData,
        cause: error.message,
        recovery_error: recoveryError.message,
        recorded_at: new Date().toISOString()
      });
      throw new GameKbError('INSTALL_RECOVERY_FAILED', 'Installation failed and previous data could not be restored', {
        cause: error.message,
        recovery_error: recoveryError.message,
        recovery_report: installed.recovery
      });
    }
    throw error;
  }
}

function installVerifiedData(novelDir, options = {}) {
  const run = resolveWritableRun(novelDir, options.runId, 'install', options.profile);
  const workPaths = pathsFor(novelDir, run.run_id);
  assertAcceptedArtifacts(workPaths);
  const workspace = verifyFinal(workPaths, { profile: run.profile });
  if (!workspace.passed) {
    throw new GameKbError('INSTALL_VERIFICATION_FAILED', 'Final workspace did not pass installation verification', workspace);
  }
  const manifest = readJson(workPaths.manifest);
  const idPlanHash = jsonHash(workPaths.finalIdPlan);
  if (workspace.id_plan_hash && workspace.id_plan_hash !== idPlanHash) {
    throw new GameKbError('INSTALL_ID_PLAN_HASH_MISMATCH', 'Final ID plan does not match workspace verification', {
      expected: workspace.id_plan_hash,
      actual: idPlanHash
    });
  }
  const migrationReceipt = publishedMigrationReceipt(novelDir, run.run_id);
  const migrationReceiptHash = migrationReceipt
    ? fileHash(migrationReceipt)
    : null;
  const chapters = manifest.chapters.map(chapter => ({
    number: chapter.number,
    title: chapter.title,
    input_hash: chapter.input_hash
  }));
  const installed = installPaths(novelDir);
  const previousReceipt = readReceipt(installed.receipt);
  if (previousReceipt
    && previousReceipt.source_hash === manifest.source_hash
    && previousReceipt.final_data_hash === workspace.final_data_hash
    && JSON.stringify(previousReceipt.chapters) === JSON.stringify(chapters)) {
    const current = verifyInstalled(novelDir);
    if (current.passed) return { ...previousReceipt, idempotent: true };
  }
  const previousRunMetadata = fs.readFileSync(workPaths.runJson, 'utf8');
  return promoteVerifiedData(novelDir, {
    ...options,
    sourceData: workPaths.finalData,
    sourceHash: manifest.source_hash,
    finalDataHash: workspace.final_data_hash,
    idPlanHash,
    migrationReceiptHash,
    chapters,
    profile: run.profile,
    verificationReportContent: fs.readFileSync(
      path.join(workPaths.finalReports, 'verification-report.json'),
      'utf8'
    ),
    commit(receipt) {
      const runMetadata = readJson(workPaths.runJson);
      atomicWriteJson(workPaths.runJson, {
        ...runMetadata,
        status: 'installed',
        installed_at: receipt.installed_at,
        final_data_hash: workspace.final_data_hash,
        id_plan_hash: receipt.id_plan_hash,
        migration_receipt_hash: receipt.migration_receipt_hash,
        verification_report_hash: receipt.verification_report_hash
      });
    },
    rollbackCommit() {
      atomicWriteFile(workPaths.runJson, previousRunMetadata);
    }
  });
}

module.exports = {
  DATA_FILES,
  INSTALL_RECEIPT,
  PENDING_RECEIPT,
  installVerifiedData,
  promoteVerifiedData,
  recoverInterruptedInstall,
  verifyInstalled
};
