'use strict';

const fs = require('node:fs');

const { GameKbError } = require('./errors');
const { atomicWriteFile, stableHash } = require('./io');

const TIMING_CONTRACT_VERSION = 1;
const EVENT_SCHEMA_VERSION = 1;
const SIMPLE_EVENT_TYPES = new Set([
  'run_started',
  'source_prepare_started',
  'source_prepared'
]);
const WINDOW_EVENT_TYPES = new Set(['window_issued', 'window_closed']);
const UNIT_EVENT_TYPES = new Set([
  'attempt_issued',
  'attempt_observed',
  'attempt_accepted',
  'attempt_rejected',
  'manual_review_entered',
  'manual_review_resumed'
]);
const PHASE_EVENT_TYPES = new Set(['phase_started', 'phase_completed']);
const PHASES = new Set(['assemble', 'verify', 'install', 'archive']);
const BASE_FIELDS = ['schema_version', 'sequence', 'event_key', 'type', 'occurred_at'];

function timingError(message, details = {}) {
  return new GameKbError('TIMING_EVENTS_INVALID', message, details);
}

function canonicalUtc(value) {
  const text = value instanceof Date ? value.toISOString() : value;
  if (typeof text !== 'string') throw timingError('Timing event timestamp must be UTC ISO 8601');
  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== text) {
    throw timingError('Timing event timestamp must be canonical UTC ISO 8601', { occurred_at: text });
  }
  return text;
}

function bindingFields(event) {
  if (SIMPLE_EVENT_TYPES.has(event.type)) return [];
  if (WINDOW_EVENT_TYPES.has(event.type)) {
    if (!Number.isInteger(event.window_sequence) || event.window_sequence < 1) {
      throw timingError('Window event requires a positive window_sequence');
    }
    return ['window_sequence'];
  }
  if (UNIT_EVENT_TYPES.has(event.type)) {
    if (typeof event.unit !== 'string' || !/^chapter:\d{3,}$/.test(event.unit)) {
      throw timingError('Unit event requires a chapter unit', { unit: event.unit });
    }
    if (!Number.isInteger(event.cycle) || event.cycle < 1
      || !Number.isInteger(event.attempt) || event.attempt < 1) {
      throw timingError('Unit event requires positive cycle and attempt values');
    }
    if (typeof event.producer !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(event.producer)) {
      throw timingError('Unit event requires a safe producer', { producer: event.producer });
    }
    return ['unit', 'cycle', 'attempt', 'producer'];
  }
  if (PHASE_EVENT_TYPES.has(event.type)) {
    if (!PHASES.has(event.phase)) throw timingError('Phase event requires a supported phase', { phase: event.phase });
    return ['phase'];
  }
  throw timingError('Timing event type is unsupported', { type: event.type });
}

function timingEventKey(event) {
  const type = event.type.replaceAll('_', '-');
  if (SIMPLE_EVENT_TYPES.has(event.type)) return type;
  if (WINDOW_EVENT_TYPES.has(event.type)) return `${type}:${event.window_sequence}`;
  if (UNIT_EVENT_TYPES.has(event.type)) {
    return `${type}:${event.unit}:${event.cycle}:${event.attempt}`;
  }
  if (PHASE_EVENT_TYPES.has(event.type)) return `${type}:${event.phase}`;
  throw timingError('Timing event type is unsupported', { type: event.type });
}

function semanticPayload(event, strict = false) {
  const fields = bindingFields(event);
  if (strict) {
    const actual = Object.keys(event).sort();
    const expected = ['type', ...fields].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw timingError('Timing event input contains writer-owned or unrelated fields', {
        actual, expected
      });
    }
  }
  return Object.fromEntries(['type', ...fields].map(field => [field, event[field]]));
}

function assertExactFields(event, fields) {
  const actual = Object.keys(event).sort();
  const expected = [...BASE_FIELDS, ...fields].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw timingError('Timing event fields do not match its type', { actual, expected });
  }
}

function validatePersistedEvent(event, index, previousAt, seenKeys) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw timingError('Timing event line must contain an object', { sequence: index + 1 });
  }
  const fields = bindingFields(event);
  assertExactFields(event, fields);
  if (event.schema_version !== EVENT_SCHEMA_VERSION || event.sequence !== index + 1) {
    throw timingError('Timing event schema or sequence is invalid', { sequence: event.sequence });
  }
  const occurredAt = canonicalUtc(event.occurred_at);
  if (previousAt && occurredAt < previousAt) {
    throw timingError('Timing event timestamps must not move backwards', { sequence: event.sequence });
  }
  const expectedKey = timingEventKey(event);
  if (event.event_key !== expectedKey || seenKeys.has(event.event_key)) {
    throw timingError('Timing event key is invalid or duplicated', { event_key: event.event_key });
  }
  seenKeys.add(event.event_key);
  return occurredAt;
}

