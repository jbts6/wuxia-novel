'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const os = require('node:os');

const { pathsFor } = require('../scripts/lib/paths');
const { sha256 } = require('../scripts/lib/source');

let workerGuard = {};
try {
  workerGuard = require('../scripts/lib/worker-guard');
} catch {
  // First TDD run exercises the missing module.
}

function makeTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-test-'));
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'chapter.txt'), 'original text');
  fs.writeFileSync(path.join(dir, 'README.md'), '# test');
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function makePaths(repoDir) {
  const novelDir = path.join(repoDir, 'novel');
  fs.mkdirSync(novelDir, { recursive: true });
  return pathsFor(novelDir, 'run-guard-test');
}

function captureError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  assert.fail('Expected callback to throw');
}

test('openWorkerGuard returns a guard ID and persists snapshot', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const result = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    assert.equal(typeof result.guard_id, 'string');
    assert.equal(result.guard_id.length > 0, true);
    assert.equal(fs.existsSync(path.join(paths.workerGuards, `${result.guard_id}.json`)), true);
  } finally {
    cleanup(repo);
  }
});

test('checkWorkerGuard detects no changes when repository is untouched', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    const result = workerGuard.checkWorkerGuard({ repositoryRoot: repo, paths, guardId: guard_id });

    assert.equal(result.guard_id, guard_id);
    assert.deepEqual(result.violations, []);
    assert.equal(typeof result.check_time, 'string');
  } finally {
    cleanup(repo);
  }
});

test('checkWorkerGuard detects a new file added by a worker', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    // Simulate worker adding a file
    fs.writeFileSync(path.join(repo, 'src', 'rogue.yaml'), 'rogue content');

    const result = workerGuard.checkWorkerGuard({ repositoryRoot: repo, paths, guardId: guard_id });

    assert.equal(result.violations.length >= 1, true);
    const violation = result.violations.find(v => v.change_kind === 'added');
    assert.notEqual(violation, undefined);
    assert.equal(violation.repository_relative, 'src/rogue.yaml');
    assert.equal(violation.entry_type, 'file');
  } finally {
    cleanup(repo);
  }
});

test('checkWorkerGuard detects a modified source file', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    // Simulate worker modifying a file
    fs.writeFileSync(path.join(repo, 'src', 'chapter.txt'), 'modified text');

    const result = workerGuard.checkWorkerGuard({ repositoryRoot: repo, paths, guardId: guard_id });

    const violation = result.violations.find(v => v.change_kind === 'modified');
    assert.notEqual(violation, undefined);
    assert.equal(violation.repository_relative, 'src/chapter.txt');
  } finally {
    cleanup(repo);
  }
});

test('checkWorkerGuard detects a deleted file', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    // Simulate worker deleting a file
    fs.unlinkSync(path.join(repo, 'README.md'));

    const result = workerGuard.checkWorkerGuard({ repositoryRoot: repo, paths, guardId: guard_id });

    const violation = result.violations.find(v => v.change_kind === 'deleted');
    assert.notEqual(violation, undefined);
    assert.equal(violation.repository_relative, 'README.md');
    assert.equal(violation.entry_type, 'file');
  } finally {
    cleanup(repo);
  }
});

test('checkWorkerGuard detects a new directory', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    // Simulate worker creating a directory
    fs.mkdirSync(path.join(repo, 'src', 'newdir'));

    const result = workerGuard.checkWorkerGuard({ repositoryRoot: repo, paths, guardId: guard_id });

    const violation = result.violations.find(v => v.change_kind === 'added' && v.entry_type === 'directory');
    assert.notEqual(violation, undefined);
    assert.equal(violation.repository_relative, 'src/newdir');
  } finally {
    cleanup(repo);
  }
});

test('checkWorkerGuard excludes .git and node_modules from snapshot', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });
    fs.mkdirSync(path.join(repo, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'node_modules', 'pkg', 'index.js'), '');

    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    // Modify node_modules (should be ignored)
    fs.writeFileSync(path.join(repo, 'node_modules', 'pkg', 'index.js'), 'changed');

    // Modify .git (should be ignored)
    fs.writeFileSync(path.join(repo, '.git', 'config'), 'changed');

    const result = workerGuard.checkWorkerGuard({ repositoryRoot: repo, paths, guardId: guard_id });

    assert.deepEqual(result.violations, []);
  } finally {
    cleanup(repo);
  }
});

