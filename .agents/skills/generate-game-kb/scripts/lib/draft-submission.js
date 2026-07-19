'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { commitSubmission } = require('./accept');
const { assertAcceptedSerialization } = require('./run');
const { GameKbError } = require('./errors');
const { readJson, serializeYaml } = require('./io');
const {
  openSubmissionJournal,
  writeSubmissionPhase,
  readSubmissionPhase,
  submissionResult
} = require('./submission-journal');
const { stagingPathFor } = require('./paths');
const { loadProgress } = require('./progress');
const { sha256 } = require('./source');

const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MiB

function validateInputBounds(rawInput) {
  if (typeof rawInput !== 'string' || rawInput.length === 0) {
    throw new GameKbError('SUBMISSION_INPUT_EMPTY', 'Stdin input must not be empty', {});
  }
  const byteLength = Buffer.byteLength(rawInput, 'utf8');
  if (byteLength > MAX_INPUT_BYTES) {
    throw new GameKbError('SUBMISSION_INPUT_OVERSIZED', 'Stdin input exceeds maximum size', {
      byte_length: byteLength,
      max: MAX_INPUT_BYTES
    });
  }
  if (rawInput.includes('\0')) {
    throw new GameKbError('SUBMISSION_INPUT_CONTAINS_NUL', 'Stdin input must not contain NUL bytes', {});
  }
}

function validateCliIdentity(paths, batchId, unit, attempt) {
  const manifest = readJson(paths.manifest);
  if (!manifest) {
    throw new GameKbError('MANIFEST_MISSING', 'Run manifest not found', { run: paths.run });
  }

  const chapterMatch = /^chapter:(\d{3})$/.exec(unit);
  if (!chapterMatch) {
    throw new GameKbError('UNIT_UNSUPPORTED', 'Only chapter units are supported by the submission broker', { unit });
  }

  const chapterNumber = Number(chapterMatch[1]);
  const chapter = manifest.chapters.find(c => c.number === chapterNumber);
  if (!chapter) {
    throw new GameKbError('UNIT_UNKNOWN', 'Chapter unit is not present in the manifest', { unit });
  }

  const expectedBatchId = `chapter-batch-${String(chapterNumber).padStart(3, '0')}`;
  if (batchId !== expectedBatchId) {
    throw new GameKbError('SUBMISSION_CLI_IDENTITY_MISMATCH', 'CLI batch_id does not match unit', {
      batch_id: batchId,
      expected_batch_id: expectedBatchId,
      unit
    });
  }

  const progress = loadProgress(paths, manifest);
  const state = progress.units?.[unit];
  const expectedAttempt = !state || state.input_hash !== chapter.input_hash ? 1 : (state.attempts || 0) + 1;

  if (attempt !== expectedAttempt) {
    throw new GameKbError('SUBMISSION_CLI_IDENTITY_MISMATCH', 'CLI attempt does not match current state', {
      attempt,
      expected_attempt: expectedAttempt,
      unit
    });
  }

  if (state?.input_hash === chapter.input_hash && state.status === 'manual_review') {
    throw new GameKbError('UNIT_MANUAL_REVIEW', 'Manual-review unit requires an explicit reset', { unit });
  }

  if (state?.input_hash === chapter.input_hash && state.status === 'done') {
    throw new GameKbError('UNIT_ALREADY_DONE', 'Completed unchanged unit cannot be resubmitted', { unit });
  }

  return { manifest, progress, chapter, expectedAttempt };
}

function parseEnvelope(rawInput) {
  let envelope;
  try {
    envelope = JSON.parse(rawInput);
  } catch (error) {
    return { envelope: null, parseError: error };
  }

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return { envelope: null, parseError: new Error('Envelope must be a JSON object') };
  }

  return { envelope, parseError: null };
}

function verifyEnvelopeIdentity(envelope, batchId, unit, attempt, inputHash) {
  if (envelope.schema_version !== 1) {
    throw new GameKbError('SUBMISSION_SCHEMA_VERSION_MISMATCH', 'Envelope schema version must be 1', {
      schema_version: envelope.schema_version
    });
  }

  const mismatches = [];
  if (envelope.batch_id !== batchId) mismatches.push('batch_id');
  if (envelope.unit !== unit) mismatches.push('unit');
  if (envelope.attempt !== attempt) mismatches.push('attempt');
  if (envelope.input_hash !== inputHash) mismatches.push('input_hash');

  if (mismatches.length > 0) {
    throw new GameKbError('SUBMISSION_IDENTITY_MISMATCH', 'Envelope identity fields do not match CLI', {
      mismatches,
      envelope: { batch_id: envelope.batch_id, unit: envelope.unit, attempt: envelope.attempt, input_hash: envelope.input_hash },
      cli: { batch_id: batchId, unit, attempt, input_hash: inputHash }
    });
  }

  if (!envelope.draft || typeof envelope.draft !== 'object') {
    throw new GameKbError('SUBMISSION_DRAFT_MISSING', 'Envelope must contain a draft object', {});
  }
}

