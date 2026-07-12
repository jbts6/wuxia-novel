#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  evaluateHardGates,
  regressionInputFromLegacySnapshot
} = require('../scripts/lib/quality-gates');

const FIXTURES = path.join(__dirname, 'fixtures');

function loadFixture(filename) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, filename), 'utf8'));
}

function passingInput() {
  return {
    source_coverage: {
      passed: true,
      errors: [],
      source_file_valid: true,
      source_hash_valid: true,
      missing_windows_by_pass: {},
      chapter_summary_issues: []
    },
    ledger_closure: { passed: true, errors: [], unresolved_candidate_ids: [] },
    evidence_integrity: {
      missing_data_files: [],
      invalid_data_files: [],
      schema_errors: [],
      enrichment_errors: [],
      entities_without_grounded_refs: [],
      descriptions_without_refs: [],
      verification_file_errors: [],
      verification_data_hash_valid: true,
      dialogue_total: 12,
      dialogue_grounded: 12,
      verification_weak: 0,
      verification_unverified: 0
    },
    recall_evidence: {
      unresolved_gap_candidates: [],
      unexplained_lexical_signals: [],
      unresolved_martial_candidates: [],
      missing_must_include: [],
      gold_status: 'no_gold'
    },
    semantic_coverage: {
      main_events_missing_dialogue: [],
      personas_missing_dialogue: [],
      semantic_non_vacuity_errors: [],
      cross_validation_errors: 0,
      cross_validation_data_hash_valid: true,
      blocking_schema_errors: []
    }
  };
}

describe('G1-G5 hard quality gates', () => {
  it('passes only when every independent gate passes', () => {
    const report = evaluateHardGates(passingInput());
    assert.equal(report.completion_gate_passed, true);
    assert.deepEqual(Object.keys(report.gates), ['G1', 'G2', 'G3', 'G4', 'G5']);
    assert.ok(Object.values(report.gates).every(gate => gate.passed));
    assert.equal('overall_score' in report, false);
  });

  it('does not let strong categories compensate for one failed gate', () => {
    const input = passingInput();
    input.evidence_integrity.verification_weak = 1;
    const report = evaluateHardGates(input);

    assert.equal(report.completion_gate_passed, false);
    assert.equal(report.gates.G3.passed, false);
    assert.ok(report.gates.G3.reasons.some(reason => reason.includes('weak')));
    assert.equal(report.gates.G1.passed, true);
  });

  it('fails G3 for missing enrichment and stale verification evidence', () => {
    const input = passingInput();
    input.evidence_integrity.enrichment_errors = ['skills.json/skill_x.one_line: required enrichment field is missing'];
    input.evidence_integrity.verification_data_hash_valid = false;
    const report = evaluateHardGates(input);

    assert.equal(report.gates.G3.passed, false);
    assert.ok(report.gates.G3.reasons.some(reason => reason.includes('skill_x.one_line')));
    assert.ok(report.gates.G3.reasons.some(reason => reason.includes('stale')));
  });

  it('fails G5 when semantic coverage or cross-validation is vacuous', () => {
    const input = passingInput();
    input.semantic_coverage.semantic_non_vacuity_errors = ['no core or important characters classified'];
    input.semantic_coverage.cross_validation_data_hash_valid = false;
    const report = evaluateHardGates(input);

    assert.equal(report.gates.G5.passed, false);
    assert.ok(report.gates.G5.reasons.some(reason => reason.includes('no core')));
    assert.ok(report.gates.G5.reasons.some(reason => reason.includes('stale')));
  });

  it('fails G1 when detailed source validation reports an alignment error', () => {
    const input = passingInput();
    input.source_coverage.passed = false;
    input.source_coverage.errors = ['ch_split chapters are not aligned with the current original text'];
    const report = evaluateHardGates(input);

    assert.equal(report.gates.G1.passed, false);
    assert.ok(report.gates.G1.reasons.some(reason => reason.includes('not aligned')));
  });

  it('fails the human-reviewed low-recall Lianchengjue snapshot', () => {
    const fixture = loadFixture('legacy-lianchengjue-low-recall.json');
    const report = evaluateHardGates(regressionInputFromLegacySnapshot(fixture));

    assert.equal(report.completion_gate_passed, false);
    assert.equal(report.gates.G4.passed, false);
    for (const category of fixture.confirmed_missing_categories) {
      assert.ok(report.gates.G4.reasons.some(reason => reason.includes(category)), category);
    }
  });

  it('fails the current Tianlongbabu false-pass metrics', () => {
    const fixture = loadFixture('legacy-tianlongbabu-false-pass.json');
    const report = evaluateHardGates(regressionInputFromLegacySnapshot(fixture));

    assert.equal(report.completion_gate_passed, false);
    assert.equal(report.gates.G3.passed, false);
    assert.equal(report.gates.G5.passed, false);
    assert.ok(report.gates.G3.reasons.some(reason => reason.includes('121')));
    assert.ok(report.gates.G5.reasons.some(reason => reason.includes('28')));
    assert.ok(report.gates.G5.reasons.some(reason => reason.includes('character')));
  });

  it('fails missing pipeline evidence instead of treating it as zero', () => {
    const input = passingInput();
    delete input.recall_evidence;
    const report = evaluateHardGates(input);

    assert.equal(report.gates.G4.passed, false);
    assert.ok(report.gates.G4.reasons.some(reason => reason.includes('missing')));
  });
});
