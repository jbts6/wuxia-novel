'use strict';

const fs = require('node:fs');

const { GameKbError } = require('./errors');
const { assertCurrentWorkerContract } = require('./chapter-worker-contract');
const { stableHash } = require('./io');
const { chapterAttemptPaths } = require('./paths');

const MAX_ACTIVE_UNITS = 5;
const MAX_ATTEMPTS_PER_CYCLE = 2;
const UNIT_STATUSES = new Set(['pending', 'active', 'rejected', 'accepted']);
const PRODUCERS = new Set(['chapter-worker', 'main-agent-repair', 'carry-forward']);

function unitName(number) {
  return `chapter:${String(number).padStart(3, '0')}`;
}

function invariant(message, details = {}) {
  throw new GameKbError('ACTIVE_WINDOW_INVALID', message, details);
}

function manifestUnits(manifest) {
  if (!manifest || !Array.isArray(manifest.chapters)) {
    invariant('Manifest chapters are required');
  }
  const units = manifest.chapters.map(chapter => unitName(chapter.number));
  if (units.some(unit => !/^chapter:\d{3,}$/.test(unit)) || new Set(units).size !== units.length) {
    invariant('Manifest chapter units are invalid or duplicated', { units });
  }
  return units;
}

function emptyUnitState() {
  return {
    status: 'pending',
    cycle: 0,
    attempt: 0,
    producer: null,
    input_hash: null,
    input_file: null,
    output_file: null,
    output_hash: null,
    reject_reason: null,
    repair_allowed: false,
    errors: []
  };
}

function createProgress(manifest) {
  const units = {};
  for (const unit of manifestUnits(manifest)) units[unit] = emptyUnitState();
  return {
    schema_version: 7,
    semantic_contract_version: 7,
    active_units: [],
    units
  };
}

function assertJobMetadata(unitNameValue, state, manifest, paths) {
  if (!PRODUCERS.has(state.producer)
    || typeof state.input_hash !== 'string' || !state.input_hash.startsWith('sha256:')) {
    invariant('Active unit metadata is incomplete', { unit: unitNameValue, state });
  }
  if (state.producer === 'carry-forward') {
    if (state.input_file !== null || state.output_file !== null) {
      invariant('Carry-forward unit must not retain job paths', { unit: unitNameValue, state });
    }
    return;
  }
  if (typeof state.input_file !== 'string' || typeof state.output_file !== 'string') {
    invariant('Active unit job paths are incomplete', { unit: unitNameValue, state });
  }
  if (!paths) return;

  const expected = chapterAttemptPaths(paths, unitNameValue, state.cycle, state.attempt);
  if (state.input_file !== expected.input || state.output_file !== expected.output) {
    invariant('Persisted job paths do not match the selected run', {
      unit: unitNameValue,
      input_file: state.input_file,
      output_file: state.output_file,
      expected_input_file: expected.input,
      expected_output_file: expected.output
    });
  }
  if (!fs.existsSync(state.input_file)) return;
  let input;
  try {
    input = JSON.parse(fs.readFileSync(state.input_file, 'utf8'));
  } catch (error) {
    invariant('Persisted job input is not valid JSON', { unit: unitNameValue, error: error.message });
  }
  if (stableHash(input) !== state.input_hash
    || input.unit !== unitNameValue
    || input.cycle !== state.cycle
    || input.attempt !== state.attempt
    || input.producer !== state.producer
    || input.output_file !== state.output_file) {
    invariant('Persisted job input does not match progress metadata', {
      unit: unitNameValue,
      input_file: state.input_file
    });
  }
  assertCurrentWorkerContract(input.worker_contract, {
    run_id: paths.runId,
    unit: unitNameValue
  });
  if (state.producer === 'chapter-worker') {
    const chapter = manifest.chapters.find(entry => unitName(entry.number) === unitNameValue);
    if (!chapter || input.source_hash !== chapter.input_hash) {
      invariant('Persisted chapter input hash does not match the manifest', {
        unit: unitNameValue,
        source_hash: input.source_hash,
        expected_source_hash: chapter?.input_hash
      });
    }
  }
}

function executionUnits(progress, orderedUnits) {
  if (progress.recovery_units === undefined) return orderedUnits;
  if (!Array.isArray(progress.recovery_units) || progress.recovery_units.length === 0
    || new Set(progress.recovery_units).size !== progress.recovery_units.length) {
    invariant('Recovery units are invalid', { recovery_units: progress.recovery_units });
  }
  const selected = new Set(progress.recovery_units);
  const orderedRecovery = orderedUnits.filter(unit => selected.has(unit));
  if (orderedRecovery.length !== selected.size
    || JSON.stringify(orderedRecovery) !== JSON.stringify(progress.recovery_units)) {
    invariant('Recovery units do not match manifest order', { recovery_units: progress.recovery_units });
  }
  return orderedRecovery;
}