function submitChapterEnvelope({ paths, guardId, batchId, unit, attempt, rawInput, faultAt }) {
  // 1. Validate transport bounds (before any journal binding)
  validateInputBounds(rawInput);

  // 2. Check for terminal journal result BEFORE CLI identity (replay support)
  const rawHash = sha256(rawInput);
  const journalPaths = require('./submission-journal').submissionJournalPaths(paths, unit, attempt);
  if (fs.existsSync(journalPaths.result)) {
    // Check if raw hash matches before returning cached result
    if (fs.existsSync(journalPaths.binding)) {
      const existingBinding = readJson(journalPaths.binding);
      if (existingBinding.raw_hash !== rawHash) {
        throw new GameKbError('SUBMISSION_REPLAY_CONFLICT', 'Conflicting hash for same unit/attempt', {
          unit,
          attempt,
          existing_hash: existingBinding.raw_hash,
          incoming_hash: rawHash
        });
      }
    }
    const existingResult = readJson(journalPaths.result);
    return existingResult;
  }
  // Check for binding conflict (different raw hash for same unit/attempt)
  if (fs.existsSync(journalPaths.binding)) {
    const existingBinding = readJson(journalPaths.binding);
    if (existingBinding.raw_hash !== rawHash) {
      throw new GameKbError('SUBMISSION_REPLAY_CONFLICT', 'Conflicting hash for same unit/attempt', {
        unit,
        attempt,
        existing_hash: existingBinding.raw_hash,
        incoming_hash: rawHash
      });
    }
    // Same binding but no result yet — resume from last phase
  }

  // 3. Validate CLI identity
  const { manifest, progress, chapter, expectedAttempt } = validateCliIdentity(paths, batchId, unit, attempt);

  // 4. Check serialization
  const runJson = readJson(paths.runJson);
  assertAcceptedSerialization(runJson, 'submit-draft');

  // 5. Parse envelope
  const { envelope, parseError } = parseEnvelope(rawInput);

  // 5. If parseable, verify envelope identity before journal binding
  if (envelope && !parseError) {
    try {
      verifyEnvelopeIdentity(envelope, batchId, unit, attempt, chapter.input_hash);
    } catch (error) {
      // Identity mismatch consumes zero attempts — no journal binding
      throw error;
    }
  }

  // 6. Open/bind journal (malformed JSON is bound because CLI identity is known)
  const recordedAt = new Date().toISOString();
  const journal = openSubmissionJournal({
    paths,
    batchId,
    unit,
    attempt,
    inputHash: chapter.input_hash,
    rawHash,
    guardId,
    recordedAt
  });

  // Check for terminal result (replay)
  const existingResult = submissionResult(journal);
  if (existingResult) return existingResult;

  // 7. Handle malformed content
  if (parseError || !envelope) {
    const prevalidationErrors = [{
      code: 'SUBMISSION_ENVELOPE_INVALID',
      path: '$',
      target: parseError?.message || 'Envelope must be a JSON object'
    }];

    const submissionId = `submission:${unit}:attempt:${attempt}:${chapter.input_hash}:${rawHash}`;

    // Fault injection: after binding
    if (faultAt === 'binding') throw new GameKbError('SUBMISSION_FAULT_INJECTED', 'Fault after binding', { phase: faultAt });

    const result = commitSubmission({
      paths,
      unit,
      attempt,
      inputHash: chapter.input_hash,
      submissionId,
      evidenceText: rawInput,
      evidenceExtension: '.json',
      stagingPath: null,
      draft: null,
      prevalidationErrors,
      checkpoint: (phase, data) => {
        writeSubmissionPhase(journal, phase, data);
        if (faultAt === phase) throw new GameKbError('SUBMISSION_FAULT_INJECTED', 'Fault after phase', { phase });
      }
    });

    writeSubmissionPhase(journal, 'result', result);
    return result;
  }

  // 8. Valid envelope — canonicalize draft
  const canonicalYaml = serializeYaml(envelope.draft);
  const stagingPath = stagingPathFor(paths, unit, attempt);
  const { atomicWriteFile } = require('./io');
  atomicWriteFile(stagingPath, canonicalYaml);

  writeSubmissionPhase(journal, 'staging-written', { staging_path: stagingPath });
  if (faultAt === 'staging-written') throw new GameKbError('SUBMISSION_FAULT_INJECTED', 'Fault after staging-written', { phase: faultAt });

  // 9. Call commitSubmission with checkpoint callbacks
  const submissionId = `submission:${unit}:attempt:${attempt}:${chapter.input_hash}:${rawHash}`;

  const result = commitSubmission({
    paths,
    unit,
    attempt,
    inputHash: chapter.input_hash,
    submissionId,
    evidenceText: canonicalYaml,
    evidenceExtension: '.yaml',
    stagingPath,
    draft: envelope.draft,
    prevalidationErrors: null,
    checkpoint: (phase, data) => {
      writeSubmissionPhase(journal, phase, data);
      if (faultAt === phase) throw new GameKbError('SUBMISSION_FAULT_INJECTED', 'Fault after phase', { phase });
    }
  });

  writeSubmissionPhase(journal, 'result', result);
  return result;
}

module.exports = { submitChapterEnvelope };
