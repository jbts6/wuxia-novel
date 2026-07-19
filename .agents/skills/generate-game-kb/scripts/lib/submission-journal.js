'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { writeImmutableJson, readJson } = require('./io');

const JOURNAL_PHASES = ['binding', 'staging-written', 'submission-recorded', 'accepted-written', 'result'];
const TERMINAL_REJECTION_CODES = new Set(['DRAFT_REJECTED', 'DOMAIN_PENDING_UNRESOLVED']);
const BINDING_FIELDS = Object.freeze([
  'schema_version',
  'batch_id',
  'unit',
  'attempt',
  'input_hash',
  'raw_hash',
  'guard_id',
  'guard_open_receipt_hash',
  'guard_check_receipt_hash',
  'created_at'
]);
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const RESULT_FIELDS = Object.freeze([
  'unit',
  'status',
  'attempts',
  'remaining_attempts',
  'errors',
  'quarantine_files',
  'draft_archive',
  'draft_archive_hash',
  'submission_record',
  'error_record',
  'consumed_path',
  'accepted_file',
  'accepted_file_hash',
  'submission_id',
  'recorded_at'
]);
const RECORD_FIELDS = Object.freeze([
  'schema_version',
  'submission_id',
  'unit',
  'input_hash',
  'attempt',
  'recorded_at',
  'status',
  'staging_path',
  'output_hash',
  'archive_path',
  'archive_hash',
  'accepted_file',
  'accepted_file_hash',
  'consumed',
  'errors'
]);

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hashBytes(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function validateBoundFile(file, expectedHash, kind, journalFile) {
  if (typeof file !== 'string' || file.length === 0 || !fs.existsSync(file)) {
    corruptJournal('Terminal result references a missing durable artifact', {
      file: journalFile,
      artifact_kind: kind,
      artifact_file: file
    });
  }
  const actualHash = hashBytes(fs.readFileSync(file));
  if (actualHash !== expectedHash) {
    corruptJournal('Terminal result artifact hash does not match its durable record', {
      file: journalFile,
      artifact_kind: kind,
      artifact_file: file,
      expected_hash: expectedHash,
      actual_hash: actualHash
    });
  }
}

function submissionJournalPaths(paths, unit, attempt) {
  const dir = path.join(paths.draftSubmissions, `${unit.replaceAll(':', '_')}_attempt_${String(attempt).padStart(2, '0')}`);
  return {
    dir,
    binding: path.join(dir, 'binding.json'),
    'staging-written': path.join(dir, 'staging-written.json'),
    'submission-recorded': path.join(dir, 'submission-recorded.json'),
    'accepted-written': path.join(dir, 'accepted-written.json'),
    result: path.join(dir, 'result.json')
  };
}

function corruptJournal(message, details = {}) {
  throw new GameKbError('SUBMISSION_JOURNAL_CORRUPT', message, details);
}

function terminalSubmissionRejection(error) {
  if (!(error instanceof GameKbError) || !TERMINAL_REJECTION_CODES.has(error.code)) return null;
  return {
    ...error.details,
    terminal_error: { code: error.code, message: error.message }
  };
}

function returnSubmissionResult(result) {
  if (result?.terminal_error) {
    const { terminal_error: terminalError, ...details } = result;
    throw new GameKbError(terminalError.code, terminalError.message, details);
  }
  return result;
}

function readJournalJson(file, phase) {
  try {
    const value = readJson(file);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      corruptJournal('Journal phase must contain a JSON object', { phase, file });
    }
    return value;
  } catch (error) {
    if (error?.code === 'SUBMISSION_JOURNAL_CORRUPT') throw error;
    corruptJournal('Journal phase is not valid JSON', { phase, file, cause: error.message });
  }
}

