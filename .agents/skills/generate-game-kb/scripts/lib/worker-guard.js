'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { writeImmutableJson } = require('./io');
const { repositoryRootFor } = require('./paths');

const EXCLUDED_DIRS = new Set(['.git', 'node_modules']);
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const OPEN_RECEIPT_FIELDS = Object.freeze([
  'guard_id', 'repository_root', 'open_time', 'job_batch_id', 'job_unit',
  'job_attempt', 'job_input_hash', 'job_submissions', 'entry_count', 'entries',
  'boundary_message'
]);
const CHECK_RECEIPT_FIELDS = Object.freeze([
  'guard_id', 'open_receipt_hash', 'repository_root', 'check_time',
  'violations', 'violation_count'
]);

function hasExactFields(value, fields) {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort());
}

function validRelativePath(repositoryRoot, value) {
  if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value) || value.includes('\\')) return false;
  const resolved = path.resolve(repositoryRoot, value);
  return isWithin(repositoryRoot, resolved) && comparisonPath(resolved) !== comparisonPath(repositoryRoot);
}

function validSnapshotState(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && hasExactFields(value, ['size', 'mtime_ns'])
    && /^\d+$/.test(value.size)
    && /^\d+$/.test(value.mtime_ns);
}

function validSnapshotEntry(entry, repositoryRoot) {
  return entry
    && typeof entry === 'object'
    && !Array.isArray(entry)
    && hasExactFields(entry, ['path', 'type', 'size', 'mtime_ns'])
    && validRelativePath(repositoryRoot, entry.path)
    && ['directory', 'file', 'other'].includes(entry.type)
    && /^\d+$/.test(entry.size)
    && /^\d+$/.test(entry.mtime_ns);
}

function validViolation(violation, repositoryRoot) {
  if (!violation
    || typeof violation !== 'object'
    || Array.isArray(violation)
    || !hasExactFields(violation, [
      'change_kind', 'repository_relative', 'absolute_path', 'entry_type', 'before', 'after'
    ])
    || !['added', 'modified', 'deleted'].includes(violation.change_kind)
    || !['directory', 'file', 'other'].includes(violation.entry_type)
    || !validRelativePath(repositoryRoot, violation.repository_relative)
    || typeof violation.absolute_path !== 'string'
    || comparisonPath(violation.absolute_path)
      !== comparisonPath(path.resolve(repositoryRoot, violation.repository_relative))) {
    return false;
  }
  if (violation.change_kind === 'added') return violation.before === null && validSnapshotState(violation.after);
  if (violation.change_kind === 'deleted') return validSnapshotState(violation.before) && violation.after === null;
  return validSnapshotState(violation.before) && validSnapshotState(violation.after);
}

