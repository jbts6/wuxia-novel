'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  makeTemporaryNovel,
  parseJsonLine,
  runFlow,
  writeAllWorkerOutputs,
  writeWorkerOutput
} = require('./helpers');

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function runJson(novel, runId) {
  const result = runFlow(['run', novel, '--run', runId, '--json']);
  assert.equal(result.status, 0, result.stderr);
  return parseJsonLine(result.stdout);
}

function repositoryRootArtifactSnapshot() {
  return fs.readdirSync(REPOSITORY_ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const content = fs.readFileSync(path.join(REPOSITORY_ROOT, entry.name));
      return [entry.name, crypto.createHash('sha256').update(content).digest('hex')];
    })
    .sort(([left], [right]) => left.localeCompare(right));
}

function assertCleanWorkspace(novel, rootSnapshot) {
  assert.equal(fs.existsSync(path.join(REPOSITORY_ROOT, '.kb-scratch')), false);
  assert.equal(fs.existsSync(path.join(novel, '.kb-scratch')), false);
  assert.deepEqual(repositoryRootArtifactSnapshot(), rootSnapshot);
}

test('six chapters cross the first window and install five YAML plus review report', () => {
  const novel = makeTemporaryNovel(6);
  const rootSnapshot = repositoryRootArtifactSnapshot();
  assertCleanWorkspace(novel, rootSnapshot);
  let result = runJson(novel, 'run-six-chapters');

  assert.deepEqual(result.jobs.map(job => job.unit), [
    'chapter:001', 'chapter:002', 'chapter:003', 'chapter:004', 'chapter:005'
  ]);
  assertCleanWorkspace(novel, rootSnapshot);
  writeAllWorkerOutputs(result.jobs);
  assertCleanWorkspace(novel, rootSnapshot);

  result = runJson(novel, result.run_id);
  assert.deepEqual(result.jobs.map(job => job.unit), ['chapter:006']);
  assertCleanWorkspace(novel, rootSnapshot);
  writeAllWorkerOutputs(result.jobs);
  assertCleanWorkspace(novel, rootSnapshot);

  result = runJson(novel, result.run_id);
  assert.equal(result.status, 'complete');
  assert.deepEqual(fs.readdirSync(path.join(novel, 'data')).sort(), [
    'chapter_summaries.yaml', 'characters.yaml', 'factions.yaml', 'items.yaml', 'skills.yaml'
  ]);
  assert.equal(fs.existsSync(path.join(novel, 'reports', 'game-kb-review.json')), true);
  assertCleanWorkspace(novel, rootSnapshot);
});

test('twenty-five chapters open the next window only after all five outputs are accepted', () => {
  const novel = makeTemporaryNovel(25);
  const rootSnapshot = repositoryRootArtifactSnapshot();
  let result = runJson(novel, 'run-twenty-five-chapters');
  const firstWindow = result.jobs;

  assert.deepEqual(firstWindow.map(job => job.unit), [
    'chapter:001', 'chapter:002', 'chapter:003', 'chapter:004', 'chapter:005'
  ]);
  assertCleanWorkspace(novel, rootSnapshot);

  result = runJson(novel, result.run_id);
  assert.equal(result.status, 'waiting');
  assert.deepEqual(result.jobs, []);
  assertCleanWorkspace(novel, rootSnapshot);

  for (let index = 0; index < 4; index += 1) {
    writeWorkerOutput(firstWindow[index]);
    assertCleanWorkspace(novel, rootSnapshot);
    result = runJson(novel, result.run_id);
    assert.equal(result.status, 'waiting');
    assert.deepEqual(result.jobs, []);
    assert.equal(result.active_units.includes('chapter:006'), false);
    assert.deepEqual(result.progress, { accepted: index + 1, total: 25 });
    assertCleanWorkspace(novel, rootSnapshot);
  }

  writeWorkerOutput(firstWindow[4]);
  assertCleanWorkspace(novel, rootSnapshot);
  result = runJson(novel, result.run_id);
  assert.deepEqual(result.jobs.map(job => job.unit), [
    'chapter:006', 'chapter:007', 'chapter:008', 'chapter:009', 'chapter:010'
  ]);
  assert.deepEqual(result.progress, { accepted: 5, total: 25 });
  assertCleanWorkspace(novel, rootSnapshot);
});
