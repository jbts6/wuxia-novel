#!/usr/bin/env node
'use strict';

function list(value) {
  return Array.isArray(value) ? value : [];
}

function missingGate(name) {
  return { passed: false, reasons: [`missing ${name} evidence`], details: null };
}

function gate(details, checks) {
  const reasons = checks.flatMap(check => check(details));
  return { passed: reasons.length === 0, reasons, details };
}

function evaluateHardGates(input = {}) {
  const source = input.source_coverage;
  const ledger = input.ledger_closure;
  const evidence = input.evidence_integrity;
  const recall = input.recall_evidence;
  const semantic = input.semantic_coverage;

  const gates = {
    G1: source ? gate(source, [
      value => value.passed === true
        ? []
        : list(value.errors).length ? value.errors : ['source coverage validation failed'],
      value => value.source_file_valid === true ? [] : ['original novel source file is missing'],
      value => value.source_hash_valid === true ? [] : ['source hash is missing or stale'],
      value => Object.entries(value.missing_windows_by_pass ?? {}).flatMap(([pass, ids]) =>
        list(ids).length ? [`${pass} missing ${ids.length} source windows`] : []
      ),
      value => list(value.chapter_summary_issues).map(issue => `chapter summary: ${issue}`)
    ]) : missingGate('source coverage'),
    G2: ledger ? gate(ledger, [
      value => value.passed === true ? [] : list(value.errors).length ? value.errors : ['ledger closure failed'],
      value => list(value.unresolved_candidate_ids).map(id => `unresolved candidate: ${id}`)
    ]) : missingGate('ledger closure'),
    G3: evidence ? gate(evidence, [
      value => list(value.entities_without_grounded_refs).map(id => `entity lacks grounded source ref: ${id}`),
      value => list(value.descriptions_without_refs).map(id => `description lacks source ref: ${id}`),
      value => Number.isInteger(value.dialogue_total) && Number.isInteger(value.dialogue_grounded)
        ? value.dialogue_total === value.dialogue_grounded
          ? []
          : [`dialogue citations grounded ${value.dialogue_grounded}/${value.dialogue_total}`]
        : ['dialogue citation verification is missing'],
      value => Number.isInteger(value.verification_weak)
        ? value.verification_weak === 0 ? [] : [`verification has ${value.verification_weak} weak refs`]
        : ['grand verification weak count is missing'],
      value => Number.isInteger(value.verification_unverified)
        ? value.verification_unverified === 0 ? [] : [`verification has ${value.verification_unverified} unverified refs`]
        : ['grand verification unverified count is missing']
    ]) : missingGate('evidence integrity'),
    G4: recall ? gate(recall, [
      value => list(value.unresolved_gap_candidates).map(id => `unresolved gap candidate: ${id}`),
      value => list(value.unexplained_lexical_signals).map(signal => `unexplained lexical signal: ${signal}`),
      value => list(value.unresolved_martial_candidates).map(id => `unresolved martial candidate: ${id}`),
      value => list(value.missing_must_include).map(item => `missing must_include: ${item}`),
      value => list(value.present_must_exclude).map(item => `present must_exclude: ${item}`),
      value => list(value.gold_errors).map(item => `invalid gold: ${item}`),
      value => list(value.regression_failures).map(item => `confirmed regression gap: ${item}`),
      value => value.final_gap_round_complete === false ? ['final gap audit round still found valid candidates'] : [],
      value => ['no_gold', 'passed'].includes(value.gold_status) ? [] : [`gold status is ${value.gold_status ?? 'missing'}`]
    ]) : missingGate('recall'),
    G5: semantic ? gate(semantic, [
      value => list(value.main_events_missing_dialogue).map(id => `main event lacks dialogue or exemption: ${id}`),
      value => list(value.personas_missing_dialogue).map(id => `character persona lacks dialogue or exemption: ${id}`),
      value => Number.isInteger(value.cross_validation_errors)
        ? value.cross_validation_errors === 0 ? [] : [`cross validation has ${value.cross_validation_errors} errors`]
        : ['cross validation result is missing'],
      value => list(value.blocking_schema_errors).map(error => `schema: ${error}`),
      value => list(value.regression_failures).map(item => `semantic regression: ${item}`)
    ]) : missingGate('semantic coverage')
  };

  return {
    generated_at: new Date().toISOString(),
    completion_gate_passed: Object.values(gates).every(item => item.passed),
    gates
  };
}

function regressionInputFromLegacySnapshot(snapshot) {
  const input = {
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
      entities_without_grounded_refs: [],
      descriptions_without_refs: [],
      dialogue_total: 0,
      dialogue_grounded: 0,
      verification_weak: 0,
      verification_unverified: 0
    },
    recall_evidence: {
      unresolved_gap_candidates: [],
      unexplained_lexical_signals: [],
      unresolved_martial_candidates: [],
      missing_must_include: [],
      regression_failures: list(snapshot.confirmed_missing_categories),
      final_gap_round_complete: true,
      gold_status: 'no_gold'
    },
    semantic_coverage: {
      main_events_missing_dialogue: [],
      personas_missing_dialogue: [],
      cross_validation_errors: Number(snapshot.cross_validation_errors ?? 0),
      blocking_schema_errors: [],
      regression_failures: []
    }
  };

  if (snapshot.verification) {
    input.evidence_integrity.verification_weak = Number(snapshot.verification.grand_total?.weak ?? 0);
    input.evidence_integrity.verification_unverified = Number(snapshot.verification.grand_total?.unverified ?? 0);
  }
  if (snapshot.dialogue) {
    if (Number(snapshot.dialogue.chapter_coverage_percent) < 100) {
      input.semantic_coverage.regression_failures.push(
        `dialogue chapter coverage ${snapshot.dialogue.chapter_coverage_percent}%`
      );
    }
    if (Number(snapshot.dialogue.character_fit_percent) <= 0) {
      input.semantic_coverage.regression_failures.push('character persona coverage 0%');
    }
  }
  if (Number(snapshot.summary_quality_proxy) < 100) {
    input.semantic_coverage.regression_failures.push(
      `chapter summary quality proxy ${snapshot.summary_quality_proxy}%`
    );
  }
  return input;
}

module.exports = { evaluateHardGates, regressionInputFromLegacySnapshot };