function receiptHash(raw) {
  return `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;
}

function guardProofMismatch(message, { guardId, receiptKind, receiptFile, cause } = {}) {
  throw new GameKbError('GUARD_PROOF_MISMATCH', message, {
    guard_id: guardId,
    receipt_kind: receiptKind,
    receipt_file: receiptFile,
    ...(cause ? { cause } : {})
  });
}

function readGuardReceipt(receiptFile, guardId, receiptKind) {
  let raw;
  let receipt;
  try {
    raw = fs.readFileSync(receiptFile);
    receipt = JSON.parse(raw.toString('utf8'));
  } catch (error) {
    guardProofMismatch('Guard receipt is not valid JSON', {
      guardId,
      receiptKind,
      receiptFile,
      cause: error.message
    });
  }

  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
    || receipt.guard_id !== guardId
    || typeof receipt.repository_root !== 'string'
    || receipt.repository_root.length === 0) {
    guardProofMismatch('Guard receipt identity or repository root is invalid', {
      guardId,
      receiptKind,
      receiptFile
    });
  }

  if (receiptKind === 'open') {
    const validJobSubmissions = Array.isArray(receipt.job_submissions)
      && receipt.job_submissions.every(submission => submission
        && typeof submission === 'object'
        && !Array.isArray(submission)
        && hasExactFields(submission, ['unit', 'attempt', 'input_hash'])
        && typeof submission.unit === 'string'
        && Number.isInteger(submission.attempt)
        && submission.attempt > 0
        && typeof submission.input_hash === 'string'
        && submission.input_hash.length > 0);
    const uniqueEntryPaths = Array.isArray(receipt.entries)
      && new Set(receipt.entries.map(entry => entry?.path)).size === receipt.entries.length;
    if (!hasExactFields(receipt, OPEN_RECEIPT_FIELDS)
      || !path.isAbsolute(receipt.repository_root)
      || typeof receipt.open_time !== 'string'
      || Number.isNaN(Date.parse(receipt.open_time))
      || (receipt.job_batch_id !== null && typeof receipt.job_batch_id !== 'string')
      || (receipt.job_unit !== null && typeof receipt.job_unit !== 'string')
      || (receipt.job_attempt !== null && (!Number.isInteger(receipt.job_attempt) || receipt.job_attempt < 1))
      || (receipt.job_input_hash !== null && typeof receipt.job_input_hash !== 'string')
      || !validJobSubmissions
      || !Array.isArray(receipt.entries)
      || !Number.isInteger(receipt.entry_count)
      || receipt.entry_count < 0
      || receipt.entry_count !== receipt.entries.length
      || !uniqueEntryPaths
      || receipt.entries.some(entry => !validSnapshotEntry(entry, receipt.repository_root))
      || typeof receipt.boundary_message !== 'string'
      || receipt.boundary_message.length === 0) {
      guardProofMismatch('Guard open receipt snapshot is invalid', {
        guardId,
        receiptKind,
        receiptFile
      });
    }
  } else if (!hasExactFields(receipt, CHECK_RECEIPT_FIELDS)
    || !path.isAbsolute(receipt.repository_root)
    || !SHA256_PATTERN.test(receipt.open_receipt_hash)
    || typeof receipt.check_time !== 'string'
    || Number.isNaN(Date.parse(receipt.check_time))
    || !Array.isArray(receipt.violations)
    || !Number.isInteger(receipt.violation_count)
    || receipt.violation_count < 0
    || receipt.violation_count !== receipt.violations.length
    || receipt.violations.some(violation => !validViolation(violation, receipt.repository_root))) {
    guardProofMismatch('Guard check receipt is invalid', {
      guardId,
      receiptKind,
      receiptFile
    });
  }

  return { raw, receipt };
}

function validateGuardProofPair({
  guardId,
  openReceipt,
  openReceiptRaw,
  checkReceipt,
  checkReceiptRaw,
  expectedRepositoryRoot
}) {
  const openReceiptHash = receiptHash(openReceiptRaw);
  if (checkReceipt.open_receipt_hash !== openReceiptHash
    || comparisonPath(checkReceipt.repository_root) !== comparisonPath(openReceipt.repository_root)
    || (expectedRepositoryRoot
      && comparisonPath(openReceipt.repository_root) !== comparisonPath(expectedRepositoryRoot))) {
    guardProofMismatch('Guard open/check receipts do not form one immutable repository proof', {
      guardId,
      receiptKind: 'pair'
    });
  }
  return {
    openReceiptHash,
    checkReceiptHash: receiptHash(checkReceiptRaw)
  };
}

function comparisonPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isWithin(parent, candidate) {
  const relative = path.relative(comparisonPath(parent), comparisonPath(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function snapshotEntry(root, target) {
  const stat = fs.lstatSync(target, { bigint: true });
  return {
    path: path.relative(root, target),
    type: stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other',
    size: stat.size.toString(),
    mtime_ns: stat.mtimeNs.toString()
  };
}

function violationStillUnresolved(repositoryRoot, violation) {
  let current = null;
  try {
    current = snapshotEntry(repositoryRoot, violation.absolute_path);
  } catch (error) {
    if (error?.code !== 'ENOENT') return true;
  }

  if (violation.change_kind === 'added') return current !== null;
  if (current === null) return true;
  return current.type !== violation.entry_type
    || current.size !== violation.before.size
    || current.mtime_ns !== violation.before.mtime_ns;
}

function normalizeRelative(p) {
  return p.split(path.sep).join('/');
}

function snapshotRepository(root, guardDir) {
  const entries = [];
  const normalizedGuard = comparisonPath(guardDir);

  function walk(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (EXCLUDED_DIRS.has(item.name)) continue;
      if (comparisonPath(full) === normalizedGuard) continue;
      if (comparisonPath(full).startsWith(normalizedGuard + path.sep)) continue;

      const entry = snapshotEntry(root, full);
      entry.path = normalizeRelative(entry.path);
      entries.push(entry);

      if (item.isDirectory()) {
        walk(full);
      }
    }
  }

  walk(root);
  return entries;
}

function openWorkerGuard({ repositoryRoot, paths, job }) {
  const resolvedRoot = path.resolve(repositoryRoot);
  const guardDir = paths.workerGuards;

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(guardDir), { recursive: true });

  // Verify guard directory is within repository
  if (!isWithin(resolvedRoot, guardDir)) {
    throw new GameKbError('GUARD_PATH_ESCAPE', 'Guard directory escaped repository root', {
      repositoryRoot: resolvedRoot,
      guardDir
    });
  }

  // Verify real paths if they exist
  if (fs.existsSync(guardDir)) {
    const realGuard = fs.realpathSync(guardDir);
    if (!comparisonPath(realGuard).startsWith(comparisonPath(resolvedRoot))) {
      throw new GameKbError('GUARD_PATH_ESCAPE', 'Guard directory escaped through a junction', {
        repositoryRoot: resolvedRoot,
        realGuard
      });
    }
  }

  const guardId = crypto.randomUUID();

  // Create guard directory before snapshot so it's part of the baseline
  fs.mkdirSync(guardDir, { recursive: true });

  const snapshot = snapshotRepository(resolvedRoot, guardDir);
  const submissions = Array.isArray(job?.submissions)
    ? job.submissions.map(submission => ({
      unit: submission?.unit ?? null,
      attempt: submission?.attempt ?? null,
      input_hash: submission?.input_hash ?? null
    }))
    : job?.unit
      ? [{ unit: job.unit, attempt: job.attempt ?? null, input_hash: job.input_hash || null }]
      : [];
  const receipt = {
    guard_id: guardId,
    repository_root: resolvedRoot,
    open_time: new Date().toISOString(),
    job_batch_id: job?.batch_id || null,
    job_unit: job?.unit || null,
    job_attempt: job?.attempt ?? null,
    job_input_hash: job?.input_hash || null,
    job_submissions: submissions,
    entry_count: snapshot.length,
    entries: snapshot,
    boundary_message: 'Guard covers repository-root contents only; paths outside the repository are not monitored.'
  };

  const guardFile = path.join(guardDir, `${guardId}.json`);
  writeImmutableJson(guardFile, receipt, 'GUARD_RECEIPT_CONFLICT');

  return {
    guard_id: guardId,
    entry_count: snapshot.length,
    boundary_message: receipt.boundary_message
  };
}

function checkWorkerGuard({ repositoryRoot, paths, guardId }) {
  const resolvedRoot = path.resolve(repositoryRoot);
  const guardDir = paths.workerGuards;
  const guardFile = path.join(guardDir, `${guardId}.json`);
  const checkFile = path.join(guardDir, `${guardId}-check.json`);

  if (!fs.existsSync(guardFile)) {
    throw new GameKbError('GUARD_NOT_FOUND', 'Guard receipt not found', {
      guard_id: guardId,
      expected_path: guardFile
    });
  }

  const { raw: openReceiptRaw, receipt } = readGuardReceipt(guardFile, guardId, 'open');
  if (comparisonPath(receipt.repository_root) !== comparisonPath(resolvedRoot)) {
    throw new GameKbError('GUARD_PROOF_MISMATCH', 'Guard open receipt identity does not match the requested check', {
      guard_id: guardId
    });
  }
  const openReceiptHash = receiptHash(openReceiptRaw);
  if (fs.existsSync(checkFile)) {
    const { raw: checkReceiptRaw, receipt: existing } = readGuardReceipt(checkFile, guardId, 'check');
    validateGuardProofPair({
      guardId,
      openReceipt: receipt,
      openReceiptRaw,
      checkReceipt: existing,
      checkReceiptRaw,
      expectedRepositoryRoot: resolvedRoot
    });
    return existing;
  }
  const currentEntries = snapshotRepository(resolvedRoot, guardDir);

  const beforeMap = new Map();
  for (const entry of receipt.entries) {
    beforeMap.set(comparisonPath(path.resolve(resolvedRoot, entry.path)), entry);
  }

  const afterMap = new Map();
  for (const entry of currentEntries) {
    afterMap.set(comparisonPath(path.resolve(resolvedRoot, entry.path)), entry);
  }

  const violations = [];

  // Check for added or modified entries
  for (const [key, after] of afterMap) {
    const before = beforeMap.get(key);
    if (!before) {
      violations.push({
        change_kind: 'added',
        repository_relative: normalizeRelative(after.path),
        absolute_path: path.resolve(resolvedRoot, after.path),
        entry_type: after.type,
        before: null,
        after: { size: after.size, mtime_ns: after.mtime_ns }
      });
    } else if (before.type !== after.type || before.size !== after.size || before.mtime_ns !== after.mtime_ns) {
      violations.push({
        change_kind: 'modified',
        repository_relative: normalizeRelative(after.path),
        absolute_path: path.resolve(resolvedRoot, after.path),
        entry_type: after.type,
        before: { size: before.size, mtime_ns: before.mtime_ns },
        after: { size: after.size, mtime_ns: after.mtime_ns }
      });
    }
  }

  // Check for deleted entries
  for (const [key, before] of beforeMap) {
    if (!afterMap.has(key)) {
      violations.push({
        change_kind: 'deleted',
        repository_relative: normalizeRelative(before.path),
        absolute_path: path.resolve(resolvedRoot, before.path),
        entry_type: before.type,
        before: { size: before.size, mtime_ns: before.mtime_ns },
        after: null
      });
    }
  }

  // Sort violations by repository_relative for determinism
  violations.sort((a, b) => a.repository_relative.localeCompare(b.repository_relative));

  const checkResult = {
    guard_id: guardId,
    open_receipt_hash: openReceiptHash,
    repository_root: resolvedRoot,
    check_time: new Date().toISOString(),
    violations,
    violation_count: violations.length
  };

  // Persist check receipt atomically
  writeImmutableJson(checkFile, checkResult, 'GUARD_RECEIPT_CONFLICT');

  return checkResult;
}

function unresolvedWorkerGuardReports(paths) {
  const guardDir = paths.workerGuards;
  if (!fs.existsSync(guardDir)) return [];

  const reports = [];
  const files = fs.readdirSync(guardDir);

  for (const file of files) {
    if (!file.endsWith('.json') || file.endsWith('-check.json')) continue;

    const guardId = file.slice(0, -'.json'.length);
    const guardFile = path.join(guardDir, file);
    const checkFile = path.join(guardDir, `${guardId}-check.json`);
    if (!fs.existsSync(checkFile)) {
      readGuardReceipt(guardFile, guardId, 'open');
      reports.push({
        guard_id: guardId,
        status: 'check-pending',
        violation_count: 0,
        violations: []
      });
    }
  }

  for (const file of files) {
    if (!file.endsWith('-check.json')) continue;

    const guardId = file.slice(0, -'-check.json'.length);
    const checkFile = path.join(guardDir, file);
    const guardFile = path.join(guardDir, `${guardId}.json`);
    if (!fs.existsSync(guardFile)) {
      guardProofMismatch('Guard check receipt has no matching open receipt', {
        guardId,
        receiptKind: 'check',
        receiptFile: checkFile
      });
    }
    const { raw: openReceiptRaw, receipt: openReceipt } = readGuardReceipt(guardFile, guardId, 'open');
    const { raw: checkReceiptRaw, receipt: checkResult } = readGuardReceipt(checkFile, guardId, 'check');
    validateGuardProofPair({
      guardId,
      openReceipt,
      openReceiptRaw,
      checkReceipt: checkResult,
      checkReceiptRaw,
      expectedRepositoryRoot: repositoryRootFor(paths.novel)
    });

    const unresolvedViolations = checkResult.violations.filter(violation => (
      violationStillUnresolved(openReceipt.repository_root, violation)
    ));
    if (unresolvedViolations.length > 0) {
      reports.push({
        guard_id: checkResult.guard_id,
        check_time: checkResult.check_time,
        violation_count: unresolvedViolations.length,
        violations: unresolvedViolations
      });
    }
  }

  return reports;
}

function assertNoUnresolvedWorkerGuards(paths) {
  const reports = unresolvedWorkerGuardReports(paths);
  if (reports.length > 0) {
    throw new GameKbError('GUARD_VIOLATIONS_UNRESOLVED', 'Worker guard violations must be resolved before continuing', {
      guard_ids: reports.map(report => report.guard_id),
      worker_guard_reports: reports
    });
  }
}

function assertCleanGuardForSubmission({ paths, guardId, batchId, unit, attempt, inputHash }) {
  if (!guardId) {
    throw new GameKbError('GUARD_ID_REQUIRED', 'Submission broker requires a guard ID', {});
  }
  const guardDir = paths.workerGuards;
  const guardFile = path.join(guardDir, `${guardId}.json`);
  const checkFile = path.join(guardDir, `${guardId}-check.json`);

  if (!fs.existsSync(guardFile)) {
    throw new GameKbError('GUARD_NOT_FOUND', 'Guard receipt not found', {
      guard_id: guardId,
      expected_path: guardFile
    });
  }

  if (!fs.existsSync(checkFile)) {
    throw new GameKbError('GUARD_CLEAN_RECEIPT_REQUIRED', 'Guard check receipt not found; run guard-check first', {
      guard_id: guardId,
      expected_path: checkFile
    });
  }

  const { raw: openReceiptRaw, receipt } = readGuardReceipt(guardFile, guardId, 'open');
  const { raw: checkReceiptRaw, receipt: checkResult } = readGuardReceipt(checkFile, guardId, 'check');
  const { openReceiptHash, checkReceiptHash } = validateGuardProofPair({
    guardId,
    openReceipt: receipt,
    openReceiptRaw,
    checkReceipt: checkResult,
    checkReceiptRaw,
    expectedRepositoryRoot: repositoryRootFor(paths.novel)
  });

  if (checkResult.violations.length > 0) {
    throw new GameKbError('GUARD_VIOLATIONS_UNRESOLVED', 'Guard check has unresolved violations', {
      guard_id: guardId,
      violation_count: checkResult.violation_count,
      violations: checkResult.violations
    });
  }

  const mismatches = [];
  if (receipt.job_batch_id !== batchId) mismatches.push('batch_id');
  const submissions = Array.isArray(receipt.job_submissions) && receipt.job_submissions.length > 0
    ? receipt.job_submissions
    : [{ unit: receipt.job_unit, attempt: receipt.job_attempt, input_hash: receipt.job_input_hash }];
  const expectedSubmission = submissions.find(submission => submission.unit === unit)
    || (submissions.length === 1 ? submissions[0] : null);
  if (!expectedSubmission || expectedSubmission.unit !== unit) mismatches.push('unit');
  if (expectedSubmission && expectedSubmission.attempt !== attempt) mismatches.push('attempt');
  if (expectedSubmission && expectedSubmission.input_hash !== inputHash) mismatches.push('input_hash');

  if (mismatches.length > 0) {
    throw new GameKbError('GUARD_SUBMISSION_IDENTITY_MISMATCH', 'Submission identity does not match guarded job', {
      guard_id: guardId,
      mismatches,
      receipt: {
        batch_id: receipt.job_batch_id,
        submissions
      },
      submission: { batch_id: batchId, unit, attempt, input_hash: inputHash }
    });
  }

  return {
    guard_id: guardId,
    check_time: checkResult.check_time,
    open_time: receipt.open_time,
    repository_root: receipt.repository_root,
    guard_open_receipt_hash: openReceiptHash,
    guard_check_receipt_hash: checkReceiptHash
  };
}

module.exports = {
  assertCleanGuardForSubmission,
  assertNoUnresolvedWorkerGuards,
  openWorkerGuard,
  checkWorkerGuard,
  unresolvedWorkerGuardReports
};
