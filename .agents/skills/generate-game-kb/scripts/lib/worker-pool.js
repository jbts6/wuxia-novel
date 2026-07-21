'use strict';

const fs = require('node:fs');

const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson } = require('./io');

// Plain concurrency counter. The controller (AI) dispatches per-chapter
// sub-agents; on a 429 it drops from the initial limit to the fallback. No
// batching, no guard, no automatic backoff daemon — the script only records
// the agreed limits so progress and reports stay consistent.
const INITIAL_CONCURRENCY_LIMIT = 5;
const FALLBACK_CONCURRENCY_LIMIT = 3;

function now() {
  return new Date().toISOString();
}

function freshWorkerPool() {
  return {
    schema_version: 1,
    initial_limit: INITIAL_CONCURRENCY_LIMIT,
    concurrency_limit: INITIAL_CONCURRENCY_LIMIT,
    updated_at: now()
  };
}

function validateWorkerPool(value, file) {
  const valid = value
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.schema_version === 1
    && value.initial_limit === INITIAL_CONCURRENCY_LIMIT
    && [INITIAL_CONCURRENCY_LIMIT, FALLBACK_CONCURRENCY_LIMIT].includes(value.concurrency_limit)
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

function recordExplicit429(paths, options = {}) {
  if (String(options.reason) !== '429') {
    throw new GameKbError(
      'WORKER_BACKOFF_REASON_INVALID',
      'Concurrency fallback accepts only an explicit 429 response',
      { reason: options.reason ?? null }
    );
  }
  const state = structuredClone(readWorkerPool(paths));
  if (state.concurrency_limit === FALLBACK_CONCURRENCY_LIMIT) {
    return { changed: false, worker_pool: state };
  }
  state.concurrency_limit = FALLBACK_CONCURRENCY_LIMIT;
  state.updated_at = now();
  atomicWriteJson(paths.workerPool, state);
  return { changed: true, worker_pool: state };
}

module.exports = {
  FALLBACK_CONCURRENCY_LIMIT,
  INITIAL_CONCURRENCY_LIMIT,
  ensureWorkerPool,
  freshWorkerPool,
  readWorkerPool,
  recordExplicit429
};
