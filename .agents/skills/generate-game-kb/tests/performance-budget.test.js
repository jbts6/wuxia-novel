'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildRunMetrics } = require('../scripts/lib/timing');

const FIXTURE = path.join(__dirname, 'fixtures', 'representative-21-chapter-timing.json');
const PHASES = [
  'prepare_ms',
  'chapter_extraction_ms',
  'domain_distill_ms',
  'assemble_ms',
  'verify_ms',
  'install_ms',
  'archive_ms'
];

test('representative 21-chapter run stays within the 45-minute budget', () => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const units = Object.entries(fixture.progress.units);
  const chapters = units.filter(([unit]) => unit.startsWith('chapter:'));
  const domains = units.filter(([unit]) => unit.startsWith('distill:'));

  assert.equal(chapters.length, 21);
  assert.equal(domains.length, 4);
  for (const [unit, state] of units) {
    assert.ok(state.attempts <= 2, `${unit} exceeded the two-submission budget`);
  }

  const metrics = buildRunMetrics({
    runId: fixture.metadata.run_id,
    candidateRegistry: path.join(__dirname, 'fixtures', 'representative-registry-not-present.json'),
    finalData: path.join(__dirname, 'fixtures', 'representative-final-data-not-present'),
    sourceChapters: path.join(__dirname, 'fixtures', 'representative-chapters-not-present')
  }, fixture.metadata, fixture.progress, fixture.ended_at);

  assert.equal(metrics.phase_durations.total_ms, 2_580_000);
  assert.ok(metrics.phase_durations.total_ms <= 2_700_000);
  for (const phase of PHASES) {
    assert.ok(metrics.phase_durations[phase] > 0, `${phase} must be positive`);
  }
  assert.equal(Object.hasOwn(metrics.phase_durations, 'installed_verify_ms'), false);
  assert.deepEqual(metrics.ai_units, {
    chapter: { planned: 21, done: 21, attempts: 24, corrections: 3 },
    domain: { planned: 4, done: 4, attempts: 6, corrections: 2 },
    total: { planned: 25, done: 25, attempts: 30, corrections: 5 }
  });
});