function assertProgressShape(progress, orderedUnits) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)
    || progress.schema_version !== 7 || progress.semantic_contract_version !== 7
    || !progress.units || typeof progress.units !== 'object' || Array.isArray(progress.units)
    || !Array.isArray(progress.active_units)) {
    invariant('Progress shape or semantic contract is invalid');
  }
  if (JSON.stringify(Object.keys(progress.units)) !== JSON.stringify(orderedUnits)) {
    invariant('Progress units do not match the manifest', {
      actual: Object.keys(progress.units), expected: orderedUnits
    });
  }
}

function assertActiveWindow(progress, orderedExecutionUnits) {
  const active = progress.active_units;
  if (active.length > MAX_ACTIVE_UNITS || new Set(active).size !== active.length) {
    invariant('active_units exceeds the fixed window or contains duplicates', { active_units: active });
  }
  const activeIndexes = active.map(unit => orderedExecutionUnits.indexOf(unit));
  if (activeIndexes.some(index => index < 0)) {
    invariant('active_units contains an unknown chapter', { active_units: active });
  }
  if (active.length > 0) {
    const start = activeIndexes[0];
    const expectedWindow = orderedExecutionUnits.slice(start, start + MAX_ACTIVE_UNITS);
    if (start % MAX_ACTIVE_UNITS !== 0
      || JSON.stringify(active) !== JSON.stringify(expectedWindow)) {
      invariant('active_units is not the earliest complete fixed window', {
        active_units: active, expected_window: expectedWindow
      });
    }
  }
  return activeIndexes;
}

function assertUnitStates(progress, manifest, paths, orderedUnits) {
  const active = progress.active_units;
  const activeSet = new Set(active);
  for (const unit of orderedUnits) {
    const state = progress.units[unit];
    if (!state || !UNIT_STATUSES.has(state.status) || !Array.isArray(state.errors)) {
      invariant('Unit state is invalid', { unit, state });
    }
    const inActiveWindow = activeSet.has(unit);
    if (inActiveWindow) {
      if (!['pending', 'active', 'rejected', 'accepted'].includes(state.status)) {
        invariant('Active window contains an invalid state', { unit, status: state.status });
      }
    } else if (state.status === 'active' || state.status === 'rejected') {
      invariant('An unfinished unit exists outside active_units', { unit, status: state.status });
    }

    if (state.status === 'pending') {
      const retryPending = inActiveWindow && state.cycle >= 2 && state.attempt === 0;
      const untouched = !inActiveWindow && state.cycle === 0 && state.attempt === 0;
      if (!retryPending && !untouched) invariant('Pending unit counters are invalid', { unit, state });
      if (state.producer !== null || state.input_hash !== null || state.input_file !== null
        || state.output_file !== null || state.output_hash !== null) {
        invariant('Pending unit retains issued job metadata', { unit, state });
      }
      continue;
    }

    if (!Number.isInteger(state.cycle) || state.cycle < 1
      || !Number.isInteger(state.attempt) || state.attempt < 1
      || state.attempt > MAX_ATTEMPTS_PER_CYCLE) {
      invariant('Unit cycle or attempt is out of range', { unit, state });
    }
    assertJobMetadata(unit, state, manifest, paths);
    if (state.status === 'accepted'
      && (typeof state.output_hash !== 'string' || state.output_hash === '')) {
      invariant('Accepted unit is missing output_hash', { unit });
    }
  }
}

function assertExecutionOrder(progress, orderedExecutionUnits, activeIndexes) {
  const active = progress.active_units;
  if (active.length > 0) {
    const start = activeIndexes[0];
    for (let index = 0; index < start; index += 1) {
      if (progress.units[orderedExecutionUnits[index]].status !== 'accepted') {
        invariant('A later window is active before earlier chapters are accepted', {
          unit: orderedExecutionUnits[index]
        });
      }
    }
    for (let index = start + active.length; index < orderedExecutionUnits.length; index += 1) {
      if (progress.units[orderedExecutionUnits[index]].status !== 'pending') {
        invariant('A chapter after the active window was issued early', {
          unit: orderedExecutionUnits[index]
        });
      }
    }
  } else {
    let pendingSeen = false;
    for (const unit of orderedExecutionUnits) {
      const status = progress.units[unit].status;
      if (status === 'pending') pendingSeen = true;
      else if (status === 'accepted' && pendingSeen) {
        invariant('Accepted chapters are not a contiguous prefix', { unit });
      }
    }
  }
}

