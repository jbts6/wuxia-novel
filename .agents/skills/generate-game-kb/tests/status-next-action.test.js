'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { pathsFor } = require('../scripts/lib/paths');
const { resolveRun } = require('../scripts/lib/run');
const { projectWorkerJobs } = require('../scripts/flow');
const {
  makeNovel,
  parseJsonLine,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft,
  writeStagingDraft
} = require('./helpers');

function activePaths(novel) {
  const run = resolveRun(novel);
  return pathsFor(novel, run.run_id);
}

function snapshotNovel(root) {
  const snapshot = [];
  function visit(directory, relative) {
    snapshot.push({ kind: 'directory', path: relative });
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const child = path.join(directory, entry.name);
      const childRelative = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        visit(child, childRelative);
      } else if (entry.isFile()) {
        snapshot.push({
          kind: 'file',
          path: childRelative,
          bytes: fs.readFileSync(child)
        });
      } else if (entry.isSymbolicLink()) {
        snapshot.push({ kind: 'symlink', path: childRelative, target: fs.readlinkSync(child) });
      } else {
        snapshot.push({ kind: 'other', path: childRelative });
      }
    }
  }
  visit(root, '.');
  return snapshot;
}

test('worker status projection fails closed instead of returning an invalid raw job', () => {
  const internalPath = path.resolve('controller-owned', 'chapter_001.yaml');
  const invalidJob = {
    batch_id: 'chapter-batch-001',
    chapters: [],
    worker_write_paths: [],
    submissions: [],
    internal_staging_path: internalPath
  };

  assert.throws(
    () => projectWorkerJobs([invalidJob]),
    error => error.code === 'CHAPTER_JOB_PROJECTION_INVALID'
  );
});

test('status returns one lifecycle action without mutating the novel tree', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const before = snapshotNovel(novel);

  const result = runFlow(['status', novel, '--json']);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(snapshotNovel(novel), before);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.counts, { pending: 1, done: 0, stale: 0, manual_review: 0 });
  assert.deepEqual(
    { next_action: output.next_action, next_units: output.next_units },
    { next_action: 'accept-chapters', next_units: ['chapter:001'] }
  );
  assert.equal(output.chapter_jobs[0].chapters[0].attempt, 1);
  assert.deepEqual(output.chapter_jobs[0].worker_write_paths, []);
  assert.deepEqual(output.chapter_jobs[0].submissions, [{
    unit: 'chapter:001',
    attempt: 1,
    input_hash: readJson(activePaths(novel).manifest).chapters[0].input_hash
  }]);
  // Worker projection strips staging_path from visible status
  assert.equal('staging_path' in output.chapter_jobs[0].chapters[0], false);
  assert.equal('staging_paths' in output.chapter_jobs[0].chapters[0], false);
  assert.equal('next_actions' in output, false);
});

