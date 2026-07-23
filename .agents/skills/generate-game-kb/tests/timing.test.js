'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { atomicWriteJson, atomicWriteYaml } = require('../scripts/lib/io');
const {
  TIMING_CONTRACT_VERSION,
  appendTimingEvent,
  buildTimingProjection,
  readTimingEvents
} = require('../scripts/lib/timing-events');
const { buildEventRunMetrics } = require('../scripts/lib/timing');

const BASE_TIME = Date.parse('2026-07-23T07:00:00.000Z');

function at(milliseconds) {
  return new Date(BASE_TIME + milliseconds).toISOString();
}

function append(file, type, milliseconds, fields = {}) {
  return appendTimingEvent(file, { type, ...fields }, { occurredAt: at(milliseconds) });
}

function attempt(unit, cycle, number, producer = 'chapter-worker') {
  return { unit, cycle, attempt: number, producer };
}

function timingFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-metrics-'));
  const paths = {
    runId: 'run-metrics',
    events: path.join(root, 'events.jsonl'),
    tasks: path.join(root, 'tasks'),
    sourceChapters: path.join(root, 'source', 'chapters'),
    chapters: path.join(root, 'accepted', 'chapters'),
    candidateRegistry: path.join(root, 'accepted', 'candidate-registry.json'),
    finalData: path.join(root, 'final', 'data')
  };
  append(paths.events, 'run_started', 0);
  append(paths.events, 'source_prepare_started', 1_000);
  append(paths.events, 'source_prepared', 3_000);
  append(paths.events, 'window_issued', 5_000, { window_sequence: 1 });
  append(paths.events, 'attempt_issued', 5_000, attempt('chapter:001', 1, 1));
  append(paths.events, 'attempt_issued', 5_000, attempt('chapter:002', 1, 1));
  append(paths.events, 'attempt_observed', 7_000, attempt('chapter:002', 1, 1));
  append(paths.events, 'attempt_accepted', 8_000, attempt('chapter:002', 1, 1));
  append(paths.events, 'attempt_observed', 9_000, attempt('chapter:001', 1, 1));
  append(paths.events, 'attempt_rejected', 10_000, attempt('chapter:001', 1, 1));
  append(paths.events, 'attempt_issued', 11_000, attempt('chapter:001', 1, 2));
  append(paths.events, 'attempt_observed', 15_000, attempt('chapter:001', 1, 2));
  append(paths.events, 'attempt_rejected', 16_000, attempt('chapter:001', 1, 2));
  append(paths.events, 'manual_review_entered', 17_000, attempt('chapter:001', 1, 2));
  append(paths.events, 'manual_review_resumed', 27_000, attempt('chapter:001', 1, 2));
  append(paths.events, 'attempt_issued', 27_000, attempt('chapter:001', 2, 1));
  append(paths.events, 'attempt_observed', 30_000, attempt('chapter:001', 2, 1));
  append(paths.events, 'attempt_accepted', 31_000, attempt('chapter:001', 2, 1));
  append(paths.events, 'window_closed', 31_000, { window_sequence: 1 });
  append(paths.events, 'phase_started', 32_000, { phase: 'assemble' });
  append(paths.events, 'phase_completed', 34_000, { phase: 'assemble' });
  append(paths.events, 'phase_started', 34_000, { phase: 'verify' });
  append(paths.events, 'phase_completed', 35_000, { phase: 'verify' });
  append(paths.events, 'phase_started', 35_000, { phase: 'install' });
  append(paths.events, 'phase_completed', 38_000, { phase: 'install' });
  append(paths.events, 'phase_started', 38_000, { phase: 'archive' });
  append(paths.events, 'phase_completed', 40_000, { phase: 'archive' });

  fs.mkdirSync(paths.chapters, { recursive: true });
  atomicWriteYaml(path.join(paths.chapters, 'chapter_001.yaml'), {
    characters: [{}, {}], skills: [{}], items: [{}], factions: [{}]
  });
  atomicWriteYaml(path.join(paths.chapters, 'chapter_002.yaml'), {
    characters: [{}], skills: [], items: [{}, {}], factions: [{}]
  });
  fs.mkdirSync(paths.finalData, { recursive: true });
  atomicWriteYaml(path.join(paths.finalData, 'characters.yaml'), [{}, {}]);
  atomicWriteYaml(path.join(paths.finalData, 'skills.yaml'), [{}, {}]);
  atomicWriteYaml(path.join(paths.finalData, 'items.yaml'), [{}]);
  atomicWriteYaml(path.join(paths.finalData, 'factions.yaml'), [{}]);
  atomicWriteJson(paths.candidateRegistry, {
    stats: { input_candidates: 0, registered_entries: 999 }
  });
  return paths;
}

test('schema 2 metrics derive waits, phases, windows, attempts, and candidates from evidence', () => {
  const paths = timingFixture();
  const metadata = {
    run_id: paths.runId,
    semantic_profile: 'chapter-direct-v1',
    timing_contract_version: TIMING_CONTRACT_VERSION
  };
  const metrics = buildEventRunMetrics(paths, metadata, at(40_000));

  assert.equal(metrics.schema_version, 2);
  assert.equal(metrics.timing_contract_version, 1);
  assert.equal(metrics.total_ms, 40_000);
  assert.equal(metrics.human_wait_ms, 10_000);
  assert.equal(metrics.active_ms, 30_000);
  assert.deepEqual(metrics.phase_durations, {
    prepare_ms: 2_000,
    chapter_extraction_ms: 26_000,
    assemble_ms: 2_000,
    verify_ms: 1_000,
    install_ms: 3_000,
    archive_ms: 2_000,
    total_ms: 40_000
  });
  assert.deepEqual(metrics.ai_units, {
    chapter: { planned: 2, done: 2, attempts: 4, corrections: 2 },
    total: { planned: 2, done: 2, attempts: 4, corrections: 2 }
  });
  assert.deepEqual(metrics.windows, {
    issued: 1,
    closed: 1,
    unclosed: 0,
    wall_ms: { count: 1, total_ms: 26_000, min_ms: 26_000, max_ms: 26_000, average_ms: 26_000 }
  });
  assert.deepEqual(metrics.attempt_timing, {
    attempts: 4,
    issued_to_observed_ms: {
      count: 4, total_ms: 13_000, min_ms: 2_000, max_ms: 4_000, average_ms: 3_250
    },
    observed_to_decision_ms: {
      count: 4, total_ms: 4_000, min_ms: 1_000, max_ms: 1_000, average_ms: 1_000
    }
  });
  assert.deepEqual(metrics.candidate_counts, { chapter_candidates: 9, final_records: 6 });
  assert.match(metrics.timing_events_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(metrics.generated_at, at(40_000));
  assert.deepEqual(buildEventRunMetrics(paths, metadata, at(40_000)), metrics);
});

test('projection rejects an entered manual review without a matching resume', () => {
  const paths = timingFixture();
  const events = readTimingEvents(paths.events)
    .filter(event => event.type !== 'manual_review_resumed')
    .map((event, index) => ({ ...event, sequence: index + 1 }));
  fs.writeFileSync(paths.events, `${events.map(event => JSON.stringify(event)).join('\n')}\n`);

  assert.throws(
    () => buildTimingProjection(readTimingEvents(paths.events)),
    error => error.code === 'TIMING_EVENTS_INVALID'
  );
});
