'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { serializeYaml } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');

const FLOW = path.resolve(__dirname, '..', 'scripts', 'flow.js');
const SKILL = path.resolve(__dirname, '..', '..', 'generate-game-kb-lite', 'SKILL.md');
const SKILL_CN = path.resolve(__dirname, '..', '..', 'generate-game-kb-lite', 'SKILL-cn.md');

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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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

function currentStatus(fixture) {
  return requireSuccess(
    runFlow(['lite-status', fixture.novel, '--run', fixture.runId, '--json']),
    'lite-status'
  );
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

function submitEnvelope(fixture, job, chapter, guardId, rawInput = null) {
  const envelope = validEnvelope(job, chapter);
  return runFlow([
    'lite-submit-draft', fixture.novel, '--run', fixture.runId,
    '--batch', job.batch_id, '--unit', chapter.unit,
    '--attempt', String(chapter.attempt), '--guard-id', guardId, '--json'
  ], rawInput === null ? JSON.stringify(envelope) : rawInput);
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
    assert.equal(fs.readFileSync(submitted.accepted_file, 'utf8'), serializeYaml(envelope.draft));
  }

  const status = requireSuccess(
    runFlow(['lite-status', fixture.novel, '--run', fixture.runId, '--json']),
    'lite-status after submissions'
  );
  assert.equal(status.next_units.includes('chapter:001'), false);
  assert.equal(status.next_units.includes('chapter:002'), false);
});

test('guard reports every incident-class repository write without changing progress', t => {
  const fixture = prepareTwoChapterFixture(t);
  const paths = pathsFor(fixture.novel, fixture.runId);
  const [job] = fixture.status.chapter_jobs;
  const progressBefore = fs.readFileSync(paths.progress);
  const opened = requireSuccess(
    runFlow(['lite-guard-open', fixture.novel, '--run', fixture.runId, '--json']),
    'lite-guard-open'
  );
  const randomNested = path.join(
    fixture.repositoryRoot,
    'unexpected-worker-output',
    randomUUID(),
    'deep',
    'payload.tmp'
  );
  const addedFiles = [
    path.join(fixture.repositoryRoot, 'game-kb', 'chapter.yaml'),
    path.join(fixture.repositoryRoot, '.trellis', 'game-kb', 'chapter.yaml'),
    path.join(fixture.repositoryRoot, 'docs', 'game-kb', 'chapter.yaml'),
    path.join(paths.run, 'out', 'chapter.yaml'),
    path.join(paths.run, 'output', 'chapter.yaml'),
    path.join(paths.staging, 'chapter_001_attempt_03.yaml'),
    randomNested
  ];
  for (const file of addedFiles) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'rogue worker output\n', 'utf8');
  }
  fs.appendFileSync(job.chapters[0].source_file, '越界修改。\n', 'utf8');

  const checked = requireSuccess(runFlow([
    'lite-guard-check', fixture.novel, '--run', fixture.runId,
    '--guard-id', opened.guard_id, '--json'
  ]), 'lite-guard-check');
  const violationPaths = new Set(checked.violations.map(violation => path.normalize(violation.absolute_path)));
  for (const file of [...addedFiles, job.chapters[0].source_file]) {
    assert.equal(violationPaths.has(path.normalize(path.resolve(file))), true, file);
  }

  const status = currentStatus(fixture);
  assert.equal(status.next_action, 'worker-write-review');
  assert.equal(status.counts.done, 0);
  assert.deepEqual(fs.readFileSync(paths.progress), progressBefore);

  const skill = fs.readFileSync(SKILL, 'utf8');
  const skillCn = fs.readFileSync(SKILL_CN, 'utf8');
  assert.match(skill, /repository root/i);
  assert.match(skill, /outside the repository[^\r\n]*(?:not monitored|not covered)/i);
  assert.match(skillCn, /仓库根目录/);
  assert.match(skillCn, /仓库之外[^\r\n]*(?:不监控|不在监控范围)/);
});

