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
const { createWorkItems, loadPlannedDefinition } = require('./work-items');

const ENRICH_CATEGORIES = new Set([
  'character', 'faction', 'location', 'skill', 'technique', 'item', 'dialogue'
]);
const ENRICH_GATE_VERSION = 'enrich-v1';
const MATERIALIZED_CATEGORIES = [
  'character', 'faction', 'location', 'skill', 'technique', 'item', 'dialogue', 'chapter_summary'
];

function definitionForEntity(entity, stageInputHash) {
  if (!entity || !ENRICH_CATEGORIES.has(entity.final_category)) return null;
  const provisionalKey = String(entity.provisional_key ?? '');
  const token = provisionalKey.split('_').at(-1);
  if (!/^[a-f0-9]{16}$/.test(token)) {
    throw new PipelineError('PROVISIONAL_KEY_INVALID', `Invalid enrich entity key: ${provisionalKey}`);
  }
  const category = entity.final_category;
  const sourcePayload = { entity };
  const instructions = {
    kind: 'enrich-entity',
    prompt_version: 'enrich-entity-v1',
    category,
    provisional_key: provisionalKey,
    allowed_output: 'provisional_enrich_record'
  };
  return {
    work_item_id: `enrich_${category}_${token}`,
    input_hash: sha256(stableStringify({ stage_input_hash: stageInputHash, instructions, sourcePayload })),
    instructions,
    source_payload: sourcePayload,
    entity_keys: [provisionalKey]
  };
}

function definitionForSummary(summary, stageInputHash) {
  if (!Number.isInteger(summary?.chapter) || summary.chapter < 1) {
    throw new PipelineError('PROVISIONAL_RECORD_INVALID', 'Chapter summary requires a positive chapter');
  }
  const key = `chapter_summary:${summary.chapter}`;
  const sourcePayload = { chapter_summary: summary };
  const instructions = {
    kind: 'enrich-entity',
    prompt_version: 'enrich-chapter-summary-v1',
    category: 'chapter_summary',
    provisional_key: key,
    allowed_output: 'provisional_enrich_record'
  };
  return {
    work_item_id: `enrich_chapter_summary_ch${String(summary.chapter).padStart(3, '0')}`,
    input_hash: sha256(stableStringify({ stage_input_hash: stageInputHash, instructions, sourcePayload })),
    instructions,
    source_payload: sourcePayload,
    entity_keys: [key]
  };
}

function buildEnrichDefinitions(materialized, stageInputHash) {
  if (typeof stageInputHash !== 'string' || !stageInputHash) {
    throw new PipelineError('STAGE_INPUT_UNAVAILABLE', 'enrich requires reconcile output hash');
  }
  const definitions = [
    ...(materialized?.entities ?? []).map(entity => definitionForEntity(entity, stageInputHash)),
    ...(materialized?.chapter_summaries ?? []).map(summary => definitionForSummary(summary, stageInputHash))
  ].filter(Boolean).sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
  const ids = definitions.map(definition => definition.work_item_id);
  const keys = definitions.flatMap(definition => definition.entity_keys);
  if (new Set(ids).size !== ids.length || new Set(keys).size !== keys.length) {
    throw new PipelineError('INVALID_WORK_ITEM', 'Enrich work items must have unique IDs and entity keys');
  }
  return definitions;
}

function loadReconcileMaterialized(paths) {
  const entities = readJson(path.join(
    paths.materialized,
    'reconcile',
    'provisional-entities.json'
  ), null);
  const chapterSummaries = readJson(path.join(
    paths.materialized,
    'reconcile',
    'chapter-summary-drafts.json'
  ), null);
  if (!Array.isArray(entities) || !Array.isArray(chapterSummaries)) {
    throw new PipelineError(
      'RECONCILE_ARTIFACTS_MISSING',
      'Reconcile provisional entities and chapter summaries are required for enrich'
    );
  }
  return { entities, chapter_summaries: chapterSummaries };
}

