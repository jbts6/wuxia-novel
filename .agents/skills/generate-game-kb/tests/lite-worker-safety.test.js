'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const FLOW = path.resolve(__dirname, '..', 'scripts', 'flow.js');

function parseJsonLine(text) {
  const line = String(text || '').split(/\r?\n/).find(value => value.trim() !== '');
  return line ? JSON.parse(line) : null;
}

function runFlow(args, input) {
  return spawnSync(process.execPath, [FLOW, ...args], {
    cwd: path.dirname(FLOW),
    encoding: 'utf8',
    input
  });
}

function requireSuccess(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return parseJsonLine(result.stdout);
}

function prepareTwoChapterFixture(t) {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lite-worker-safety-'));
  const novel = path.join(repositoryRoot, '双章安全试书');
  const runId = 'run-lite-worker-safety';
  fs.mkdirSync(path.join(repositoryRoot, '.git'));
  fs.mkdirSync(novel);
  fs.writeFileSync(
    path.join(novel, '双章安全试书.txt'),
    '第一章 起始\n甲在山谷中与故人相逢。\n第二章 继续\n乙在古寺中遇见甲。\n',
    'utf8'
  );
  t.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));

  requireSuccess(
    runFlow(['lite-prepare', novel, '--run', runId, '--json']),
    'lite-prepare'
  );
  const status = requireSuccess(
    runFlow(['lite-status', novel, '--run', runId, '--json']),
    'lite-status'
  );
  return { repositoryRoot, novel, runId, status };
}

function validEnvelope(job, chapter, draftOverrides = {}) {
  const quote = chapter.number === 1
    ? '甲在山谷中与故人相逢。'
    : '乙在古寺中遇见甲。';
  return {
    schema_version: 1,
    batch_id: job.batch_id,
    unit: chapter.unit,
    attempt: chapter.attempt,
    input_hash: chapter.input_hash,
    draft: {
      schema_version: 1,
      chapter: chapter.number,
      title: chapter.title,
      source_hash: chapter.input_hash,
      factions: [],
      characters: [],
      skills: [],
      items: [],
      chapter_summary: {
        title: chapter.title,
        summary: quote,
        source_refs: [{ chapter: chapter.number, text: quote }]
      },
      ...draftOverrides
    }
  };
}

function openAndCheckGuard(fixture) {
  const opened = requireSuccess(
    runFlow(['lite-guard-open', fixture.novel, '--run', fixture.runId, '--json']),
    'lite-guard-open'
  );
  const checked = requireSuccess(
    runFlow([
      'lite-guard-check', fixture.novel, '--run', fixture.runId,
      '--guard-id', opened.guard_id, '--json'
    ]),
    'lite-guard-check'
  );
  return { opened, checked };
}

test('two-chapter worker projection and no-op CLI guard roundtrip stay clean', t => {
  const fixture = prepareTwoChapterFixture(t);
  assert.equal(fixture.status.next_action, 'accept-chapters');
  assert.equal(fixture.status.chapter_jobs.length, 1);

  const [job] = fixture.status.chapter_jobs;
  assert.deepEqual(job.worker_write_paths, []);
  assert.equal(job.chapters.length, 2);
  assert.deepEqual(
    job.submissions,
    job.chapters.map(({ unit, attempt, input_hash: inputHash }) => ({
      unit,
      attempt,
      input_hash: inputHash
    }))
  );
  for (const chapter of job.chapters) {
    assert.equal(path.isAbsolute(chapter.source_file), true);
    assert.equal(fs.existsSync(chapter.source_file), true);
    assert.equal(JSON.stringify(chapter).includes('staging_path'), false);
  }

  const { checked } = openAndCheckGuard(fixture);
  assert.equal(checked.violation_count, 0);
  assert.deepEqual(checked.violations, []);
});

test('status-issued two-chapter batch identity submits unchanged through the broker', t => {
  const fixture = prepareTwoChapterFixture(t);
  const [job] = fixture.status.chapter_jobs;
  const { opened, checked } = openAndCheckGuard(fixture);
  assert.equal(checked.violation_count, 0);

  for (const chapter of job.chapters) {
    const envelope = validEnvelope(job, chapter);
    const submitted = requireSuccess(runFlow([
      'lite-submit-draft', fixture.novel, '--run', fixture.runId,
      '--batch', job.batch_id, '--unit', chapter.unit,
      '--attempt', String(chapter.attempt), '--guard-id', opened.guard_id, '--json'
    ], JSON.stringify(envelope)), `lite-submit-draft ${chapter.unit}`);
    assert.equal(submitted.status, 'done');
    assert.equal(submitted.unit, chapter.unit);
  }

  const status = requireSuccess(
    runFlow(['lite-status', fixture.novel, '--run', fixture.runId, '--json']),
    'lite-status after submissions'
  );
  assert.equal(status.next_units.includes('chapter:001'), false);
  assert.equal(status.next_units.includes('chapter:002'), false);
});

test('broker rejects a V6 run version copied into the chapter schema version', t => {
  const fixture = prepareTwoChapterFixture(t);
  const [job] = fixture.status.chapter_jobs;
  const [chapter] = job.chapters;
  const { opened, checked } = openAndCheckGuard(fixture);
  assert.equal(checked.violation_count, 0);

  const envelope = validEnvelope(job, chapter, { schema_version: 6 });
  const submitted = runFlow([
    'lite-submit-draft', fixture.novel, '--run', fixture.runId,
    '--batch', job.batch_id, '--unit', chapter.unit,
    '--attempt', String(chapter.attempt), '--guard-id', opened.guard_id, '--json'
  ], JSON.stringify(envelope));
  const error = parseJsonLine(submitted.stderr);

  assert.equal(submitted.status, 1);
  assert.equal(error.code, 'DRAFT_REJECTED');
  assert.equal(error.details.attempts, 1);
  assert.equal(
    error.details.errors.some(issue => issue.code === 'SCHEMA_VERSION_INVALID'),
    true
  );
});
