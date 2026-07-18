'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { applyOverlay } = require('../scripts/lib/overlay');
const { deferredPathsFor } = require('../scripts/lib/paths');
const { verifyInstalled } = require('../scripts/lib/install');
const { readJson, runFlow } = require('./helpers');
const { pass, preparePublishedV5Run } = require('./v5-published-helper');

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

function registryKeysByName(archivedRun) {
  const registry = readJson(path.join(archivedRun, 'accepted', 'candidate-registry.json'));
  return Object.fromEntries(registry.categories.characters.map(entry => [entry.canonical_name, entry.registry_key]));
}

function writeOverlay(paths, task, operations) {
  const file = task.staging_path;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, yaml.dump({
    schema_version: 1,
    base_manifest_hash: task.base_manifest_hash,
    base_data_hash: task.base_data_hash,
    operations: [...operations].sort((left, right) => left.registry_key.localeCompare(right.registry_key))
  }, { noRefs: true, lineWidth: -1 }), 'utf8');
  return file;
}

function addTask(fixture) {
  return pass(runFlow([
    'task-add', fixture.novel, '--run', fixture.prepared.run_id,
    '--type', 'characters-deep', '--scope', 'characters', '--json'
  ]), 'task-add');
}

function readyTask(fixture, paths, task, operations) {
  const draft = writeOverlay(paths, task, operations);
  return pass(runFlow([
    'task-run', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', task.task_id, '--draft', draft, '--json'
  ]), 'task-run');
}

test('overlay applies keep merge drop and patch then promotes a verified Dashboard data revision', () => {
  const fixture = preparePublishedV5Run({ runId: 'run-overlay-operations' });
  const paths = deferredPathsFor(fixture.novel, fixture.prepared.run_id);
  const keys = registryKeysByName(fixture.archivedRun);
  const task = addTask(fixture);
  const ready = readyTask(fixture, paths, task, [
    { action: 'patch', registry_key: keys['甲'], patch: { biography: '甲遍历江湖后返乡。' } },
    { action: 'merge', registry_key: keys['乙'], target_registry_key: keys['甲'] },
    { action: 'drop', registry_key: keys['丙'] },
    { action: 'keep', registry_key: keys['丁'] }
  ]);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.staging_path, task.staging_path);
  assert.equal(ready.draft_path, task.staging_path);
  assert.equal(ready.overlay_path, path.join(paths.overlays, `${task.task_id}.yaml`));
  assert.equal(fs.existsSync(ready.overlay_path), true);

  const before = verifyInstalled(fixture.novel);
  const receipt = pass(runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', task.task_id, '--json'
  ]), 'task-apply');

  const active = readYaml(path.join(fixture.novel, 'data', 'characters.yaml'));
  const backup = readYaml(path.join(receipt.backup_path, 'characters.yaml'));
  const revision = readYaml(path.join(receipt.revision_dir, 'data', 'characters.yaml'));
  assert.deepEqual(active.map(record => record.name), ['丁', '甲']);
  assert.equal(active.find(record => record.name === '甲').biography, '甲遍历江湖后返乡。');
  assert.deepEqual(revision, active);
  assert.equal(backup.length, 4);
  assert.equal(receipt.previous_final_data_hash, before.final_data_hash);
  assert.equal(receipt.backup_final_data_hash, before.final_data_hash);
  assert.equal(receipt.final_data_hash, verifyInstalled(fixture.novel).final_data_hash);
  assert.equal(verifyInstalled(fixture.novel).passed, true);
  const installedReceipt = readJson(path.join(fixture.novel, 'reports', 'generate_game_kb_install.json'));
  assert.equal(installedReceipt.registry_map_hash, receipt.registry_map_hash);

  const nextTask = addTask(fixture);
  const nextInput = readJson(nextTask.input_path);
  assert.equal(new Set(nextInput.entities.map(entity => entity.final_id)).size, nextInput.entities.length);
  const mergedEntity = nextInput.entities.find(entity => entity.record.name === '甲');
  assert.deepEqual(mergedEntity.registry_keys.sort(), [keys['乙'], keys['甲']].sort());
});

