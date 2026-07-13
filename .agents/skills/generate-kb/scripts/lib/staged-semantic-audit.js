#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  PipelineError,
  readJson,
  sha256,
  stableStringify,
  writeJsonAtomic
} = require('./atomic-json');
const { getPipelinePaths } = require('./pipeline-paths');
const { appendPipelineEvent, loadPipelineState } = require('./pipeline-state');
const { runSemanticGates } = require('./semantic-gates');
const { createWorkItems, loadPlannedDefinition } = require('./work-items');

const SEMANTIC_AUDIT_GATE_VERSION = 'semantic-audit-v1';
const RECORD_CATEGORIES = [
  'character', 'faction', 'location', 'skill', 'technique', 'item', 'dialogue', 'chapter_summary'
];

function loadSemanticInputs(paths) {
  const enrichDir = path.join(paths.materialized, 'enrich');
  const recordsByCategory = Object.fromEntries(RECORD_CATEGORIES.map(category => [
    category,
    readJson(path.join(enrichDir, `${category}.json`), null)
  ]));
  const invalidCategory = Object.entries(recordsByCategory)
    .find(([, records]) => !Array.isArray(records));
  if (invalidCategory) {
    throw new PipelineError(
      'ENRICH_ARTIFACTS_MISSING',
      `Missing enrich materialized category: ${invalidCategory[0]}`
    );
  }
  const fieldEvidenceClaims = readJson(
    path.join(enrichDir, 'field-evidence-claims.json'),
    null
  );
  const sharedEvidenceJustifications = readJson(
    path.join(enrichDir, 'shared-evidence-justifications.json'),
    null
  );
  if (!Array.isArray(fieldEvidenceClaims) || !Array.isArray(sharedEvidenceJustifications)) {
    throw new PipelineError(
      'ENRICH_ARTIFACTS_MISSING',
      'Enrich field evidence and shared-evidence artifacts are required'
    );
  }
  return {
    records_by_category: recordsByCategory,
    field_evidence_claims: fieldEvidenceClaims,
    shared_evidence_justifications: sharedEvidenceJustifications
  };
}

function buildSemanticAuditDefinitions(materialized, stageInputHash) {
  if (typeof stageInputHash !== 'string' || !stageInputHash) {
    throw new PipelineError('STAGE_INPUT_UNAVAILABLE', 'semantic-audit requires enrich output hash');
  }
  const definitions = materialized.field_evidence_claims.flatMap(entry => {
    const provisionalKey = String(entry?.provisional_key ?? '').trim();
    const claims = entry?.field_evidence_claims;
    if (!provisionalKey || !claims || typeof claims !== 'object' || Array.isArray(claims)) {
      throw new PipelineError(
        'SEMANTIC_AUDIT_INPUT_INVALID',
        'Every semantic evidence audit item requires a provisional key and field claims'
      );
    }
    const fields = Object.keys(claims).sort();
    if (fields.length === 0) return [];
    const sourcePayload = {
      category: entry.category,
      provisional_key: provisionalKey,
      field_evidence_claims: claims,
      shared_evidence_justifications: materialized.shared_evidence_justifications
        .filter(justification => justification.provisional_key === provisionalKey)
    };
    const instructions = {
      kind: 'semantic-evidence-audit',
      prompt_version: 'semantic-evidence-audit-v1',
      provisional_key: provisionalKey,
      fields,
      independence_rule: 'audit source support without trusting enrich conclusions'
    };
    return [{
      work_item_id: `semantic_evidence_${sha256(provisionalKey).slice(0, 20)}`,
      input_hash: sha256(stableStringify({
        stage_input_hash: stageInputHash,
        instructions,
        sourcePayload
      })),
      instructions,
      source_payload: sourcePayload,
      entity_keys: [provisionalKey]
    }];
  }).sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
  if (definitions.length === 0) {
    throw new PipelineError(
      'SEMANTIC_AUDIT_EMPTY',
      'semantic-audit cannot run with an empty field-evidence check set'
    );
  }
  if (new Set(definitions.map(item => item.work_item_id)).size !== definitions.length) {
    throw new PipelineError('INVALID_WORK_ITEM', 'Semantic audit work item IDs must be unique');
  }
  return definitions;
}

function planSemanticAuditWorkItems(novelDir, runId) {
  let state = loadPipelineState(novelDir, runId);
  if (state.stages.enrich.status !== 'passed' || !state.stages.enrich.output_hash) {
    throw new PipelineError('INVALID_STAGE_TRANSITION', 'enrich must pass before semantic-audit');
  }
  if (state.stages['semantic-audit'].status === 'blocked') {
    state = appendPipelineEvent(novelDir, runId, 'downstream_invalidated', {
      from_stage: 'semantic-audit',
      include_stage: true,
      reason: 'semantic_audit_remediation'
    });
  }
  if (['ready', 'invalidated'].includes(state.stages['semantic-audit'].status)) {
    state = appendPipelineEvent(novelDir, runId, 'stage_started', {
      stage: 'semantic-audit',
      input_hash: state.stages.enrich.output_hash,
      gate_version: SEMANTIC_AUDIT_GATE_VERSION
    });
  }
  if (state.stages['semantic-audit'].status !== 'running') {
    throw new PipelineError(
      'INVALID_STAGE_TRANSITION',
      `semantic-audit is ${state.stages['semantic-audit'].status}`
    );
  }
  const paths = getPipelinePaths(novelDir, runId);
  const definitions = buildSemanticAuditDefinitions(
    loadSemanticInputs(paths),
    state.stages['semantic-audit'].input_hash
  );
  createWorkItems(novelDir, runId, 'semantic-audit', definitions);
  return definitions;
}