test('stale envelope identity is rejected without consuming an attempt', t => {
  const fixture = prepareTwoChapterFixture(t);
  const [job] = fixture.status.chapter_jobs;
  const [chapter] = job.chapters;
  const paths = pathsFor(fixture.novel, fixture.runId);
  const progressBefore = fs.readFileSync(paths.progress);
  const { opened } = openAndCheckGuard(fixture);
  const envelope = { ...validEnvelope(job, chapter), input_hash: `sha256:${'0'.repeat(64)}` };
  const submitted = submitEnvelope(
    fixture,
    job,
    chapter,
    opened.guard_id,
    JSON.stringify(envelope)
  );

  assert.equal(submitted.status, 1);
  assert.equal(parseJsonLine(submitted.stderr).code, 'SUBMISSION_IDENTITY_MISMATCH');
  const next = currentStatus(fixture);
  assert.equal(next.chapter_jobs[0].chapters[0].attempt, 1);
  assert.deepEqual(fs.readFileSync(paths.progress), progressBefore);
});

test('broker reports forbidden, missing, hash, quote, and name errors in one formal rejection', t => {
  const fixture = prepareTwoChapterFixture(t);
  const [job] = fixture.status.chapter_jobs;
  const [chapter] = job.chapters;
  const { opened } = openAndCheckGuard(fixture);
  const envelope = validEnvelope(job, chapter);
  envelope.draft.book = 'forbidden';
  delete envelope.draft.title;
  envelope.draft.source_hash = `sha256:${'0'.repeat(64)}`;
  envelope.draft.characters = [
    { name: '甲' },
    {
      local_key: 'character:丙',
      name: '丙',
      source_refs: [{ chapter: chapter.number, text: '甲在山谷中与故人相逢。' }]
    }
  ];
  envelope.draft.chapter_summary = {
    title: chapter.title,
    summary: '并不存在的情节。',
    source_refs: [{ chapter: chapter.number, text: '并不存在的情节。' }]
  };

  const submitted = submitEnvelope(
    fixture,
    job,
    chapter,
    opened.guard_id,
    JSON.stringify(envelope)
  );
  const error = parseJsonLine(submitted.stderr);
  const codes = new Set(error.details.errors.map(issue => issue.code));

  assert.equal(submitted.status, 1);
  assert.equal(error.code, 'DRAFT_REJECTED');
  assert.equal(error.details.attempts, 1);
  for (const code of [
    'CHAPTER_FIELD_FORBIDDEN',
    'TITLE_REQUIRED',
    'SOURCE_HASH_MISMATCH',
    'LOCAL_KEY_REQUIRED',
    'SOURCE_REFS_REQUIRED',
    'SOURCE_NAME_NOT_FOUND',
    'SOURCE_QUOTE_NOT_FOUND'
  ]) {
    assert.equal(codes.has(code), true, code);
  }
});

test('malformed envelopes stop after two controller-issued attempts and never dispatch attempt three', t => {
  const fixture = prepareTwoChapterFixture(t);
  const [firstJob] = fixture.status.chapter_jobs;
  const firstChapter = firstJob.chapters[0];
  const firstGuard = openAndCheckGuard(fixture);
  const first = submitEnvelope(fixture, firstJob, firstChapter, firstGuard.opened.guard_id, '{');
  assert.equal(first.status, 1);
  assert.equal(parseJsonLine(first.stderr).details.attempts, 1);

  const retryStatus = currentStatus(fixture);
  const retryJob = retryStatus.chapter_jobs.find(candidate => (
    candidate.chapters.some(chapter => chapter.unit === firstChapter.unit)
  ));
  const retryChapter = retryJob.chapters.find(chapter => chapter.unit === firstChapter.unit);
  assert.equal(retryChapter.attempt, 2);
  const retryGuard = openAndCheckGuard(fixture);
  const second = submitEnvelope(fixture, retryJob, retryChapter, retryGuard.opened.guard_id, '{');
  assert.equal(second.status, 1);
  assert.equal(parseJsonLine(second.stderr).details.attempts, 2);

  const stopped = currentStatus(fixture);
  assert.equal(stopped.next_action, 'manual-review');
  assert.equal(stopped.next_units.includes(firstChapter.unit), true);
  assert.equal(Object.hasOwn(stopped, 'chapter_jobs'), false);

  const attemptThreeEnvelope = { ...validEnvelope(retryJob, retryChapter), attempt: 3 };
  const attemptThree = runFlow([
    'lite-submit-draft', fixture.novel, '--run', fixture.runId,
    '--batch', retryJob.batch_id, '--unit', retryChapter.unit,
    '--attempt', '3', '--guard-id', retryGuard.opened.guard_id, '--json'
  ], JSON.stringify(attemptThreeEnvelope));
  assert.equal(attemptThree.status, 1);
  assert.equal(parseJsonLine(attemptThree.stderr).code, 'UNIT_MANUAL_REVIEW');
  assert.equal(
    readJson(pathsFor(fixture.novel, fixture.runId).progress).units[firstChapter.unit].attempts,
    2
  );
});