function validateBinding(binding, unit, attempt, file) {
  const actualFields = Object.keys(binding).sort();
  const expectedFields = [...BINDING_FIELDS].sort();
  if (JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
    corruptJournal('Journal binding fields do not match schema version 1', {
      file,
      actual_fields: actualFields,
      expected_fields: expectedFields
    });
  }
  if (binding.schema_version !== 1
    || !/^chapter-batch-\d{3}(?:-\d{3})?$/.test(binding.batch_id)
    || binding.unit !== unit
    || binding.attempt !== attempt
    || !SHA256_PATTERN.test(binding.input_hash)
    || !SHA256_PATTERN.test(binding.raw_hash)
    || typeof binding.guard_id !== 'string'
    || binding.guard_id.length === 0
    || !SHA256_PATTERN.test(binding.guard_open_receipt_hash)
    || !SHA256_PATTERN.test(binding.guard_check_receipt_hash)
    || typeof binding.created_at !== 'string'
    || Number.isNaN(Date.parse(binding.created_at))) {
    corruptJournal('Journal binding identity or field types are invalid', { file, unit, attempt });
  }
}

function validateRecord(record, binding, phase, file) {
  if (!sameJson(Object.keys(record).sort(), [...RECORD_FIELDS].sort())
    || record.schema_version !== 1
    || typeof record.submission_id !== 'string'
    || record.submission_id.length === 0
    || record.unit !== binding.unit
    || record.attempt !== binding.attempt
    || record.input_hash !== binding.input_hash
    || record.recorded_at !== binding.created_at
    || !['accepted', 'rejected'].includes(record.status)
    || !SHA256_PATTERN.test(record.output_hash)
    || !SHA256_PATTERN.test(record.archive_hash)
    || record.archive_hash !== record.output_hash
    || typeof record.archive_path !== 'string'
    || record.archive_path.length === 0
    || (record.staging_path !== null && (typeof record.staging_path !== 'string' || record.staging_path.length === 0))
    || (record.accepted_file !== null && (typeof record.accepted_file !== 'string' || record.accepted_file.length === 0))
    || (record.accepted_file_hash !== null && !SHA256_PATTERN.test(record.accepted_file_hash))
    || typeof record.consumed !== 'boolean'
    || !Array.isArray(record.errors)) {
    corruptJournal('Submission phase contradicts its journal binding', { phase, file });
  }
  if ((record.status === 'accepted' && (record.errors.length !== 0 || record.consumed !== true))
    || (record.status === 'rejected' && (record.errors.length === 0 || record.consumed !== false))
    || (phase === 'submission-recorded' && (record.accepted_file !== null || record.accepted_file_hash !== null))
    || (phase === 'accepted-written' && record.status === 'accepted'
      && (record.accepted_file === null || record.accepted_file_hash === null))
    || (record.status === 'rejected' && (record.accepted_file !== null || record.accepted_file_hash !== null))) {
    corruptJournal('Submission phase status fields are internally inconsistent', { phase, file });
  }
}

function validateTerminalResult(result, binding, record, file) {
  const hasTerminalError = Object.prototype.hasOwnProperty.call(result, 'terminal_error');
  const expectedFields = hasTerminalError ? [...RESULT_FIELDS, 'terminal_error'] : [...RESULT_FIELDS];
  if (!sameJson(Object.keys(result).sort(), expectedFields.sort())
    || result.unit !== binding.unit
    || result.attempts !== binding.attempt
    || result.submission_id !== record.submission_id
    || typeof result.status !== 'string'
    || !Number.isInteger(result.remaining_attempts)
    || result.remaining_attempts < 0
    || !Array.isArray(result.errors)
    || !Array.isArray(result.quarantine_files)
    || typeof result.draft_archive !== 'string'
    || !SHA256_PATTERN.test(result.draft_archive_hash)
    || typeof result.submission_record !== 'string'
    || result.recorded_at !== binding.created_at
    || result.draft_archive !== record.archive_path
    || result.draft_archive_hash !== record.archive_hash
    || !sameJson(result.errors, record.errors)
    || result.accepted_file !== record.accepted_file
    || result.accepted_file_hash !== record.accepted_file_hash
    || (record.status === 'rejected') !== hasTerminalError
    || (record.status === 'accepted' && result.status !== 'done')
    || (record.status === 'accepted' && result.error_record !== null)
    || (record.status === 'accepted' && result.consumed_path !== record.staging_path)
    || (record.status === 'rejected' && !['pending', 'manual_review'].includes(result.status))
    || (record.status === 'rejected' && result.error_record !== result.submission_record)
    || (record.status === 'rejected' && result.consumed_path !== null)) {
    corruptJournal('Terminal result contradicts its durable submission record', { file });
  }
  validateBoundFile(result.draft_archive, result.draft_archive_hash, 'draft-archive', file);
  if (record.status === 'accepted') {
    validateBoundFile(result.accepted_file, result.accepted_file_hash, 'accepted-artifact', file);
  } else if (result.accepted_file_hash !== null) {
    corruptJournal('Rejected terminal result cannot bind an accepted artifact hash', { file });
  }
  if (!hasTerminalError) return;

  const terminalError = result.terminal_error;
  if (!terminalError
    || typeof terminalError !== 'object'
    || Array.isArray(terminalError)
    || JSON.stringify(Object.keys(terminalError).sort()) !== JSON.stringify(['code', 'message'])
    || !TERMINAL_REJECTION_CODES.has(terminalError.code)
    || typeof terminalError.message !== 'string'
    || terminalError.message.length === 0) {
    corruptJournal('Terminal rejection descriptor is invalid', { file });
  }
}

