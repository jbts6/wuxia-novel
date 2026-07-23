'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson } = require('./io');
const { repositoryRootFor } = require('./paths');
const { isRootTempName } = require('./root-temp-guard');

const BASELINE_VERSION = 1;

function guardFailure(message, error, details = {}) {
  throw new GameKbError('WORKER_SIDE_EFFECT_GUARD_FAILED', message, {
    ...details,
    error: error?.message || String(error)
  });
}

function rootTempEntries(repositoryRoot) {
  return fs.readdirSync(repositoryRoot, { withFileTypes: true })
    .map(entry => entry.name)
    .filter(isRootTempName)
    .sort();
}

/** Capture root temp names that predate a newly created run. */
function captureWorkerRootBaseline(paths) {
  const repositoryRoot = repositoryRootFor(paths.novel);
  try {
    atomicWriteJson(paths.workerRootBaseline, {
      version: BASELINE_VERSION,
      repository_root: repositoryRoot,
      entries: rootTempEntries(repositoryRoot)
    });
  } catch (error) {
    guardFailure('Cannot capture the Worker root side-effect baseline', error, {
      baseline_file: paths.workerRootBaseline
    });
  }
}

function readBaseline(paths, repositoryRoot) {
  try {
    const baseline = readJson(paths.workerRootBaseline);
    if (baseline.version !== BASELINE_VERSION
      || path.resolve(baseline.repository_root) !== path.resolve(repositoryRoot)
      || !Array.isArray(baseline.entries)
      || baseline.entries.some(name => typeof name !== 'string')) {
      throw new Error('baseline shape does not match the current repository');
    }
    return new Set(baseline.entries);
  } catch (error) {
    guardFailure('Cannot read the Worker root side-effect baseline', error, {
      baseline_file: paths.workerRootBaseline
    });
  }
}

function outputsReady(progress) {
  if (!Array.isArray(progress.active_units) || progress.active_units.length === 0) return false;
  return progress.active_units.every(unit => {
    const state = progress.units[unit];
    return state.status !== 'active'
      || (typeof state.output_file === 'string' && fs.existsSync(state.output_file));
  });
}

function reportQuarantineFailure({
  incidentRoot, incidentFile, repositoryRoot, names, moved, failedPath, error
}) {
  try {
    atomicWriteJson(incidentFile, {
      code: 'WORKER_SIDE_EFFECT_GUARD_FAILED',
      status: 'failed',
      repository_root: repositoryRoot,
      paths: names,
      moved,
      failed_path: failedPath,
      error: error.message
    });
  } catch (receiptError) {
    guardFailure('Cannot record a failed Worker root side-effect quarantine', receiptError, {
      incident_root: incidentRoot,
      paths: names,
      moved,
      failed_path: failedPath,
      original_error: error.message
    });
  }
  guardFailure('Cannot quarantine Worker root side effects', error, {
    incident_root: incidentRoot,
    incident_file: incidentFile,
    paths: names,
    moved,
    failed_path: failedPath
  });
}

function quarantine(paths, repositoryRoot, names) {
  const incidentRoot = path.join(
    paths.workerLeaks,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`
  );
  const incidentFile = path.join(incidentRoot, 'incident.json');
  const moved = [];
  let failedPath = null;
  try {
    fs.mkdirSync(incidentRoot, { recursive: true });
    for (const name of names) {
      failedPath = name;
      fs.renameSync(path.join(repositoryRoot, name), path.join(incidentRoot, name));
      moved.push(name);
    }
    atomicWriteJson(incidentFile, {
      code: 'WORKER_SIDE_EFFECT_QUARANTINED',
      status: 'quarantined',
      repository_root: repositoryRoot,
      paths: moved
    });
    return { incidentFile, moved };
  } catch (error) {
    reportQuarantineFailure({
      incidentRoot,
      incidentFile,
      repositoryRoot,
      names,
      moved,
      failedPath,
      error
    });
  }
}

/** Quarantine new run-local root temp files once active outputs are ready. */
function reconcileWorkerRootTemps(paths, progress) {
  if (!outputsReady(progress)) return [];
  const repositoryRoot = repositoryRootFor(paths.novel);
  const baseline = readBaseline(paths, repositoryRoot);
  let newEntries;
  try {
    newEntries = rootTempEntries(repositoryRoot).filter(name => !baseline.has(name));
  } catch (error) {
    guardFailure('Cannot inspect repository-root Worker side effects', error, {
      repository_root: repositoryRoot
    });
  }
  if (newEntries.length === 0) return [];
  const incident = quarantine(paths, repositoryRoot, newEntries);
  return [{
    code: 'WORKER_SIDE_EFFECT_QUARANTINED',
    paths: incident.moved,
    incident_file: path.relative(paths.run, incident.incidentFile).replaceAll('\\', '/')
  }];
}

module.exports = { captureWorkerRootBaseline, reconcileWorkerRootTemps };
