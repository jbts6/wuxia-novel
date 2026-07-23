'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { createProgress } = require('../scripts/lib/chapter-progress');
const { atomicWriteJson } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { sourceState } = require('../scripts/lib/run');
const {
  TIMING_CONTRACT_VERSION,
  appendTimingEvent,
  readTimingEvents
} = require('../scripts/lib/timing-events');
const { makeNovel, makeTemporaryNovel, runFlow, writeWorkerOutput } = require('./helpers');

function snapshotTree(root) {
  const result = {};
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else result[path.relative(root, file).replaceAll('\\', '/')] = crypto
        .createHash('sha256')
        .update(fs.readFileSync(file))
        .digest('hex');
    }
  }
  visit(root);
  return result;
}

function makeLegacyRunFixture() {
  const novelDir = makeNovel('旧运行', '第一章 起始\n旧运行证据。\n');
  const runId = 'run-legacy';
  const paths = pathsFor(novelDir, runId);
  fs.mkdirSync(path.join(paths.run, 'opaque'), { recursive: true });
  fs.writeFileSync(path.join(paths.run, 'opaque', 'payload.bin'), Buffer.from([0, 1, 2, 255]));
  atomicWriteJson(paths.runJson, {
    run_id: runId,
    semantic_contract_version: 6,
    semantic_profile: 'domain-distill-v1',
    accepted_serialization: 'yaml-v1',
    deep: false,
    source_hash: sourceState(novelDir).sourceHash,
    status: 'active'
  });
  return { novelDir, runDir: paths.run, runId };
}

function makeV7RunFixture({ unitStatus = 'active', timing = true } = {}) {
  const novelDir = makeNovel('新运行', '第一章 起始\n新运行证据。\n');
  const runId = 'run-v7';
  const paths = pathsFor(novelDir, runId);
  const chapterFile = path.join(paths.sourceChapters, 'ch_001.txt');
  fs.mkdirSync(path.dirname(chapterFile), { recursive: true });
  fs.writeFileSync(chapterFile, '第一章 起始\n新运行证据。\n', 'utf8');
  const manifest = {
    source_hash: sourceState(novelDir).sourceHash,
    chapters: [{ number: 1, title: '第一章 起始', input_hash: 'sha256:chapter-1', file: chapterFile }]
  };
  fs.mkdirSync(paths.run, { recursive: true });
  atomicWriteJson(paths.runJson, {
    run_id: runId,
    semantic_contract_version: 7,
    semantic_profile: 'chapter-direct-v1',
    accepted_serialization: 'yaml-v1',
    ...(timing ? {
      timing_contract_version: TIMING_CONTRACT_VERSION,
      started_at: '2026-07-23T00:00:00.000Z'
    } : {}),
    source_hash: manifest.source_hash,
    status: 'active'
  });
  if (timing) {
    appendTimingEvent(paths.events, { type: 'run_started' }, {
      occurredAt: '2026-07-23T00:00:00.000Z'
    });
    appendTimingEvent(paths.events, { type: 'source_prepare_started' }, {
      occurredAt: '2026-07-23T00:00:01.000Z'
    });
    appendTimingEvent(paths.events, { type: 'source_prepared' }, {
      occurredAt: '2026-07-23T00:00:02.000Z'
    });
    appendTimingEvent(paths.events, { type: 'window_issued', window_sequence: 1 }, {
      occurredAt: '2026-07-23T00:00:03.000Z'
    });
    appendTimingEvent(paths.events, {
      type: 'attempt_issued', unit: 'chapter:001', cycle: 1, attempt: 1,
      producer: 'chapter-worker'
    }, { occurredAt: '2026-07-23T00:00:03.000Z' });
  }
  atomicWriteJson(paths.manifest, manifest);
  const progress = createProgress(manifest);
  progress.active_units = ['chapter:001'];
  Object.assign(progress.units['chapter:001'], {
    status: unitStatus,
    cycle: 1,
    attempt: 1,
    producer: 'chapter-worker',
    input_hash: 'sha256:input',
    input_file: path.join(paths.tasks, 'chapter_001', 'cycle_01', 'attempt_01.json'),
    output_file: path.join(paths.staging, 'chapter_001', 'cycle_01', 'attempt_01.yaml')
  });
  atomicWriteJson(paths.progress, progress);
  return { novelDir, paths, runId };
}

function jsonResult(result) {
  return JSON.parse((result.status === 0 ? result.stdout : result.stderr).trim());
}

test('legacy status is read-only and run fails before mutation', () => {
  const legacy = makeLegacyRunFixture();
  const before = snapshotTree(legacy.runDir);

  const status = runFlow(['status', legacy.novelDir, '--run', legacy.runId, '--json']);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(jsonResult(status).semantic_contract_version, 6);
  assert.deepEqual(snapshotTree(legacy.runDir), before);

  const run = runFlow(['run', legacy.novelDir, '--run', legacy.runId, '--json']);
  assert.notEqual(run.status, 0);
  assert.equal(jsonResult(run).code, 'LEGACY_SEMANTIC_CONTRACT');
  assert.deepEqual(snapshotTree(legacy.runDir), before);
});

test('retry-unit requires confirmation and manual review', () => {
  const fixture = makeV7RunFixture({ unitStatus: 'active' });
  const withoutConfirm = runFlow([
    'retry-unit', fixture.novelDir, '--run', fixture.runId, '--unit', 'chapter:001', '--json'
  ]);
  assert.equal(jsonResult(withoutConfirm).code, 'CONFIRM_REQUIRED');

  const active = runFlow([
    'retry-unit', fixture.novelDir, '--run', fixture.runId,
    '--unit', 'chapter:001', '--confirm', '--json'
  ]);
  assert.equal(jsonResult(active).code, 'RETRY_UNIT_NOT_REVIEWABLE');
});

