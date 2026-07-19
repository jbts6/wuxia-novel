'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');
const { prepareNovel } = require('../scripts/lib/source');
const {
  makeNovel,
  readJson,
  sourceRef,
  validChapterDraft
} = require('./helpers');

let recovery = {};
let workerGuard = {};
try {
  recovery = require('../scripts/lib/draft-recovery');
  workerGuard = require('../scripts/lib/worker-guard');
} catch {
  // First TDD run exercises the missing module.
}

function chapterFixture(name, runId) {
  const novel = makeNovel(name, '第一章 起始\n甲在山谷中与故人相逢。\n');
  createOrResumeRun(novel, { runId });
  prepareNovel(novel, { runId });
  const paths = pathsFor(novel, runId);
  fs.mkdirSync(paths.staging, { recursive: true });
  const manifest = readJson(paths.manifest);
  const chapter = manifest.chapters[0];
  return { novel, paths, chapter, manifest };
}

function openGuardWithViolation(fixture, sourcePath) {
  const repositoryRoot = fixture.paths.novel;
  const job = {
    batch_id: `chapter-batch-${String(fixture.chapter.number).padStart(3, '0')}`,
    chapters: [],
    worker_write_paths: [],
    submissions: []
  };
  // Open guard BEFORE creating the source file
  const guardResult = workerGuard.openWorkerGuard({
    repositoryRoot,
    paths: fixture.paths,
    job
  });
  // Check guard AFTER source file exists to create violation report
  workerGuard.checkWorkerGuard({
    repositoryRoot,
    paths: fixture.paths,
    guardId: guardResult.guard_id
  });
  return guardResult.guard_id;
}

function writeYaml(file, value) {
  fs.writeFileSync(file, yaml.dump(value, { noRefs: true, lineWidth: -1 }), 'utf8');
  return file;
}

function validDraft(chapter) {
  return validChapterDraft({
    skills: [],
    items: [],
    factions: [],
    source_hash: chapter.input_hash,
    chapter_summary: {
      title: chapter.title,
      summary: '甲在山谷中与故人相逢。',
      source_refs: [sourceRef(chapter.number, '甲在山谷中与故人相逢')]
    }
  });
}

test('recoverChapterDraft copies valid misplaced file to staging and creates receipt', () => {
  const fixture = chapterFixture('恢复有效试书', 'run-recovery-valid');
  const misplacedPath = path.join(fixture.paths.novel, 'misplaced_valid.yaml');
  // Open guard BEFORE creating the source file
  const guardId = openGuardWithViolation(fixture, misplacedPath);
  // Now create the source file (guard will detect it as a new file)
  writeYaml(misplacedPath, validDraft(fixture.chapter));
  // Check guard to register the violation
  workerGuard.checkWorkerGuard({
    repositoryRoot: fixture.paths.novel,
    paths: fixture.paths,
    guardId
  });

  const result = recovery.recoverChapterDraft({
    repositoryRoot: fixture.paths.novel,
    paths: fixture.paths,
    manifest: fixture.manifest,
    unit: 'chapter:001',
    sourcePath: misplacedPath,
    confirmed: true,
    guardId
  });

  // Progress should be updated by acceptDraft
  const progressAfter = readJson(fixture.paths.progress);
  assert.equal(progressAfter.units['chapter:001'].status, 'done');
  assert.equal(progressAfter.units['chapter:001'].attempts, 1);

  // Source file should still exist
  assert.equal(fs.existsSync(misplacedPath), true);

  // Destination is consumed by acceptDraft after successful acceptance
  // Receipt should exist
  assert.equal(typeof result.receipt_path, 'string');
  assert.equal(fs.existsSync(result.receipt_path), true);
  const receipt = readJson(result.receipt_path);
  assert.equal(receipt.unit, 'chapter:001');
  assert.equal(typeof receipt.source_hash, 'string');
  assert.equal(typeof receipt.destination_hash, 'string');

  // Acceptance result should be returned
  assert.equal(typeof result.acceptance, 'object');
  assert.equal(result.acceptance.unit, 'chapter:001');
});

