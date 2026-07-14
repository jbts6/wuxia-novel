'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, readJson } = require('./helpers');
const { pathsFor } = require('../scripts/lib/paths');
const {
  freshProgress,
  freshUnit,
  assertRecallAttempt,
  loadProgress,
  normalizeErrorFingerprint,
  recordSubmission,
  resetUnit,
  saveProgress
} = require('../scripts/lib/progress');
const { prepareNovel } = require('../scripts/lib/source');

function submit(progress, output, errors) {
  return recordSubmission(progress, 'chapter:001', 'sha256:input', output, errors);
}

test('third invalid submission exhausts the unit', () => {
  let progress = freshProgress();
  progress.units['chapter:001'] = freshUnit('sha256:input');
  progress = submit(progress, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  progress = submit(progress, 'sha256:b', [{ code: 'E2', path: 'y' }]);
  progress = submit(progress, 'sha256:c', [{ code: 'E3', path: 'z' }]);

  assert.equal(progress.units['chapter:001'].status, 'manual_review');
  assert.equal(progress.units['chapter:001'].attempts, 3);
});

test('a valid third submission completes instead of exhausting the unit', () => {
  let progress = freshProgress();
  progress.units['chapter:001'] = freshUnit('sha256:input');
  progress = submit(progress, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  progress = submit(progress, 'sha256:b', [{ code: 'E2', path: 'y' }]);
  progress = submit(progress, 'sha256:c', []);

  assert.equal(progress.units['chapter:001'].status, 'done');
  assert.equal(progress.units['chapter:001'].attempts, 3);
});

test('identical output stops on the second invalid submission', () => {
  let progress = freshProgress();
  progress.units['chapter:001'] = freshUnit('sha256:input');
  progress = submit(progress, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  progress = submit(progress, 'sha256:a', [{ code: 'E2', path: 'y' }]);

  assert.equal(progress.units['chapter:001'].status, 'manual_review');
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
  assert.match(progress.units['chapter:001'].stop_reason, /REPEATED_ERROR/);
});

test('A-B-A output history stops on the third submission', () => {
  let progress = freshProgress();
  progress.units['chapter:001'] = freshUnit('sha256:input');
  progress = submit(progress, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  progress = submit(progress, 'sha256:b', [{ code: 'E2', path: 'y' }]);
  progress = submit(progress, 'sha256:a', [{ code: 'E3', path: 'z' }]);

  assert.equal(progress.units['chapter:001'].status, 'manual_review');
  assert.match(progress.units['chapter:001'].stop_reason, /OUTPUT_OSCILLATION/);
});

test('A-B-A error history stops on the third submission', () => {
  let progress = freshProgress();
  progress.units['chapter:001'] = freshUnit('sha256:input');
  progress = submit(progress, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  progress = submit(progress, 'sha256:b', [{ code: 'E2', path: 'y' }]);
  progress = submit(progress, 'sha256:c', [{ code: 'E1', path: 'x', message: 'noise' }]);

  assert.equal(progress.units['chapter:001'].status, 'manual_review');
  assert.match(progress.units['chapter:001'].stop_reason, /ERROR_OSCILLATION/);
});

test('reload keeps attempts when input hash is unchanged', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const manifest = prepareNovel(novel);
  const paths = pathsFor(novel, manifest.run_id);
  let progress = loadProgress(paths, manifest);
  const inputHash = manifest.chapters[0].input_hash;
  progress = recordSubmission(progress, 'chapter:001', inputHash, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  saveProgress(paths, progress);

  assert.equal(loadProgress(paths, manifest).units['chapter:001'].attempts, 1);
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

test('recall semantic budget survives reload and permits one format correction', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const manifest = prepareNovel(novel);
  const paths = pathsFor(novel, manifest.run_id);
  let progress = loadProgress(paths, manifest);
  const draft = { items: [{ name: '回生丹', source_refs: [{ chapter: 1, text: '回生丹' }] }] };

  progress = assertRecallAttempt(progress, 'recall:items', draft, 'sha256:recall-input');
  saveProgress(paths, progress);
  progress = loadProgress(paths, manifest);
  assert.equal(progress.units['recall:items'].semantic_attempts, 1);
  assert.equal(progress.units['recall:items'].attempts, 1);

  progress = assertRecallAttempt(progress, 'recall:items', draft, 'sha256:recall-input');
  assert.equal(progress.units['recall:items'].semantic_attempts, 1);
  assert.equal(progress.units['recall:items'].format_attempts, 1);
  assert.equal(progress.units['recall:items'].attempts, 2);
  assert.throws(
    () => assertRecallAttempt(progress, 'recall:items', { items: [{ name: '另一物' }] }),
    { code: 'NO_PROGRESS' }
  );
});
