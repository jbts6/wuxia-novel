'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { archiveRun } = require('../scripts/lib/archive');
const { sha256File } = require('../scripts/lib/archive-integrity');
const { installVerifiedData } = require('../scripts/lib/install');
const { verifyFinal } = require('../scripts/lib/verify');
const { createV7Workspace } = require('./v7-fixture');
const { appendTimingEvent, readTimingEvents } = require('../scripts/lib/timing-events');
const { runFlow } = require('./helpers');

function completePreArchivePhases(fixture) {
  appendTimingEvent(fixture.paths.events, { type: 'phase_started', phase: 'verify' }, {
    occurredAt: '2026-07-22T00:00:08.000Z'
  });
  const verification = verifyFinal(fixture.paths, { deep: false });
  appendTimingEvent(fixture.paths.events, { type: 'phase_completed', phase: 'verify' }, {
    occurredAt: '2026-07-22T00:00:09.000Z'
  });
  appendTimingEvent(fixture.paths.events, { type: 'phase_started', phase: 'install' }, {
    occurredAt: '2026-07-22T00:00:09.000Z'
  });
  const install = installVerifiedData(fixture.novel, { runId: fixture.runId, deep: false });
  appendTimingEvent(fixture.paths.events, { type: 'phase_completed', phase: 'install' }, {
    occurredAt: '2026-07-22T00:00:11.000Z'
  });
  appendTimingEvent(fixture.paths.events, { type: 'phase_started', phase: 'archive' }, {
    occurredAt: '2026-07-22T00:00:12.000Z'
  });
  return { verification, install };
}

test('archive receipt binds assembly, verification, install, review, source, and final hashes', () => {
  const fixture = createV7Workspace({ timing: true });
  const { verification, install } = completePreArchivePhases(fixture);
  const receipt = archiveRun(fixture.novel, fixture.runId, {
    now: () => '2026-07-22T00:00:13.000Z'
  });

  for (const field of [
    'assembly_report_hash', 'verification_report_hash', 'install_receipt_hash',
    'review_report_hash', 'source_hash', 'final_data_hash'
  ]) {
    assert.match(receipt[field], /^sha256:[a-f0-9]{64}$/, field);
  }
  assert.equal(receipt.source_hash, fixture.manifest.source_hash);
  assert.equal(receipt.final_data_hash, verification.final_data_hash);
  assert.equal(receipt.review_report_hash, install.review_report_hash);
  assert.equal(receipt.timing_contract_version, 1);
  assert.match(receipt.timing_events_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(receipt.metrics_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(fs.existsSync(fixture.paths.run), false);
  assert.equal(fs.existsSync(path.join(receipt.archive_dir, 'archive-receipt.json')), true);
  const metrics = JSON.parse(fs.readFileSync(
    path.join(receipt.archive_dir, 'reports', 'run-metrics.json'),
    'utf8'
  ));
  assert.equal(metrics.schema_version, 2);
  assert.equal(metrics.timing_events_hash, receipt.timing_events_hash);
  assert.equal(metrics.candidate_counts.chapter_candidates, 4);
  assert.equal(readTimingEvents(path.join(receipt.archive_dir, 'events.jsonl')).at(-1).type, 'phase_completed');

  const status = runFlow(['status', fixture.novel, '--run', fixture.runId, '--json']);
  assert.equal(status.status, 0, status.stderr);
  const eventsFile = path.join(receipt.archive_dir, 'events.jsonl');
  const metricsFile = path.join(receipt.archive_dir, 'reports', 'run-metrics.json');
  const eventBytes = fs.readFileSync(eventsFile);
  fs.appendFileSync(eventsFile, 'tampered');
  const tampered = runFlow(['status', fixture.novel, '--run', fixture.runId, '--json']);
  assert.notEqual(tampered.status, 0);
  assert.equal(JSON.parse(tampered.stderr).code, 'TIMING_EVIDENCE_INVALID');
  fs.writeFileSync(eventsFile, eventBytes);
  fs.appendFileSync(metricsFile, ' ');
  const metricsTampered = runFlow(['status', fixture.novel, '--run', fixture.runId, '--json']);
  assert.notEqual(metricsTampered.status, 0);
  assert.equal(JSON.parse(metricsTampered.stderr).code, 'TIMING_EVIDENCE_INVALID');
});

test('archive rollback restores timing evidence when failure follows timing completion', () => {
  const fixture = createV7Workspace({ timing: true, runId: 'run-timing-rollback' });
  completePreArchivePhases(fixture);
  const before = fs.readFileSync(fixture.paths.events, 'utf8');

  assert.throws(
    () => archiveRun(fixture.novel, fixture.runId, {
      now: () => '2026-07-22T00:00:13.000Z',
      faultAt: 'after_timing_write'
    }),
    error => error.code === 'ARCHIVE_MOVE_FAILED'
  );
  assert.equal(fs.readFileSync(fixture.paths.events, 'utf8'), before);
  assert.equal(fs.existsSync(fixture.paths.run), true);
  assert.equal(fs.existsSync(path.join(
    fixture.novel, '_archive', 'generate-game-kb', fixture.runId
  )), false);
});

test('archived status recomputes metrics instead of trusting a coherently rehashed file', () => {
  const fixture = createV7Workspace({ timing: true, runId: 'run-metrics-reprojection' });
  completePreArchivePhases(fixture);
  const receipt = archiveRun(fixture.novel, fixture.runId, {
    now: () => '2026-07-22T00:00:13.000Z'
  });
  const metricsFile = path.join(receipt.archive_dir, 'reports', 'run-metrics.json');
  const receiptFile = path.join(receipt.archive_dir, 'archive-receipt.json');
  const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
  metrics.active_ms += 1;
  fs.writeFileSync(metricsFile, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
  const rehashedReceipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  rehashedReceipt.metrics_hash = sha256File(metricsFile);
  fs.writeFileSync(receiptFile, `${JSON.stringify(rehashedReceipt, null, 2)}\n`, 'utf8');

  const status = runFlow(['status', fixture.novel, '--run', fixture.runId, '--json']);
  assert.notEqual(status.status, 0);
  assert.equal(JSON.parse(status.stderr).code, 'TIMING_EVIDENCE_INVALID');
});