test('recoverChapterDraft rejects missing confirmation', () => {
  const fixture = chapterFixture('恢复缺确认试书', 'run-recovery-no-confirm');
  const misplacedPath = path.join(fixture.paths.novel, 'misplaced_no_confirm.yaml');
  writeYaml(misplacedPath, validDraft(fixture.chapter));

  assert.throws(
    () => recovery.recoverChapterDraft({
      repositoryRoot: fixture.paths.novel,
      paths: fixture.paths,
      manifest: fixture.manifest,
      unit: 'chapter:001',
      sourcePath: misplacedPath,
      confirmed: false,
      guardId: 'test-guard-id'
    }),
    error => error.code === 'RECOVERY_NOT_CONFIRMED'
  );
});

test('recoverChapterDraft rejects invalid content', () => {
  const fixture = chapterFixture('恢复无效内容试书', 'run-recovery-invalid');
  const misplacedPath = path.join(fixture.paths.novel, 'misplaced_invalid.yaml');
  const guardId = openGuardWithViolation(fixture, misplacedPath);
  fs.writeFileSync(misplacedPath, 'decisions: [\n', 'utf8');
  workerGuard.checkWorkerGuard({
    repositoryRoot: fixture.paths.novel,
    paths: fixture.paths,
    guardId
  });

  assert.throws(
    () => recovery.recoverChapterDraft({
      repositoryRoot: fixture.paths.novel,
      paths: fixture.paths,
      manifest: fixture.manifest,
      unit: 'chapter:001',
      sourcePath: misplacedPath,
      confirmed: true,
      guardId
    }),
    error => error.code === 'RECOVERY_INVALID_CONTENT'
  );
});

test('recoverChapterDraft rejects source outside repository', () => {
  const fixture = chapterFixture('恢复外部文件试书', 'run-recovery-outside');
  const outsidePath = path.join(fixture.paths.novel, '..', 'outside.yaml');
  writeYaml(outsidePath, validDraft(fixture.chapter));

  try {
    assert.throws(
      () => recovery.recoverChapterDraft({
        repositoryRoot: fixture.paths.novel,
        paths: fixture.paths,
        manifest: fixture.manifest,
        unit: 'chapter:001',
        sourcePath: outsidePath,
        confirmed: true,
        guardId: 'test-guard-id'
      }),
      error => error.code === 'RECOVERY_SOURCE_OUTSIDE'
    );
  } finally {
    fs.rmSync(outsidePath, { force: true });
  }
});

test('recoverChapterDraft rejects symbolic link source', () => {
  const fixture = chapterFixture('恢复符号链接试书', 'run-recovery-symlink');
  const realPath = path.join(fixture.paths.novel, 'real_for_symlink.yaml');
  const symlinkPath = path.join(fixture.paths.novel, 'symlink_source.yaml');
  writeYaml(realPath, validDraft(fixture.chapter));

  try {
    fs.symlinkSync(realPath, symlinkPath);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'ENOSYS') return;
    throw err;
  }

  assert.throws(
    () => recovery.recoverChapterDraft({
      repositoryRoot: fixture.paths.novel,
      paths: fixture.paths,
      manifest: fixture.manifest,
      unit: 'chapter:001',
      sourcePath: symlinkPath,
      confirmed: true,
      guardId: 'test-guard-id'
    }),
    error => error.code === 'RECOVERY_SOURCE_SYMLINK'
  );
});

test('recoverChapterDraft rejects source in another run', () => {
  const fixture = chapterFixture('恢复跨运行试书', 'run-recovery-cross-run');
  const otherRunDir = path.join(fixture.paths.runs, 'run-other');
  fs.mkdirSync(otherRunDir, { recursive: true });
  const crossRunPath = path.join(otherRunDir, 'cross_draft.yaml');
  writeYaml(crossRunPath, validDraft(fixture.chapter));

  assert.throws(
    () => recovery.recoverChapterDraft({
      repositoryRoot: fixture.paths.novel,
      paths: fixture.paths,
      manifest: fixture.manifest,
      unit: 'chapter:001',
      sourcePath: crossRunPath,
      confirmed: true,
      guardId: 'test-guard-id'
    }),
    error => error.code === 'RECOVERY_SOURCE_CROSS_RUN'
  );
});