function planEnrichWorkItems(novelDir, runId) {
  let state = loadPipelineState(novelDir, runId);
  if (state.stages.reconcile.status !== 'passed' || !state.stages.reconcile.output_hash) {
    throw new PipelineError('INVALID_STAGE_TRANSITION', 'reconcile must pass before enrich');
  }
  if (['ready', 'invalidated', 'blocked'].includes(state.stages.enrich.status)) {
    state = appendPipelineEvent(novelDir, runId, 'stage_started', {
      stage: 'enrich',
      input_hash: state.stages.reconcile.output_hash,
      gate_version: ENRICH_GATE_VERSION
    });
  }
  if (state.stages.enrich.status !== 'running') {
    throw new PipelineError('INVALID_STAGE_TRANSITION', `enrich is ${state.stages.enrich.status}`);
  }
  if (Object.values(state.work_items)
    .some(item => item.stage === 'enrich' && item.status !== 'invalidated')) {
    throw new PipelineError('WORK_ITEMS_ALREADY_PLANNED', 'Enrich work items already exist');
  }
  const paths = getPipelinePaths(novelDir, runId);
  const definitions = buildEnrichDefinitions(
    loadReconcileMaterialized(paths),
    state.stages.enrich.input_hash
  );
  if (definitions.length === 0) {
    throw new PipelineError('ENRICH_NO_WORK_ITEMS', 'Enrich requires at least one retained record');
  }
  createWorkItems(novelDir, runId, 'enrich', definitions);
  return definitions;
}

function loadAcceptedPayload(novelDir, runId, item) {
  const paths = getPipelinePaths(novelDir, runId);
  const base = path.join(paths.workItems, 'enrich');
  const draft = readJson(path.join(base, 'drafts', `${item.work_item_id}.json`), null);
  const receipt = readJson(path.join(base, 'receipts', `${item.work_item_id}.json`), null);
  if (!draft || !receipt) {
    throw new PipelineError('ENRICH_ARTIFACT_MISSING', `${item.work_item_id} draft or receipt is missing`);
  }
  if (sha256(stableStringify(draft.payload)) !== item.output_hash
    || sha256(stableStringify(receipt)) !== item.receipt_hash
    || receipt.output_hash !== item.output_hash
    || receipt.input_hash !== item.input_hash) {
    throw new PipelineError('ENRICH_ARTIFACT_TAMPERED', `${item.work_item_id} draft or receipt hash mismatch`);
  }
  return draft.payload;
}

function validateEnrichStage(novelDir, runId) {
  const state = loadPipelineState(novelDir, runId);
  const errors = [];
  if (state.stages.enrich.status !== 'running') errors.push(`enrich is ${state.stages.enrich.status}`);
  if (state.stages.enrich.input_hash !== state.stages.reconcile.output_hash) {
    errors.push('enrich input hash does not match reconcile output hash');
  }
  const paths = getPipelinePaths(novelDir, runId);
  let expectedDefinitions = [];
  try {
    expectedDefinitions = buildEnrichDefinitions(
      loadReconcileMaterialized(paths),
      state.stages.enrich.input_hash
    );
  } catch (error) {
    errors.push(error.message);
  }
  const expectedById = new Map(expectedDefinitions.map(definition => [definition.work_item_id, definition]));
  const items = Object.values(state.work_items).filter(item => item.stage === 'enrich');
  if (items.length !== expectedDefinitions.length) {
    errors.push(`expected ${expectedDefinitions.length} enrich work items, found ${items.length}`);
  }
  for (const item of items) {
    const expected = expectedById.get(item.work_item_id);
    if (!expected) {
      errors.push(`unexpected enrich work item ${item.work_item_id}`);
      continue;
    }
    if (item.status !== 'accepted') errors.push(`${item.work_item_id}: status is ${item.status}`);
    if (item.input_hash !== expected.input_hash) errors.push(`${item.work_item_id}: stale input hash`);
    try {
      const definition = loadPlannedDefinition(novelDir, runId, 'enrich', item);
      const { definition_hash: ignored, ...body } = definition;
      if (stableStringify(body) !== stableStringify({
        schema_version: 1,
        stage: 'enrich',
        ...expected
      })) {
        errors.push(`${item.work_item_id}: definition does not match reconcile materialized input`);
      }
      if (item.status === 'accepted') loadAcceptedPayload(novelDir, runId, item);
    } catch (error) {
      errors.push(`${item.work_item_id}: ${error.message}`);
    }
  }
  return { passed: errors.length === 0, errors, items };
}