function readSubmissionJournal(paths, unit, attempt) {
  const journalPaths = submissionJournalPaths(paths, unit, attempt);
  if (!fs.existsSync(journalPaths.dir)) return null;
  if (!fs.existsSync(journalPaths.binding)) {
    corruptJournal('Submission journal directory has no binding phase', {
      journal_dir: journalPaths.dir,
      unit,
      attempt
    });
  }

  const binding = readJournalJson(journalPaths.binding, 'binding');
  validateBinding(binding, unit, attempt, journalPaths.binding);
  const phases = { binding };
  for (const phase of JOURNAL_PHASES.slice(1)) {
    const file = journalPaths[phase];
    if (fs.existsSync(file)) phases[phase] = readJournalJson(file, phase);
  }

  if (phases['accepted-written'] && !phases['submission-recorded']) {
    corruptJournal('accepted-written phase exists without submission-recorded', { journal_dir: journalPaths.dir });
  }
  if (phases.result && !phases['accepted-written']) {
    corruptJournal('result phase exists without accepted-written', { journal_dir: journalPaths.dir });
  }
  if (phases['staging-written']
    && (typeof phases['staging-written'].staging_path !== 'string'
      || phases['staging-written'].staging_path.length === 0)) {
    corruptJournal('staging-written phase has no staging path', { file: journalPaths['staging-written'] });
  }

  for (const phase of ['submission-recorded', 'accepted-written']) {
    if (phases[phase]) validateRecord(phases[phase], binding, phase, journalPaths[phase]);
  }
  if (phases['submission-recorded'] && phases['accepted-written']) {
    for (const field of ['schema_version', 'submission_id', 'unit', 'attempt', 'input_hash', 'recorded_at', 'status', 'staging_path', 'output_hash', 'archive_path', 'archive_hash', 'consumed', 'errors']) {
      if (!sameJson(phases['submission-recorded'][field], phases['accepted-written'][field])) {
        corruptJournal('Durable submission phases contradict each other', { field, journal_dir: journalPaths.dir });
      }
    }
  }
  if (phases['submission-recorded']) {
    const stagingPath = phases['staging-written']?.staging_path ?? null;
    if ((phases['submission-recorded'].staging_path ?? null) !== stagingPath) {
      corruptJournal('Submission record contradicts the staging-written phase', { journal_dir: journalPaths.dir });
    }
  }
  if (phases.result) {
    validateTerminalResult(phases.result, binding, phases['accepted-written'], journalPaths.result);
  }

  let lastPhase = 'binding';
  for (const phase of JOURNAL_PHASES.slice(1)) {
    if (phases[phase]) lastPhase = phase;
  }
  return { paths: journalPaths, binding, phases, last_phase: lastPhase };
}