test('recoverChapterDraft uses current attempt from progress', () => {
  const fixture = chapterFixture('恢复当前尝试试书', 'run-recovery-attempt');
  const misplacedPath = path.join(fixture.paths.novel, 'misplaced_attempt.yaml');
  const guardId = openGuardWithViolation(fixture, misplacedPath);
  writeYaml(misplacedPath, validDraft(fixture.chapter));
  workerGuard.checkWorkerGuard({
    repositoryRoot: fixture.paths.novel,
    paths: fixture.paths,
    guardId
  });

  // First recovery should use attempt 1
  const result1 = recovery.recoverChapterDraft({
    repositoryRoot: fixture.paths.novel,
    paths: fixture.paths,
    manifest: fixture.manifest,
    unit: 'chapter:001',
    sourcePath: misplacedPath,
    confirmed: true,
    guardId
  });

  assert.match(result1.destination_path, /chapter_001_attempt_01\.yaml$/);
  assert.equal(result1.attempt, 1);

  // Progress should show attempt 1 done
  const progressAfter1 = readJson(fixture.paths.progress);
  assert.equal(progressAfter1.units['chapter:001'].attempts, 1);
  assert.equal(progressAfter1.units['chapter:001'].status, 'done');
});

test('recoverChapterDraft calls acceptDraft and returns acceptance result', () => {
  const fixture = chapterFixture('恢复验收试书', 'run-recovery-acceptance');
  const misplacedPath = path.join(fixture.paths.novel, 'misplaced_accept.yaml');
  const guardId = openGuardWithViolation(fixture, misplacedPath);
  writeYaml(misplacedPath, validDraft(fixture.chapter));
  workerGuard.checkWorkerGuard({
    repositoryRoot: fixture.paths.novel,
    paths: fixture.paths,
    guardId
  });

  const result = recovery.recoverChapterDraft({
    repositoryRoot: fixture.paths.novel,
    paths: fixture.paths,
    manifest: fixture.manifest,
    unit: 'chapter:001',
    sourcePath: misplacedPath,
    confirmed: true,
    guardId
  });

  // Should return acceptance result
  assert.equal(typeof result.acceptance, 'object');
  assert.equal(result.acceptance.unit, 'chapter:001');
  assert.equal(result.acceptance.status, 'done');

  // Progress should be updated
  const progress = readJson(fixture.paths.progress);
  assert.equal(progress.units['chapter:001'].status, 'done');
  assert.equal(progress.units['chapter:001'].attempts, 1);
});

test('recoverChapterDraft rejects source not discovered by guard', () => {
  const fixture = chapterFixture('恢复未发现试书', 'run-recovery-not-discovered');
  const misplacedPath = path.join(fixture.paths.novel, 'misplaced_not_discovered.yaml');

  // Open guard and create one discovered file
  const guardId = openGuardWithViolation(fixture, misplacedPath);
  writeYaml(misplacedPath, validDraft(fixture.chapter));
  workerGuard.checkWorkerGuard({
    repositoryRoot: fixture.paths.novel,
    paths: fixture.paths,
    guardId
  });

  // Create a different file that is NOT in guard violations
  const otherPath = path.join(fixture.paths.novel, 'other_misplaced.yaml');
  writeYaml(otherPath, validDraft(fixture.chapter));

  assert.throws(
    () => recovery.recoverChapterDraft({
      repositoryRoot: fixture.paths.novel,
      paths: fixture.paths,
      manifest: fixture.manifest,
      unit: 'chapter:001',
      sourcePath: otherPath,
      confirmed: true,
      guardId
    }),
    error => error.code === 'RECOVERY_SOURCE_NOT_GUARD_DISCOVERED'
  );

  fs.rmSync(otherPath, { force: true });
});