test('checkWorkerGuard returns normalized absolute paths on Windows', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    fs.writeFileSync(path.join(repo, 'src', 'rogue.yaml'), 'content');

    const result = workerGuard.checkWorkerGuard({ repositoryRoot: repo, paths, guardId: guard_id });

    const violation = result.violations.find(v => v.change_kind === 'added');
    assert.notEqual(violation, undefined);
    assert.equal(typeof violation.absolute_path, 'string');
    assert.equal(path.isAbsolute(violation.absolute_path), true);
  } finally {
    cleanup(repo);
  }
});

test('checkWorkerGuard results are deterministic regardless of worker report', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    fs.writeFileSync(path.join(repo, 'src', 'rogue.yaml'), 'content');

    const result1 = workerGuard.checkWorkerGuard({ repositoryRoot: repo, paths, guardId: guard_id });
    const checkReceipt = path.join(paths.workerGuards, `${guard_id}-check.json`);
    const receiptBefore = fs.readFileSync(checkReceipt);
    const result2 = workerGuard.checkWorkerGuard({ repositoryRoot: repo, paths, guardId: guard_id });

    assert.deepEqual(result1.violations, result2.violations);
    assert.deepEqual(fs.readFileSync(checkReceipt), receiptBefore);
  } finally {
    cleanup(repo);
  }
});

test('unresolvedWorkerGuardReports returns empty when no guard exists', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const reports = workerGuard.unresolvedWorkerGuardReports(paths);
    assert.deepEqual(reports, []);
  } finally {
    cleanup(repo);
  }
});

test('unresolvedWorkerGuardReports blocks scheduling when violations exist', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    fs.writeFileSync(path.join(repo, 'src', 'rogue.yaml'), 'content');

    // Check to record violations
    workerGuard.checkWorkerGuard({ repositoryRoot: repo, paths, guardId: guard_id });

    const reports = workerGuard.unresolvedWorkerGuardReports(paths);
    assert.equal(reports.length > 0, true);
    assert.equal(reports[0].guard_id, guard_id);
  } finally {
    cleanup(repo);
  }
});

test('unresolvedWorkerGuardReports returns empty when guard has no violations', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    // Check with no changes
    workerGuard.checkWorkerGuard({ repositoryRoot: repo, paths, guardId: guard_id });

    const reports = workerGuard.unresolvedWorkerGuardReports(paths);
    assert.deepEqual(reports, []);
  } finally {
    cleanup(repo);
  }
});

test('unresolvedWorkerGuardReports treats an open guard without a check as unresolved', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });
    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    const reports = workerGuard.unresolvedWorkerGuardReports(paths);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].guard_id, guard_id);
    assert.equal(reports[0].status, 'check-pending');
    assert.throws(
      () => workerGuard.assertNoUnresolvedWorkerGuards(paths),
      error => error.code === 'GUARD_VIOLATIONS_UNRESOLVED'
    );
  } finally {
    cleanup(repo);
  }
});

test('openWorkerGuard rejects a junction escape outside repository root', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(path.dirname(paths.workerGuards), { recursive: true });
    // Create a junction from workerGuards to outside
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-outside-'));
    try {
      fs.symlinkSync(outside, paths.workerGuards, 'junction');
      assert.throws(
        () => workerGuard.openWorkerGuard({
          repositoryRoot: repo,
          paths,
          job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
        }),
        error => error.code === 'GUARD_PATH_ESCAPE'
      );
    } finally {
      cleanup(outside);
    }
  } finally {
    cleanup(repo);
  }
});

test('openWorkerGuard boundary message promises repository-root coverage only', () => {
  const repo = makeTempRepo();
  try {
    const paths = makePaths(repo);
    fs.mkdirSync(paths.run, { recursive: true });

    const result = workerGuard.openWorkerGuard({
      repositoryRoot: repo,
      paths,
      job: { batch_id: 'chapter-batch-001', chapters: [], worker_write_paths: [], submissions: [] }
    });

    assert.equal(typeof result.boundary_message, 'string');
    assert.match(result.boundary_message, /repository/i);
  } finally {
    cleanup(repo);
  }
});

// --- assertCleanGuardForSubmission tests ---

function makeSiblingRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-sibling-'));
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  // Selected novel directory
  const novelDir = path.join(root, 'selected-novel');
  fs.mkdirSync(novelDir, { recursive: true });
  fs.writeFileSync(path.join(novelDir, 'novel.txt'), '第一章 起始\n甲。\n');
  // Sibling output directory with nested path
  const siblingOutput = path.join(root, 'sibling-output', 'random', 'deep');
  fs.mkdirSync(siblingOutput, { recursive: true });
  return { root, novelDir, siblingOutput };
}

