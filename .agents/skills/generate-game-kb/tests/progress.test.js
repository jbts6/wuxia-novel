'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, readJson, runFlow } = require('./helpers');
const { pathsFor } = require('../scripts/lib/paths');
const progressApi = require('../scripts/lib/progress');
const {
  freshProgress,
  freshUnit,
  loadProgress,
  manualIssues,
  normalizeErrorFingerprint,
  recordSubmission,
  resetUnit,
  saveProgress,
  setOptionalUnitState,
  statusReport,
  syncPlannedUnits
} = progressApi;
const { DOMAIN_UNITS } = require('../scripts/lib/semantic-contract');
const { prepareNovel } = require('../scripts/lib/source');

function submit(progress, output, errors) {
  return recordSubmission(progress, 'chapter:001', 'sha256:input', output, errors);
}

test('legacy pre-charge APIs are absent and submissions cannot be double-charged', () => {
  assert.equal(Object.hasOwn(progressApi, 'assertRecallAttempt'), false);
  assert.equal(Object.hasOwn(progressApi, 'recordTargetedSubmission'), false);
  assert.equal(Object.hasOwn(progressApi, 'semanticContentHash'), false);

  let progress = freshProgress();
  progress.units['chapter:001'] = freshUnit('sha256:input');
  progress = submit(progress, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  assert.equal(progress.units['chapter:001'].attempts, 1);
  progress = submit(progress, 'sha256:b', []);
  assert.equal(progress.units['chapter:001'].status, 'done');
  assert.equal(progress.units['chapter:001'].attempts, 2);
});

test('one validator-guided correction completes within the two-submission budget', () => {
  let progress = freshProgress();
  progress.units['chapter:001'] = freshUnit('sha256:input');
  progress = submit(progress, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  progress = submit(progress, 'sha256:b', []);

  assert.equal(progress.units['chapter:001'].status, 'done');
  assert.equal(progress.units['chapter:001'].attempts, 2);
});

test('a second validation failure requires manual review', () => {
  let progress = freshProgress();
  progress.units['chapter:001'] = freshUnit('sha256:input');
  progress = submit(progress, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  progress = submit(progress, 'sha256:b', [{ code: 'E2', path: 'y' }]);

  assert.equal(progress.units['chapter:001'].status, 'manual_review');
  assert.equal(progress.units['chapter:001'].attempts, 2);
  assert.match(progress.units['chapter:001'].stop_reason, /ATTEMPTS_EXHAUSTED/);
  assert.throws(
    () => submit(progress, 'sha256:c', []),
    { code: 'UNIT_MANUAL_REVIEW' }
  );
  assert.equal(progress.units['chapter:001'].attempts, 2);
});

test('identical output stops on the second invalid submission', () => {
  let progress = freshProgress();
  progress.units['chapter:001'] = freshUnit('sha256:input');
  progress = submit(progress, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  progress = submit(progress, 'sha256:a', [{ code: 'E2', path: 'y' }]);

  assert.equal(progress.units['chapter:001'].status, 'manual_review');
  assert.equal(progress.units['chapter:001'].attempts, 2);
  assert.match(progress.units['chapter:001'].stop_reason, /REPEATED_OUTPUT/);
});

test('identical normalized error stops on the second submission', () => {
  const first = [{ code: 'E1', path: 'b', target: '乙', message: 'first' }, { code: 'E2', path: 'a' }];
  const second = [{ code: 'E2', path: 'a', message: 'changed' }, { code: 'E1', path: 'b', target: '乙' }];
  let progress = freshProgress();
  progress.units['chapter:001'] = freshUnit('sha256:input');
  progress = submit(progress, 'sha256:a', first);
  progress = submit(progress, 'sha256:b', second);

  assert.equal(normalizeErrorFingerprint(first), normalizeErrorFingerprint(second));
  assert.equal(progress.units['chapter:001'].status, 'manual_review');
  assert.equal(progress.units['chapter:001'].attempts, 2);
  assert.match(progress.units['chapter:001'].stop_reason, /REPEATED_ERROR/);
});

test('reload keeps attempts when input hash is unchanged', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const manifest = prepareNovel(novel);
  const paths = pathsFor(novel, manifest.run_id);
  let progress = loadProgress(paths, manifest);
  const inputHash = manifest.chapters[0].input_hash;
  progress = recordSubmission(progress, 'chapter:001', inputHash, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  saveProgress(paths, progress);

  const reloaded = loadProgress(paths, manifest);
  assert.equal(reloaded.units['chapter:001'].attempts, 1);
  progress = recordSubmission(reloaded, 'chapter:001', inputHash, 'sha256:b', []);
  assert.equal(progress.units['chapter:001'].status, 'done');
  assert.equal(progress.units['chapter:001'].attempts, 2);
});

test('wrong staging paths are rejected before a submission consumes an attempt', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const prepared = runFlow(['prepare', novel, '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);
  const runId = JSON.parse(prepared.stdout).run_id;
  const paths = pathsFor(novel, runId);
  const outside = path.join(novel, 'outside.yaml');
  fs.writeFileSync(outside, 'schema_version: 1\n', 'utf8');
  const before = fs.readFileSync(paths.progress);

  const rejected = runFlow([
    'accept', novel, '--run', runId, '--unit', 'chapter:001', '--draft', outside, '--json'
  ]);

  assert.notEqual(rejected.status, 0);
  assert.equal(JSON.parse(rejected.stderr).code, 'DRAFT_STAGING_MISMATCH');
  assert.deepEqual(fs.readFileSync(paths.progress), before);
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 0);
});

test('changed source requires the old run to be archived before a fresh budget', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const firstManifest = prepareNovel(novel);
  const paths = pathsFor(novel, firstManifest.run_id);
  let progress = loadProgress(paths, firstManifest);
  progress = recordSubmission(progress, 'chapter:001', firstManifest.chapters[0].input_hash, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  saveProgress(paths, progress);
  fs.writeFileSync(path.join(novel, '试书.txt'), '第一章 起始\n乙。\n', 'utf8');

  assert.throws(() => prepareNovel(novel), { code: 'RUN_SOURCE_CHANGED' });
  const reloaded = loadProgress(paths, firstManifest);
  assert.equal(reloaded.units['chapter:001'].status, 'pending');
  assert.equal(reloaded.units['chapter:001'].attempts, 1);
  assert.equal(reloaded.history.length, 0);
});

test('reset requires confirmation and affects only one unit', () => {
  let progress = freshProgress();
  progress.units['chapter:001'] = { ...freshUnit('sha256:a'), status: 'manual_review', attempts: 2 };
  progress.units['chapter:002'] = { ...freshUnit('sha256:b'), status: 'done', attempts: 1 };

  assert.throws(() => resetUnit(progress, 'chapter:001', false), { code: 'RESET_CONFIRM_REQUIRED' });
  const reset = resetUnit(progress, 'chapter:001', true);
  assert.equal(reset.units['chapter:001'].status, 'pending');
  assert.equal(reset.units['chapter:001'].attempts, 0);
  assert.equal(reset.units['chapter:002'].status, 'done');
  const resubmitted = recordSubmission(reset, 'chapter:001', 'sha256:a', 'sha256:replacement', []);
  assert.equal(resubmitted.units['chapter:001'].status, 'done');
  assert.equal(resubmitted.units['chapter:001'].attempts, 1);
});

test('syncing dynamic category units preserves unchanged done siblings and rotates only stale inputs', () => {
  const progress = freshProgress();
  progress.units['distill:characters'] = {
    ...freshUnit('sha256:characters'),
    status: 'done',
    attempts: 1
  };
  progress.units['distill:items'] = {
    ...freshUnit('sha256:items-old'),
    status: 'pending',
    attempts: 1
  };

  const updated = syncPlannedUnits(progress, [
    { unit: 'distill:characters', input_hash: 'sha256:characters' },
    { unit: 'distill:items', input_hash: 'sha256:items-new' },
    { unit: 'distill:factions', input_hash: 'sha256:factions' }
  ]);

  assert.equal(updated.units['distill:characters'].status, 'done');
  assert.equal(updated.units['distill:characters'].attempts, 1);
  assert.equal(updated.units['distill:items'].status, 'stale');
  assert.equal(updated.units['distill:items'].attempts, 0);
  assert.equal(updated.units['distill:factions'].status, 'pending');
  assert.equal(updated.history.length, 1);
  assert.equal(updated.history[0].unit, 'distill:items');
});

test('status reports domain units in the shared canonical order', () => {
  const progress = freshProgress();
  for (const unit of [...DOMAIN_UNITS].reverse()) {
    progress.units[unit] = freshUnit(`sha256:${unit}`);
  }

  const report = statusReport(
    { manifest: 'manifest.json', progress: 'progress.json', manualReview: 'manual-review.json' },
    { chapters: [] },
    progress
  );

  assert.deepEqual(report.units.map(unit => unit.unit), DOMAIN_UNITS);
});

test('failed optional basic-curate is visible without becoming a blocking manual issue', () => {
  let progress = freshProgress();
  progress = setOptionalUnitState(
    progress,
    'basic-curate',
    'sha256:registry',
    'failed',
    [{ code: 'BASIC_CURATE_INVALID', path: 'decisions[0]' }]
  );

  const report = statusReport(
    { manifest: 'manifest.json', progress: 'progress.json', manualReview: 'manual-review.json' },
    { chapters: [] },
    progress
  );

  assert.equal(report.counts.failed, 1);
  assert.deepEqual(report.units.map(unit => ({ unit: unit.unit, status: unit.status })), [
    { unit: 'basic-curate', status: 'failed' }
  ]);
  assert.deepEqual(manualIssues(progress), []);
});

test('skipped basic-curate remains a publishable non-blocking terminal state', () => {
  let progress = freshProgress();
  progress.units['chapter:001'] = { ...freshUnit('sha256:chapter'), status: 'done' };
  progress = setOptionalUnitState(progress, 'basic-curate', 'sha256:registry', 'skipped');

  const report = statusReport(
    { manifest: 'manifest.json', progress: 'progress.json', manualReview: 'manual-review.json' },
    { chapters: [{ number: 1 }] },
    progress
  );

  assert.equal(report.counts.done, 1);
  assert.equal(report.counts.skipped, 1);
  assert.deepEqual(manualIssues(progress), []);
});

test('done unchanged unit rejects resubmission without consuming attempts', () => {
  let progress = freshProgress();
  progress.units['chapter:001'] = { ...freshUnit('sha256:input'), status: 'done', attempts: 1 };

  assert.throws(
    () => submit(progress, 'sha256:b', []),
    { code: 'UNIT_ALREADY_DONE' }
  );
  assert.equal(progress.units['chapter:001'].attempts, 1);
});

test('corrupt progress fails closed', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const manifest = prepareNovel(novel);
  const paths = pathsFor(novel, manifest.run_id);
  fs.writeFileSync(paths.progress, '{broken', 'utf8');

  assert.throws(() => loadProgress(paths, manifest), { code: 'PROGRESS_CORRUPT' });
  assert.equal(readJson(paths.manualReview).length, 0);
});
