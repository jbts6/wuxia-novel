'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { atomicWriteYaml } = require('../scripts/lib/io');
const {
  EVENT_SCHEMA_VERSION,
  TIMING_CONTRACT_VERSION,
  buildTimingProjection,
  readTimingEvents,
  timingEventKey
} = require('../scripts/lib/timing-events');
const { buildEventRunMetrics } = require('../scripts/lib/timing');

const START = Date.parse('2026-07-23T07:00:00.000Z');

function timingPaths(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    root,
    runId: 'run-performance',
    events: path.join(root, 'events.jsonl'),
    tasks: path.join(root, 'tasks'),
    sourceChapters: path.join(root, 'source', 'chapters'),
    chapters: path.join(root, 'accepted', 'chapters'),
    finalData: path.join(root, 'final', 'data')
  };
}

function writeEventLog(paths, chapterCount, correctionCount) {
  const events = [];
  function push(type, milliseconds, fields = {}) {
    const payload = { type, ...fields };
    events.push({
      schema_version: EVENT_SCHEMA_VERSION,
      sequence: events.length + 1,
      event_key: timingEventKey(payload),
      type,
      occurred_at: new Date(START + milliseconds).toISOString(),
      ...fields
    });
  }
  push('run_started', 0);
  push('source_prepare_started', 10_000);
  push('source_prepared', 30_000);
  let cursor = 40_000;
  let corrections = correctionCount;
  for (let first = 1, window = 1; first <= chapterCount; first += 5, window += 1) {
    const numbers = Array.from(
      { length: Math.min(5, chapterCount - first + 1) },
      (_, index) => first + index
    );
    push('window_issued', cursor, { window_sequence: window });
    for (const number of numbers) {
      push('attempt_issued', cursor, {
        unit: `chapter:${String(number).padStart(3, '0')}`,
        cycle: 1,
        attempt: 1,
        producer: 'chapter-worker'
      });
    }
    for (const number of numbers) {
      const unit = `chapter:${String(number).padStart(3, '0')}`;
      const firstAttempt = { unit, cycle: 1, attempt: 1, producer: 'chapter-worker' };
      cursor += 1_000;
      push('attempt_observed', cursor, firstAttempt);
      cursor += 1_000;
      push(corrections > 0 ? 'attempt_rejected' : 'attempt_accepted', cursor, firstAttempt);
      if (corrections > 0) {
        corrections -= 1;
        const retry = { unit, cycle: 1, attempt: 2, producer: 'chapter-worker' };
        cursor += 1_000;
        push('attempt_issued', cursor, retry);
        cursor += 1_000;
        push('attempt_observed', cursor, retry);
        cursor += 1_000;
        push('attempt_accepted', cursor, retry);
      }
    }
    push('window_closed', cursor, { window_sequence: window });
    cursor += 1_000;
  }
  const phases = [
    ['assemble', 2_400_000, 2_450_000],
    ['verify', 2_450_000, 2_490_000],
    ['install', 2_490_000, 2_550_000],
    ['archive', 2_550_000, 2_580_000]
  ];
  for (const [phase, started, completed] of phases) {
    push('phase_started', started, { phase });
    push('phase_completed', completed, { phase });
  }
  fs.writeFileSync(paths.events, `${events.map(event => JSON.stringify(event)).join('\n')}\n`);
}

function writeAcceptedChapters(paths, count) {
  fs.mkdirSync(paths.chapters, { recursive: true });
  for (let number = 1; number <= count; number += 1) {
    atomicWriteYaml(path.join(paths.chapters, `chapter_${String(number).padStart(3, '0')}.yaml`), {
      characters: [{}], skills: [{}], items: [{}], factions: [{}]
    });
  }
}

test('representative 21-chapter event run stays within the 45-minute budget', () => {
  const paths = timingPaths('game-kb-performance-');
  writeEventLog(paths, 21, 3);
  writeAcceptedChapters(paths, 21);
  const metrics = buildEventRunMetrics(paths, {
    run_id: paths.runId,
    semantic_profile: 'chapter-direct-v1',
    timing_contract_version: TIMING_CONTRACT_VERSION
  }, new Date(START + 2_580_000).toISOString());

  assert.equal(metrics.total_ms, 2_580_000);
  assert.ok(metrics.total_ms <= 2_700_000);
  assert.equal(metrics.human_wait_ms, 0);
  for (const value of Object.values(metrics.phase_durations)) assert.ok(value > 0);
  assert.deepEqual(metrics.ai_units, {
    chapter: { planned: 21, done: 21, attempts: 24, corrections: 3 },
    total: { planned: 21, done: 21, attempts: 24, corrections: 3 }
  });
  assert.equal(metrics.windows.issued, 5);
  assert.equal(metrics.windows.unclosed, 0);
  assert.equal(metrics.candidate_counts.chapter_candidates, 84);
});

test('1000-chapter event replay and projection stay within a linear-time guardrail', () => {
  const paths = timingPaths('game-kb-performance-large-');
  writeEventLog(paths, 1_000, 0);
  const started = performance.now();
  const projection = buildTimingProjection(readTimingEvents(paths.events));
  const elapsed = performance.now() - started;

  assert.equal(projection.attempt_timing.attempts, 1_000);
  assert.equal(projection.windows.issued, 200);
  assert.equal(projection.windows.closed, 200);
  assert.ok(elapsed < 5_000, `event projection took ${elapsed.toFixed(1)}ms`);
});
