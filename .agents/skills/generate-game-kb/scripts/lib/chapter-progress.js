'use strict';

const { GameKbError } = require('./errors');

const MAX_ACTIVE_UNITS = 5;
const MAX_ATTEMPTS_PER_CYCLE = 2;

function createProgress(manifest) {
  const units = {};
  for (const chapter of manifest.chapters) {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    units[unit] = { status: 'pending', cycle: 0, attempt: 0, output_hash: null };
  }
  return { schema_version: 7, active_units: [], units };
}

function assertProgressInvariant(progress, manifest) {
  const active = progress.active_units;
  if (active.length > MAX_ACTIVE_UNITS) {
    throw new GameKbError('PROGRESS_INVARIANT_VIOLATION', `active_units exceeds ${MAX_ACTIVE_UNITS}`, {
      active_units: active
    });
  }
  if (new Set(active).size !== active.length) {
    throw new GameKbError('PROGRESS_INVARIANT_VIOLATION', 'duplicate active_units', { active_units: active });
  }
  for (const unit of active) {
    const state = progress.units[unit];
    if (!state) {
      throw new GameKbError('PROGRESS_INVARIANT_VIOLATION', `active unit not in units map: ${unit}`, { unit });
    }
    if (state.attempt < 1 || state.attempt > MAX_ATTEMPTS_PER_CYCLE) {
      throw new GameKbError('PROGRESS_INVARIANT_VIOLATION', `attempt out of range for ${unit}`, {
        unit, attempt: state.attempt
      });
    }
    if (state.cycle < 1) {
      throw new GameKbError('PROGRESS_INVARIANT_VIOLATION', `cycle below 1 for ${unit}`, {
        unit, cycle: state.cycle
      });
    }
  }
}

function applyIssuedWindow(progress, jobs) {
  for (const job of jobs) {
    const state = progress.units[job.unit];
    state.status = 'active';
    state.cycle = job.cycle;
    state.attempt = job.attempt;
    if (!progress.active_units.includes(job.unit)) {
      progress.active_units.push(job.unit);
    }
  }
}

function applyAccepted(progress, unit, event) {
  unit.status = 'accepted';
  unit.output_hash = event.output_hash;
  const allDone = progress.active_units.every(u => progress.units[u].status === 'accepted');
  if (allDone) progress.active_units = [];
}

function applyRejected(progress, unit, event) {
  unit.status = 'rejected';
  unit.reject_reason = event.reason || null;
  unit.repair_allowed = event.repair_allowed || false;
}

function applyNewCycle(progress, unit, event) {
  unit.status = 'pending';
  unit.cycle += 1;
  unit.attempt = 0;
  unit.output_hash = null;
  unit.reject_reason = null;
  unit.repair_allowed = false;
  progress.active_units = progress.active_units.filter(u => u !== event.unit);
}

function transitionProgress(current, event) {
  const next = structuredClone(current);
  const unit = event.unit ? next.units[event.unit] : null;
  if (event.type === 'issue-window') applyIssuedWindow(next, event.jobs);
  else if (event.type === 'accepted') applyAccepted(next, unit, event);
  else if (event.type === 'rejected') applyRejected(next, unit, event);
  else if (event.type === 'retry-unit') applyNewCycle(next, unit, event);
  else throw new GameKbError('PROGRESS_EVENT_INVALID', 'Unknown progress transition', { type: event.type });
  if (event.manifest) assertProgressInvariant(next, event.manifest);
  return next;
}

module.exports = { MAX_ACTIVE_UNITS, MAX_ATTEMPTS_PER_CYCLE, assertProgressInvariant, createProgress, transitionProgress };
