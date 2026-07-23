'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  TIMING_CONTRACT_VERSION,
  appendTimingEvent,
  readTimingEvents,
  timingEventsHash
} = require('../scripts/lib/timing-events');

function eventFile() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-timing-'));
  return path.join(directory, 'events.jsonl');
}

test('writer owns sequence, canonical UTC time, stable keys, and idempotent replay', () => {
  const file = eventFile();
  const first = appendTimingEvent(file, { type: 'run_started' }, {
    now: () => new Date('2026-07-23T07:00:00.000Z')
  });
  const replay = appendTimingEvent(file, { type: 'run_started' }, {
    now: () => new Date('2026-07-23T08:00:00.000Z')
  });
  const attempt = appendTimingEvent(file, {
    type: 'attempt_issued',
    unit: 'chapter:024',
    cycle: 2,
    attempt: 1,
    producer: 'chapter-worker'
  }, {
    now: () => new Date('2026-07-23T07:05:55.400Z')
  });

  assert.equal(TIMING_CONTRACT_VERSION, 1);
  assert.equal(first.appended, true);
  assert.equal(replay.appended, false);
  assert.deepEqual(replay.event, first.event);
  assert.equal(attempt.event.sequence, 2);
  assert.equal(attempt.event.event_key, 'attempt-issued:chapter:024:2:1');
  assert.equal(attempt.event.occurred_at, '2026-07-23T07:05:55.400Z');
  assert.deepEqual(readTimingEvents(file), [first.event, attempt.event]);
});

test('same stable key with different semantic payload fails closed', () => {
  const file = eventFile();
  const event = {
    type: 'attempt_issued',
    unit: 'chapter:024',
    cycle: 2,
    attempt: 1,
    producer: 'chapter-worker'
  };
  appendTimingEvent(file, event, { now: () => '2026-07-23T07:05:55.400Z' });

  assert.throws(
    () => appendTimingEvent(file, { ...event, producer: 'main-agent-repair' }),
    error => error.code === 'TIMING_EVENT_CONFLICT'
  );
});

test('writer rejects caller-owned sequence, key, timestamp, or unrelated fields', () => {
  const additions = [
    { sequence: 7 },
    { event_key: 'caller-owned' },
    { occurred_at: '2026-07-23T07:00:00.000Z' },
    { unit: 'chapter:001' }
  ];

  for (const addition of additions) {
    assert.throws(
      () => appendTimingEvent(eventFile(), { type: 'run_started', ...addition }),
      error => error.code === 'TIMING_EVENTS_INVALID'
    );
  }
});

test('reader rejects partial lines, broken sequence, invalid binding, and time reversal', async t => {
  const cases = {
    'partial line': '{"schema_version":1',
    'broken sequence': `${JSON.stringify({
      schema_version: 1,
      sequence: 2,
      event_key: 'run-started',
      type: 'run_started',
      occurred_at: '2026-07-23T07:00:00.000Z'
    })}\n`,
    'invalid binding': `${JSON.stringify({
      schema_version: 1,
      sequence: 1,
      event_key: 'attempt-issued:chapter:024:2:1',
      type: 'attempt_issued',
      occurred_at: '2026-07-23T07:00:00.000Z',
      unit: 'chapter:024',
      cycle: 2,
      attempt: 1
    })}\n`,
    'time reversal': [
      {
        schema_version: 1, sequence: 1, event_key: 'run-started',
        type: 'run_started', occurred_at: '2026-07-23T07:00:01.000Z'
      },
      {
        schema_version: 1, sequence: 2, event_key: 'source-prepare-started',
        type: 'source_prepare_started', occurred_at: '2026-07-23T07:00:00.000Z'
      }
    ].map(value => JSON.stringify(value)).join('\n') + '\n'
  };

  for (const [name, content] of Object.entries(cases)) {
    await t.test(name, () => {
      const file = eventFile();
      fs.writeFileSync(file, content, 'utf8');
      assert.throws(() => readTimingEvents(file), error => error.code === 'TIMING_EVENTS_INVALID');
    });
  }
});

test('failed atomic replacement preserves the previous complete event file', () => {
  const file = eventFile();
  appendTimingEvent(file, { type: 'run_started' }, {
    now: () => '2026-07-23T07:00:00.000Z'
  });
  const before = fs.readFileSync(file, 'utf8');

  assert.throws(
    () => appendTimingEvent(file, { type: 'source_prepare_started' }, {
      now: () => '2026-07-23T07:00:01.000Z',
      writeFile: () => { throw new Error('simulated write failure'); }
    }),
    /simulated write failure/
  );
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(readTimingEvents(file).length, 1);
});

test('event hash is stable for unchanged canonical bytes and changes after append', () => {
  const file = eventFile();
  appendTimingEvent(file, { type: 'run_started' }, {
    now: () => '2026-07-23T07:00:00.000Z'
  });
  const first = timingEventsHash(file);
  assert.equal(timingEventsHash(file), first);

  appendTimingEvent(file, { type: 'source_prepare_started' }, {
    now: () => '2026-07-23T07:00:01.000Z'
  });
  assert.notEqual(timingEventsHash(file), first);
  assert.match(timingEventsHash(file), /^sha256:[a-f0-9]{64}$/);
});
