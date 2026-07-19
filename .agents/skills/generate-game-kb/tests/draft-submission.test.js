'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { buildCandidateRegistry } = require('../scripts/lib/candidate-registry');
const { normalizeChapterDraft, validateChapterDraft } = require('../scripts/lib/chapter-contract');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');
const { prepareNovel, sha256 } = require('../scripts/lib/source');
const { submissionJournalPaths } = require('../scripts/lib/submission-journal');
const workerGuard = require('../scripts/lib/worker-guard');
const {
  makeNovel,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft
} = require('./helpers');

let submitDraft = {};
try {
  submitDraft = require('../scripts/lib/draft-submission');
} catch {
  // First TDD run exercises the missing module.
}
const directSubmitChapterEnvelope = submitDraft.submitChapterEnvelope;
const fixtureGuardIds = new Map();
submitDraft.submitChapterEnvelope = options => directSubmitChapterEnvelope({
  guardId: fixtureGuardIds.get(options.paths),
  ...options
});

function captureError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  assert.fail('Expected callback to throw');
}

function chapterFixture(name, runId) {
  const novel = makeNovel(name, '第一章 起始\n甲在山谷中与故人相逢。\n');
  createOrResumeRun(novel, { runId });
  prepareNovel(novel, { runId });
  const paths = pathsFor(novel, runId);
  fs.mkdirSync(paths.staging, { recursive: true });
  const manifest = readJson(paths.manifest);
  const chapter = manifest.chapters[0];
  const job = {
    batch_id: `chapter-batch-${String(chapter.number).padStart(3, '0')}`,
    unit: `chapter:${String(chapter.number).padStart(3, '0')}`,
    attempt: 1,
    input_hash: chapter.input_hash
  };
  const { guard_id: guardId } = workerGuard.openWorkerGuard({
    repositoryRoot: novel,
    paths,
    job
  });
  workerGuard.checkWorkerGuard({ repositoryRoot: novel, paths, guardId });
  fixtureGuardIds.set(paths, guardId);
  return { novel, paths, chapter, manifest, guardId };
}

function validEnvelope(chapter, extra = {}) {
  return {
    schema_version: 1,
    batch_id: `chapter-batch-${String(chapter.number).padStart(3, '0')}`,
    unit: `chapter:${String(chapter.number).padStart(3, '0')}`,
    attempt: 1,
    input_hash: chapter.input_hash,
    draft: validChapterDraft({
      skills: [],
      items: [],
      factions: [],
      source_hash: chapter.input_hash,
      chapter_summary: {
        title: chapter.title,
        summary: '甲在山谷中与故人相逢。',
        source_refs: [sourceRef(chapter.number, '甲在山谷中与故人相逢')]
      }
    }),
    ...extra
  };
}

test('submitChapterEnvelope accepts a valid JSON envelope from stdin', () => {
  const fixture = chapterFixture('有效信封提交试书', 'run-valid-envelope');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);

  const result = submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    guardId: fixture.guardId,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  });

  assert.equal(result.status, 'done');
  assert.equal(typeof result.accepted_file, 'string');
  assert.equal(fs.existsSync(result.accepted_file), true);
  assert.equal(result.accepted_file_hash, sha256(fs.readFileSync(result.accepted_file)));
  // Accepted file must be YAML, not JSON
  const raw = fs.readFileSync(result.accepted_file, 'utf8');
  assert.equal(raw.trimStart().startsWith('{'), false);

  const binding = readJson(submissionJournalPaths(fixture.paths, envelope.unit, 1).binding);
  const openReceipt = path.join(fixture.paths.workerGuards, `${fixture.guardId}.json`);
  const checkReceipt = path.join(fixture.paths.workerGuards, `${fixture.guardId}-check.json`);
  assert.equal(binding.guard_id, fixture.guardId);
  assert.equal(binding.guard_open_receipt_hash, sha256(fs.readFileSync(openReceipt)));
  assert.equal(binding.guard_check_receipt_hash, sha256(fs.readFileSync(checkReceipt)));
});

test('submitChapterEnvelope rejects an unguarded direct broker call before creating a journal', () => {
  const fixture = chapterFixture('无guard提交拒绝试书', 'run-unguarded-envelope');
  const envelope = validEnvelope(fixture.chapter);

  const error = captureError(() => directSubmitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: JSON.stringify(envelope)
  }));

  assert.equal(error.code, 'GUARD_ID_REQUIRED');
  assert.equal(fs.existsSync(fixture.paths.draftSubmissions), false);
});

