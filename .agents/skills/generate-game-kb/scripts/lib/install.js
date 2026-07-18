'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { assertAcceptedArtifacts } = require('./candidate-ledger');
const { CATEGORY_FILES } = require('./finalize');
const { atomicWriteFile, atomicWriteJson, readJson } = require('./io');
const { pathsFor } = require('./paths');
const { SEMANTIC_CONTRACT_VERSION, resolveWritableRun } = require('./run');
const { verifyDataRoot, verifyFinal } = require('./verify');

const DATA_FILES = Object.freeze(Object.values(CATEGORY_FILES).sort());
const REPORT_FILES = Object.freeze([
  'verification-report.json'
]);
const INSTALL_RECEIPT = 'generate_game_kb_install.json';
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
  if (receipt.schema_version !== 1 || receipt.installer !== 'generate-game-kb') {
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
  result.source_hash = typeof receipt.source_hash === 'string' ? receipt.source_hash : null;
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

function installVerifiedData(novelDir, options = {}) {
  const run = resolveWritableRun(novelDir, options.runId, 'install', options.profile);
  const runId = run.run_id;
  const installed = installPaths(novelDir);
  recoverInterruptedInstall(novelDir);
  const workPaths = pathsFor(novelDir, runId);
  assertAcceptedArtifacts(workPaths);
  const workspace = verifyFinal(workPaths, { profile: run.profile });
  if (!workspace.passed) {
    throw new GameKbError('INSTALL_VERIFICATION_FAILED', 'Final workspace did not pass installation verification', workspace);
  }
  const manifest = readJson(workPaths.manifest);
  const expectedChapters = manifest.chapters.map(chapter => ({
    number: chapter.number,
    title: chapter.title,
    input_hash: chapter.input_hash
  }));
  const previousReceipt = readReceipt(installed.receipt);
  if (previousReceipt
    && previousReceipt.source_hash === manifest.source_hash
    && previousReceipt.final_data_hash === workspace.final_data_hash
    && JSON.stringify(previousReceipt.chapters) === JSON.stringify(expectedChapters)) {
    const current = verifyInstalled(novelDir);
    if (current.passed) return { ...previousReceipt, idempotent: true };
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
  let runMetadataWritten = false;
  const previousRunMetadata = fs.readFileSync(workPaths.runJson, 'utf8');
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
      fs.copyFileSync(path.join(workPaths.finalData, filename), path.join(nextData, filename));
    }
    const entries = { preserved: [], removed: [] };
    const staged = verifyDataRoot(nextData, {
      chapters: manifest.chapters,
      expectedHash: workspace.final_data_hash
    });
    if (!staged.passed) {
      throw new GameKbError('INSTALL_STAGING_VERIFICATION_FAILED', 'Staged data did not pass verification', staged);
    }

    state = originalDataState(installed.data);
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

    try {
      fs.renameSync(nextData, installed.data);
    } catch (error) {
      throw new GameKbError('INSTALL_SWAP_FAILED', 'Could not promote staged data', { cause: error.message });
    }
    dataPromoted = true;
    pending.phase = 'data_promoted';
    atomicWriteJson(installed.pending, pending);

    const postSwap = verifyDataRoot(installed.data, {
      chapters: manifest.chapters,
      expectedHash: workspace.final_data_hash
    });
    if (!postSwap.passed) {
      throw new GameKbError('INSTALL_POST_SWAP_VERIFICATION_FAILED', 'Installed data failed post-swap verification', postSwap);
    }

    fs.mkdirSync(installed.reports, { recursive: true });
    reportsWritten = true;
    for (const filename of REPORT_FILES) {
      atomicWriteFile(
        path.join(installed.reports, filename),
        fs.readFileSync(path.join(workPaths.finalReports, filename), 'utf8')
      );
    }
    const verificationReportHash = fileHash(path.join(installed.reports, 'verification-report.json'));
    const receipt = {
      schema_version: 1,
      semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
      profile: run.profile || 'v4',
      installer: 'generate-game-kb',
      source_hash: manifest.source_hash,
      final_data_hash: workspace.final_data_hash,
      data_files: [...DATA_FILES],
      verification_report_hash: verificationReportHash,
      chapters: expectedChapters,
      archive_root: archiveRoot,
      archive_data: state === 'nonempty' ? archiveData : null,
      backup_path: state === 'nonempty' ? archiveData : null,
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
    const runMetadata = readJson(workPaths.runJson);
    atomicWriteJson(workPaths.runJson, {
      ...runMetadata,
      status: 'installed',
      installed_at: receipt.installed_at,
      final_data_hash: workspace.final_data_hash,
      verification_report_hash: receipt.verification_report_hash
    });
    runMetadataWritten = true;
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
      if (runMetadataWritten) atomicWriteFile(workPaths.runJson, previousRunMetadata);
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

module.exports = {
  DATA_FILES,
  INSTALL_RECEIPT,
  PENDING_RECEIPT,
  installVerifiedData,
  recoverInterruptedInstall,
  verifyInstalled
};
