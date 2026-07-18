'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { acceptDraft, semanticDecisionFile } = require('../scripts/lib/accept');
const { buildCandidateRegistry } = require('../scripts/lib/candidate-registry');
const { normalizeChapterDraft } = require('../scripts/lib/chapter-contract');
const { createDomainWorkPlan } = require('../scripts/lib/domain-work');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');
const { prepareNovel } = require('../scripts/lib/source');
const { readWorkItem, writeWorkPlan } = require('../scripts/lib/semantic-work');
const {
  makeNovel,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft,
  validDomainDraft
} = require('./helpers');

function captureError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  assert.fail('Expected callback to throw');
}

function writeYaml(file, value) {
  fs.writeFileSync(file, yaml.dump(value, { noRefs: true, lineWidth: -1 }), 'utf8');
  return file;
}

function domainFixture(name, runId) {
  const novel = makeNovel(name, '第一章 起始\n甲在山谷中与故人相逢。\n');
  createOrResumeRun(novel, { runId });
  prepareNovel(novel, { runId });
  const paths = pathsFor(novel, runId);
  fs.mkdirSync(paths.staging, { recursive: true });
  const chapter = normalizeChapterDraft(validChapterDraft({
    skills: [],
    items: [],
    factions: [],
    chapter_summary: {
      title: '第一章 起始',
      summary: '甲在山谷中与故人相逢。',
      source_refs: [sourceRef(1, '甲在山谷中与故人相逢')]
    }
  }));
  const plan = createDomainWorkPlan({ registry: buildCandidateRegistry([chapter]) });
  writeWorkPlan(paths, plan);
  const unit = 'distill:characters';
  return { novel, paths, unit, input: readWorkItem(paths, unit).input };
}

test('wrong controller attempt path is rejected without consuming the submission budget', () => {
  const fixture = domainFixture('错误路径不耗预算试书', 'run-wrong-attempt');
  const wrongPath = path.join(fixture.paths.staging, 'distill_characters_attempt_02.yaml');
  writeYaml(wrongPath, validDomainDraft(fixture.input));

  const error = captureError(() => acceptDraft({
    paths: fixture.paths,
    unit: fixture.unit,
    draftPath: wrongPath
  }));

  assert.equal(error.code, 'DRAFT_STAGING_MISMATCH');
  assert.equal(readJson(fixture.paths.progress).units[fixture.unit], undefined);
  assert.equal(readWorkItem(fixture.paths, fixture.unit).input.attempt, 1);
  assert.equal(fs.existsSync(wrongPath), true);
});

test('rejected drafts stay reviewable and the second failure stops without automatic restart', () => {
  const fixture = domainFixture('拒绝草稿保留试书', 'run-rejected-retained');
  fs.writeFileSync(fixture.input.staging_path, 'decisions: [\n', 'utf8');

  const first = captureError(() => acceptDraft({
    paths: fixture.paths,
    unit: fixture.unit,
    draftPath: fixture.input.staging_path
  }));

  assert.equal(first.code, 'DRAFT_REJECTED');
  assert.equal(first.details.attempts, 1);
  assert.equal(fs.existsSync(fixture.input.staging_path), true);
  assert.equal(fs.existsSync(first.details.draft_archive), true);
  assert.equal(fs.existsSync(first.details.error_record), true);
  const firstRecordBytes = fs.readFileSync(first.details.error_record);
  const firstRecord = readJson(first.details.error_record);
  assert.equal(firstRecord.staging_path, fixture.input.staging_path);
  assert.equal(firstRecord.attempt, 1);
  assert.equal(firstRecord.archive_hash, first.details.draft_archive_hash);
  assert.equal(firstRecord.status, 'rejected');

  const retryInput = readWorkItem(fixture.paths, fixture.unit).input;
  assert.equal(retryInput.attempt, 2);
  assert.match(retryInput.staging_path, /distill_characters_attempt_02\.yaml$/);
  fs.writeFileSync(retryInput.staging_path, 'decisions: [\n', 'utf8');

  const second = captureError(() => acceptDraft({
    paths: fixture.paths,
    unit: fixture.unit,
    draftPath: retryInput.staging_path
  }));

  const progress = readJson(fixture.paths.progress).units[fixture.unit];
  assert.equal(second.code, 'DRAFT_REJECTED');
  assert.equal(progress.attempts, 2);
  assert.equal(progress.status, 'manual_review');
  assert.equal(fs.existsSync(retryInput.staging_path), true);
  assert.deepEqual(fs.readFileSync(first.details.error_record), firstRecordBytes);
  assert.equal(readWorkItem(fixture.paths, fixture.unit).input.attempt, 2);
  assert.equal(
    fs.existsSync(path.join(fixture.paths.staging, 'distill_characters_attempt_03.yaml')),
    false
  );
});

test('accepted evidence records and consumes the controller-owned staging path', () => {
  const fixture = domainFixture('成功草稿消费试书', 'run-accepted-consumed');
  writeYaml(fixture.input.staging_path, validDomainDraft(fixture.input));

  const result = acceptDraft({
    paths: fixture.paths,
    unit: fixture.unit,
    draftPath: fixture.input.staging_path
  });

  assert.equal(result.status, 'done');
  assert.equal(result.consumed_path, fixture.input.staging_path);
  assert.equal(fs.existsSync(fixture.input.staging_path), false);
  assert.equal(fs.existsSync(semanticDecisionFile(
    fixture.paths,
    fixture.unit,
    fixture.input.input_hash
  )), true);
  const record = readJson(result.submission_record);
  assert.equal(record.status, 'accepted');
  assert.equal(record.staging_path, fixture.input.staging_path);
  assert.equal(record.consumed, true);
});

test('retry-unit starts a fresh bounded cycle before attempt one is resubmitted', () => {
  const fixture = domainFixture('重置工作项试书', 'run-reset-work-item');
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const input = readWorkItem(fixture.paths, fixture.unit).input;
    fs.writeFileSync(input.staging_path, 'decisions: [\n', 'utf8');
    const rejected = captureError(() => acceptDraft({
      paths: fixture.paths,
      unit: fixture.unit,
      draftPath: input.staging_path
    }));
    assert.equal(rejected.code, 'DRAFT_REJECTED');
  }
  assert.equal(readJson(fixture.paths.progress).units[fixture.unit].status, 'manual_review');
  assert.equal(readWorkItem(fixture.paths, fixture.unit).input.attempt, 2);

  const reset = runFlow([
    'retry-unit', fixture.novel, '--run', fixture.paths.runId,
    '--unit', fixture.unit, '--confirm', '--json'
  ]);

  assert.equal(reset.status, 0, reset.stderr);
  assert.equal(readJson(fixture.paths.progress).units[fixture.unit].status, 'pending');
  assert.equal(readJson(fixture.paths.progress).units[fixture.unit].attempts, 0);
  assert.equal(readJson(fixture.paths.progress).history.length, 1);
  const resetInput = readWorkItem(fixture.paths, fixture.unit).input;
  assert.equal(resetInput.attempt, 1);
  assert.match(resetInput.staging_path, /distill_characters_attempt_01\.yaml$/);
  writeYaml(resetInput.staging_path, validDomainDraft(resetInput));
  const accepted = acceptDraft({
    paths: fixture.paths,
    unit: fixture.unit,
    draftPath: resetInput.staging_path
  });
  assert.equal(accepted.status, 'done');
  assert.equal(accepted.attempts, 1);
});