function predecessorKey(event) {
  const suffix = `${event.unit}:${event.cycle}:${event.attempt}`;
  if (event.type === 'source_prepared') return 'source-prepare-started';
  if (event.type === 'window_closed') return `window-issued:${event.window_sequence}`;
  if (event.type === 'attempt_observed') return `attempt-issued:${suffix}`;
  if (event.type === 'attempt_accepted' || event.type === 'attempt_rejected') {
    return `attempt-observed:${suffix}`;
  }
  if (event.type === 'manual_review_entered') return `attempt-rejected:${suffix}`;
  if (event.type === 'manual_review_resumed') return `manual-review-entered:${suffix}`;
  if (event.type === 'phase_completed') return `phase-started:${event.phase}`;
  return null;
}

function assertLifecyclePredecessor(events, event) {
  const required = predecessorKey(event);
  if (required && !events.some(previous => previous.event_key === required)) {
    throw timingError('Timing event is missing its lifecycle predecessor', {
      event_key: timingEventKey(event),
      required_event_key: required
    });
  }
  if (event.type === 'attempt_accepted' || event.type === 'attempt_rejected') {
    const opposite = event.type === 'attempt_accepted' ? 'attempt-rejected' : 'attempt-accepted';
    const suffix = `${event.unit}:${event.cycle}:${event.attempt}`;
    if (events.some(previous => previous.event_key === `${opposite}:${suffix}`)) {
      throw timingError('Observed attempt must have exactly one terminal decision', {
        event_key: timingEventKey(event),
        conflicting_event_key: `${opposite}:${suffix}`
      });
    }
  }
}

function readTimingEvents(file) {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8');
  if (!content || !content.endsWith('\n')) throw timingError('Timing event file has a partial final line', { file });
  const lines = content.slice(0, -1).split('\n');
  if (lines.some(line => !line)) throw timingError('Timing event file contains a blank line', { file });
  const events = [];
  const seenKeys = new Set();
  let previousAt = null;
  for (const [index, line] of lines.entries()) {
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      throw timingError('Timing event line is not valid JSON', { sequence: index + 1, cause: error.message });
    }
    previousAt = validatePersistedEvent(event, index, previousAt, seenKeys);
    assertLifecyclePredecessor(events, event);
    events.push(event);
  }
  if (events[0]?.type !== 'run_started') {
    throw timingError('Timing event lifecycle must begin with run_started', { file });
  }
  return events;
}

function appendTimingEvent(file, input, options = {}) {
  const payload = semanticPayload(input, true);
  const eventKey = timingEventKey(payload);
  const events = readTimingEvents(file);
  if (events.length === 0 && payload.type !== 'run_started') {
    throw timingError('Timing event lifecycle must begin with run_started', { event_key: eventKey });
  }
  const existing = events.find(event => event.event_key === eventKey);
  if (existing) {
    if (JSON.stringify(semanticPayload(existing)) !== JSON.stringify(payload)) {
      throw new GameKbError('TIMING_EVENT_CONFLICT', 'Timing event key already has different data', {
        event_key: eventKey
      });
    }
    return { appended: false, event: existing };
  }
  assertLifecyclePredecessor(events, payload);
  const now = options.now ? options.now() : new Date();
  const occurredAt = canonicalUtc(options.occurredAt ?? now);
  const previous = events.at(-1);
  const event = {
    schema_version: EVENT_SCHEMA_VERSION,
    sequence: events.length + 1,
    event_key: eventKey,
    type: payload.type,
    occurred_at: occurredAt,
    ...Object.fromEntries(Object.keys(payload).slice(1).map(field => [field, payload[field]]))
  };
  validatePersistedEvent(event, events.length, previous?.occurred_at, new Set(events.map(item => item.event_key)));
  const content = `${events.map(item => JSON.stringify(item)).concat(JSON.stringify(event)).join('\n')}\n`;
  (options.writeFile || atomicWriteFile)(file, content);
  return { appended: true, event };
}

function timingEventsHash(file) {
  readTimingEvents(file);
  return stableHash(fs.readFileSync(file, 'utf8'));
}

function recordRunTimingEvent(paths, input, options = {}) {
  if (!paths?.runJson || !fs.existsSync(paths.runJson)) return { appended: false, event: null };
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(paths.runJson, 'utf8'));
  } catch (error) {
    throw timingError('Run metadata cannot be read for timing events', { cause: error.message });
  }
  if (metadata.timing_contract_version === undefined) return { appended: false, event: null };
  if (metadata.timing_contract_version !== TIMING_CONTRACT_VERSION) {
    throw new GameKbError('TIMING_CONTRACT_UNSUPPORTED', 'Timing contract version is unsupported', {
      timing_contract_version: metadata.timing_contract_version
    });
  }
  return appendTimingEvent(paths.events, input, options);
}