function materializeEnrich(novelDir, runId, items) {
  const recordsByCategory = Object.fromEntries(MATERIALIZED_CATEGORIES.map(category => [category, []]));
  const evidence = [];
  const sharedEvidence = [];
  const discoveryAlerts = [];
  for (const item of [...items].sort((left, right) =>
    left.work_item_id.localeCompare(right.work_item_id))) {
    const definition = loadPlannedDefinition(novelDir, runId, 'enrich', item);
    const payload = loadAcceptedPayload(novelDir, runId, item);
    const category = definition.instructions.category;
    recordsByCategory[category].push(payload.record);
    evidence.push({
      work_item_id: item.work_item_id,
      category,
      provisional_key: definition.instructions.provisional_key,
      field_evidence_claims: payload.field_evidence_claims
    });
    for (const justification of payload.shared_evidence_justification || []) {
      sharedEvidence.push({
        work_item_id: item.work_item_id,
        category,
        provisional_key: definition.instructions.provisional_key,
        ...justification
      });
    }
    for (const alert of payload.discovery_alerts || []) {
      discoveryAlerts.push({
        work_item_id: item.work_item_id,
        source_provisional_key: definition.instructions.provisional_key,
        ...alert
      });
    }
  }
  const materialized = {
    records_by_category: recordsByCategory,
    field_evidence_claims: evidence,
    shared_evidence_justifications: sharedEvidence,
    discovery_alerts: discoveryAlerts
  };
  materialized.output_hash = sha256(stableStringify(materialized));
  return materialized;
}

function writeEnrichMaterialized(paths, materialized) {
  const outputDir = path.join(paths.materialized, 'enrich');
  for (const category of MATERIALIZED_CATEGORIES) {
    writeJsonAtomic(path.join(outputDir, `${category}.json`), materialized.records_by_category[category]);
  }
  writeJsonAtomic(path.join(outputDir, 'field-evidence-claims.json'), materialized.field_evidence_claims);
  writeJsonAtomic(
    path.join(outputDir, 'shared-evidence-justifications.json'),
    materialized.shared_evidence_justifications
  );
  writeJsonAtomic(path.join(outputDir, 'discovery-alerts.json'), materialized.discovery_alerts);
}

function completeEnrichStage(novelDir, runId) {
  const validation = validateEnrichStage(novelDir, runId);
  if (!validation.passed) {
    throw new PipelineError('ENRICH_GATE_FAILED', validation.errors.join('; '), validation);
  }
  const materialized = materializeEnrich(novelDir, runId, validation.items);
  const state = loadPipelineState(novelDir, runId);
  const paths = getPipelinePaths(novelDir, runId);
  const writeOutputs = () => writeEnrichMaterialized(paths, materialized);
  if (materialized.discovery_alerts.length > 0) {
    appendPipelineEvent(novelDir, runId, 'stage_gate_failed', {
      stage: 'enrich',
      failure_code: 'ENRICH_DISCOVERY_ALERT',
      remediation_stage: 'reconcile',
      discovery_count: materialized.discovery_alerts.length
    }, { beforeCommit: writeOutputs });
    const nextState = appendPipelineEvent(novelDir, runId, 'downstream_invalidated', {
      from_stage: 'reconcile',
      include_stage: true,
      reason: 'enrich_discovery_alert'
    });
    return {
      action: 'block-enrich',
      failure_code: 'ENRICH_DISCOVERY_ALERT',
      materialized,
      state: nextState
    };
  }
  const nextState = appendPipelineEvent(novelDir, runId, 'stage_passed', {
    stage: 'enrich',
    input_hash: state.stages.enrich.input_hash,
    output_hash: materialized.output_hash,
    gate_version: state.stages.enrich.gate_version
  }, { beforeCommit: writeOutputs });
  return { action: 'complete-enrich', validation, materialized, state: nextState };
}

module.exports = {
  ENRICH_CATEGORIES,
  ENRICH_GATE_VERSION,
  buildEnrichDefinitions,
  completeEnrichStage,
  materializeEnrich,
  planEnrichWorkItems,
  validateEnrichStage
};
