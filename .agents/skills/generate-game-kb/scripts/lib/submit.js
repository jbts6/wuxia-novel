'use strict';

const fs = require('node:fs');

const { GameKbError } = require('./errors');
const { acceptDraft, commitSubmission } = require('./accept');
const { readJson, serializeYaml, atomicWriteFile } = require('./io');
const { stagingPathFor } = require('./paths');
const { loadProgress } = require('./progress');
const { readWorkItem } = require('./semantic-work');

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

function nextAttempt(progress, unit, inputHash) {
  const state = progress.units?.[unit];
  return !state || state.input_hash !== inputHash ? 1 : (state.attempts || 0) + 1;
}

// Resolve the controller identity for a unit from the run state. Chapter units
// derive their input hash from the manifest; domain-decision units read it from
// the immutable work plan. Returns { inputHash, expectedAttempt, isDomain }.
// The staging path is derived by the caller once the attempt is validated.
function resolveUnitIdentity(paths, manifest, progress, unit) {
  const chapterMatch = /^chapter:(\d{3})$/.exec(unit);
  if (chapterMatch) {
    const number = Number(chapterMatch[1]);
    const chapter = manifest.chapters.find(candidate => candidate.number === number);
    if (!chapter) {
      throw new GameKbError('UNIT_UNKNOWN', 'Chapter unit is not present in the manifest', { unit });
    }
    return {
      inputHash: chapter.input_hash,
      expectedAttempt: nextAttempt(progress, unit, chapter.input_hash),
      isDomain: false
    };
  }
  if (/^distill:(factions|characters|skills|items)$/.test(unit)) {
    const work = readWorkItem(paths, unit);
    return {
      inputHash: work.input.input_hash,
      expectedAttempt: work.input.attempt,
      isDomain: true
    };
  }
  throw new GameKbError('UNIT_UNSUPPORTED', 'submit supports chapter and domain decision units', { unit });
}

// `submit` performs ONLY in-command input validation (envelope shape, schema
// version, unit/attempt/input-hash identity). Because `ch_split` is
// deterministic and workers never write artifacts, there is no separate guard
// stage. A malformed or identity-mismatched envelope must fail WITHOUT writing
// staging, accepted evidence, or progress state.
function submitWorkerEnvelope({ paths, unit, attempt, rawInput }) {
  validateInputBounds(rawInput);

  const manifest = readJson(paths.manifest);
  if (!manifest) {
    throw new GameKbError('MANIFEST_MISSING', 'Run manifest not found', { run: paths.run });
  }
  const progress = loadProgress(paths, manifest);

  const identity = resolveUnitIdentity(paths, manifest, progress, unit);
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new GameKbError('ATTEMPT_REQUIRED', 'submit requires a positive integer --attempt', { unit });
  }
  if (attempt !== identity.expectedAttempt) {
    throw new GameKbError('SUBMISSION_ATTEMPT_CONFLICT', 'Submission attempt is not the next controller attempt', {
      unit,
      attempt,
      expected_attempt: identity.expectedAttempt
    });
  }
  const stagingPath = identity.isDomain
    ? readWorkItem(paths, unit).input.staging_path
    : stagingPathFor(paths, unit, attempt);

  const { envelope, parseError } = parseEnvelope(rawInput);
  if (parseError || !envelope) {
    throw new GameKbError('SUBMISSION_ENVELOPE_INVALID', 'Envelope must be a valid JSON object', {
      detail: parseError ? parseError.message : 'Envelope must be a JSON object'
    });
  }
  if (envelope.schema_version !== 1) {
    throw new GameKbError('SUBMISSION_SCHEMA_VERSION_MISMATCH', 'Envelope schema version must be 1', {
      schema_version: envelope.schema_version
    });
  }

  const mismatches = [];
  if (envelope.unit !== unit) mismatches.push('unit');
  if (envelope.attempt !== attempt) mismatches.push('attempt');
  if (envelope.input_hash !== identity.inputHash) mismatches.push('input_hash');
  if (mismatches.length > 0) {
    throw new GameKbError('SUBMISSION_IDENTITY_MISMATCH', 'Envelope identity fields do not match CLI', {
      mismatches,
      envelope: { unit: envelope.unit, attempt: envelope.attempt, input_hash: envelope.input_hash },
      cli: { unit, attempt, input_hash: identity.inputHash }
    });
  }
  if (!envelope.draft || typeof envelope.draft !== 'object') {
    throw new GameKbError('SUBMISSION_DRAFT_MISSING', 'Envelope must contain a draft object', {});
  }

  const canonicalYaml = serializeYaml(envelope.draft);
  atomicWriteFile(stagingPath, canonicalYaml);

  if (identity.isDomain) {
    return commitSubmission({
      paths,
      unit,
      attempt: identity.expectedAttempt,
      inputHash: identity.inputHash,
      submissionId: `submission:${unit}:attempt:${identity.expectedAttempt}:${identity.inputHash}`,
      evidenceText: canonicalYaml,
      evidenceExtension: '.yaml',
      stagingPath,
      draft: envelope.draft,
      prevalidationErrors: null
    });
  }
  return acceptDraft({ paths, unit, draftPath: stagingPath });
}

module.exports = { submitWorkerEnvelope, validateInputBounds, parseEnvelope, nextAttempt };
