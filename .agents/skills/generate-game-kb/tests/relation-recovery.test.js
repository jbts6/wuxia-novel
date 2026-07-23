'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { assembleRun } = require('../scripts/lib/assemble');
const { assertAcceptedArtifacts, readArtifactManifest } = require('../scripts/lib/candidate-ledger');
const { receiveAvailableChapterOutputs } = require('../scripts/lib/chapter-receiver');
const { atomicWriteJson, readJson, stableHash } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { hashReferenceRecoveryReport } = require('../scripts/lib/reference-recovery');
const { recoveryRunId } = require('../scripts/lib/relation-recovery-run');
const { sha256 } = require('../scripts/lib/source');
const {
  makeTemporaryNovel,
  parseJsonLine,
  replaceAcceptedArtifact,
  runFlow,
  writeAllWorkerOutputs
} = require('./helpers');

function runJson(args) {
  const result = runFlow([...args, '--json']);
  assert.equal(result.status, 0, result.stderr);
  return parseJsonLine(result.stdout);
}

function treeHashes(root) {
  const hashes = {};
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else hashes[path.relative(root, file).split(path.sep).join('/')] = crypto
        .createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  }
  visit(root);
  return hashes;
}

function legacyParentWithBrokenRelation() {
  const novel = makeTemporaryNovel(3);
  const started = runJson(['run', novel, '--run', 'parent-relations']);
  writeAllWorkerOutputs(started.jobs);
  const paths = pathsFor(novel, started.run_id);
  const manifest = readJson(paths.manifest);
  const received = receiveAvailableChapterOutputs({
    paths, manifest, progress: readJson(paths.progress)
  });
  atomicWriteJson(paths.progress, received.progress);

  const chapterFile = path.join(paths.chapters, 'chapter_002.yaml');
  const chapter = yaml.load(fs.readFileSync(chapterFile, 'utf8'));
  chapter.characters[0].skills = ['失传剑法'];
  replaceAcceptedArtifact(paths, chapterFile, chapter);
  const artifact = readArtifactManifest(paths).entries
    .find(entry => entry.relative_path === 'accepted/chapters/chapter_002.yaml');
  const progress = readJson(paths.progress);
  progress.units['chapter:002'].output_hash = artifact.content_hash;
  atomicWriteJson(paths.progress, progress);

  const assembly = assembleRun({ paths });
  assert.equal(assembly.status, 'manual_review');
  assert.deepEqual(assembly.manual_review, ['chapter:002']);
  return { novel, paths };
}