test('controller recovery preserves rogue evidence and unblocks only after user remediation', t => {
  const fixture = prepareTwoChapterFixture(t);
  const paths = pathsFor(fixture.novel, fixture.runId);
  const [job] = fixture.status.chapter_jobs;
  const [chapter] = job.chapters;
  const envelope = validEnvelope(job, chapter);
  const opened = requireSuccess(
    runFlow(['lite-guard-open', fixture.novel, '--run', fixture.runId, '--json']),
    'lite-guard-open'
  );
  const rogueDirectory = path.join(fixture.repositoryRoot, 'game-kb');
  const rogueFile = path.join(rogueDirectory, 'chapter.yaml');
  fs.mkdirSync(rogueDirectory, { recursive: true });
  const rogueBytes = serializeYaml(envelope.draft);
  fs.writeFileSync(rogueFile, rogueBytes, 'utf8');
  const checked = requireSuccess(runFlow([
    'lite-guard-check', fixture.novel, '--run', fixture.runId,
    '--guard-id', opened.guard_id, '--json'
  ]), 'lite-guard-check');
  assert.equal(
    checked.violations.some(violation => path.normalize(violation.absolute_path) === path.normalize(rogueFile)),
    true
  );

  const unconfirmed = runFlow([
    'lite-recover-draft', fixture.novel, '--run', fixture.runId,
    '--unit', chapter.unit, '--source', rogueFile,
    '--guard-id', opened.guard_id, '--json'
  ]);
  assert.equal(unconfirmed.status, 1);
  assert.equal(parseJsonLine(unconfirmed.stderr).code, 'CONFIRM_REQUIRED');

  const recovered = requireSuccess(runFlow([
    'lite-recover-draft', fixture.novel, '--run', fixture.runId,
    '--unit', chapter.unit, '--source', rogueFile,
    '--guard-id', opened.guard_id, '--confirm', '--json'
  ]), 'lite-recover-draft');
  assert.equal(recovered.acceptance.status, 'done');
  assert.equal(fs.readFileSync(rogueFile, 'utf8'), rogueBytes);
  assert.equal(
    fs.readFileSync(recovered.acceptance.accepted_file, 'utf8'),
    serializeYaml(envelope.draft)
  );
  assert.equal(readJson(paths.progress).units[chapter.unit].attempts, 1);
  assert.equal(currentStatus(fixture).next_action, 'worker-write-review');

  fs.rmSync(rogueDirectory, { recursive: true, force: true });
  const remediated = currentStatus(fixture);
  assert.notEqual(remediated.next_action, 'worker-write-review');
});

test('legacy accepted serialization is reported as read-only and dispatches no chapter job', t => {
  const fixture = prepareTwoChapterFixture(t);
  assert.equal(fixture.status.accepted_serialization, 'yaml-v1');
  const paths = pathsFor(fixture.novel, fixture.runId);
  const run = readJson(paths.runJson);
  delete run.accepted_serialization;
  fs.writeFileSync(paths.runJson, `${JSON.stringify(run, null, 2)}\n`, 'utf8');

  const status = currentStatus(fixture);
  assert.equal(status.accepted_serialization, null);
  assert.equal(status.next_action, 'start-new-run');
  assert.equal(Object.hasOwn(status, 'chapter_jobs'), false);

  const guard = runFlow([
    'lite-guard-open', fixture.novel, '--run', fixture.runId, '--json'
  ]);
  assert.equal(guard.status, 1);
  assert.equal(parseJsonLine(guard.stderr).code, 'LEGACY_ACCEPTED_SERIALIZATION');
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