test('confirmed manual review records resume before issuing the new cycle', () => {
  const novelDir = makeTemporaryNovel(1, { name: '复核运行' });
  const runId = 'run-manual-timing';
  const first = runFlow(['run', novelDir, '--run', runId, '--json']);
  assert.equal(first.status, 0, first.stderr);
  const firstJob = jsonResult(first).jobs[0];
  fs.writeFileSync(firstJob.output_file, 'characters: []\n', 'utf8');

  const second = runFlow(['run', novelDir, '--run', runId, '--json']);
  assert.equal(second.status, 0, second.stderr);
  const secondJob = jsonResult(second).jobs[0];
  assert.equal(secondJob.cycle, 1);
  assert.equal(secondJob.attempt, 2);
  fs.writeFileSync(secondJob.output_file, 'characters: []\n', 'utf8');

  const stopped = runFlow(['run', novelDir, '--run', runId, '--json']);
  assert.equal(stopped.status, 0, stopped.stderr);
  assert.equal(jsonResult(stopped).status, 'manual_review');
  const paths = pathsFor(novelDir, runId);
  assert.equal(
    readTimingEvents(paths.events).filter(event => event.type === 'manual_review_entered').length,
    1
  );

  const retried = runFlow([
    'retry-unit', novelDir, '--run', runId,
    '--unit', 'chapter:001', '--confirm', '--json'
  ]);
  assert.equal(retried.status, 0, retried.stderr);
  const output = jsonResult(retried);
  assert.equal(output.job.cycle, 2);
  assert.equal(output.job.attempt, 1);
  const events = readTimingEvents(paths.events);
  assert.deepEqual(events.slice(-2).map(event => event.type), [
    'manual_review_resumed', 'attempt_issued'
  ]);
  assert.deepEqual(
    events.slice(-2).map(event => [event.unit, event.cycle, event.attempt, event.producer]),
    [
      ['chapter:001', 1, 2, 'chapter-worker'],
      ['chapter:001', 2, 1, 'chapter-worker']
    ]
  );

  const eventBytes = fs.readFileSync(paths.events, 'utf8');
  const duplicate = runFlow([
    'retry-unit', novelDir, '--run', runId,
    '--unit', 'chapter:001', '--confirm', '--json'
  ]);
  assert.equal(jsonResult(duplicate).code, 'RETRY_UNIT_NOT_REVIEWABLE');
  assert.equal(fs.readFileSync(paths.events, 'utf8'), eventBytes);

  writeWorkerOutput(output.job);
  const completed = runFlow(['run', novelDir, '--run', runId, '--json']);
  assert.equal(completed.status, 0, completed.stderr);
  assert.equal(jsonResult(completed).status, 'complete');
  const archiveDir = path.join(novelDir, '_archive', 'generate-game-kb', runId);
  const metrics = JSON.parse(fs.readFileSync(
    path.join(archiveDir, 'reports', 'run-metrics.json'),
    'utf8'
  ));
  assert.deepEqual(metrics.ai_units.chapter, {
    planned: 1, done: 1, attempts: 3, corrections: 2
  });
  assert.equal(metrics.active_ms, metrics.total_ms - metrics.human_wait_ms);
  assert.equal(metrics.candidate_counts.chapter_candidates, 4);
});

test('archive-abandoned preserves legacy bytes without conversion', () => {
  const legacy = makeLegacyRunFixture();
  const before = snapshotTree(legacy.runDir);
  const result = runFlow(['archive-abandoned', legacy.novelDir, '--run', legacy.runId, '--json']);
  assert.equal(result.status, 0, result.stderr);
  const output = jsonResult(result);
  assert.equal(output.status, 'archived-abandoned');
  assert.deepEqual(snapshotTree(output.archiveDir), before);
  assert.equal(fs.existsSync(legacy.runDir), false);
});

test('archive-abandoned also preserves v7 bytes', () => {
  const fixture = makeV7RunFixture({ timing: false });
  const before = snapshotTree(fixture.paths.run);
  const result = runFlow(['archive-abandoned', fixture.novelDir, '--run', fixture.runId, '--json']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(snapshotTree(jsonResult(result).archiveDir), before);
});

test('status keeps an existing archived v7 run without timing evidence read-only', () => {
  const fixture = makeV7RunFixture({ timing: false });
  const metadata = JSON.parse(fs.readFileSync(fixture.paths.runJson, 'utf8'));
  atomicWriteJson(fixture.paths.runJson, { ...metadata, status: 'archived' });
  const archiveDir = path.join(fixture.novelDir, '_archive', 'generate-game-kb', fixture.runId);
  fs.mkdirSync(path.dirname(archiveDir), { recursive: true });
  fs.renameSync(fixture.paths.run, archiveDir);
  const before = snapshotTree(archiveDir);

  const result = runFlow(['status', fixture.novelDir, '--run', fixture.runId, '--json']);
  assert.equal(result.status, 0, result.stderr);
  const output = jsonResult(result);
  assert.equal(output.status, 'complete');
  assert.equal(output.semantic_contract_version, 7);
  assert.deepEqual(snapshotTree(archiveDir), before);

  const inferred = runFlow(['status', fixture.novelDir, '--json']);
  assert.equal(inferred.status, 0, inferred.stderr);
  assert.equal(jsonResult(inferred).status, 'complete');
  assert.deepEqual(snapshotTree(archiveDir), before);
});