test('submitChapterEnvelope rejects a tampered open receipt before creating a journal', () => {
  const fixture = chapterFixture('guard证明篡改拒绝试书', 'run-tampered-guard-proof');
  const envelope = validEnvelope(fixture.chapter);
  const openReceipt = path.join(fixture.paths.workerGuards, `${fixture.guardId}.json`);
  const tampered = readJson(openReceipt);
  tampered.open_time = '2000-01-01T00:00:00.000Z';
  fs.writeFileSync(openReceipt, `${JSON.stringify(tampered, null, 2)}\n`, 'utf8');

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    guardId: fixture.guardId,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: JSON.stringify(envelope)
  }));

  assert.equal(error.code, 'GUARD_PROOF_MISMATCH');
  assert.equal(fs.existsSync(fixture.paths.draftSubmissions), false);
});

test('submitChapterEnvelope replay rejects a corrupt journal through the shared decoder', () => {
  const fixture = chapterFixture('损坏journal重放拒绝试书', 'run-corrupt-journal-replay');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);
  const journal = submissionJournalPaths(fixture.paths, envelope.unit, 1);
  fs.mkdirSync(journal.dir, { recursive: true });
  fs.writeFileSync(journal.binding, `${JSON.stringify({
    raw_hash: sha256(rawInput),
    input_hash: fixture.chapter.input_hash
  })}\n`, 'utf8');
  const progressBefore = fs.readFileSync(fixture.paths.progress);

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    guardId: fixture.guardId,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  }));

  assert.equal(error.code, 'SUBMISSION_JOURNAL_CORRUPT');
  assert.deepEqual(fs.readFileSync(fixture.paths.progress), progressBefore);
});

test('submitChapterEnvelope rejects empty input', () => {
  const fixture = chapterFixture('空输入拒绝试书', 'run-empty-input');
  const envelope = validEnvelope(fixture.chapter);

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: ''
  }));

  assert.equal(error.code, 'SUBMISSION_INPUT_EMPTY');
});

test('submitChapterEnvelope rejects oversized input', () => {
  const fixture = chapterFixture('超大输入拒绝试书', 'run-oversized-input');
  const envelope = validEnvelope(fixture.chapter);
  const oversized = 'x'.repeat(10 * 1024 * 1024 + 1); // > 10MB

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: oversized
  }));

  assert.equal(error.code, 'SUBMISSION_INPUT_OVERSIZED');
});

test('submitChapterEnvelope rejects UTF-8 oversized input by byte length not character count', () => {
  const fixture = chapterFixture('UTF-8超大输入拒绝试书', 'run-utf8-oversized');
  const envelope = validEnvelope(fixture.chapter);
  // 3-byte Chinese chars: 3,495,254 chars × 3 bytes = 10,485,762 bytes > 10 MiB
  const rawInput = '中'.repeat(Math.floor(10 * 1024 * 1024 / 3) + 1);
  assert.equal(rawInput.length < 10 * 1024 * 1024, true);
  assert.equal(Buffer.byteLength(rawInput, 'utf8') > 10 * 1024 * 1024, true);

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  }));

  assert.equal(error.code, 'SUBMISSION_INPUT_OVERSIZED');
});

test('submitChapterEnvelope rejects input containing NUL bytes', () => {
  const fixture = chapterFixture('NUL字节拒绝试书', 'run-nul-input');
  const envelope = validEnvelope(fixture.chapter);

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: JSON.stringify(envelope) + '\0'
  }));

  assert.equal(error.code, 'SUBMISSION_INPUT_CONTAINS_NUL');
});

test('submitChapterEnvelope rejects malformed JSON and consumes one attempt', () => {
  const fixture = chapterFixture('畸形JSON拒绝试书', 'run-malformed-json');
  const envelope = validEnvelope(fixture.chapter);

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: '{invalid json'
  }));

  // Malformed JSON consumes one attempt via commitSubmission
  assert.equal(error.code, 'DRAFT_REJECTED');
  assert.equal(error.details.attempts, 1);
});

