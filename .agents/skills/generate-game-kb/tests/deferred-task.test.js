'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { verifyInstalled } = require('../scripts/lib/install');
const { readJson } = require('./helpers');
const { preparePublishedV5Run } = require('./v5-published-helper');

function hashFile(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

test('deep task can be created after v5 publication without modifying the archived base', () => {
  const fixture = preparePublishedV5Run({ runId: 'run-post-publish-task' });
  const artifactManifest = path.join(fixture.archivedRun, 'artifact-manifest.json');
  const archivedHash = hashFile(artifactManifest);
  const installed = verifyInstalled(fixture.novel);

  const result = require('./helpers').runFlow([
    'task-add', fixture.novel, '--run', fixture.prepared.run_id,
    '--type', 'characters-deep', '--scope', 'characters', '--requested-by', 'user', '--json'
  ]);

  assert.equal(result.status, 0, result.stderr);
  const task = JSON.parse(result.stdout);
  const deferredRoot = path.join(
    fixture.novel, '.game-kb-work', 'deferred', fixture.prepared.run_id
  );
  const expectedStagingPath = path.join(deferredRoot, 'tasks', task.task_id, 'overlay.yaml');
  assert.equal(task.base_manifest_hash, archivedHash);
  assert.equal(task.base_data_hash, installed.final_data_hash);
  assert.equal(task.status, 'pending');
  assert.equal(task.staging_path, expectedStagingPath);
  assert.equal(path.isAbsolute(task.staging_path), true);
  assert.equal(fs.existsSync(task.input_path), true);
  assert.equal(fs.existsSync(task.staging_path), false);
  assert.equal(hashFile(artifactManifest), archivedHash);
  assert.equal(fs.existsSync(path.join(fixture.archivedRun, 'deferred-tasks.json')), false);

  const state = readJson(path.join(deferredRoot, 'deferred-tasks.json'));
  assert.equal(state.tasks[0].task_id, task.task_id);
  assert.equal(state.tasks[0].staging_path, expectedStagingPath);
  const input = readJson(task.input_path);
  assert.equal(input.current_data_hash, installed.final_data_hash);
  assert.equal(input.staging_path, expectedStagingPath);
});

test('deep task accepts an overlay only at its controller-issued staging path', () => {
  const fixture = preparePublishedV5Run({ runId: 'run-controller-owned-overlay-path' });
  const added = require('./helpers').runFlow([
    'task-add', fixture.novel, '--run', fixture.prepared.run_id,
    '--type', 'characters-deep', '--scope', 'characters', '--requested-by', 'user', '--json'
  ]);
  assert.equal(added.status, 0, added.stderr);
  const task = JSON.parse(added.stdout);

  const result = require('./helpers').runFlow([
    'task-run', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', task.task_id, '--draft', path.join(fixture.novel, 'other-overlay.yaml'), '--json'
  ]);

  assert.notEqual(result.status, 0);
  const error = JSON.parse(result.stderr);
  assert.equal(error.code, 'DEFERRED_DRAFT_PATH_MISMATCH');
  assert.equal(error.details.expected, task.staging_path);
});