test('assertCleanGuardForSubmission rejects unknown guard ID', () => {
  const { root, novelDir } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });
    fs.mkdirSync(paths.workerGuards, { recursive: true });

    const error = captureError(() => workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: 'nonexistent-guard-id',
      batchId: 'chapter-batch-001',
      unit: 'chapter:001',
      attempt: 1,
      inputHash: 'sha256:abc123'
    }));

    assert.equal(error.code, 'GUARD_NOT_FOUND');
  } finally {
    cleanup(root);
  }
});

test('assertCleanGuardForSubmission rejects when no check receipt exists', () => {
  const { root, novelDir } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });

    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: root,
      paths,
      job
    });

    // No check performed — no check receipt
    const error = captureError(() => workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: guard_id,
      batchId: 'chapter-batch-001',
      unit: 'chapter:001',
      attempt: 1,
      inputHash: 'sha256:abc123'
    }));

    assert.equal(error.code, 'GUARD_CLEAN_RECEIPT_REQUIRED');
  } finally {
    cleanup(root);
  }
});

test('assertCleanGuardForSubmission rejects when check has violations', () => {
  const { root, novelDir, siblingOutput } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });

    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: root,
      paths,
      job
    });

    // Add a rogue file in sibling directory
    fs.writeFileSync(path.join(siblingOutput, 'rogue.yaml'), 'rogue content');

    // Check detects violations
    const checkResult = workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id });
    assert.equal(checkResult.violations.length > 0, true);

    const error = captureError(() => workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: guard_id,
      batchId: 'chapter-batch-001',
      unit: 'chapter:001',
      attempt: 1,
      inputHash: 'sha256:abc123'
    }));

    assert.equal(error.code, 'GUARD_VIOLATIONS_UNRESOLVED');
    assert.equal(error.details.violation_count > 0, true);
  } finally {
    cleanup(root);
  }
});

test('assertCleanGuardForSubmission rejects when batch_id mismatches', () => {
  const { root } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });

    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id });

    const error = captureError(() => workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: guard_id,
      batchId: 'chapter-batch-999',
      unit: 'chapter:001',
      attempt: 1,
      inputHash: 'sha256:abc123'
    }));

    assert.equal(error.code, 'GUARD_SUBMISSION_IDENTITY_MISMATCH');
    assert.deepEqual(error.details.mismatches, ['batch_id']);
  } finally {
    cleanup(root);
  }
});

test('assertCleanGuardForSubmission rejects when unit mismatches', () => {
  const { root } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });

    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id });

    const error = captureError(() => workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: guard_id,
      batchId: 'chapter-batch-001',
      unit: 'chapter:002',
      attempt: 1,
      inputHash: 'sha256:abc123'
    }));

    assert.equal(error.code, 'GUARD_SUBMISSION_IDENTITY_MISMATCH');
    assert.deepEqual(error.details.mismatches, ['unit']);
  } finally {
    cleanup(root);
  }
});

test('assertCleanGuardForSubmission rejects when attempt mismatches', () => {
  const { root } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });

    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id });

    const error = captureError(() => workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: guard_id,
      batchId: 'chapter-batch-001',
      unit: 'chapter:001',
      attempt: 2,
      inputHash: 'sha256:abc123'
    }));

    assert.equal(error.code, 'GUARD_SUBMISSION_IDENTITY_MISMATCH');
    assert.deepEqual(error.details.mismatches, ['attempt']);
  } finally {
    cleanup(root);
  }
});

test('assertCleanGuardForSubmission rejects when input_hash mismatches', () => {
  const { root } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });

    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id });

    const error = captureError(() => workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: guard_id,
      batchId: 'chapter-batch-001',
      unit: 'chapter:001',
      attempt: 1,
      inputHash: 'sha256:different'
    }));

    assert.equal(error.code, 'GUARD_SUBMISSION_IDENTITY_MISMATCH');
    assert.deepEqual(error.details.mismatches, ['input_hash']);
  } finally {
    cleanup(root);
  }
});

