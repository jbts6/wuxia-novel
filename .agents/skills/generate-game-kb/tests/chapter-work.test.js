'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createProgress, transitionProgress, assertProgressInvariant, MAX_ACTIVE_UNITS } = require('../scripts/lib/chapter-progress');
const { issueNextWindow, issueRetryJob, advanceChapterWork, activeJobMetadata } = require('../scripts/lib/chapter-work');
const { chapterAttemptPaths, pathsFor } = require('../scripts/lib/paths');

function manifestWithChapters(count) {
  const chapters = [];
  for (let i = 1; i <= count; i++) {
    chapters.push({
      number: i,
      title: `第${i}章`,
      file: `/tmp/novel/ch${String(i).padStart(3, '0')}.txt`,
      input_hash: `sha256:ch${i}`
    });
  }
  return { chapters };
}

function temporaryRunPaths() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-work-'));
  const novel = path.join(tmp, 'novel');
  fs.mkdirSync(novel, { recursive: true });
  const paths = pathsFor(novel, 'run-test');
  fs.mkdirSync(paths.run, { recursive: true });
  return paths;
}

describe('chapter-progress', () => {
  it('createProgress initializes all units as pending', () => {
    const manifest = manifestWithChapters(3);
    const progress = createProgress(manifest);
    assert.equal(progress.schema_version, 7);
    assert.deepEqual(progress.active_units, []);
    assert.equal(Object.keys(progress.units).length, 3);
    assert.equal(progress.units['chapter:001'].status, 'pending');
  });

  it('transitionProgress accepted clears window only when all units done', () => {
    const manifest = manifestWithChapters(5);
    let progress = createProgress(manifest);
    const jobs = [
      { unit: 'chapter:001', cycle: 1, attempt: 1 },
      { unit: 'chapter:002', cycle: 1, attempt: 1 }
    ];
    progress = transitionProgress(progress, { type: 'issue-window', jobs, manifest });
    assert.deepEqual(progress.active_units, ['chapter:001', 'chapter:002']);
    progress = transitionProgress(progress, { type: 'accepted', unit: 'chapter:001', output_hash: 'sha256:one', manifest });
    assert.deepEqual(progress.active_units, ['chapter:001', 'chapter:002']);
    assert.equal(progress.units['chapter:001'].status, 'accepted');
    progress = transitionProgress(progress, { type: 'accepted', unit: 'chapter:002', output_hash: 'sha256:two', manifest });
    assert.deepEqual(progress.active_units, []);
  });

  it('transitionProgress rejected keeps unit in active_units', () => {
    const manifest = manifestWithChapters(5);
    let progress = createProgress(manifest);
    progress = transitionProgress(progress, { type: 'issue-window', jobs: [{ unit: 'chapter:001', cycle: 1, attempt: 1 }], manifest });
    progress = transitionProgress(progress, { type: 'rejected', unit: 'chapter:001', reason: 'bad yaml', manifest });
    assert.deepEqual(progress.active_units, ['chapter:001']);
    assert.equal(progress.units['chapter:001'].status, 'rejected');
  });

  it('assertProgressInvariant rejects more than 5 active units', () => {
    const manifest = manifestWithChapters(6);
    const progress = createProgress(manifest);
    progress.active_units = ['chapter:001', 'chapter:002', 'chapter:003', 'chapter:004', 'chapter:005', 'chapter:006'];
    for (const u of progress.active_units) {
      progress.units[u] = { status: 'active', cycle: 1, attempt: 1, output_hash: null };
    }
    assert.throws(() => assertProgressInvariant(progress, manifest), /active_units exceeds/);
  });

  it('assertProgressInvariant rejects duplicate active units', () => {
    const manifest = manifestWithChapters(3);
    const progress = createProgress(manifest);
    progress.active_units = ['chapter:001', 'chapter:001'];
    progress.units['chapter:001'] = { status: 'active', cycle: 1, attempt: 1, output_hash: null };
    assert.throws(() => assertProgressInvariant(progress, manifest), /duplicate/);
  });

  it('assertProgressInvariant rejects attempt out of range', () => {
    const manifest = manifestWithChapters(1);
    const progress = createProgress(manifest);
    progress.active_units = ['chapter:001'];
    progress.units['chapter:001'] = { status: 'active', cycle: 1, attempt: 3, output_hash: null };
    assert.throws(() => assertProgressInvariant(progress, manifest), /attempt out of range/);
  });
});

