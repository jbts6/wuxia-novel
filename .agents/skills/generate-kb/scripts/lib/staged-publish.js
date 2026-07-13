#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  PipelineError,
  readJson,
  sha256,
  stableStringify
} = require('./atomic-json');
const {
  DATA_FILE_BY_CATEGORY,
  buildStagingBundle
} = require('./publish-bundle');
const { getPipelinePaths } = require('./pipeline-paths');
const { loadPipelineState } = require('./pipeline-state');
const { buildStagedReports } = require('./staged-reports');

function readRequiredJson(filePath, label) {
  try {
    return readJson(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new PipelineError('PUBLISH_ARTIFACT_MISSING', `${label} is missing`);
    }
    throw new PipelineError('PUBLISH_ARTIFACT_INVALID', `${label}: ${error.message}`);
  }
}

function readJsonLines(filePath, label) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new PipelineError('PUBLISH_ARTIFACT_MISSING', `${label} is missing`);
    }
    throw error;
  }
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new PipelineError(
        'PUBLISH_ARTIFACT_INVALID',
        `${label}:${index + 1}: ${error.message}`
      );
    }
  });
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new PipelineError('PUBLISH_ARTIFACT_INVALID', `${label} must be an array`);
  }
  return value;
}

function assertDraftOutsideRun(draftPath, paths) {
  const resolved = path.resolve(draftPath);
  const relative = path.relative(paths.runDir, resolved);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new PipelineError(
      'PUBLISH_DRAFT_MANAGED_PATH',
      'AI publish drafts must be outside the managed run directory'
    );
  }
  return resolved;
}

function loadPublishDraft(draftPath, paths, state) {
  const resolved = assertDraftOutsideRun(draftPath, paths);
  const draft = readRequiredJson(resolved, 'publish draft');
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)
    || draft.schema_version !== 1 || draft.run_id !== state.run_id) {
    throw new PipelineError(
      'PUBLISH_DRAFT_INVALID',
      'Publish draft must use schema_version 1 and bind the active run_id'
    );
  }
  if (draft.semantic_audit_hash !== state.stages['semantic-audit'].output_hash) {
    throw new PipelineError(
      'PUBLISH_DRAFT_STALE',
      'Publish draft semantic_audit_hash does not match the active run'
    );
  }
  if (!draft.token_plan || typeof draft.token_plan !== 'object'
    || Array.isArray(draft.token_plan)) {
    throw new PipelineError('PUBLISH_DRAFT_INVALID', 'Publish draft token_plan is required');
  }
  if (Object.hasOwn(draft, 'report_inputs')) {
    throw new PipelineError(
      'PUBLISH_DRAFT_INVALID',
      'Publish reports are controller-generated; report_inputs is not allowed'
    );
  }
  return { resolved, draft, draft_hash: sha256(stableStringify(draft)) };
}

function loadReconcileArtifacts(paths) {
  const base = path.join(paths.materialized, 'reconcile');
  const strong = readRequiredJson(path.join(base, 'strong-signals.json'), 'reconcile strong signals');
  const value = {
    decisions: readJsonLines(path.join(base, 'decisions.jsonl'), 'reconcile decisions'),
    entities: assertArray(
      readRequiredJson(path.join(base, 'provisional-entities.json'), 'reconcile entities'),
      'reconcile entities'
    ),
    strong_signals: assertArray(strong?.signals, 'reconcile strong signals'),
    signal_resolutions: assertArray(strong?.resolutions, 'reconcile signal resolutions'),
    chapter_summaries: assertArray(
      readRequiredJson(path.join(base, 'chapter-summary-drafts.json'), 'reconcile chapter summaries'),
      'reconcile chapter summaries'
    )
  };
  value.output_hash = sha256(stableStringify(value));
  return value;
}

function loadEnrichArtifacts(paths) {
  const base = path.join(paths.materialized, 'enrich');
  const recordsByCategory = Object.fromEntries(Object.keys(DATA_FILE_BY_CATEGORY).map(category => [
    category,
    assertArray(
      readRequiredJson(path.join(base, `${category}.json`), `enrich ${category}`),
      `enrich ${category}`
    )
  ]));
  const value = {
    records_by_category: recordsByCategory,
    field_evidence_claims: assertArray(
      readRequiredJson(path.join(base, 'field-evidence-claims.json'), 'enrich field evidence'),
      'enrich field evidence'
    ),
    shared_evidence_justifications: assertArray(
      readRequiredJson(
        path.join(base, 'shared-evidence-justifications.json'),
        'enrich shared evidence'
      ),
      'enrich shared evidence'
    ),
    discovery_alerts: assertArray(
      readRequiredJson(path.join(base, 'discovery-alerts.json'), 'enrich discovery alerts'),
      'enrich discovery alerts'
    )
  };
  value.output_hash = sha256(stableStringify(value));
  return value;
}

function loadSemanticReport(paths) {
  const report = readRequiredJson(
    path.join(paths.materialized, 'semantic-audit', 'report.json'),
    'semantic audit report'
  );
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new PipelineError('PUBLISH_ARTIFACT_INVALID', 'semantic audit report must be an object');
  }
  const hashInput = { ...report };
  delete hashInput.output_hash;
  const expectedHash = sha256(stableStringify(hashInput));
  if (report.output_hash !== expectedHash) {
    throw new PipelineError('PUBLISH_ARTIFACT_STALE', 'semantic audit report hash is stale');
  }
  return report;
}

