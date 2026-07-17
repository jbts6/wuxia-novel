'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { pathsFor } = require('../scripts/lib/paths');
const { resolveRun } = require('../scripts/lib/run');
const { makeNovel, readJson, runFlow } = require('./helpers');

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
  assert.equal('next_actions' in output, false);
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
