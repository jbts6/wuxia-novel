'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createProgress, transitionProgress } = require('../scripts/lib/chapter-progress');
const { issueNextWindow, issueRetryJob } = require('../scripts/lib/chapter-work');
const { atomicWriteJson } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const {
  TIMING_CONTRACT_VERSION,
  appendTimingEvent,
  readTimingEvents
} = require('../scripts/lib/timing-events');

function timingFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-work-timing-'));
  const novel = path.join(root, 'novel');
  const source = path.join(root, 'source');
  fs.mkdirSync(novel, { recursive: true });
  fs.mkdirSync(source, { recursive: true });
  const paths = pathsFor(novel, 'run-test');
  fs.mkdirSync(paths.run, { recursive: true });
  const chapters = [];
  for (let number = 1; number <= 25; number += 1) {
    const file = path.join(source, `chapter_${String(number).padStart(3, '0')}.txt`);
    fs.writeFileSync(file, `第${number}章\n甲在此章现身。\n`, 'utf8');
    chapters.push({
      number,
      title: `第${number}章`,
      file,
      input_hash: `sha256:chapter-${number}`
    });
  }
  const startedAt = new Date(Date.now() - 1_000).toISOString();
  atomicWriteJson(paths.runJson, {
    run_id: paths.runId,
    timing_contract_version: TIMING_CONTRACT_VERSION,
    started_at: startedAt
  });
  appendTimingEvent(paths.events, { type: 'run_started' }, { occurredAt: startedAt });
  return { paths, manifest: { chapters } };
}

test('records each fixed window once and every automatic attempt across retries', () => {
  const { paths, manifest } = timingFixture();
  let progress = createProgress(manifest);
  const first = issueNextWindow({ paths, manifest, progress });
  progress = first.progress;
  let events = readTimingEvents(paths.events);
  assert.deepEqual(events.map(event => event.type), [
    'run_started',
    'window_issued',
    'attempt_issued',
    'attempt_issued',
    'attempt_issued',
    'attempt_issued',
    'attempt_issued'
  ]);
  assert.equal(events[1].window_sequence, 1);
  assert.deepEqual(
    events.slice(2).map(event => [event.unit, event.cycle, event.attempt, event.producer]),
    first.jobs.map(job => [job.unit, job.cycle, job.attempt, job.producer])
  );

  progress = transitionProgress(progress, {
    type: 'rejected', unit: 'chapter:001', reason: 'evidence', repair_allowed: false,
    errors: [{ code: 'SOURCE_REFS_REQUIRED' }], manifest, paths
  });
  issueRetryJob({ paths, manifest, progress, unit: 'chapter:001' });
  events = readTimingEvents(paths.events);
  assert.equal(events.filter(event => event.type === 'window_issued').length, 1);
  assert.deepEqual(events.at(-1), {
    schema_version: 1,
    sequence: 8,
    event_key: 'attempt-issued:chapter:001:1:2',
    type: 'attempt_issued',
    occurred_at: events.at(-1).occurred_at,
    unit: 'chapter:001',
    cycle: 1,
    attempt: 2,
    producer: 'chapter-worker'
  });
});
