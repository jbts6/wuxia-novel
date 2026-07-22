'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createProgress,
  transitionProgress,
  assertProgressInvariant
} = require('../scripts/lib/chapter-progress');
const {
  issueNextWindow,
  issueRetryJob,
  advanceChapterWork,
  activeJobMetadata
} = require('../scripts/lib/chapter-work');
const { stableHash } = require('../scripts/lib/io');
const { chapterAttemptPaths, pathsFor } = require('../scripts/lib/paths');

function manifestWithChapters(count, root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-source-'))) {
  fs.mkdirSync(root, { recursive: true });
  const chapters = [];
  for (let number = 1; number <= count; number += 1) {
    const file = path.join(root, `chapter_${String(number).padStart(3, '0')}.txt`);
    fs.writeFileSync(file, `第${number}章\n甲在此章现身。\n`, 'utf8');
    chapters.push({
      number,
      title: `第${number}章`,
      file,
      input_hash: `sha256:chapter-${number}`
    });
  }
  return { chapters };
}

function temporaryRunPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-work-'));
  const novel = path.join(root, 'novel');
  fs.mkdirSync(novel, { recursive: true });
  const paths = pathsFor(novel, 'run-test');
  fs.mkdirSync(paths.run, { recursive: true });
  return paths;
}

describe('chapter-progress', () => {
  it('initializes the complete v7 unit state', () => {
    const progress = createProgress(manifestWithChapters(3));
    assert.equal(progress.schema_version, 7);
    assert.equal(progress.semantic_contract_version, 7);
    assert.deepEqual(progress.active_units, []);
    assert.deepEqual(progress.units['chapter:001'], {
      status: 'pending',
      cycle: 0,
      attempt: 0,
      producer: null,
      input_hash: null,
      input_file: null,
      output_file: null,
      output_hash: null,
      reject_reason: null,
      repair_allowed: false,
      errors: []
    });
  });

  it('keeps the whole fixed window until every unit is accepted', () => {
    const paths = temporaryRunPaths();
    const manifest = manifestWithChapters(2);
    const issued = issueNextWindow({ paths, manifest, progress: createProgress(manifest) });
    let progress = transitionProgress(issued.progress, {
      type: 'accepted', unit: 'chapter:001', output_hash: 'sha256:one', manifest, paths
    });
    assert.deepEqual(progress.active_units, ['chapter:001', 'chapter:002']);
    progress = transitionProgress(progress, {
      type: 'accepted', unit: 'chapter:002', output_hash: 'sha256:two', manifest, paths
    });
    assert.deepEqual(progress.active_units, []);
  });

  it('rejects a later window while an earlier chapter is pending', () => {
    const manifest = manifestWithChapters(10);
    const progress = createProgress(manifest);
    progress.active_units = ['chapter:006'];
    progress.units['chapter:006'] = {
      status: 'active', cycle: 1, attempt: 1, producer: 'chapter-worker',
      input_hash: 'sha256:x', input_file: 'C:/outside/input.json',
      output_file: 'C:/outside/output.yaml', output_hash: null,
      reject_reason: null, repair_allowed: false, errors: []
    };
    assert.throws(
      () => assertProgressInvariant(progress, manifest),
      error => error.code === 'ACTIVE_WINDOW_INVALID'
    );
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
    const first = issueNextWindow({ paths, manifest, progress: createProgress(manifest) });
    assert.equal(first.jobs.length, 5);
    const acceptedOne = transitionProgress(first.progress, {
      type: 'accepted', unit: 'chapter:001', output_hash: 'sha256:one', manifest, paths
    });
    const second = issueNextWindow({ paths, manifest, progress: acceptedOne });
    assert.deepEqual(second.jobs, []);
    assert.deepEqual(second.progress.active_units, [
      'chapter:001', 'chapter:002', 'chapter:003', 'chapter:004', 'chapter:005'
    ]);
  });

  it('issues chapter six only after the first fixed window is accepted', () => {
    let progress = issueNextWindow({
      paths, manifest, progress: createProgress(manifest)
    }).progress;
    for (let number = 1; number <= 5; number += 1) {
      const unit = `chapter:${String(number).padStart(3, '0')}`;
      progress = transitionProgress(progress, {
        type: 'accepted', unit, output_hash: `sha256:${unit}`, manifest, paths
      });
    }
    const second = issueNextWindow({ paths, manifest, progress });
    assert.equal(second.jobs.length, 5);
    assert.equal(second.jobs[0].unit, 'chapter:006');
  });

  it('returns stable public job metadata and writes immutable chapter input', () => {
    const issued = issueNextWindow({
      paths, manifest, progress: createProgress(manifest)
    });
    const job = issued.jobs[0];
    assert.deepEqual(Object.keys(job).sort(), [
      'attempt', 'cycle', 'input_file', 'input_hash', 'output_file', 'producer', 'unit'
    ]);
    assert.equal(job.producer, 'chapter-worker');
    assert.equal(path.relative(paths.tasks, job.input_file).startsWith('..'), false);
    assert.equal(path.relative(paths.staging, job.output_file).startsWith('..'), false);
    const input = JSON.parse(fs.readFileSync(job.input_file, 'utf8'));
    assert.equal(input.chapter_text.includes('甲在此章现身'), true);
    assert.equal(input.output_file, job.output_file);
    assert.equal(job.input_hash, stableHash(input));
    assert.deepEqual(activeJobMetadata(paths, issued.progress)[0], { ...job, status: 'active' });
  });

  it('uses cycle and attempt in distinct task and staging paths', () => {
    const first = chapterAttemptPaths(paths, 'chapter:001', 1, 1);
    const secondAttempt = chapterAttemptPaths(paths, 'chapter:001', 1, 2);
    const secondCycle = chapterAttemptPaths(paths, 'chapter:001', 2, 1);
    assert.notEqual(first.input, secondAttempt.input);
    assert.notEqual(first.output, secondAttempt.output);
    assert.notEqual(first.input, secondCycle.input);
    assert.notEqual(first.output, secondCycle.output);
    assert.equal(path.relative(paths.tasks, first.input).startsWith('..'), false);
    assert.equal(path.relative(paths.staging, first.output).startsWith('..'), false);
  });

  it('keeps semantic retry on chapter-worker with the chapter source', () => {
    let progress = issueNextWindow({
      paths, manifest, progress: createProgress(manifest)
    }).progress;
    progress = transitionProgress(progress, {
      type: 'rejected', unit: 'chapter:001', reason: 'evidence', repair_allowed: false,
      errors: [{ code: 'SOURCE_REFS_REQUIRED' }], manifest, paths
    });
    const retry = issueRetryJob({ paths, manifest, progress, unit: 'chapter:001' });
    assert.equal(retry.job.producer, 'chapter-worker');
    const input = JSON.parse(fs.readFileSync(retry.job.input_file, 'utf8'));
    assert.equal(typeof input.chapter_text, 'string');
    assert.deepEqual(input.previous_errors, [{ code: 'SOURCE_REFS_REQUIRED' }]);
  });

  it('isolates mechanical repair input from the novel source', () => {
    let progress = issueNextWindow({
      paths, manifest, progress: createProgress(manifest)
    }).progress;
    progress = transitionProgress(progress, {
      type: 'rejected', unit: 'chapter:001', reason: 'yaml_mechanical', repair_allowed: true,
      errors: [{ code: 'YAML_CODE_FENCE' }], manifest, paths
    });
    const retry = issueRetryJob({ paths, manifest, progress, unit: 'chapter:001' });
    assert.equal(retry.job.producer, 'main-agent-repair');
    const input = JSON.parse(fs.readFileSync(retry.job.input_file, 'utf8'));
    assert.deepEqual(input.allowed_repair_codes, ['YAML_CODE_FENCE']);
    for (const forbidden of ['chapter_text', 'source_file', 'source_hash', 'taxonomies']) {
      assert.equal(Object.hasOwn(input, forbidden), false, forbidden);
    }
    assert.equal(input.producer, 'main-agent-repair');
    assert.equal(input.output_file, retry.job.output_file);
  });

  it('enters manual review after attempt two is rejected', () => {
    const smallManifest = manifestWithChapters(2);
    const smallPaths = temporaryRunPaths();
    let progress = issueNextWindow({
      paths: smallPaths, manifest: smallManifest, progress: createProgress(smallManifest)
    }).progress;
    progress = transitionProgress(progress, {
      type: 'rejected', unit: 'chapter:001', reason: 'bad', errors: [],
      repair_allowed: false, manifest: smallManifest, paths: smallPaths
    });
    progress = issueRetryJob({
      paths: smallPaths, manifest: smallManifest, progress, unit: 'chapter:001'
    }).progress;
    progress = transitionProgress(progress, {
      type: 'rejected', unit: 'chapter:001', reason: 'still bad', errors: [],
      repair_allowed: false, manifest: smallManifest, paths: smallPaths
    });
    const result = advanceChapterWork({ paths: smallPaths, manifest: smallManifest, progress });
    assert.equal(result.status, 'manual_review');
    assert.deepEqual(result.manual_review, ['chapter:001']);
  });

  it('returns ready-to-assemble only when all chapters are accepted', () => {
    const smallManifest = manifestWithChapters(2);
    const smallPaths = temporaryRunPaths();
    const issued = issueNextWindow({
      paths: smallPaths, manifest: smallManifest, progress: createProgress(smallManifest)
    });
    let progress = issued.progress;
    for (const job of issued.jobs) {
      progress = transitionProgress(progress, {
        type: 'accepted', unit: job.unit, output_hash: `sha256:${job.unit}`,
        manifest: smallManifest, paths: smallPaths
      });
    }
    assert.equal(
      advanceChapterWork({ paths: smallPaths, manifest: smallManifest, progress }).status,
      'ready-to-assemble'
    );
  });

  it('rejects tampered persisted job paths', () => {
    const issued = issueNextWindow({
      paths, manifest, progress: createProgress(manifest)
    });
    const tampered = structuredClone(issued.progress);
    tampered.units['chapter:001'].output_file = path.join(paths.run, '..', 'escape.yaml');
    assert.throws(
      () => assertProgressInvariant(tampered, manifest, paths),
      error => error.code === 'ACTIVE_WINDOW_INVALID'
    );
  });

  it('rejects a non-identical replay of an immutable job input', () => {
    issueNextWindow({ paths, manifest, progress: createProgress(manifest) });
    const changedManifest = structuredClone(manifest);
    changedManifest.chapters[0].title = '被篡改的章标题';
    assert.throws(
      () => issueNextWindow({ paths, manifest: changedManifest, progress: createProgress(changedManifest) }),
      error => error.code === 'UNIT_ALREADY_ACTIVE'
    );
  });
});
