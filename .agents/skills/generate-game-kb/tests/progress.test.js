'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createProgress, transitionProgress } = require('../scripts/lib/chapter-progress');
const { issueNextWindow, issueRetryJob } = require('../scripts/lib/chapter-work');
const { pathsFor } = require('../scripts/lib/paths');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-progress-'));
  const novel = path.join(root, 'novel');
  const source = path.join(root, 'chapter.txt');
  fs.mkdirSync(novel, { recursive: true });
  fs.writeFileSync(source, '第一章\n甲现身。\n', 'utf8');
  return {
    paths: pathsFor(novel, 'run-progress'),
    manifest: {
      chapters: [{
        number: 1,
        title: '第一章',
        file: source,
        input_hash: 'sha256:chapter-1'
      }]
    }
  };
}

test('rejects unknown progress events without mutating current state', () => {
  const { manifest } = fixture();
  const current = createProgress(manifest);
  assert.throws(
    () => transitionProgress(current, { type: 'unknown', manifest }),
    error => error.code === 'PROGRESS_EVENT_INVALID'
  );
  assert.equal(current.units['chapter:001'].status, 'pending');
});

test('rejects acceptance for a unit outside the active window', () => {
  const { manifest } = fixture();
  const current = createProgress(manifest);
  assert.throws(
    () => transitionProgress(current, {
      type: 'accepted', unit: 'chapter:001', output_hash: 'sha256:x', manifest
    }),
    error => error.code === 'ACTIVE_WINDOW_INVALID'
  );
});

test('user retry opens a new cycle without removing the fixed window', () => {
  const { paths, manifest } = fixture();
  fs.mkdirSync(paths.run, { recursive: true });
  let progress = issueNextWindow({ paths, manifest, progress: createProgress(manifest) }).progress;
  progress = transitionProgress(progress, {
    type: 'rejected', unit: 'chapter:001', reason: 'bad', repair_allowed: false,
    errors: [{ code: 'SOURCE_REFS_REQUIRED' }], manifest, paths
  });
  progress = issueRetryJob({ paths, manifest, progress, unit: 'chapter:001' }).progress;
  progress = transitionProgress(progress, {
    type: 'rejected', unit: 'chapter:001', reason: 'still bad', repair_allowed: false,
    errors: [{ code: 'SOURCE_REFS_REQUIRED' }], manifest, paths
  });
  progress = transitionProgress(progress, {
    type: 'retry-unit', unit: 'chapter:001', manifest, paths
  });
  assert.deepEqual(progress.active_units, ['chapter:001']);
  assert.equal(progress.units['chapter:001'].status, 'pending');
  assert.equal(progress.units['chapter:001'].cycle, 2);
  assert.equal(progress.units['chapter:001'].attempt, 0);

  const retried = issueRetryJob({ paths, manifest, progress, unit: 'chapter:001' });
  assert.equal(retried.job.cycle, 2);
  assert.equal(retried.job.attempt, 1);
  assert.equal(retried.job.producer, 'chapter-worker');
});