test('submitChapterEnvelope replays an identical malformed rejection without consuming another attempt', () => {
  const fixture = chapterFixture('畸形JSON幂等重放试书', 'run-malformed-json-replay');
  const envelope = validEnvelope(fixture.chapter);
  const options = {
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: '{invalid json'
  };

  const first = captureError(() => submitDraft.submitChapterEnvelope(options));
  const second = captureError(() => submitDraft.submitChapterEnvelope(options));

  assert.equal(first.code, 'DRAFT_REJECTED');
  assert.equal(second.code, 'DRAFT_REJECTED');
  assert.deepEqual(second.details, first.details);
  const progress = readJson(fixture.paths.progress);
  assert.equal(progress.units[envelope.unit].attempts, 1);
  const journal = submissionJournalPaths(fixture.paths, envelope.unit, 1);
  assert.equal(fs.existsSync(journal.result), true);
});

test('submitChapterEnvelope rejects wrong schema version', () => {
  const fixture = chapterFixture('错误版本拒绝试书', 'run-wrong-version');
  const envelope = validEnvelope(fixture.chapter, { schema_version: 99 });

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: JSON.stringify(envelope)
  }));

  assert.equal(error.code, 'SUBMISSION_SCHEMA_VERSION_MISMATCH');
});

test('submitChapterEnvelope rejects wrong batch_id in envelope', () => {
  const fixture = chapterFixture('错误批次拒绝试书', 'run-wrong-batch');
  const envelope = validEnvelope(fixture.chapter, { batch_id: 'wrong-batch' });

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: `chapter-batch-${String(fixture.chapter.number).padStart(3, '0')}`,
    unit: envelope.unit,
    attempt: 1,
    rawInput: JSON.stringify(envelope)
  }));

  assert.equal(error.code, 'SUBMISSION_IDENTITY_MISMATCH');
});

test('submitChapterEnvelope rejects wrong unit in envelope', () => {
  const fixture = chapterFixture('错误单元拒绝试书', 'run-wrong-unit');
  const envelope = validEnvelope(fixture.chapter, { unit: 'chapter:999' });

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: 'chapter:001',
    attempt: 1,
    rawInput: JSON.stringify(envelope)
  }));

  assert.equal(error.code, 'SUBMISSION_IDENTITY_MISMATCH');
});

test('submitChapterEnvelope rejects wrong attempt in envelope', () => {
  const fixture = chapterFixture('错误尝试拒绝试书', 'run-wrong-attempt');
  const envelope = validEnvelope(fixture.chapter, { attempt: 99 });

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: JSON.stringify(envelope)
  }));

  assert.equal(error.code, 'SUBMISSION_IDENTITY_MISMATCH');
});

test('submitChapterEnvelope rejects wrong input_hash in envelope', () => {
  const fixture = chapterFixture('错误哈希拒绝试书', 'run-wrong-hash');
  const envelope = validEnvelope(fixture.chapter, { input_hash: 'sha256:wrong' });

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: JSON.stringify(envelope)
  }));

  assert.equal(error.code, 'SUBMISSION_IDENTITY_MISMATCH');
});

test('submitChapterEnvelope creates journal binding with raw SHA-256', () => {
  const fixture = chapterFixture('收据创建试书', 'run-receipt-created');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);

  const result = submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  });

  assert.equal(result.status, 'done');
  // Journal binding should exist
  const journalDir = path.join(fixture.paths.draftSubmissions, 'chapter_001_attempt_01');
  assert.equal(fs.existsSync(path.join(journalDir, 'binding.json')), true);
  const binding = readJson(path.join(journalDir, 'binding.json'));
  assert.equal(typeof binding.raw_hash, 'string');
  assert.equal(binding.raw_hash.startsWith('sha256:'), true);
  assert.equal(binding.unit, envelope.unit);
  assert.equal(binding.attempt, 1);
  // Result should be terminal
  assert.equal(fs.existsSync(path.join(journalDir, 'result.json')), true);
});

test('submitChapterEnvelope replays identical input without consuming extra attempt', () => {
  const fixture = chapterFixture('重放相同输入试书', 'run-replay-same');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);

  const first = submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  });

  const second = submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  });

  assert.equal(first.status, second.status);
  assert.equal(first.accepted_file, second.accepted_file);
  // Progress should show only 1 attempt
  const progress = readJson(fixture.paths.progress);
  assert.equal(progress.units[envelope.unit].attempts, 1);
});