function openSubmissionJournal(binding) {
  const journalPaths = submissionJournalPaths(binding.paths, binding.unit, binding.attempt);
  fs.mkdirSync(journalPaths.dir, { recursive: true });

  // Normalize binding fields (caller uses camelCase, stored uses snake_case)
  const normalized = {
    batch_id: binding.batchId || binding.batch_id,
    unit: binding.unit,
    attempt: binding.attempt,
    input_hash: binding.inputHash || binding.input_hash,
    raw_hash: binding.rawHash || binding.raw_hash,
    guard_id: binding.guardId || binding.guard_id,
    guard_open_receipt_hash: binding.guardOpenReceiptHash || binding.guard_open_receipt_hash,
    guard_check_receipt_hash: binding.guardCheckReceiptHash || binding.guard_check_receipt_hash
  };

  // Check for existing binding
  if (fs.existsSync(journalPaths.binding)) {
    const existing = readSubmissionJournal(binding.paths, binding.unit, binding.attempt).binding;
    const fields = [
      'batch_id',
      'unit',
      'attempt',
      'input_hash',
      'raw_hash',
      'guard_id',
      'guard_open_receipt_hash',
      'guard_check_receipt_hash'
    ];
    for (const field of fields) {
      if (existing[field] !== normalized[field]) {
        throw new GameKbError('SUBMISSION_REPLAY_CONFLICT', 'Journal binding conflict', {
          field,
          existing: existing[field],
          incoming: normalized[field]
        });
      }
    }
    // Same binding — resume
    return { paths: journalPaths, resumed: true };
  }

  // Write new binding
  writeImmutableJson(journalPaths.binding, {
    schema_version: 1,
    batch_id: normalized.batch_id,
    unit: normalized.unit,
    attempt: normalized.attempt,
    input_hash: normalized.input_hash,
    raw_hash: normalized.raw_hash,
    guard_id: normalized.guard_id,
    guard_open_receipt_hash: normalized.guard_open_receipt_hash,
    guard_check_receipt_hash: normalized.guard_check_receipt_hash,
    created_at: binding.recordedAt || new Date().toISOString()
  }, 'SUBMISSION_REPLAY_CONFLICT');

  return { paths: journalPaths, resumed: false };
}

function writeSubmissionPhase(journal, phase, value) {
  if (!JOURNAL_PHASES.includes(phase)) {
    throw new GameKbError('JOURNAL_PHASE_INVALID', 'Unknown journal phase', { phase });
  }
  const file = journal.paths[phase];
  if (!file) {
    throw new GameKbError('JOURNAL_PHASE_INVALID', 'No path for journal phase', { phase });
  }
  writeImmutableJson(file, value, 'SUBMISSION_REPLAY_CONFLICT');
}

function readSubmissionPhase(journal, phase) {
  const file = journal.paths[phase];
  if (!file || !fs.existsSync(file)) return null;
  return readJson(file);
}

function submissionResult(journal) {
  return readSubmissionPhase(journal, 'result');
}

function lastDurablePhase(journal) {
  for (let i = JOURNAL_PHASES.length - 1; i >= 0; i--) {
    const file = journal.paths[JOURNAL_PHASES[i]];
    if (file && fs.existsSync(file)) return JOURNAL_PHASES[i];
  }
  return null;
}

function pendingSubmissionJournals(paths) {
  const dir = paths.draftSubmissions;
  if (!fs.existsSync(dir)) return [];

  const pending = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const identity = /^chapter_(\d{3})_attempt_(\d+)$/.exec(entry.name);
    if (!identity) {
      corruptJournal('Submission journal directory name is invalid', { journal_dir: path.join(dir, entry.name) });
    }
    const unit = `chapter:${identity[1]}`;
    const attempt = Number(identity[2]);
    const decoded = readSubmissionJournal(paths, unit, attempt);
    if (decoded.phases.result) continue;
    const binding = decoded.binding;

    pending.push({
      unit: binding.unit,
      attempt: binding.attempt,
      batch_id: binding.batch_id,
      input_hash: binding.input_hash,
      raw_hash: binding.raw_hash,
      guard_id: binding.guard_id,
      last_phase: decoded.last_phase,
      journal_dir: decoded.paths.dir
    });
  }

  return pending;
}

module.exports = {
  openSubmissionJournal,
  writeSubmissionPhase,
  readSubmissionPhase,
  submissionResult,
  lastDurablePhase,
  pendingSubmissionJournals,
  readSubmissionJournal,
  returnSubmissionResult,
  terminalSubmissionRejection,
  submissionJournalPaths
};
