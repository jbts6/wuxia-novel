'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { pathsFor } = require('../scripts/lib/paths');
const {
  pendingSubmissionJournals,
  submissionJournalPaths
} = require('../scripts/lib/submission-journal');

function fixture(name) {
  const novel = fs.mkdtempSync(path.join(os.tmpdir(), `submission-journal-${name}-`));
  const paths = pathsFor(novel, 'run-journal');
  const journal = submissionJournalPaths(paths, 'chapter:001', 1);
  fs.mkdirSync(journal.dir, { recursive: true });
  return { paths, journal };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function binding(overrides = {}) {
  return {
    schema_version: 1,
    batch_id: 'chapter-batch-001',
    unit: 'chapter:001',
    attempt: 1,
    input_hash: `sha256:${'1'.repeat(64)}`,
    raw_hash: `sha256:${'2'.repeat(64)}`,
    guard_id: 'guard-001',
    guard_open_receipt_hash: `sha256:${'3'.repeat(64)}`,
    guard_check_receipt_hash: `sha256:${'4'.repeat(64)}`,
    created_at: '2026-07-19T00:00:00.000Z',
    ...overrides
  };
}

function phaseRecord(overrides = {}) {
  return {
    schema_version: 1,
    submission_id: 'submission:chapter:001:attempt:1',
    unit: 'chapter:001',
    input_hash: `sha256:${'1'.repeat(64)}`,
    attempt: 1,
    recorded_at: '2026-07-19T00:00:00.000Z',
    status: 'accepted',
    staging_path: 'chapter_001_attempt_01.yaml',
    output_hash: `sha256:${'5'.repeat(64)}`,
    archive_path: 'attempt_01.yaml',
    archive_hash: `sha256:${'5'.repeat(64)}`,
    accepted_file: null,
    accepted_file_hash: null,
    consumed: true,
    errors: [],
    ...overrides
  };
}

test('pendingSubmissionJournals decodes a valid binding journal', () => {
  const { paths, journal } = fixture('valid');
  writeJson(journal.binding, binding());

  assert.deepEqual(pendingSubmissionJournals(paths), [{
    unit: 'chapter:001',
    attempt: 1,
    batch_id: 'chapter-batch-001',
    input_hash: `sha256:${'1'.repeat(64)}`,
    raw_hash: `sha256:${'2'.repeat(64)}`,
    guard_id: 'guard-001',
    last_phase: 'binding',
    journal_dir: journal.dir
  }]);
});

test('pendingSubmissionJournals rejects a binding with missing required fields', () => {
  const { paths, journal } = fixture('missing-fields');
  writeJson(journal.binding, { schema_version: 1 });

  assert.throws(
    () => pendingSubmissionJournals(paths),
    error => error.code === 'SUBMISSION_JOURNAL_CORRUPT'
  );
});

test('pendingSubmissionJournals rejects phase identity that contradicts binding', () => {
  const { paths, journal } = fixture('identity');
  writeJson(journal.binding, binding());
  writeJson(journal['submission-recorded'], phaseRecord({ unit: 'chapter:002' }));

  assert.throws(
    () => pendingSubmissionJournals(paths),
    error => error.code === 'SUBMISSION_JOURNAL_CORRUPT'
  );
});

test('pendingSubmissionJournals rejects out-of-order durable phases', () => {
  const { paths, journal } = fixture('phase-order');
  writeJson(journal.binding, binding());
  writeJson(journal['accepted-written'], phaseRecord());

  assert.throws(
    () => pendingSubmissionJournals(paths),
    error => error.code === 'SUBMISSION_JOURNAL_CORRUPT'
  );
});

test('pendingSubmissionJournals validates terminal journals before skipping them', () => {
  const { paths, journal } = fixture('terminal');
  writeJson(journal.binding, binding());
  writeJson(journal.result, { unit: 'chapter:999', status: 'done', attempts: 1 });

  assert.throws(
    () => pendingSubmissionJournals(paths),
    error => error.code === 'SUBMISSION_JOURNAL_CORRUPT'
  );
});

test('pendingSubmissionJournals rejects a terminal result missing accepted result fields', () => {
  const { paths, journal } = fixture('terminal-missing-fields');
  const recorded = phaseRecord();
  const accepted = phaseRecord({
    accepted_file: 'accepted/chapter_001.yaml',
    accepted_file_hash: `sha256:${'6'.repeat(64)}`
  });
  writeJson(journal.binding, binding());
  writeJson(journal['staging-written'], { staging_path: accepted.staging_path });
  writeJson(journal['submission-recorded'], recorded);
  writeJson(journal['accepted-written'], accepted);
  writeJson(journal.result, {
    unit: 'chapter:001',
    status: 'done',
    attempts: 1,
    submission_id: accepted.submission_id
  });

  assert.throws(
    () => pendingSubmissionJournals(paths),
    error => error.code === 'SUBMISSION_JOURNAL_CORRUPT'
  );
});

test('pendingSubmissionJournals rejects a malformed terminal rejection descriptor', () => {
  const { paths, journal } = fixture('terminal-error');
  const rejected = phaseRecord({
    status: 'rejected',
    staging_path: null,
    consumed: false,
    errors: [{ code: 'SUBMISSION_ENVELOPE_INVALID' }]
  });
  writeJson(journal.binding, binding());
  writeJson(journal['submission-recorded'], rejected);
  writeJson(journal['accepted-written'], rejected);
  writeJson(journal.result, {
    unit: 'chapter:001',
    status: 'pending',
    attempts: 1,
    submission_id: rejected.submission_id,
    terminal_error: 'DRAFT_REJECTED'
  });

  assert.throws(
    () => pendingSubmissionJournals(paths),
    error => error.code === 'SUBMISSION_JOURNAL_CORRUPT'
  );
});