test('assertCleanGuardForSubmission succeeds with exact clean check and matching identity', () => {
  const { root } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });

    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id });

    const proof = workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: guard_id,
      batchId: 'chapter-batch-001',
      unit: 'chapter:001',
      attempt: 1,
      inputHash: 'sha256:abc123'
    });

    assert.equal(proof.guard_id, guard_id);
    assert.equal(typeof proof.check_time, 'string');
    assert.equal(typeof proof.open_time, 'string');
    assert.equal(proof.repository_root, path.resolve(root));
    const openReceipt = path.join(paths.workerGuards, `${guard_id}.json`);
    const checkReceipt = path.join(paths.workerGuards, `${guard_id}-check.json`);
    const check = JSON.parse(fs.readFileSync(checkReceipt, 'utf8'));
    assert.equal(check.open_receipt_hash, sha256(fs.readFileSync(openReceipt)));
    assert.equal(check.repository_root, path.resolve(root));
    assert.equal(proof.guard_open_receipt_hash, sha256(fs.readFileSync(openReceipt)));
    assert.equal(proof.guard_check_receipt_hash, sha256(fs.readFileSync(checkReceipt)));
  } finally {
    cleanup(root);
  }
});

test('assertCleanGuardForSubmission matches an identity in a batched job submission list', () => {
  const { root } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });
    const job = {
      batch_id: 'chapter-batch-001-002',
      chapters: [],
      worker_write_paths: [],
      submissions: [
        { unit: 'chapter:001', attempt: 1, input_hash: 'sha256:first' },
        { unit: 'chapter:002', attempt: 2, input_hash: 'sha256:second' }
      ]
    };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id });

    const proof = workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: guard_id,
      batchId: job.batch_id,
      unit: 'chapter:002',
      attempt: 2,
      inputHash: 'sha256:second'
    });

    assert.equal(proof.guard_id, guard_id);
  } finally {
    cleanup(root);
  }
});

test('checkWorkerGuard reports repository-relative and absolute paths for sibling rogue file', () => {
  const { root, siblingOutput } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });

    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });

    // Add rogue file in sibling output directory
    fs.writeFileSync(path.join(siblingOutput, 'rogue.yaml'), 'rogue content');

    const result = workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id });

    const violation = result.violations.find(v => v.change_kind === 'added');
    assert.notEqual(violation, undefined);
    assert.equal(violation.repository_relative, 'sibling-output/random/deep/rogue.yaml');
    assert.equal(path.isAbsolute(violation.absolute_path), true);
    assert.equal(violation.absolute_path.endsWith('rogue.yaml'), true);
  } finally {
    cleanup(root);
  }
});

test('guard receipt repository_root equals temp Git root, not novel directory', () => {
  const { root, novelDir } = makeSiblingRepo();
  try {
    const novelPaths = pathsFor(novelDir, 'run-sibling-guard');
    fs.mkdirSync(novelPaths.run, { recursive: true });

    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({
      repositoryRoot: root,
      paths: novelPaths,
      job
    });

    const guardFile = path.join(novelPaths.workerGuards, `${guard_id}.json`);
    const receipt = JSON.parse(fs.readFileSync(guardFile, 'utf8'));

    assert.equal(receipt.repository_root, path.resolve(root));
    assert.notEqual(receipt.repository_root, path.resolve(novelDir));
  } finally {
    cleanup(root);
  }
});

test('assertCleanGuardForSubmission rejects multiple field mismatches', () => {
  const { root } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });

    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id });

    const error = captureError(() => workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: guard_id,
      batchId: 'chapter-batch-999',
      unit: 'chapter:002',
      attempt: 99,
      inputHash: 'sha256:different'
    }));

    assert.equal(error.code, 'GUARD_SUBMISSION_IDENTITY_MISMATCH');
    assert.equal(error.details.mismatches.length, 4);
    assert.ok(error.details.mismatches.includes('batch_id'));
    assert.ok(error.details.mismatches.includes('unit'));
    assert.ok(error.details.mismatches.includes('attempt'));
    assert.ok(error.details.mismatches.includes('input_hash'));
  } finally {
    cleanup(root);
  }
});

test('checkWorkerGuard rejects an open receipt with an invalid open_time', () => {
  const repo = makeSiblingRepo();
  try {
    const { root } = repo;
    const paths = makePaths(root);
    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    const receiptFile = path.join(paths.workerGuards, `${guard_id}.json`);
    const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
    receipt.open_time = 42;
    fs.writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

    assert.throws(
      () => workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id }),
      error => error.code === 'GUARD_PROOF_MISMATCH'
    );
  } finally {
    cleanup(repo.root);
  }
});

