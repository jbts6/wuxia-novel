'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson } = require('./io');
const { DOMAIN_UNITS } = require('./semantic-contract');
const { syncWorkItemAttempt } = require('./semantic-work');

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
    last_submission_id: null,
    updated_at: now()
  };
}

function isUnattemptedPending(unit) {
  return ['pending', 'stale'].includes(unit?.status)
    && (unit?.attempts ?? 0) === 0
    && (unit?.output_hashes || []).length === 0;
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

function recordSubmission(current, unitName, inputHash, outputHash, errors, options = {}) {
  const { attempt, submissionId, recordedAt } = options;
  const progress = cloneProgress(current);
  let unit = progress.units[unitName];

  // Idempotent replay: same submissionId returns identical state
  if (submissionId && unit?.last_submission_id === submissionId) {
    return progress;
  }

  if (!unit || unit.input_hash !== inputHash) {
    unit = rotateUnit(progress, unitName, inputHash, unit ? 'stale' : 'pending');
  } else if (unit.status === 'done') {
    throw new GameKbError('UNIT_ALREADY_DONE', 'Completed unchanged unit cannot be resubmitted', { unit: unitName });
  } else if (unit.status === 'manual_review') {
    throw new GameKbError('UNIT_MANUAL_REVIEW', 'Manual-review unit requires an explicit reset', { unit: unitName });
  }

  // When explicit attempt is provided, enforce ordering
  if (attempt !== undefined && submissionId) {
    const expectedAttempt = unit.attempts + 1;
    if (attempt !== expectedAttempt) {
      throw new GameKbError('SUBMISSION_ATTEMPT_CONFLICT', 'Submission attempt is not the next controller attempt', {
        unit: unitName,
        attempt,
        expected_attempt: expectedAttempt
      });
    }
  }

  if (unit.attempts >= 2) {
    throw new GameKbError('UNIT_ATTEMPTS_EXHAUSTED', 'Unit has exhausted its two-submission budget', {
      unit: unitName,
      attempts: unit.attempts
    });
  }

  const normalizedErrors = normalizeErrors(errors);
  const fingerprint = normalizeErrorFingerprint(normalizedErrors);
  const outputs = [...unit.output_hashes, String(outputHash)].slice(-2);
  const fingerprints = fingerprint
    ? [...unit.error_fingerprints, fingerprint].slice(-2)
    : [...unit.error_fingerprints].slice(-2);
  const attempts = unit.attempts + 1;
  const reasons = [];

  if (normalizedErrors.length > 0) {
    if (outputs.length >= 2 && outputs.at(-1) === outputs.at(-2)) reasons.push('REPEATED_OUTPUT');
    if (fingerprints.length >= 2 && fingerprints.at(-1) === fingerprints.at(-2)) reasons.push('REPEATED_ERROR');
    if (attempts >= 2) reasons.push('ATTEMPTS_EXHAUSTED');
  }

  unit.attempts = attempts;
  unit.output_hashes = outputs;
  unit.error_fingerprints = fingerprints;
  unit.last_errors = normalizedErrors;
  unit.status = normalizedErrors.length === 0 ? 'done' : reasons.length > 0 ? 'manual_review' : 'pending';
  unit.stop_reason = reasons.length > 0 ? reasons.join(',') : null;
  if (submissionId) unit.last_submission_id = submissionId;
  unit.updated_at = recordedAt || now();
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

function setOptionalUnitState(current, unitName, inputHash, status, errors = []) {
  if (unitName !== 'basic-curate') {
    throw new GameKbError('OPTIONAL_UNIT_UNKNOWN', 'Unknown optional unit', { unit: unitName });
  }
  if (!['pending', 'done', 'failed', 'skipped'].includes(status)) {
    throw new GameKbError('OPTIONAL_UNIT_STATUS_INVALID', 'Invalid optional unit status', {
      unit: unitName,
      status
    });
  }
  const progress = cloneProgress(current);
  let unit = progress.units[unitName];
  if (!unit || unit.input_hash !== inputHash) unit = rotateUnit(progress, unitName, inputHash, 'pending');
  const normalizedErrors = normalizeErrors(errors);
  const fingerprint = normalizeErrorFingerprint(normalizedErrors);
  unit.status = status;
  unit.attempts = ['done', 'failed'].includes(status) ? 1 : 0;
  unit.output_hashes = [];
  unit.error_fingerprints = fingerprint ? [fingerprint] : [];
  unit.last_errors = normalizedErrors;
  unit.stop_reason = status === 'failed'
    ? 'OPTIONAL_UNIT_FAILED'
    : status === 'skipped' ? 'OPTIONAL_UNIT_SKIPPED' : null;
  unit.updated_at = now();
  progress.updated_at = unit.updated_at;
  return progress;
}

function syncPlannedUnits(current, descriptors) {
  const progress = cloneProgress(current);
  let changed = false;
  for (const descriptor of Array.isArray(descriptors) ? descriptors : []) {
    const unitName = descriptor?.unit;
    const inputHash = descriptor?.input_hash;
    if (typeof unitName !== 'string' || typeof inputHash !== 'string') {
      throw new GameKbError('WORK_PLAN_INVALID', 'Planned units require unit and input_hash');
    }
    const existing = progress.units[unitName];
    if (!existing) {
      progress.units[unitName] = freshUnit(inputHash);
      changed = true;
    } else if (existing.input_hash !== inputHash) {
      if (isUnattemptedPending(existing)) progress.units[unitName] = freshUnit(inputHash);
      else rotateUnit(progress, unitName, inputHash, 'stale');
      changed = true;
    } else if (existing.status === 'stale' && isUnattemptedPending(existing)) {
      progress.units[unitName] = freshUnit(inputHash);
      changed = true;
    }
  }
  if (changed) progress.updated_at = now();
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
    ? [...unit.error_fingerprints, fingerprint].slice(-2)
    : unit.error_fingerprints;
  unit.stop_reason = stopReason;
  unit.updated_at = now();
  progress.updated_at = unit.updated_at;
  return progress;
}

function reopenAcceptedDomainUnit(current, unitName, error) {
  const progress = cloneProgress(current);
  const unit = progress.units[unitName];
  if (!unit || !unitName.startsWith('distill:') || !['done', 'pending'].includes(unit.status)) {
    throw new GameKbError('DOMAIN_RECOVERY_INVALID', 'Only an accepted domain unit can be reopened', {
      unit: unitName,
      status: unit?.status ?? null
    });
  }
  unit.status = 'pending';
  unit.last_errors = normalizeErrors([error]);
  unit.stop_reason = null;
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
      suggested_action: `Inspect ${unitName}; retry with retry-unit --unit ${unitName} --confirm`
    }));
}

