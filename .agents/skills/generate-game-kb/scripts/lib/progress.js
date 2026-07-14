'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson } = require('./io');

function now() {
  return new Date().toISOString();
}

function freshProgress() {
  return {
    schema_version: 1,
    units: {},
    history: [],
    updated_at: now()
  };
}

function freshUnit(inputHash, status = 'pending') {
  return {
    input_hash: inputHash,
    status,
    attempts: 0,
    output_hashes: [],
    error_fingerprints: [],
    last_errors: [],
    stop_reason: null,
    updated_at: now()
  };
}

function normalizeErrors(errors) {
  return (Array.isArray(errors) ? errors : []).map(error => ({
    code: String(error?.code || 'UNKNOWN'),
    path: String(error?.path || ''),
    target: String(error?.target || '')
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function normalizeErrorFingerprint(errors) {
  const normalized = normalizeErrors(errors);
  if (normalized.length === 0) return null;
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex')}`;
}

function cloneProgress(progress) {
  return structuredClone(progress);
}

function rotateUnit(progress, unitName, inputHash, status) {
  const previous = progress.units[unitName];
  if (previous) {
    progress.history.push({ unit: unitName, ...previous, archived_at: now() });
  }
  progress.units[unitName] = freshUnit(inputHash, status);
  return progress.units[unitName];
}

function recordSubmission(current, unitName, inputHash, outputHash, errors) {
  const progress = cloneProgress(current);
  let unit = progress.units[unitName];
  if (!unit || unit.input_hash !== inputHash) {
    unit = rotateUnit(progress, unitName, inputHash, unit ? 'stale' : 'pending');
  } else if (unit.status === 'done') {
    throw new GameKbError('UNIT_ALREADY_DONE', 'Completed unchanged unit cannot be resubmitted', { unit: unitName });
  } else if (unit.status === 'manual_review') {
    throw new GameKbError('UNIT_MANUAL_REVIEW', 'Manual-review unit requires an explicit reset', { unit: unitName });
  }

  const normalizedErrors = normalizeErrors(errors);
  const fingerprint = normalizeErrorFingerprint(normalizedErrors);
  const outputs = [...unit.output_hashes, String(outputHash)].slice(-3);
  const fingerprints = fingerprint
    ? [...unit.error_fingerprints, fingerprint].slice(-3)
    : [...unit.error_fingerprints].slice(-3);
  const attempts = unit.attempts + 1;
  const reasons = [];

  if (normalizedErrors.length > 0) {
    if (outputs.length >= 2 && outputs.at(-1) === outputs.at(-2)) reasons.push('REPEATED_OUTPUT');
    if (fingerprints.length >= 2 && fingerprints.at(-1) === fingerprints.at(-2)) reasons.push('REPEATED_ERROR');
    if (outputs.length === 3 && outputs[0] === outputs[2]) reasons.push('OUTPUT_OSCILLATION');
    if (fingerprints.length === 3 && fingerprints[0] === fingerprints[2]) reasons.push('ERROR_OSCILLATION');
    if (attempts >= 3) reasons.push('ATTEMPTS_EXHAUSTED');
  }

  unit.attempts = attempts;
  unit.output_hashes = outputs;
  unit.error_fingerprints = fingerprints;
  unit.last_errors = normalizedErrors;
  unit.status = normalizedErrors.length === 0 ? 'done' : reasons.length > 0 ? 'manual_review' : 'pending';
  unit.stop_reason = reasons.length > 0 ? reasons.join(',') : null;
  unit.updated_at = now();
  progress.updated_at = unit.updated_at;
  return progress;
}

function setDeterministicUnit(current, unitName, inputHash, errors) {
  const progress = cloneProgress(current);
  let unit = progress.units[unitName];
  if (!unit || unit.input_hash !== inputHash) unit = rotateUnit(progress, unitName, inputHash, 'pending');
  const normalizedErrors = normalizeErrors(errors);
  const fingerprint = normalizeErrorFingerprint(normalizedErrors);
  unit.status = normalizedErrors.length > 0 ? 'manual_review' : 'done';
  unit.attempts = 0;
  unit.output_hashes = [];
  unit.error_fingerprints = fingerprint ? [fingerprint] : [];
  unit.last_errors = normalizedErrors;
  unit.stop_reason = normalizedErrors.length > 0 ? 'DETERMINISTIC_VALIDATION_FAILED' : null;
  unit.updated_at = now();
  progress.updated_at = unit.updated_at;
  return progress;
}

function forceManualReview(current, unitName, errors, stopReason) {
  const progress = cloneProgress(current);
  const unit = progress.units[unitName];
  if (!unit) throw new GameKbError('UNIT_UNKNOWN', 'Cannot stop an unknown unit', { unit: unitName });
  const normalizedErrors = normalizeErrors(errors);
  const fingerprint = normalizeErrorFingerprint(normalizedErrors);
  unit.status = 'manual_review';
  unit.last_errors = normalizedErrors;
  unit.error_fingerprints = fingerprint
    ? [...unit.error_fingerprints, fingerprint].slice(-3)
    : unit.error_fingerprints;
  unit.stop_reason = stopReason;
  unit.updated_at = now();
  progress.updated_at = unit.updated_at;
  return progress;
}

function manualIssues(progress) {
  return Object.entries(progress.units)
    .filter(([, unit]) => unit.status === 'manual_review')
    .map(([unitName, unit]) => ({
      unit: unitName,
      input_hash: unit.input_hash,
      attempts: unit.attempts,
      stop_reason: unit.stop_reason,
      errors: unit.last_errors,
      suggested_action: `Inspect ${unitName}; reset only with reset-unit --unit ${unitName} --confirm`
    }));
}

function saveProgress(paths, progress) {
  const value = cloneProgress(progress);
  value.updated_at = now();
  atomicWriteJson(paths.progress, value);
  atomicWriteJson(paths.manualReview, manualIssues(value));
  return value;
}

function readProgress(file) {
  try {
    const progress = readJson(file);
    if (!progress || typeof progress !== 'object' || Array.isArray(progress) || typeof progress.units !== 'object') {
      throw new Error('invalid progress shape');
    }
    progress.history = Array.isArray(progress.history) ? progress.history : [];
    return progress;
  } catch (error) {
    throw new GameKbError('PROGRESS_CORRUPT', 'Progress cannot be parsed safely', {
      file,
      cause: error.message
    });
  }
}

function loadProgress(paths, manifest) {
  const progress = fs.existsSync(paths.progress) ? readProgress(paths.progress) : freshProgress();
  let changed = !fs.existsSync(paths.progress);
  for (const chapter of manifest.chapters) {
    const unitName = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const existing = progress.units[unitName];
    if (!existing) {
      progress.units[unitName] = freshUnit(chapter.input_hash);
      changed = true;
    } else if (existing.input_hash !== chapter.input_hash) {
      rotateUnit(progress, unitName, chapter.input_hash, 'stale');
      changed = true;
    }
  }
  if (changed || !fs.existsSync(paths.manualReview)) return saveProgress(paths, progress);
  return progress;
}

function resetUnit(current, unitName, confirmed) {
  if (!confirmed) {
    throw new GameKbError('RESET_CONFIRM_REQUIRED', 'reset-unit requires --confirm', { unit: unitName });
  }
  const progress = cloneProgress(current);
  const existing = progress.units[unitName];
  if (!existing) throw new GameKbError('UNIT_UNKNOWN', 'Unknown unit', { unit: unitName });
  rotateUnit(progress, unitName, existing.input_hash, 'pending');
  progress.updated_at = now();
  return progress;
}

function statusReport(paths, manifest, progress) {
  const unitNames = [
    ...manifest.chapters.map(chapter => `chapter:${String(chapter.number).padStart(3, '0')}`),
    ...Object.keys(progress.units).filter(name => !name.startsWith('chapter:')).sort()
  ];
  const counts = { pending: 0, done: 0, stale: 0, manual_review: 0 };
  const units = unitNames.map(name => {
    const unit = progress.units[name];
    counts[unit.status] += 1;
    return { unit: name, status: unit.status, attempts: unit.attempts, input_hash: unit.input_hash };
  });
  return {
    schema_version: 1,
    counts,
    units,
    files: {
      manifest: paths.manifest,
      progress: paths.progress,
      manual_review: paths.manualReview
    }
  };
}

module.exports = {
  freshProgress,
  freshUnit,
  forceManualReview,
  loadProgress,
  manualIssues,
  normalizeErrorFingerprint,
  recordSubmission,
  resetUnit,
  saveProgress,
  setDeterministicUnit,
  statusReport
};