test('checkWorkerGuard rejects an open receipt snapshot entry missing required fields', () => {
  const repo = makeSiblingRepo();
  try {
    const { root } = repo;
    const paths = makePaths(root);
    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    const receiptFile = path.join(paths.workerGuards, `${guard_id}.json`);
    const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
    delete receipt.entries[0].type;
    fs.writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

    assert.throws(
      () => workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id }),
      error => error.code === 'GUARD_PROOF_MISMATCH'
    );
  } finally {
    cleanup(repo.root);
  }
});

test('checkWorkerGuard rejects an open receipt snapshot path outside the repository', () => {
  const repo = makeSiblingRepo();
  try {
    const { root } = repo;
    const paths = makePaths(root);
    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    const receiptFile = path.join(paths.workerGuards, `${guard_id}.json`);
    const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
    receipt.entries[0].path = '../outside.txt';
    fs.writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

    assert.throws(
      () => workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id }),
      error => error.code === 'GUARD_PROOF_MISMATCH'
    );
  } finally {
    cleanup(repo.root);
  }
});

test('checkWorkerGuard normalizes malformed open receipt JSON', () => {
  const { root } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });
    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    fs.writeFileSync(path.join(paths.workerGuards, `${guard_id}.json`), '{');

    const error = captureError(() => workerGuard.checkWorkerGuard({
      repositoryRoot: root,
      paths,
      guardId: guard_id
    }));

    assert.equal(error.code, 'GUARD_PROOF_MISMATCH');
  } finally {
    cleanup(root);
  }
});

test('checkWorkerGuard normalizes an open receipt with no repository root', () => {
  const { root } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });
    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    const receiptFile = path.join(paths.workerGuards, `${guard_id}.json`);
    const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
    delete receipt.repository_root;
    fs.writeFileSync(receiptFile, JSON.stringify(receipt));

    const error = captureError(() => workerGuard.checkWorkerGuard({
      repositoryRoot: root,
      paths,
      guardId: guard_id
    }));

    assert.equal(error.code, 'GUARD_PROOF_MISMATCH');
  } finally {
    cleanup(root);
  }
});

test('assertCleanGuardForSubmission normalizes malformed check receipt JSON', () => {
  const { root } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });
    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id });
    fs.writeFileSync(path.join(paths.workerGuards, `${guard_id}-check.json`), '{');

    const error = captureError(() => workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: guard_id,
      batchId: job.batch_id,
      unit: job.unit,
      attempt: job.attempt,
      inputHash: job.input_hash
    }));

    assert.equal(error.code, 'GUARD_PROOF_MISMATCH');
  } finally {
    cleanup(root);
  }
});

test('unresolvedWorkerGuardReports normalizes malformed check receipt JSON', () => {
  const { root } = makeSiblingRepo();
  try {
    const paths = makePaths(root);
    fs.mkdirSync(paths.run, { recursive: true });
    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: root, paths, job });
    workerGuard.checkWorkerGuard({ repositoryRoot: root, paths, guardId: guard_id });
    fs.writeFileSync(path.join(paths.workerGuards, `${guard_id}-check.json`), '{');

    const error = captureError(() => workerGuard.unresolvedWorkerGuardReports(paths));

    assert.equal(error.code, 'GUARD_PROOF_MISMATCH');
  } finally {
    cleanup(root);
  }
});

test('assertCleanGuardForSubmission rejects a guard scoped below the real Git root', () => {
  const { root, novelDir } = makeSiblingRepo();
  try {
    const paths = pathsFor(novelDir, 'run-narrow-guard');
    fs.mkdirSync(paths.run, { recursive: true });
    const job = { batch_id: 'chapter-batch-001', unit: 'chapter:001', attempt: 1, input_hash: 'sha256:abc123' };
    const { guard_id } = workerGuard.openWorkerGuard({ repositoryRoot: novelDir, paths, job });
    workerGuard.checkWorkerGuard({ repositoryRoot: novelDir, paths, guardId: guard_id });

    const error = captureError(() => workerGuard.assertCleanGuardForSubmission({
      paths,
      guardId: guard_id,
      batchId: job.batch_id,
      unit: job.unit,
      attempt: job.attempt,
      inputHash: job.input_hash
    }));

    assert.equal(error.code, 'GUARD_PROOF_MISMATCH');
  } finally {
    cleanup(root);
  }
});
