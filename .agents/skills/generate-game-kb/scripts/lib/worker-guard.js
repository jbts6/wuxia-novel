'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');

const EXCLUDED_DIRS = new Set(['.git', 'node_modules']);

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
  const receipt = {
    guard_id: guardId,
    repository_root: resolvedRoot,
    open_time: new Date().toISOString(),
    job_batch_id: job?.batch_id || null,
    job_unit: job?.unit || null,
    job_attempt: job?.attempt ?? null,
    job_input_hash: job?.input_hash || null,
    entry_count: snapshot.length,
    entries: snapshot,
    boundary_message: 'Guard covers repository-root contents only; paths outside the repository are not monitored.'
  };

  const guardFile = path.join(guardDir, `${guardId}.json`);
  fs.writeFileSync(guardFile, JSON.stringify(receipt, null, 2));

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

  if (!fs.existsSync(guardFile)) {
    throw new GameKbError('GUARD_NOT_FOUND', 'Guard receipt not found', {
      guard_id: guardId,
      expected_path: guardFile
    });
  }

  const receipt = JSON.parse(fs.readFileSync(guardFile, 'utf8'));
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
    check_time: new Date().toISOString(),
    violations,
    violation_count: violations.length
  };

  // Persist check receipt atomically
  const checkFile = path.join(guardDir, `${guardId}-check.json`);
  fs.writeFileSync(checkFile, JSON.stringify(checkResult, null, 2));

  return checkResult;
}

function unresolvedWorkerGuardReports(paths) {
  const guardDir = paths.workerGuards;
  if (!fs.existsSync(guardDir)) return [];

  const reports = [];
  const files = fs.readdirSync(guardDir);

  for (const file of files) {
    if (!file.endsWith('-check.json')) continue;

    const checkFile = path.join(guardDir, file);
    const checkResult = JSON.parse(fs.readFileSync(checkFile, 'utf8'));

    if (checkResult.violations && checkResult.violations.length > 0) {
      reports.push({
        guard_id: checkResult.guard_id,
        check_time: checkResult.check_time,
        violation_count: checkResult.violation_count,
        violations: checkResult.violations
      });
    }
  }

  return reports;
}

function assertCleanGuardForSubmission({ paths, guardId, batchId, unit, attempt, inputHash }) {
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

  const receipt = JSON.parse(fs.readFileSync(guardFile, 'utf8'));
  const checkResult = JSON.parse(fs.readFileSync(checkFile, 'utf8'));

  if (checkResult.violations && checkResult.violations.length > 0) {
    throw new GameKbError('GUARD_VIOLATIONS_UNRESOLVED', 'Guard check has unresolved violations', {
      guard_id: guardId,
      violation_count: checkResult.violation_count,
      violations: checkResult.violations
    });
  }

  const mismatches = [];
  if (receipt.job_batch_id !== batchId) mismatches.push('batch_id');
  if (receipt.job_unit !== unit) mismatches.push('unit');
  if (receipt.job_attempt !== attempt) mismatches.push('attempt');
  if (receipt.job_input_hash !== inputHash) mismatches.push('input_hash');

  if (mismatches.length > 0) {
    throw new GameKbError('GUARD_SUBMISSION_IDENTITY_MISMATCH', 'Submission identity does not match guarded job', {
      guard_id: guardId,
      mismatches,
      receipt: {
        batch_id: receipt.job_batch_id,
        unit: receipt.job_unit,
        attempt: receipt.job_attempt,
        input_hash: receipt.job_input_hash
      },
      submission: { batch_id: batchId, unit, attempt, input_hash: inputHash }
    });
  }

  return {
    guard_id: guardId,
    check_time: checkResult.check_time,
    open_time: receipt.open_time,
    repository_root: receipt.repository_root
  };
}

module.exports = { assertCleanGuardForSubmission, openWorkerGuard, checkWorkerGuard, unresolvedWorkerGuardReports };
