'use strict';

const fs = require('node:fs');

const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson } = require('./io');

const INITIAL_CONCURRENCY_LIMIT = 10;

function now() {
  return new Date().toISOString();
}

function freshWorkerPool() {
  return {
    schema_version: 1,
    initial_limit: INITIAL_CONCURRENCY_LIMIT,
    concurrency_limit: INITIAL_CONCURRENCY_LIMIT,
    halted: false,
    incidents: [],
    updated_at: now()
  };
}

function validateWorkerPool(value, file) {
  const valid = value
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.schema_version === 1
    && value.initial_limit === INITIAL_CONCURRENCY_LIMIT
    && Number.isInteger(value.concurrency_limit)
    && value.concurrency_limit >= 1
    && value.concurrency_limit <= INITIAL_CONCURRENCY_LIMIT
    && typeof value.halted === 'boolean'
    && Array.isArray(value.incidents)
    && typeof value.updated_at === 'string';
  if (!valid) {
    throw new GameKbError('WORKER_POOL_CORRUPT', 'Chapter-worker concurrency state is invalid', { file });
  }
  return value;
}

function readWorkerPool(paths) {
  try {
    return validateWorkerPool(readJson(paths.workerPool), paths.workerPool);
  } catch (error) {
    if (error instanceof GameKbError) throw error;
    throw new GameKbError('WORKER_POOL_CORRUPT', 'Chapter-worker concurrency state cannot be read safely', {
      file: paths.workerPool,
      cause: error.message
    });
  }
}

function ensureWorkerPool(paths) {
  if (fs.existsSync(paths.workerPool)) return readWorkerPool(paths);
  const state = freshWorkerPool();
  atomicWriteJson(paths.workerPool, state);
  return state;
}

function assertBatchId(batchId) {
  if (typeof batchId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(batchId)) {
    throw new GameKbError('WORKER_BATCH_REQUIRED', 'worker-backoff requires a safe --batch <id>');
  }
  return batchId;
}

function recordWorkerBackoff(paths, options = {}) {
  const batchId = assertBatchId(options.batchId);
  if (String(options.reason) !== '429') {
    throw new GameKbError('WORKER_BACKOFF_REASON_INVALID', 'worker-backoff accepts only an explicit 429 response', {
      reason: options.reason ?? null
    });
  }

  const state = structuredClone(readWorkerPool(paths));
  if (state.incidents.some(incident => incident.batch_id === batchId)) {
    return { duplicate: true, worker_pool: state };
  }
  if (state.halted) {
    throw new GameKbError('WORKER_RATE_LIMITED', 'Chapter workers are halted after persistent 429 responses', {
      worker_pool: state
    });
  }

  const previousLimit = state.concurrency_limit;
  const nextLimit = Math.max(1, Math.floor(previousLimit / 2));
  const halted = previousLimit === 1;
  const recordedAt = now();
  state.concurrency_limit = nextLimit;
  state.halted = halted;
  state.incidents.push({
    batch_id: batchId,
    reason: '429',
    previous_limit: previousLimit,
    next_limit: nextLimit,
    action: halted ? 'halted' : 'reduced',
    recorded_at: recordedAt
  });
  state.updated_at = recordedAt;
  atomicWriteJson(paths.workerPool, state);

  if (halted) {
    throw new GameKbError('WORKER_RATE_LIMITED', 'Concurrency one still received 429; stop and report external rate limiting', {
      worker_pool: state
    });
  }
  return { duplicate: false, worker_pool: state };
}

module.exports = {
  INITIAL_CONCURRENCY_LIMIT,
  ensureWorkerPool,
  freshWorkerPool,
  readWorkerPool,
  recordWorkerBackoff
};