function loadAcceptedVerdicts(novelDir, runId, item) {
  const paths = getPipelinePaths(novelDir, runId);
  const base = path.join(paths.workItems, 'semantic-audit');
  const draft = readJson(path.join(base, 'drafts', `${item.work_item_id}.json`), null);
  const receipt = readJson(path.join(base, 'receipts', `${item.work_item_id}.json`), null);
  if (!draft || !receipt
    || sha256(stableStringify(draft.payload)) !== item.output_hash
    || sha256(stableStringify(receipt)) !== item.receipt_hash
    || receipt.output_hash !== item.output_hash) {
    throw new PipelineError(
      'SEMANTIC_AUDIT_ARTIFACT_TAMPERED',
      `${item.work_item_id} draft or receipt is missing or stale`
    );
  }
  return draft.payload.evidence_verdicts;
}

function collectSemanticAuditVerdicts(novelDir, runId, expectedDefinitions) {
  const state = loadPipelineState(novelDir, runId);
  const expectedIds = new Set(expectedDefinitions.map(definition => definition.work_item_id));
  const items = Object.values(state.work_items)
    .filter(item => item.stage === 'semantic-audit')
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
  if (items.length !== expectedIds.size || items.some(item =>
    !expectedIds.has(item.work_item_id) || item.status !== 'accepted')) {
    throw new PipelineError(
      'SEMANTIC_AUDIT_INCOMPLETE',
      'Every planned semantic-audit work item must be accepted'
    );
  }
  const verdicts = [];
  for (const item of items) {
    loadPlannedDefinition(novelDir, runId, 'semantic-audit', item);
    verdicts.push(...loadAcceptedVerdicts(novelDir, runId, item));
  }
  return verdicts;
}

function loadReconcileAuditInputs(paths) {
  const entities = readJson(path.join(
    paths.materialized,
    'reconcile',
    'provisional-entities.json'
  ), []);
  const strongSignals = readJson(path.join(
    paths.materialized,
    'reconcile',
    'strong-signals.json'
  ), { signals: [] });
  return {
    events: (Array.isArray(entities) ? entities : [])
      .filter(entity => entity.final_category === 'event')
      .map(entity => ({
        ...entity,
        name: entity.canonical_name
      })),
    dialogue_signals: (strongSignals?.signals ?? [])
      .filter(signal => (signal.sources ?? []).includes('dialogue-speaker'))
      .map(signal => ({ speaker_name: signal.name, source_refs: signal.source_refs ?? [] }))
  };
}

function completeSemanticAuditStage(novelDir, runId) {
  const state = loadPipelineState(novelDir, runId);
  if (state.stages['semantic-audit'].status !== 'running') {
    throw new PipelineError(
      'INVALID_STAGE_TRANSITION',
      `semantic-audit is ${state.stages['semantic-audit'].status}`
    );
  }
  if (state.stages['semantic-audit'].input_hash !== state.stages.enrich.output_hash) {
    throw new PipelineError('SEMANTIC_AUDIT_STALE', 'semantic-audit input hash is stale');
  }
  const paths = getPipelinePaths(novelDir, runId);
  const materialized = loadSemanticInputs(paths);
  const definitions = buildSemanticAuditDefinitions(
    materialized,
    state.stages['semantic-audit'].input_hash
  );
  const verdicts = collectSemanticAuditVerdicts(novelDir, runId, definitions);
  const reconcile = loadReconcileAuditInputs(paths);
  const exemptions = readJson(
    path.join(paths.materialized, 'semantic-audit', 'exemptions.json'),
    { personas: [], event_participants: [] }
  );
  const result = runSemanticGates({
    ...materialized,
    ...reconcile,
    exemptions,
    evidence_audit_verdicts: verdicts
  });
  const report = {
    ...result,
    schema_version: 1,
    run_id: runId,
    input_hash: state.stages['semantic-audit'].input_hash
  };
  report.output_hash = sha256(stableStringify(report));
  const reportPath = path.join(paths.materialized, 'semantic-audit', 'report.json');
  if (!result.passed) {
    appendPipelineEvent(novelDir, runId, 'stage_gate_failed', {
      stage: 'semantic-audit',
      failure_code: 'SEMANTIC_AUDIT_FAILED',
      remediation_stage: result.errors.some(error => [
        'EVENT_PARTICIPANT_UNRESOLVED',
        'SUMMARY_CHARACTER_UNRESOLVED'
      ].includes(error.code)) ? 'reconcile' : 'enrich',
      error_count: result.errors.length,
      high_risk_count: result.high_risk_decisions.length
    }, { beforeCommit: () => writeJsonAtomic(reportPath, report) });
    throw new PipelineError(
      'SEMANTIC_AUDIT_FAILED',
      `Semantic audit found ${result.errors.length} blocking errors`,
      { report }
    );
  }
  const nextState = appendPipelineEvent(novelDir, runId, 'stage_passed', {
    stage: 'semantic-audit',
    input_hash: state.stages['semantic-audit'].input_hash,
    output_hash: report.output_hash,
    gate_version: state.stages['semantic-audit'].gate_version
  }, { beforeCommit: () => writeJsonAtomic(reportPath, report) });
  return { action: 'complete-semantic-audit', report, state: nextState };
}

module.exports = {
  SEMANTIC_AUDIT_GATE_VERSION,
  buildSemanticAuditDefinitions,
  completeSemanticAuditStage,
  loadSemanticInputs,
  planSemanticAuditWorkItems
};