test('submitChapterEnvelope repairs a missing terminal result after progress was saved', () => {
  const fixture = chapterFixture('结果丢失重放试书', 'run-replay-after-progress');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);
  const first = submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  });

  const journal = submissionJournalPaths(fixture.paths, envelope.unit, 1);
  const durablePhases = ['binding', 'staging-written', 'submission-recorded', 'accepted-written'];
  const phaseBytes = new Map(durablePhases.map(phase => [phase, fs.readFileSync(journal[phase])]));
  const progressBefore = fs.readFileSync(fixture.paths.progress);
  const resultBefore = fs.readFileSync(journal.result);
  fs.rmSync(journal.result);

  const replay = submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  });

  assert.deepEqual(replay, first);
  for (const phase of durablePhases) {
    assert.deepEqual(fs.readFileSync(journal[phase]), phaseBytes.get(phase));
  }
  assert.deepEqual(fs.readFileSync(fixture.paths.progress), progressBefore);
  assert.deepEqual(fs.readFileSync(journal.result), resultBefore);
});

test('submitChapterEnvelope binds every recorded_at value to the journal transaction timestamp', () => {
  const fixture = chapterFixture('时间绑定重放试书', 'run-replay-recorded-at');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);
  const baseArgs = {
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  };

  const faultError = captureError(() => submitDraft.submitChapterEnvelope({ ...baseArgs, faultAt: 'submission-recorded' }));
  assert.equal(faultError.code, 'SUBMISSION_FAULT_INJECTED');

  const journal = submissionJournalPaths(fixture.paths, envelope.unit, 1);
  const binding = readJson(journal.binding);
  submitDraft.submitChapterEnvelope(baseArgs);

  const submissionRecord = readJson(journal['submission-recorded']);
  const acceptedRecord = readJson(journal['accepted-written']);
  const result = readJson(journal.result);
  const progress = readJson(fixture.paths.progress);
  assert.equal(submissionRecord.recorded_at, binding.created_at);
  assert.equal(acceptedRecord.recorded_at, binding.created_at);
  assert.equal(result.recorded_at, binding.created_at);
  assert.equal(progress.updated_at, binding.created_at);
  assert.equal(progress.units[envelope.unit].updated_at, binding.created_at);
});

test('submitChapterEnvelope replay rejects a mutated archived draft', () => {
  const fixture = chapterFixture('归档篡改重放试书', 'run-replay-mutated-archive');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);
  const options = {
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  };
  const result = submitDraft.submitChapterEnvelope(options);
  fs.writeFileSync(result.draft_archive, 'tampered archive\n', 'utf8');

  const error = captureError(() => submitDraft.submitChapterEnvelope(options));
  assert.equal(error.code, 'SUBMISSION_JOURNAL_CORRUPT');
});

test('submitChapterEnvelope replay rejects a mutated accepted artifact', () => {
  const fixture = chapterFixture('accepted篡改重放试书', 'run-replay-mutated-accepted');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);
  const options = {
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  };
  const result = submitDraft.submitChapterEnvelope(options);
  fs.writeFileSync(result.accepted_file, 'tampered accepted artifact\n', 'utf8');

  const error = captureError(() => submitDraft.submitChapterEnvelope(options));
  assert.equal(error.code, 'SUBMISSION_JOURNAL_CORRUPT');
});