test('Lite status skips full-book domain workers after controller domain planning', () => {
  const novel = makeNovel('Lite 域计划路由试书', '第一章 起始\n甲。\n');
  const prepared = runFlow(['lite-prepare', novel, '--run', 'run-lite-domain-route', '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);
  const runId = JSON.parse(prepared.stdout).run_id;
  const paths = pathsFor(novel, runId);
  const manifest = readJson(paths.manifest);
  const draft = validChapterDraft({
    source_hash: manifest.chapters[0].input_hash,
    characters: [],
    skills: [],
    items: [],
    factions: [],
    chapter_summary: {
      title: manifest.chapters[0].title,
      summary: '甲在本章出现。',
      source_refs: [sourceRef(1, '甲。')]
    }
  });
  const accepted = runFlow([
    'lite-accept', novel, '--run', runId, '--unit', 'chapter:001',
    '--draft', writeStagingDraft(novel, 'chapter:001', draft), '--json'
  ]);
  assert.equal(accepted.status, 0, accepted.stderr);

  const beforePlan = runFlow(['lite-status', novel, '--run', runId, '--json']);
  assert.equal(beforePlan.status, 0, beforePlan.stderr);
  assert.equal(JSON.parse(beforePlan.stdout).next_action, 'lite-plan-domains');

  const planned = runFlow(['lite-plan-domains', novel, '--run', runId, '--json']);
  assert.equal(planned.status, 0, planned.stderr);

  const afterPlan = runFlow(['lite-status', novel, '--run', runId, '--json']);
  assert.equal(afterPlan.status, 0, afterPlan.stderr);
  const output = JSON.parse(afterPlan.stdout);
  assert.equal(output.next_action, 'lite-publish');
  assert.equal('domain_jobs' in output, false);
});

test('unresolved worker guard blocks status scheduling and direct publish gates', () => {
  const novel = makeNovel('guard 阻断试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--run', 'run-guard-blocking', '--json']).status, 0);

  const opened = runFlow(['guard-open', novel, '--run', 'run-guard-blocking', '--json']);
  assert.equal(opened.status, 0, opened.stderr);
  const guardId = JSON.parse(opened.stdout).guard_id;
  fs.writeFileSync(path.join(novel, 'rogue-worker-output.yaml'), 'rogue: true\n', 'utf8');
  const checked = runFlow([
    'guard-check', novel, '--run', 'run-guard-blocking', '--guard-id', guardId, '--json'
  ]);
  assert.equal(checked.status, 0, checked.stderr);
  assert.ok(JSON.parse(checked.stdout).violation_count > 0);

  const status = runFlow(['status', novel, '--run', 'run-guard-blocking', '--json']);
  assert.equal(status.status, 0, status.stderr);
  const statusOutput = JSON.parse(status.stdout);
  assert.equal(statusOutput.next_action, 'worker-write-review');
  assert.deepEqual(statusOutput.next_units, []);
  assert.equal('chapter_jobs' in statusOutput, false);
  assert.equal(statusOutput.worker_guard_reports[0].guard_id, guardId);

  for (const command of ['publish', 'install', 'verify']) {
    const result = runFlow([command, novel, '--run', 'run-guard-blocking', '--json']);
    assert.notEqual(result.status, 0, command);
    assert.equal(parseJsonLine(result.stderr).code, 'GUARD_VIOLATIONS_UNRESOLVED', command);
  }
});

test('status issues only the second current staging path after one rejected chapter draft', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const manifest = readJson(paths.manifest);
  fs.writeFileSync(manifest.chapters[0].staging_paths[0], 'chapter: [\n', 'utf8');

  const rejected = runFlow([
    'accept', novel, '--run', paths.runId,
    '--unit', 'chapter:001', '--draft', manifest.chapters[0].staging_paths[0], '--json'
  ]);
  assert.equal(rejected.status, 1);

  const result = runFlow(['status', novel, '--run', paths.runId, '--json']);
  assert.equal(result.status, 0, result.stderr);
  const descriptor = JSON.parse(result.stdout).chapter_jobs[0].chapters[0];
  const job = JSON.parse(result.stdout).chapter_jobs[0];
  assert.equal(descriptor.attempt, 2);
  assert.deepEqual(job.worker_write_paths, []);
  assert.deepEqual(job.submissions, [{
    unit: 'chapter:001',
    attempt: 2,
    input_hash: manifest.chapters[0].input_hash
  }]);
  // Worker projection strips staging_path from visible status
  assert.equal('staging_path' in descriptor, false);
  assert.equal('staging_paths' in descriptor, false);
});

test('status projects stale progress without recreating missing controller files', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const progress = readJson(paths.progress);
  progress.units['chapter:001'] = {
    ...progress.units['chapter:001'],
    status: 'done',
    attempts: 1,
    input_hash: 'sha256:stale-chapter'
  };
  fs.writeFileSync(paths.progress, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
  fs.rmSync(paths.manualReview);
  const before = snapshotNovel(novel);

  const result = runFlow(['status', novel, '--json']);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(snapshotNovel(novel), before);
  assert.equal(fs.existsSync(paths.manualReview), false);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.counts, { pending: 0, done: 0, stale: 1, manual_review: 0 });
  assert.deepEqual(
    { next_action: output.next_action, next_units: output.next_units },
    { next_action: 'accept-chapters', next_units: ['chapter:001'] }
  );
});

test('worker-backoff records 429 reduction without spending a chapter attempt', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const before = fs.readFileSync(paths.progress);
  assert.equal(readJson(paths.workerPool).concurrency_limit, 5);

  const result = runFlow([
    'worker-backoff', novel, '--run', paths.runId, '--batch', 'batch-001', '--reason', '429', '--json'
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).worker_pool.concurrency_limit, 3);
  assert.deepEqual(fs.readFileSync(paths.progress), before);
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 0);
  assert.equal(readJson(paths.workerPool).concurrency_limit, 3);
});