test('recover-relations creates an immutable derived run and only reopens affected chapters', () => {
  const { novel, paths: parentPaths } = legacyParentWithBrokenRelation();
  const parentBefore = treeHashes(parentPaths.run);

  const recovered = runJson([
    'recover-relations', novel, '--run', parentPaths.runId, '--confirm'
  ]);
  assert.equal(recovered.parent_run, parentPaths.runId);
  assert.equal(recovered.status, 'jobs');
  assert.deepEqual(recovered.jobs.map(job => job.unit), ['chapter:002']);
  assert.ok(recovered.run_id !== parentPaths.runId);

  const childPaths = pathsFor(novel, recovered.run_id);
  const receipt = readJson(childPaths.recoveryReceipt);
  assert.equal(receipt.parent_run, parentPaths.runId);
  assert.deepEqual(receipt.carried_units, ['chapter:001', 'chapter:003']);
  assert.deepEqual(receipt.reopened_units, ['chapter:002']);
  assert.match(receipt.report_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(receipt.receipt_hash, /^sha256:[a-f0-9]{64}$/);

  const progress = readJson(childPaths.progress);
  assert.deepEqual(progress.recovery_units, ['chapter:002']);
  assert.equal(progress.units['chapter:001'].producer, 'carry-forward');
  assert.equal(progress.units['chapter:001'].status, 'accepted');
  assert.equal(progress.units['chapter:002'].producer, 'chapter-worker');
  assert.equal(progress.units['chapter:002'].status, 'active');
  assert.equal(progress.units['chapter:003'].producer, 'carry-forward');
  assert.equal(progress.units['chapter:003'].status, 'accepted');

  const artifacts = readArtifactManifest(childPaths);
  assert.deepEqual(artifacts.entries.map(entry => entry.relative_path).sort(), [
    'accepted/chapters/chapter_001.yaml',
    'accepted/chapters/chapter_003.yaml'
  ]);
  assertAcceptedArtifacts(childPaths);

  const input = readJson(recovered.jobs[0].input_file);
  assert.equal(input.producer, 'chapter-worker');
  assert.equal(input.worker_contract.version, 4);
  assert.equal(input.recovery_context.parent_run, parentPaths.runId);
  assert.equal(input.recovery_context.report_hash, receipt.report_hash);
  assert.equal(fs.existsSync(input.recovery_context.parent_accepted_draft), true);
  assert.equal(input.recovery_context.relationship_errors[0].target_name, '失传剑法');

  const resumed = runJson([
    'recover-relations', novel, '--run', parentPaths.runId, '--confirm'
  ]);
  assert.equal(resumed.run_id, recovered.run_id);
  assert.deepEqual(resumed.jobs.map(job => job.unit), ['chapter:002']);

  writeAllWorkerOutputs(recovered.jobs);
  const completed = runJson(['run', novel, '--run', recovered.run_id]);
  assert.equal(completed.status, 'complete');
  assert.deepEqual(treeHashes(parentPaths.run), parentBefore);
});

test('recover-relations requires explicit confirmation', () => {
  const { novel, paths } = legacyParentWithBrokenRelation();
  const result = runFlow([
    'recover-relations', novel, '--run', paths.runId, '--json'
  ]);
  assert.notEqual(result.status, 0);
  const error = parseJsonLine(result.stderr);
  assert.equal(error.code, 'CONFIRM_REQUIRED');
});

test('recover-relations rejects a stale relationship report hash', () => {
  const { novel, paths } = legacyParentWithBrokenRelation();
  const report = readJson(paths.referenceRecovery);
  report.relationships[0].target_name = '被篡改的目标';
  atomicWriteJson(paths.referenceRecovery, report);

  const result = runFlow([
    'recover-relations', novel, '--run', paths.runId, '--confirm', '--json'
  ]);
  assert.notEqual(result.status, 0);
  const error = parseJsonLine(result.stderr);
  assert.equal(error.code, 'REFERENCE_RECOVERY_REPORT_HASH_INVALID');
});

test('recover-relations removes a newly created child run when initialization fails', () => {
  const { novel, paths: parentPaths } = legacyParentWithBrokenRelation();
  const artifactManifest = readArtifactManifest(parentPaths);
  const carriedEntry = artifactManifest.entries
    .find(entry => entry.relative_path === 'accepted/chapters/chapter_001.yaml');
  const carriedFile = path.join(parentPaths.run, ...carriedEntry.relative_path.split('/'));
  const nonCanonicalBytes = `${fs.readFileSync(carriedFile, 'utf8')}# preserved YAML comment\n`;
  fs.writeFileSync(carriedFile, nonCanonicalBytes, 'utf8');
  carriedEntry.content_hash = sha256(nonCanonicalBytes);
  atomicWriteJson(parentPaths.artifactManifest, artifactManifest);

  const report = readJson(parentPaths.referenceRecovery);
  report.artifact_manifest_hash = stableHash(artifactManifest);
  report.report_hash = hashReferenceRecoveryReport(report);
  atomicWriteJson(parentPaths.referenceRecovery, report);
  const childPaths = pathsFor(novel, recoveryRunId(parentPaths.runId, report.report_hash));

  const result = runFlow([
    'recover-relations', novel, '--run', parentPaths.runId, '--confirm', '--json'
  ]);
  assert.notEqual(result.status, 0);
  assert.equal(parseJsonLine(result.stderr).code, 'REFERENCE_RECOVERY_CARRY_HASH_MISMATCH');
  assert.equal(fs.existsSync(childPaths.run), false);
});