function assertPublishStage(state) {
  if (state.stages.publish.status !== 'running' || state.publish) {
    throw new PipelineError(
      'INVALID_STAGE_TRANSITION',
      'publish must be running without a built bundle'
    );
  }
  for (const stage of ['prepare', 'inventory', 'reconcile', 'enrich', 'semantic-audit']) {
    if (state.stages[stage].status !== 'passed') {
      throw new PipelineError('INVALID_STAGE_TRANSITION', `${stage} must pass before publish`);
    }
  }
}

function assertArtifactHash(actual, expected, label) {
  if (actual !== expected) {
    throw new PipelineError(
      'PUBLISH_ARTIFACT_STALE',
      `${label} materialized hash does not match the passed stage`,
      { expected, actual }
    );
  }
}

function loadManagedPublishContext(novelDir, runId, draftPath, suppliedState = null) {
  const state = suppliedState || loadPipelineState(novelDir, runId);
  assertPublishStage(state);
  const paths = getPipelinePaths(novelDir, runId);
  const sourceIndex = readRequiredJson(path.join(paths.source, 'source-index.json'), 'source index');
  if (typeof sourceIndex?.source_hash !== 'string' || !sourceIndex.source_hash) {
    throw new PipelineError('PUBLISH_ARTIFACT_INVALID', 'source index source_hash is missing');
  }
  const reconcile = loadReconcileArtifacts(paths);
  const enrich = loadEnrichArtifacts(paths);
  const semanticReport = loadSemanticReport(paths);
  assertArtifactHash(reconcile.output_hash, state.stages.reconcile.output_hash, 'reconcile');
  assertArtifactHash(enrich.output_hash, state.stages.enrich.output_hash, 'enrich');
  assertArtifactHash(semanticReport.output_hash, state.stages['semantic-audit'].output_hash, 'semantic-audit');
  if (state.stages.enrich.input_hash !== reconcile.output_hash
    || state.stages['semantic-audit'].input_hash !== enrich.output_hash
    || state.stages.publish.input_hash !== semanticReport.output_hash
    || semanticReport.input_hash !== enrich.output_hash) {
    throw new PipelineError('PUBLISH_ARTIFACT_STALE', 'Publish stage input hash chain is stale');
  }
  if (semanticReport.passed !== true || (semanticReport.errors?.length ?? 0) > 0) {
    throw new PipelineError('SEMANTIC_AUDIT_FAILED', 'Publish requires a passing semantic audit report');
  }

  const reviewPacket = readRequiredJson(
    path.join(paths.review, 'recall-packet.json'),
    'recall review packet'
  );
  if (reviewPacket.run_id !== runId
    || reviewPacket.source_hash !== sourceIndex.source_hash
    || reviewPacket.reconcile_output_hash !== reconcile.output_hash) {
    throw new PipelineError('PUBLISH_ARTIFACT_STALE', 'Recall review packet is stale');
  }
  const publishDraft = loadPublishDraft(draftPath, paths, state);
  const reportInputs = {
    source_validation: {
      schema_version: 1,
      run_id: runId,
      passed: sourceIndex.source_alignment_valid === true,
      errors: sourceIndex.source_alignment_valid === true ? [] : ['source alignment is invalid'],
      source_hash: sourceIndex.source_hash
    },
    semantic_audit_report: semanticReport,
    review_packet: reviewPacket
  };
  return {
    state,
    paths,
    sourceIndex,
    reconcile,
    enrich,
    semanticReport,
    reviewPacket,
    publishDraft,
    provisionalInput: {
      records_by_category: enrich.records_by_category,
      events: reconcile.entities.filter(entity => entity.final_category === 'event')
    },
    reportInputs
  };
}

function buildManagedPublishBundle(novelDir, runId, draftPath, options = {}) {
  const context = loadManagedPublishContext(novelDir, runId, draftPath, options.state);
  const built = buildStagingBundle({
    novelDir,
    stagingParent: path.join(context.paths.publish, 'staging'),
    runId,
    sourceHash: context.sourceIndex.source_hash,
    reconcileHash: context.reconcile.output_hash,
    enrichHash: context.enrich.output_hash,
    semanticAuditHash: context.semanticReport.output_hash,
    provisionalInput: context.provisionalInput,
    tokenPlan: context.publishDraft.draft.token_plan,
    reportInputs: context.reportInputs,
    reportBuilder: input => buildStagedReports({
      ...input,
      stageEvidence: {
        prepare: {
          stage: 'prepare',
          status: context.state.stages.prepare.status,
          output_hash: context.state.stages.prepare.output_hash
        },
        inventory: {
          stage: 'inventory',
          status: context.state.stages.inventory.status,
          output_hash: context.state.stages.inventory.output_hash
        },
        reconcile: {
          stage: 'reconcile',
          status: context.state.stages.reconcile.status,
          output_hash: context.reconcile.output_hash,
          decision_count: context.reconcile.decisions.length,
          entity_count: context.reconcile.entities.length
        },
        recall: {
          status: context.reviewPacket.status,
          accepted: context.reviewPacket.status !== 'needs_ai_review'
        }
      }
    }),
    gateVersions: Object.fromEntries(Object.entries(context.state.stages).map(([stage, value]) => [
      stage,
      value.gate_version
    ])),
    createdAt: options.createdAt
  });
  return { ...built, publish_input_hash: context.publishDraft.draft_hash };
}

module.exports = {
  buildManagedPublishBundle,
  loadManagedPublishContext
};
