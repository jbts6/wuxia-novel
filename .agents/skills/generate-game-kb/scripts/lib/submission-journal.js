'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { writeImmutableJson, readJson } = require('./io');

const JOURNAL_PHASES = ['binding', 'staging-written', 'submission-recorded', 'accepted-written', 'result'];

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

function openSubmissionJournal(binding) {
  const journalPaths = submissionJournalPaths(binding.paths, binding.unit, binding.attempt);
  fs.mkdirSync(journalPaths.dir, { recursive: true });

  // Normalize binding fields (caller uses camelCase, stored uses snake_case)
  const normalized = {
    batch_id: binding.batchId || binding.batch_id,
    unit: binding.unit,
    attempt: binding.attempt,
    input_hash: binding.inputHash || binding.input_hash,
    raw_hash: binding.rawHash || binding.raw_hash
  };

  // Check for existing binding
  if (fs.existsSync(journalPaths.binding)) {
    const existing = readJson(journalPaths.binding);
    const fields = ['batch_id', 'unit', 'attempt', 'input_hash', 'raw_hash'];
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
    guard_id: binding.guardId || binding.guard_id || null,
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
  // Skip if already written (idempotent replay)
  if (fs.existsSync(file)) return;
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
    const journalDir = path.join(dir, entry.name);
    const bindingFile = path.join(journalDir, 'binding.json');
    const resultFile = path.join(journalDir, 'result.json');

    if (!fs.existsSync(bindingFile)) continue;
    if (fs.existsSync(resultFile)) continue; // Terminal — skip

    const binding = readJson(bindingFile);
    const lastPhase = null;
    // Find last durable phase
    let durablePhase = null;
    for (let i = JOURNAL_PHASES.length - 1; i >= 0; i--) {
      const phaseFile = path.join(journalDir, `${JOURNAL_PHASES[i]}.json`);
      if (fs.existsSync(phaseFile)) {
        durablePhase = JOURNAL_PHASES[i];
        break;
      }
    }

    pending.push({
      unit: binding.unit,
      attempt: binding.attempt,
      batch_id: binding.batch_id,
      input_hash: binding.input_hash,
      raw_hash: binding.raw_hash,
      guard_id: binding.guard_id,
      last_phase: durablePhase,
      journal_dir: journalDir
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
  submissionJournalPaths
};
