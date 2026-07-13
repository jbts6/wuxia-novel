#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const {
  PipelineError,
  readJson,
  stableStringify,
  writeJsonAtomic
} = require('./atomic-json');
const {
  createEvent,
  readEventLog,
  writeEventLog
} = require('./pipeline-events');
const {
  replayPipelineEvents,
  reducePipelineEvent
} = require('./pipeline-reducer');
const {
  ensureRunDirectories,
  getPipelinePaths,
  setActiveRun
} = require('./pipeline-paths');

function normalizeConfig(config) {
  const maxWorkers = config?.max_workers ?? 1;
  const riskLimit = config?.risk_limit ?? 15;
  if (!Number.isInteger(maxWorkers) || maxWorkers < 1 || maxWorkers > 4) {
    throw new PipelineError('INVALID_CONFIG', 'max_workers must be an integer from 1 to 4');
  }
  if (!Number.isInteger(riskLimit) || riskLimit < 1 || riskLimit > 15) {
    throw new PipelineError('INVALID_CONFIG', 'risk_limit must be an integer from 1 to 15');
  }
  return {
    schema_version: 1,
    ...config,
    max_workers: maxWorkers,
    risk_limit: riskLimit
  };
}

function withRunLock(paths, callback) {
  try {
    fs.mkdirSync(paths.runLock);
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new PipelineError('RUN_LOCKED', `Pipeline run is locked: ${paths.runId}`);
    }
    throw error;
  }
  try {
    return callback();
  } finally {
    fs.rmSync(paths.runLock, { recursive: true, force: true });
  }
}

function initializePipelineRun(novelDir, { runId, config = {}, now = new Date() }) {
  const paths = getPipelinePaths(novelDir, runId);
  if (fs.existsSync(paths.events)) {
    throw new PipelineError('RUN_ALREADY_EXISTS', `Pipeline run already exists: ${runId}`);
  }
  ensureRunDirectories(paths);
  return withRunLock(paths, () => {
    const normalizedConfig = normalizeConfig(config);
    const event = createEvent({
      runId,
      type: 'run_initialized',
      payload: { config: normalizedConfig },
      now
    });
    const state = reducePipelineEvent(null, event);
    writeJsonAtomic(paths.config, normalizedConfig);
    writeEventLog(paths.events, [event]);
    writeJsonAtomic(paths.state, state);
    setActiveRun(paths, runId, event.occurred_at);
    return state;
  });
}

function loadPipelineState(novelDir, runId) {
  const paths = getPipelinePaths(novelDir, runId);
  const events = readEventLog(paths.events);
  if (events.length === 0) {
    throw new PipelineError('RUN_NOT_FOUND', `Pipeline run does not exist: ${runId}`);
  }
  const rebuilt = replayPipelineEvents(events);
  const cached = readJson(paths.state, null);
  if (cached === null || stableStringify(cached) !== stableStringify(rebuilt)) {
    writeJsonAtomic(paths.state, rebuilt);
  }
  return rebuilt;
}

function loadActiveRun(novelDir) {
  const paths = getPipelinePaths(novelDir);
  const active = readJson(paths.activeRun, null);
  if (!active || typeof active.run_id !== 'string') {
    throw new PipelineError('RUN_NOT_FOUND', `No active pipeline run in ${paths.pipelineRoot}`);
  }
  return active;
}

function loadActivePipelineState(novelDir) {
  const active = loadActiveRun(novelDir);
  return loadPipelineState(novelDir, active.run_id);
}

function appendPipelineEvent(novelDir, runId, type, payload = {}, options = {}) {
  const paths = getPipelinePaths(novelDir, runId);
  if (!fs.existsSync(paths.runDir)) {
    throw new PipelineError('RUN_NOT_FOUND', `Pipeline run does not exist: ${runId}`);
  }
  return withRunLock(paths, () => {
    const events = readEventLog(paths.events);
    if (events.length === 0) {
      throw new PipelineError('RUN_NOT_FOUND', `Pipeline run does not exist: ${runId}`);
    }
    const currentState = replayPipelineEvents(events);
    const event = createEvent({
      runId,
      type,
      payload,
      previous: events[events.length - 1],
      now: options.now || new Date(),
      eventId: options.eventId || null
    });
    const nextState = reducePipelineEvent(currentState, event);
    if (typeof options.beforeCommit === 'function') {
      options.beforeCommit({
        currentState,
        event,
        nextState,
        paths
      });
    }
    writeEventLog(paths.events, [...events, event]);
    writeJsonAtomic(paths.state, nextState);
    setActiveRun(paths, runId, event.occurred_at);
    return nextState;
  });
}

module.exports = {
  appendPipelineEvent,
  initializePipelineRun,
  loadActivePipelineState,
  loadActiveRun,
  loadPipelineState,
  normalizeConfig,
  withRunLock
};
