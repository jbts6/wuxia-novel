'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { GameKbError } = require('./errors');
const { assertProgressInvariant, transitionProgress } = require('./chapter-progress');
const { validateWorkerChapterDraft, normalizeAcceptedChapterDraft } = require('./chapter-contract');
const { sha256 } = require('./source');
const { ensureAcceptedArtifact } = require('./candidate-ledger');
const { atomicWriteJson, writeImmutableFile, writeImmutableJson } = require('./io');
const { assertStagingIdentity } = require('./paths');
const { windowSequenceFor } = require('./chapter-work');
const { recordRunTimingEvent } = require('./timing-events');

const MECHANICAL_ERROR_CODES = new Set([
  'YAML_CODE_FENCE',
  'YAML_INDENTATION',
  'YAML_QUOTE',
  'YAML_EMPTY_COLLECTION'
]);

function syntaxError(code, target) {
  return { code, path: '$', target: target || '' };
}

function parseWorkerYaml(raw) {
  if (/^```(?:ya?ml)?\s*$/m.test(raw) || /^```/m.test(raw)) {
    return { draft: null, errors: [syntaxError('YAML_CODE_FENCE', 'code fence detected')] };
  }
  try {
    const documents = [];
    yaml.loadAll(raw, document => documents.push(document));
    if (documents.length !== 1) {
      return {
        draft: null,
        errors: [syntaxError('YAML_MULTI_DOCUMENT', `${documents.length} documents`)]
      };
    }
    if (!documents[0] || typeof documents[0] !== 'object' || Array.isArray(documents[0])) {
      return { draft: null, errors: [syntaxError('STAGING_OUTPUT_INVALID', 'mapping required')] };
    }
    return { draft: documents[0], errors: [] };
  } catch (error) {
    const message = String(error?.message || error);
    if (/indent/i.test(message)) return { draft: null, errors: [syntaxError('YAML_INDENTATION', message)] };
    if (/quote|quoted|expected.*['"]/i.test(message)) {
      return { draft: null, errors: [syntaxError('YAML_QUOTE', message)] };
    }
    return { draft: null, errors: [syntaxError('YAML_PARSE_ERROR', message)] };
  }
}

function normalizeValidationErrors(draft, errors) {
  return errors.map(error => {
    if (error.code !== 'CATEGORY_ARRAY_REQUIRED') return error;
    const value = draft?.[error.path];
    if (value === null || (value && typeof value === 'object'
      && !Array.isArray(value) && Object.keys(value).length === 0)) {
      return { code: 'YAML_EMPTY_COLLECTION', path: error.path, target: value };
    }
    return error;
  });
}

function isMechanicalOnly(errors) {
  return errors.length > 0 && errors.every(error => MECHANICAL_ERROR_CODES.has(error.code));
}

function archivePaths(paths, unit, state) {
  const safe = unit.replaceAll(':', '_');
  const cycle = `cycle_${String(state.cycle).padStart(2, '0')}`;
  const attempt = `attempt_${String(state.attempt).padStart(2, '0')}`;
  return {
    draft: path.join(paths.drafts, safe, cycle, `${attempt}.yaml`),
    errors: path.join(paths.revisions, safe, cycle, `${attempt}.errors.json`)
  };
}

function archiveRawDraft(paths, unit, state, raw) {
  const archived = archivePaths(paths, unit, state);
  writeImmutableFile(archived.draft, raw, 'STAGING_OUTPUT_REPLAY_CONFLICT');
  return archived;
}

function archiveErrors(paths, unit, state, outputHash, errors) {
  const archived = archivePaths(paths, unit, state);
  writeImmutableJson(archived.errors, {
    unit,
    cycle: state.cycle,
    attempt: state.attempt,
    output_hash: outputHash,
    errors
  }, 'STAGING_OUTPUT_REPLAY_CONFLICT');
  return archived;
}

function removeStaging(file) {
  fs.rmSync(file, { force: true });
}

function cleanupPersistedReplays(paths, progress) {
  for (const [unit, state] of Object.entries(progress.units)) {
    if (state.status === 'active' || !state.output_file || !fs.existsSync(state.output_file)) continue;
    const stagingFile = assertStagingIdentity(paths, state.output_file);
    const archived = archivePaths(paths, unit, state).draft;
    if (!fs.existsSync(archived)
      || !fs.readFileSync(archived).equals(fs.readFileSync(stagingFile))) {
      throw new GameKbError(
        'STAGING_OUTPUT_REPLAY_CONFLICT',
        'Persisted staging replay does not match its archived draft',
        { unit, staging_file: stagingFile, archived_draft: archived }
      );
    }
    removeStaging(stagingFile);
  }
}

function rejectObservedOutput({ paths, manifest, progress, unit, raw, outputHash, errors }) {
  const state = progress.units[unit];
  archiveRawDraft(paths, unit, state, raw);
  archiveErrors(paths, unit, state, outputHash, errors);
  const repairAllowed = isMechanicalOnly(errors);
  recordAttemptEvent(paths, 'attempt_rejected', unit, state);
  const next = transitionProgress(progress, {
    type: 'rejected',
    unit,
    reason: errors[0]?.code || 'STAGING_OUTPUT_INVALID',
    repair_allowed: repairAllowed,
    errors,
    manifest,
    paths
  });
  atomicWriteJson(paths.progress, next);
  removeStaging(state.output_file);
  return {
    progress: next,
    record: {
      unit,
      status: 'rejected',
      output_hash: outputHash,
      repair_allowed: repairAllowed,
      errors
    }
  };
}

function acceptObservedOutput({ paths, manifest, progress, unit, raw, outputHash, accepted }) {
  const state = progress.units[unit];
  const acceptedFile = path.join(paths.chapters, `${unit.replaceAll(':', '_')}.yaml`);
  ensureAcceptedArtifact(paths, acceptedFile, outputHash, accepted);
  archiveRawDraft(paths, unit, state, raw);
  recordAttemptEvent(paths, 'attempt_accepted', unit, state);
  if (closesActiveWindow(progress, unit)) {
    recordRunTimingEvent(paths, {
      type: 'window_closed',
      window_sequence: windowSequenceFor(progress.active_units)
    });
  }
  const next = transitionProgress(progress, {
    type: 'accepted', unit, output_hash: outputHash, manifest, paths
  });
  atomicWriteJson(paths.progress, next);
  removeStaging(state.output_file);
  return {
    progress: next,
    record: {
      unit,
      status: 'accepted',
      output_hash: outputHash,
      repair_allowed: false,
      errors: []
    }
  };
}

function recordAttemptEvent(paths, type, unit, state) {
  recordRunTimingEvent(paths, {
    type,
    unit,
    cycle: state.cycle,
    attempt: state.attempt,
    producer: state.producer
  });
}

function closesActiveWindow(progress, unit) {
  return progress.active_units.every(name => (
    name === unit || progress.units[name].status === 'accepted'
  ));
}

function expectedChapter(manifest, unit) {
  const chapter = manifest.chapters.find(entry => (
    `chapter:${String(entry.number).padStart(3, '0')}` === unit
  ));
  if (!chapter) throw new GameKbError('UNIT_NOT_FOUND', `Unknown active chapter unit: ${unit}`, { unit });
  return {
    number: chapter.number,
    title: chapter.title,
    inputHash: chapter.input_hash,
    chapterText: fs.readFileSync(chapter.file, 'utf8')
  };
}

function evaluateObservedOutput(raw, expected) {
  const parsed = parseWorkerYaml(raw);
  if (parsed.errors.length > 0) return { errors: parsed.errors, accepted: null };
  const validationErrors = normalizeValidationErrors(
    parsed.draft,
    validateWorkerChapterDraft(parsed.draft, expected)
  );
  if (validationErrors.length > 0) return { errors: validationErrors, accepted: null };
  const normalized = normalizeAcceptedChapterDraft(parsed.draft, expected);
  return { errors: normalized.errors, accepted: normalized.chapter };
}

function receiveObservedUnit({ paths, manifest, progress, unit }) {
  const state = progress.units[unit];
  if (state.status !== 'active') return null;
  const outputFile = assertStagingIdentity(paths, state.output_file);
  if (!fs.existsSync(outputFile)) return null;
  recordAttemptEvent(paths, 'attempt_observed', unit, state);
  const raw = fs.readFileSync(outputFile, 'utf8');
  const outputHash = sha256(raw);
  const evaluated = evaluateObservedOutput(raw, expectedChapter(manifest, unit));
  if (evaluated.errors.length > 0) {
    return rejectObservedOutput({
      paths, manifest, progress, unit, raw, outputHash, errors: evaluated.errors
    });
  }
  return acceptObservedOutput({
    paths, manifest, progress, unit, raw, outputHash, accepted: evaluated.accepted
  });
}

function receiveAvailableChapterOutputs({ paths, manifest, progress }) {
  assertProgressInvariant(progress, manifest, paths);
  cleanupPersistedReplays(paths, progress);
  const received = [];
  let current = progress;

  for (const unit of [...current.active_units]) {
    const result = receiveObservedUnit({ paths, manifest, progress: current, unit });
    if (!result) continue;
    current = result.progress;
    received.push(result.record);
  }

  return { progress: current, received };
}

module.exports = { MECHANICAL_ERROR_CODES, receiveAvailableChapterOutputs };