describe('chapter-work', () => {
  let paths;
  let manifest;

  beforeEach(() => {
    paths = temporaryRunPaths();
    manifest = manifestWithChapters(25);
  });

  it('does not refill a partially completed five-unit window', () => {
    const progress = createProgress(manifest);
    const first = issueNextWindow({ paths, manifest, progress });
    assert.equal(first.jobs.length, 5);
    const acceptedOne = transitionProgress(first.progress, { type: 'accepted', unit: 'chapter:001', output_hash: 'sha256:one', manifest });
    const second = issueNextWindow({ paths, manifest, progress: acceptedOne });
    assert.deepEqual(second.jobs, []);
    assert.deepEqual(second.progress.active_units, ['chapter:001', 'chapter:002', 'chapter:003', 'chapter:004', 'chapter:005']);
  });

  it('issues next window only when active_units is empty', () => {
    let progress = createProgress(manifest);
    const first = issueNextWindow({ paths, manifest, progress });
    assert.equal(first.jobs.length, 5);
    progress = first.progress;
    for (let i = 1; i <= 5; i++) {
      const unit = `chapter:${String(i).padStart(3, '0')}`;
      progress = transitionProgress(progress, { type: 'accepted', unit, output_hash: `sha256:ch${i}`, manifest });
    }
    const second = issueNextWindow({ paths, manifest, progress });
    assert.equal(second.jobs.length, 5);
    assert.equal(second.jobs[0].unit, 'chapter:006');
  });

  it('retry-unit creates a new cycle without overwriting prior files', () => {
    const first = chapterAttemptPaths(paths, 'chapter:001', 1, 1);
    const retried = chapterAttemptPaths(paths, 'chapter:001', 2, 1);
    assert.notEqual(first.input, retried.input);
    assert.notEqual(first.output, retried.output);
  });

  it('issueRetryJob increments attempt within same cycle', () => {
    let progress = createProgress(manifest);
    const issued = issueNextWindow({ paths, manifest, progress });
    progress = issued.progress;
    progress = transitionProgress(progress, { type: 'rejected', unit: 'chapter:001', reason: 'bad', manifest });
    const retry = issueRetryJob({ paths, manifest, progress, unit: 'chapter:001' });
    assert.equal(retry.job.attempt, 2);
    assert.equal(retry.job.cycle, 1);
    assert.equal(retry.progress.units['chapter:001'].status, 'active');
  });

  it('advanceChapterWork returns manual_review when attempt 2 rejected', () => {
    let progress = createProgress(manifestWithChapters(2));
    const smallPaths = temporaryRunPaths();
    const smallManifest = manifestWithChapters(2);
    const issued = issueNextWindow({ paths: smallPaths, manifest: smallManifest, progress });
    progress = issued.progress;
    progress = transitionProgress(progress, { type: 'rejected', unit: 'chapter:001', reason: 'bad', manifest: smallManifest });
    const retry = issueRetryJob({ paths: smallPaths, manifest: smallManifest, progress, unit: 'chapter:001' });
    progress = retry.progress;
    progress = transitionProgress(progress, { type: 'rejected', unit: 'chapter:001', reason: 'still bad', manifest: smallManifest });
    const result = advanceChapterWork({ paths: smallPaths, manifest: smallManifest, progress });
    assert.equal(result.status, 'manual_review');
    assert.deepEqual(result.manual_review, ['chapter:001']);
  });

  it('advanceChapterWork returns ready-to-assemble when all accepted', () => {
    const smallManifest = manifestWithChapters(2);
    const smallPaths = temporaryRunPaths();
    let progress = createProgress(smallManifest);
    const issued = issueNextWindow({ paths: smallPaths, manifest: smallManifest, progress });
    progress = issued.progress;
    for (const job of issued.jobs) {
      progress = transitionProgress(progress, { type: 'accepted', unit: job.unit, output_hash: `sha256:${job.unit}`, manifest: smallManifest });
    }
    const result = advanceChapterWork({ paths: smallPaths, manifest: smallManifest, progress });
    assert.equal(result.status, 'ready-to-assemble');
  });

  it('activeJobMetadata returns current window state', () => {
    const progress = createProgress(manifest);
    const issued = issueNextWindow({ paths, manifest, progress });
    const meta = activeJobMetadata(paths, issued.progress);
    assert.equal(meta.length, 5);
    assert.equal(meta[0].unit, 'chapter:001');
    assert.equal(meta[0].attempt, 1);
    assert.equal(meta[0].status, 'active');
  });

  it('writes immutable input files with exclusive creation', () => {
    const progress = createProgress(manifest);
    const issued = issueNextWindow({ paths, manifest, progress });
    assert.ok(fs.existsSync(issued.jobs[0].input));
    const content = JSON.parse(fs.readFileSync(issued.jobs[0].input, 'utf8'));
    assert.equal(content.semantic_contract_version, 7);
    assert.equal(content.unit, 'chapter:001');
    assert.equal(content.chapter, 1);
  });
});