function saveProgress(paths, progress, { updatedAt } = {}) {
  const value = cloneProgress(progress);
  value.updated_at = updatedAt || now();
  for (const unitName of DOMAIN_UNITS) {
    const unit = value.units[unitName];
    if (!unit || !['pending', 'stale', 'manual_review'].includes(unit.status)) continue;
    const attempt = unit.status === 'manual_review'
      ? Math.min(2, unit.attempts)
      : Math.min(2, unit.attempts + 1);
    if (attempt < 1) continue;
    const inputFile = path.join(paths.domainWork, unitName.replaceAll(':', '_'), 'input.json');
    if (fs.existsSync(inputFile)) syncWorkItemAttempt(paths, unitName, attempt);
  }
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

function projectProgressState(paths, manifest) {
  const progress = fs.existsSync(paths.progress) ? readProgress(paths.progress) : freshProgress();
  let changed = !fs.existsSync(paths.progress);
  for (const chapter of manifest.chapters) {
    const unitName = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const existing = progress.units[unitName];
    if (!existing) {
      progress.units[unitName] = freshUnit(chapter.input_hash);
      changed = true;
    } else if (existing.input_hash !== chapter.input_hash) {
      if (isUnattemptedPending(existing)) progress.units[unitName] = freshUnit(chapter.input_hash);
      else rotateUnit(progress, unitName, chapter.input_hash, 'stale');
      changed = true;
    } else if (existing.status === 'stale' && isUnattemptedPending(existing)) {
      progress.units[unitName] = freshUnit(chapter.input_hash);
      changed = true;
    }
  }
  return { progress, changed };
}

function projectProgress(paths, manifest) {
  return projectProgressState(paths, manifest).progress;
}

function loadProgress(paths, manifest) {
  const { progress, changed } = projectProgressState(paths, manifest);
  if (changed || !fs.existsSync(paths.manualReview)) return saveProgress(paths, progress);
  return progress;
}

function resetUnit(current, unitName, confirmed, command = 'reset-unit') {
  if (!confirmed) {
    throw new GameKbError('RESET_CONFIRM_REQUIRED', `${command} requires --confirm`, { unit: unitName });
  }
  const progress = cloneProgress(current);
  const existing = progress.units[unitName];
  if (!existing) throw new GameKbError('UNIT_UNKNOWN', 'Unknown unit', { unit: unitName });
  rotateUnit(progress, unitName, existing.input_hash, 'pending');
  progress.updated_at = now();
  return progress;
}

function statusReport(paths, manifest, progress) {
  const domainUnitSet = new Set(DOMAIN_UNITS);
  const otherUnits = Object.keys(progress.units).filter(name => !name.startsWith('chapter:'));
  const unitNames = [
    ...manifest.chapters.map(chapter => `chapter:${String(chapter.number).padStart(3, '0')}`),
    ...DOMAIN_UNITS.filter(name => Object.hasOwn(progress.units, name)),
    ...otherUnits.filter(name => !domainUnitSet.has(name)).sort()
  ];
  const counts = { pending: 0, done: 0, stale: 0, manual_review: 0 };
  const units = unitNames.map(name => {
    const unit = progress.units[name];
    if (!Object.hasOwn(counts, unit.status)) counts[unit.status] = 0;
    counts[unit.status] += 1;
    return {
      unit: name,
      status: unit.status,
      attempts: unit.attempts,
      input_hash: unit.input_hash
    };
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
  projectProgress,
  recordSubmission,
  reopenAcceptedDomainUnit,
  resetUnit,
  saveProgress,
  setDeterministicUnit,
  setOptionalUnitState,
  syncPlannedUnits,
  statusReport
};
