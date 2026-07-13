#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const {
  PipelineError,
  sha256,
  stableStringify,
  writeJsonLinesAtomic
} = require('./atomic-json');

const EVENT_TYPES = Object.freeze([
  'run_initialized',
  'stage_started',
  'work_items_created',
  'work_item_claimed',
  'work_item_lease_expired',
  'work_item_submission_rejected',
  'work_item_accepted',
  'stage_gate_failed',
  'stage_passed',
  'review_requested',
  'review_recorded',
  'downstream_invalidated',
  'publish_bundle_built',
  'bundle_promoted',
  'bundle_rolled_back'
]);

const EVENT_TYPE_SET = new Set(EVENT_TYPES);

const ERROR_CODES = Object.freeze({
  EVENT_HASH_MISMATCH: 'EVENT_HASH_MISMATCH',
  EVENT_LOG_INVALID: 'EVENT_LOG_INVALID',
  EVENT_SEQUENCE_INVALID: 'EVENT_SEQUENCE_INVALID',
  INVALID_EVENT: 'INVALID_EVENT',
  INVALID_STAGE_TRANSITION: 'INVALID_STAGE_TRANSITION',
  PATH_OUTSIDE_RUN: 'PATH_OUTSIDE_RUN',
  RUN_ALREADY_EXISTS: 'RUN_ALREADY_EXISTS',
  RUN_LOCKED: 'RUN_LOCKED',
  RUN_NOT_FOUND: 'RUN_NOT_FOUND'
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function eventHashInput(event) {
  const { event_hash: ignored, ...body } = event;
  return body;
}

function decodeEvent(value, line = null) {
  const invalid = message => {
    throw new PipelineError(
      ERROR_CODES.INVALID_EVENT,
      line === null ? message : `events.jsonl:${line}: ${message}`
    );
  };
  if (!isPlainObject(value)) invalid('event must be an object');
  if (value.schema_version !== 1) invalid('schema_version must be 1');
  if (!Number.isInteger(value.seq) || value.seq < 1) invalid('seq must be a positive integer');
  for (const key of ['event_id', 'run_id', 'occurred_at', 'type', 'event_hash']) {
    if (typeof value[key] !== 'string' || value[key].length === 0) invalid(`${key} must be a string`);
  }
  if (!EVENT_TYPE_SET.has(value.type)) invalid(`unknown event type ${JSON.stringify(value.type)}`);
  if (!isPlainObject(value.payload)) invalid('payload must be an object');
  if (value.prev_event_hash !== null && typeof value.prev_event_hash !== 'string') {
    invalid('prev_event_hash must be null or a string');
  }
  return value;
}

function createEvent({ runId, type, payload = {}, previous = null, now = new Date(), eventId = null }) {
  if (!EVENT_TYPE_SET.has(type)) {
    throw new PipelineError(ERROR_CODES.INVALID_EVENT, `Unknown event type: ${type}`);
  }
  const seq = previous ? previous.seq + 1 : 1;
  const event = {
    schema_version: 1,
    seq,
    event_id: eventId || `${runId}:${String(seq).padStart(12, '0')}`,
    run_id: runId,
    occurred_at: (now instanceof Date ? now : new Date(now)).toISOString(),
    type,
    payload,
    prev_event_hash: previous ? previous.event_hash : null
  };
  event.event_hash = sha256(stableStringify(event));
  return decodeEvent(event);
}

function verifyEventChain(events) {
  let previous = null;
  let runId = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = decodeEvent(events[index], index + 1);
    const expectedSeq = index + 1;
    if (event.seq !== expectedSeq || (previous && event.prev_event_hash !== previous.event_hash)) {
      throw new PipelineError(
        ERROR_CODES.EVENT_SEQUENCE_INVALID,
        `Invalid event chain at seq ${event.seq}; expected ${expectedSeq}`
      );
    }
    if (runId !== null && event.run_id !== runId) {
      throw new PipelineError(ERROR_CODES.EVENT_SEQUENCE_INVALID, 'Event log mixes run IDs');
    }
    const expectedHash = sha256(stableStringify(eventHashInput(event)));
    if (event.event_hash !== expectedHash) {
      throw new PipelineError(
        ERROR_CODES.EVENT_HASH_MISMATCH,
        `Event hash mismatch at seq ${event.seq}`
      );
    }
    runId = event.run_id;
    previous = event;
  }
  return events;
}

function readEventLog(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  const events = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    if (!rawLine.trim()) continue;
    try {
      events.push(JSON.parse(rawLine));
    } catch (error) {
      throw new PipelineError(
        ERROR_CODES.EVENT_LOG_INVALID,
        `events.jsonl:${index + 1}: invalid JSON: ${error.message}`
      );
    }
  }
  return verifyEventChain(events);
}

function writeEventLog(filePath, events) {
  verifyEventChain(events);
  writeJsonLinesAtomic(filePath, events);
}

module.exports = {
  ERROR_CODES,
  EVENT_TYPES,
  PipelineError,
  createEvent,
  decodeEvent,
  readEventLog,
  verifyEventChain,
  writeEventLog
};
