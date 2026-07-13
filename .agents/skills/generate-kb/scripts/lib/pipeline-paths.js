#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  PipelineError,
  resolveInside,
  writeJsonAtomic
} = require('./atomic-json');

const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function assertManagedSegment(value, label) {
  if (typeof value !== 'string' || !SEGMENT_PATTERN.test(value) || value === '..') {
    throw new PipelineError('INVALID_MANAGED_SEGMENT', `Invalid ${label}: ${JSON.stringify(value)}`);
  }
  return value;
}

function getPipelinePaths(novelDir, runId) {
  const novelRoot = path.resolve(novelDir);
  const pipelineRoot = resolveInside(novelRoot, 'build', 'generate-kb');
  const runsDir = resolveInside(pipelineRoot, 'runs');
  const paths = {
    novelRoot,
    pipelineRoot,
    activeRun: resolveInside(pipelineRoot, 'active-run.json'),
    runsDir
  };
  if (runId === undefined || runId === null) return paths;

  assertManagedSegment(runId, 'run ID');
  const runDir = resolveInside(runsDir, runId);
  return {
    ...paths,
    runId,
    runDir,
    config: resolveInside(runDir, 'config.json'),
    events: resolveInside(runDir, 'events.jsonl'),
    state: resolveInside(runDir, 'state.json'),
    locks: resolveInside(runDir, 'locks'),
    runLock: resolveInside(runDir, 'locks', 'run.lock'),
    source: resolveInside(runDir, 'source'),
    workItems: resolveInside(runDir, 'work-items'),
    materialized: resolveInside(runDir, 'materialized'),
    review: resolveInside(runDir, 'review'),
    publish: resolveInside(runDir, 'publish')
  };
}

function ensureRunDirectories(paths) {
  for (const key of ['pipelineRoot', 'runsDir', 'runDir', 'locks', 'source', 'workItems', 'materialized', 'review', 'publish']) {
    fs.mkdirSync(paths[key], { recursive: true });
  }
}

function setActiveRun(paths, runId, updatedAt) {
  writeJsonAtomic(paths.activeRun, {
    schema_version: 1,
    run_id: runId,
    updated_at: updatedAt
  });
}

module.exports = {
  assertManagedSegment,
  ensureRunDirectories,
  getPipelinePaths,
  setActiveRun
};