test('successive overlays are cumulative and a stale task cannot replace newer Dashboard data', () => {
  const fixture = preparePublishedV5Run({ runId: 'run-overlay-cumulative' });
  const paths = deferredPathsFor(fixture.novel, fixture.prepared.run_id);
  const keys = registryKeysByName(fixture.archivedRun);
  const firstTask = addTask(fixture);
  readyTask(fixture, paths, firstTask, [
    { action: 'patch', registry_key: keys['甲'], patch: { biography: '第一版传记。' } }
  ]);
  const first = pass(runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', firstTask.task_id, '--json'
  ]), 'first apply');

  const secondTask = addTask(fixture);
  const staleTask = addTask(fixture);
  assert.equal(secondTask.base_data_hash, first.final_data_hash);
  readyTask(fixture, paths, secondTask, [
    { action: 'patch', registry_key: keys['甲'], patch: { biography: '第二版传记。' } }
  ]);
  readyTask(fixture, paths, staleTask, [
    { action: 'patch', registry_key: keys['甲'], patch: { biography: '陈旧传记。' } }
  ]);
  const second = pass(runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', secondTask.task_id, '--json'
  ]), 'second apply');

  assert.notEqual(second.backup_path, first.backup_path);
  assert.equal(
    readYaml(path.join(second.backup_path, 'characters.yaml')).find(record => record.name === '甲').biography,
    '第一版传记。'
  );
  const stale = runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', staleTask.task_id, '--json'
  ]);
  assert.notEqual(stale.status, 0);
  assert.equal(JSON.parse(stale.stderr).code, 'DEFERRED_TASK_STALE');
  assert.equal(
    readYaml(path.join(fixture.novel, 'data', 'characters.yaml')).find(record => record.name === '甲').biography,
    '第二版传记。'
  );
});

test('a mutated installed registry map blocks the next deep task', () => {
  const fixture = preparePublishedV5Run({ runId: 'run-overlay-registry-map' });
  const paths = deferredPathsFor(fixture.novel, fixture.prepared.run_id);
  const keys = registryKeysByName(fixture.archivedRun);
  const task = addTask(fixture);
  readyTask(fixture, paths, task, [
    { action: 'patch', registry_key: keys['甲'], patch: { biography: '已安装传记。' } }
  ]);
  pass(runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', task.task_id, '--json'
  ]), 'task-apply');

  const mapping = readJson(paths.registryMap);
  mapping.categories.characters[keys['甲']] = mapping.categories.characters[keys['丁']];
  fs.writeFileSync(paths.registryMap, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');

  const next = runFlow([
    'task-add', fixture.novel, '--run', fixture.prepared.run_id,
    '--type', 'characters-deep', '--scope', 'characters', '--json'
  ]);
  assert.notEqual(next.status, 0);
  assert.equal(JSON.parse(next.stderr).code, 'DEFERRED_REGISTRY_MAP_HASH_MISMATCH');
});

test('overlay install fault restores the previous active data and leaves no applied revision', () => {
  const fixture = preparePublishedV5Run({ runId: 'run-overlay-rollback' });
  const paths = deferredPathsFor(fixture.novel, fixture.prepared.run_id);
  const keys = registryKeysByName(fixture.archivedRun);
  const task = addTask(fixture);
  readyTask(fixture, paths, task, [
    { action: 'patch', registry_key: keys['甲'], patch: { biography: '不应安装。' } }
  ]);
  const before = fs.readFileSync(path.join(fixture.novel, 'data', 'characters.yaml'), 'utf8');

  assert.throws(() => applyOverlay({
    paths,
    taskId: task.task_id,
    faultAt: 'after-old-move'
  }), error => error?.code === 'INSTALL_FAULT_INJECTED');

  assert.equal(fs.readFileSync(path.join(fixture.novel, 'data', 'characters.yaml'), 'utf8'), before);
  assert.equal(readJson(paths.deferredTasks).tasks.find(item => item.task_id === task.task_id).status, 'ready');
  assert.equal(fs.existsSync(paths.revisions), false);
});