test('submitChapterEnvelope replay rejects an immutable phase content conflict', () => {
  const fixture = chapterFixture('phase冲突重放试书', 'run-replay-phase-conflict');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);
  const options = {
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  };
  const faultError = captureError(() => submitDraft.submitChapterEnvelope({
    ...options,
    faultAt: 'submission-recorded'
  }));
  assert.equal(faultError.code, 'SUBMISSION_FAULT_INJECTED');

  const journal = submissionJournalPaths(fixture.paths, envelope.unit, 1);
  const record = readJson(journal['submission-recorded']);
  record.archive_path = `${record.archive_path}.conflict`;
  fs.writeFileSync(journal['submission-recorded'], `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  const error = captureError(() => submitDraft.submitChapterEnvelope(options));
  assert.equal(error.code, 'SUBMISSION_REPLAY_CONFLICT');
  assert.equal(fs.existsSync(journal['accepted-written']), false);
  assert.equal(fs.existsSync(journal.result), false);
});

test('submitChapterEnvelope rejects conflicting hash for same unit/attempt', () => {
  const fixture = chapterFixture('冲突哈希拒绝试书', 'run-replay-conflict');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);

  submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  });

  const differentEnvelope = validEnvelope(fixture.chapter, {
    draft: validChapterDraft({
      skills: [],
      items: [],
      factions: [],
      source_hash: fixture.chapter.input_hash,
      chapter_summary: {
        title: fixture.chapter.title,
        summary: '不同的摘要内容。',
        source_refs: [sourceRef(fixture.chapter.number, '甲在山谷中与故人相逢')]
      }
    })
  });
  const differentRaw = JSON.stringify(differentEnvelope);

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: differentRaw
  }));

  assert.equal(error.code, 'SUBMISSION_REPLAY_CONFLICT');
});

test('submitChapterEnvelope rejects a legacy serialization run', () => {
  const fixture = chapterFixture('旧版序列化拒绝试书', 'run-legacy-serialization');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);

  // Modify run.json to remove accepted_serialization
  const runJson = readJson(fixture.paths.runJson);
  delete runJson.accepted_serialization;
  fs.writeFileSync(fixture.paths.runJson, JSON.stringify(runJson, null, 2));

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  }));

  assert.equal(error.code, 'LEGACY_ACCEPTED_SERIALIZATION');
});

for (const faultAt of ['binding', 'staging-written', 'submission-recorded', 'accepted-written']) {
  test(`submitChapterEnvelope resumes after fault at ${faultAt}`, () => {
    const fixture = chapterFixture(`故障注入恢复试书 ${faultAt}`, `run-fault-${faultAt}`);
    const envelope = validEnvelope(fixture.chapter);
    const rawInput = JSON.stringify(envelope);
    const baseArgs = {
      paths: fixture.paths,
      batchId: envelope.batch_id,
      unit: envelope.unit,
      attempt: 1,
      rawInput
    };

    // First call with fault injection — should throw
    const faultError = captureError(() => submitDraft.submitChapterEnvelope({ ...baseArgs, faultAt }));
    assert.equal(faultError.code, 'SUBMISSION_FAULT_INJECTED');
    assert.equal(faultError.details.phase, faultAt);

    // Second call without fault — should resume and return terminal result
    const result = submitDraft.submitChapterEnvelope(baseArgs);
    assert.equal(result.status, 'done');
    assert.equal(result.attempts, 1);
    assert.equal(typeof result.accepted_file, 'string');
    assert.equal(fs.existsSync(result.accepted_file), true);
  });
}

test('submitChapterEnvelope conflict preserves all journal artifacts', () => {
  const fixture = chapterFixture('冲突保留试书', 'run-conflict-preserve');
  const envelope = validEnvelope(fixture.chapter);
  const rawInput = JSON.stringify(envelope);

  // First submission succeeds
  submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput
  });

  // Snapshot journal artifacts
  const journalDir = path.join(fixture.paths.draftSubmissions, 'chapter_001_attempt_01');
  const bindingBefore = fs.readFileSync(path.join(journalDir, 'binding.json'));
  const resultBefore = fs.readFileSync(path.join(journalDir, 'result.json'));

  // Different content for same unit/attempt — should conflict
  const differentEnvelope = validEnvelope(fixture.chapter, {
    draft: validChapterDraft({
      skills: [],
      items: [],
      factions: [],
      source_hash: fixture.chapter.input_hash,
      chapter_summary: {
        title: fixture.chapter.title,
        summary: '不同的摘要。',
        source_refs: [sourceRef(fixture.chapter.number, '甲在山谷中与故人相逢')]
      }
    })
  });

  const error = captureError(() => submitDraft.submitChapterEnvelope({
    paths: fixture.paths,
    batchId: envelope.batch_id,
    unit: envelope.unit,
    attempt: 1,
    rawInput: JSON.stringify(differentEnvelope)
  }));

  assert.equal(error.code, 'SUBMISSION_REPLAY_CONFLICT');
  // Journal artifacts must be byte-identical
  assert.deepEqual(fs.readFileSync(path.join(journalDir, 'binding.json')), bindingBefore);
  assert.deepEqual(fs.readFileSync(path.join(journalDir, 'result.json')), resultBefore);
});