function durationMs(start, end) {
  const value = Date.parse(end.occurred_at) - Date.parse(start.occurred_at);
  if (!Number.isFinite(value) || value < 0) {
    throw timingError('Timing event duration is invalid', {
      start: start.event_key,
      end: end.event_key
    });
  }
  return value;
}

function durationSummary(values) {
  if (values.length === 0) {
    return { count: 0, total_ms: 0, min_ms: 0, max_ms: 0, average_ms: 0 };
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    total_ms: total,
    min_ms: Math.min(...values),
    max_ms: Math.max(...values),
    average_ms: total / values.length
  };
}

function requiredEvent(byKey, key) {
  const event = byKey.get(key);
  if (!event) throw timingError('Timing projection requires a completed lifecycle', { event_key: key });
  return event;
}

function buildWindowMetrics(events, byKey) {
  const issued = events.filter(event => event.type === 'window_issued');
  const durations = [];
  let closed = 0;
  for (const start of issued) {
    const end = byKey.get(`window-closed:${start.window_sequence}`);
    if (!end) continue;
    closed += 1;
    durations.push(durationMs(start, end));
  }
  return {
    issued: issued.length,
    closed,
    unclosed: issued.length - closed,
    wall_ms: durationSummary(durations)
  };
}

function buildAttemptTiming(events, byKey) {
  const issued = events.filter(event => event.type === 'attempt_issued');
  const turnaround = [];
  const validation = [];
  for (const start of issued) {
    const suffix = `${start.unit}:${start.cycle}:${start.attempt}`;
    const observed = requiredEvent(byKey, `attempt-observed:${suffix}`);
    const decisions = [
      byKey.get(`attempt-accepted:${suffix}`),
      byKey.get(`attempt-rejected:${suffix}`)
    ].filter(Boolean);
    if (decisions.length !== 1) {
      throw timingError('Observed attempt requires exactly one decision', { attempt: suffix });
    }
    turnaround.push(durationMs(start, observed));
    validation.push(durationMs(observed, decisions[0]));
  }
  return {
    attempts: issued.length,
    issued_to_observed_ms: durationSummary(turnaround),
    observed_to_decision_ms: durationSummary(validation)
  };
}

function humanWaitMs(events, byKey) {
  return events.filter(event => event.type === 'manual_review_entered')
    .reduce((total, start) => {
      const suffix = `${start.unit}:${start.cycle}:${start.attempt}`;
      return total + durationMs(start, requiredEvent(byKey, `manual-review-resumed:${suffix}`));
    }, 0);
}

function terminalPhaseMs(byKey, phase) {
  return durationMs(
    requiredEvent(byKey, `phase-started:${phase}`),
    requiredEvent(byKey, `phase-completed:${phase}`)
  );
}

function buildTimingProjection(events) {
  if (!Array.isArray(events) || events.length === 0) throw timingError('Timing projection requires events');
  const byKey = new Map(events.map(event => [event.event_key, event]));
  const runStarted = requiredEvent(byKey, 'run-started');
  const archiveCompleted = requiredEvent(byKey, 'phase-completed:archive');
  const windows = buildWindowMetrics(events, byKey);
  const totalMs = durationMs(runStarted, archiveCompleted);
  const waitMs = humanWaitMs(events, byKey);
  if (waitMs > totalMs) throw timingError('Human wait exceeds total run duration');
  return {
    total_ms: totalMs,
    human_wait_ms: waitMs,
    active_ms: totalMs - waitMs,
    phase_durations: {
      prepare_ms: durationMs(
        requiredEvent(byKey, 'source-prepare-started'),
        requiredEvent(byKey, 'source-prepared')
      ),
      chapter_extraction_ms: windows.wall_ms.total_ms,
      assemble_ms: terminalPhaseMs(byKey, 'assemble'),
      verify_ms: terminalPhaseMs(byKey, 'verify'),
      install_ms: terminalPhaseMs(byKey, 'install'),
      archive_ms: terminalPhaseMs(byKey, 'archive'),
      total_ms: totalMs
    },
    windows,
    attempt_timing: buildAttemptTiming(events, byKey)
  };
}

module.exports = {
  EVENT_SCHEMA_VERSION,
  TIMING_CONTRACT_VERSION,
  appendTimingEvent,
  buildTimingProjection,
  readTimingEvents,
  recordRunTimingEvent,
  timingEventKey,
  timingEventsHash
};