function assertProgressInvariant(progress, manifest, paths) {
  const orderedUnits = manifestUnits(manifest);
  assertProgressShape(progress, orderedUnits);
  const orderedExecutionUnits = executionUnits(progress, orderedUnits);
  const activeIndexes = assertActiveWindow(progress, orderedExecutionUnits);
  assertUnitStates(progress, manifest, paths, orderedUnits);
  assertExecutionOrder(progress, orderedExecutionUnits, activeIndexes);
  return true;
}

function requireActiveUnit(progress, event) {
  const unit = progress.units[event.unit];
  if (!unit || !progress.active_units.includes(event.unit)) {
    invariant('Progress event targets a unit outside active_units', { unit: event.unit, type: event.type });
  }
  return unit;
}

function applyIssuedWindow(progress, event) {
  if (!Array.isArray(event.jobs) || event.jobs.length === 0 || event.jobs.length > MAX_ACTIVE_UNITS) {
    invariant('Issued jobs are empty or exceed the fixed window', { jobs: event.jobs });
  }
  for (const job of event.jobs) {
    const state = progress.units[job.unit];
    if (!state) invariant('Issued job has an unknown unit', { unit: job.unit });
    const initial = state.status === 'pending' && state.cycle === 0 && state.attempt === 0;
    const newCycle = state.status === 'pending' && state.cycle >= 2 && state.attempt === 0
      && progress.active_units.includes(job.unit);
    const retry = state.status === 'rejected' && state.attempt === 1
      && progress.active_units.includes(job.unit);
    if (!initial && !newCycle && !retry) {
      invariant('Unit cannot be issued from its current state', { unit: job.unit, state });
    }
    state.status = 'active';
    state.cycle = job.cycle;
    state.attempt = job.attempt;
    state.producer = job.producer;
    state.input_hash = job.input_hash;
    state.input_file = job.input_file;
    state.output_file = job.output_file;
    state.output_hash = null;
    state.reject_reason = null;
    state.repair_allowed = false;
    state.errors = [];
    if (!progress.active_units.includes(job.unit)) progress.active_units.push(job.unit);
  }
}

function applyAccepted(progress, event) {
  const unit = requireActiveUnit(progress, event);
  if (unit.status !== 'active' || typeof event.output_hash !== 'string' || event.output_hash === '') {
    invariant('Only an active unit with output_hash can be accepted', { unit: event.unit });
  }
  unit.status = 'accepted';
  unit.output_hash = event.output_hash;
  if (progress.active_units.every(name => progress.units[name].status === 'accepted')) {
    progress.active_units = [];
  }
}

function applyRejected(progress, event) {
  const unit = requireActiveUnit(progress, event);
  if (unit.status !== 'active') invariant('Only an active unit can be rejected', { unit: event.unit });
  unit.status = 'rejected';
  unit.reject_reason = event.reason || null;
  unit.repair_allowed = event.repair_allowed === true;
  unit.errors = Array.isArray(event.errors) ? structuredClone(event.errors) : [];
}

function applyNewCycle(progress, event) {
  const unit = requireActiveUnit(progress, event);
  if (unit.status !== 'rejected' || unit.attempt !== MAX_ATTEMPTS_PER_CYCLE) {
    invariant('retry-unit requires a unit stopped after attempt two', { unit: event.unit, state: unit });
  }
  const nextCycle = unit.cycle + 1;
  Object.assign(unit, emptyUnitState(), { cycle: nextCycle });
}

function transitionProgress(current, event) {
  if (!event?.manifest) invariant('Progress transition requires the current manifest');
  assertProgressInvariant(current, event.manifest, event.paths);
  const next = structuredClone(current);
  if (event.type === 'issue-window') applyIssuedWindow(next, event);
  else if (event.type === 'accepted') applyAccepted(next, event);
  else if (event.type === 'rejected') applyRejected(next, event);
  else if (event.type === 'retry-unit') applyNewCycle(next, event);
  else throw new GameKbError('PROGRESS_EVENT_INVALID', 'Unknown progress transition', { type: event.type });
  assertProgressInvariant(next, event.manifest, event.paths);
  return next;
}

module.exports = {
  MAX_ACTIVE_UNITS,
  MAX_ATTEMPTS_PER_CYCLE,
  assertProgressInvariant,
  createProgress,
  transitionProgress
};
