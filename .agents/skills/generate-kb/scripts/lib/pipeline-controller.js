#!/usr/bin/env node
'use strict';

const { PipelineError } = require('./atomic-json');
const { loadPipelineState } = require('./pipeline-state');
const {
  completeInventoryStage,
  planInventoryWorkItems,
  prepareRunSource
} = require('./staged-inventory');
const {
  advanceReconcileStage,
  planReconcileWorkItems
} = require('./staged-reconcile');
const {
  completeEnrichStage,
  planEnrichWorkItems
} = require('./staged-enrich');
const {
  completeSemanticAuditStage,
  planSemanticAuditWorkItems
} = require('./staged-semantic-audit');

function result(action, state, details = {}) {
  return { action, ...details, state };
}

function runCurrentStageAction(novelDir, runId, options = {}) {
  const state = loadPipelineState(novelDir, runId);
  const next = state.next_action;

  if (next.stage === 'prepare'
    && ['start-stage', 'remediate-stage'].includes(next.command)) {
    const prepared = prepareRunSource(novelDir, runId, options.sourceOptions || {});
    return result('prepare-source', prepared.state, {
      output_hash: prepared.output_hash,
      chapter_count: prepared.sourceIndex.chapters.length,
      window_count: prepared.sourceIndex.windows.length
    });
  }

  if (next.stage === 'inventory' && next.command === 'start-stage') {
    const definitions = planInventoryWorkItems(novelDir, runId);
    return result('plan-inventory', loadPipelineState(novelDir, runId), {
      work_item_count: definitions.length
    });
  }

  if (next.stage === 'inventory' && next.command === 'check') {
    const completed = completeInventoryStage(novelDir, runId);
    return result('complete-inventory', completed.state, {
      validation: completed.validation,
      output_hash: completed.materialized.output_hash
    });
  }

  if (next.stage === 'inventory'
    && ['claim', 'submit', 'continue-stage'].includes(next.command)) {
    return result('awaiting-work-items', state, {
      next_action: next
    });
  }

  if (next.stage === 'reconcile'
    && ['start-stage', 'remediate-stage'].includes(next.command)) {
    const definitions = planReconcileWorkItems(novelDir, runId);
    return result('plan-reconcile', loadPipelineState(novelDir, runId), {
      work_item_count: definitions.length
    });
  }

  if (next.stage === 'reconcile'
    && ['check', 'continue-stage'].includes(next.command)) {
    return advanceReconcileStage(novelDir, runId);
  }

  if (next.stage === 'reconcile'
    && ['claim', 'submit'].includes(next.command)) {
    return result('awaiting-work-items', state, {
      next_action: next
    });
  }

  if (next.stage === 'reconcile' && next.command === 'record-review') {
    return result('awaiting-recall-review', state, {
      next_action: next
    });
  }

  if (next.stage === 'enrich'
    && ['start-stage', 'remediate-stage'].includes(next.command)) {
    const definitions = planEnrichWorkItems(novelDir, runId);
    return result('plan-enrich', loadPipelineState(novelDir, runId), {
      work_item_count: definitions.length
    });
  }

  if (next.stage === 'enrich'
    && ['check', 'continue-stage'].includes(next.command)) {
    return completeEnrichStage(novelDir, runId);
  }

  if (next.stage === 'enrich'
    && ['claim', 'submit'].includes(next.command)) {
    return result('awaiting-work-items', state, {
      next_action: next
    });
  }

  if (next.stage === 'semantic-audit'
    && ['start-stage', 'remediate-stage'].includes(next.command)) {
    const definitions = planSemanticAuditWorkItems(novelDir, runId);
    return result('plan-semantic-audit', loadPipelineState(novelDir, runId), {
      work_item_count: definitions.length
    });
  }

  if (next.stage === 'semantic-audit'
    && ['check', 'continue-stage'].includes(next.command)) {
    return completeSemanticAuditStage(novelDir, runId);
  }

  if (next.stage === 'semantic-audit'
    && ['claim', 'submit'].includes(next.command)) {
    return result('awaiting-work-items', state, {
      next_action: next
    });
  }

  if (next.stage === 'publish'
    && ['build-publish', 'promote'].includes(next.command)) {
    return result('awaiting-publish-command', state, {
      next_action: next
    });
  }

  if (next.command === 'complete') return result('complete', state);

  throw new PipelineError(
    'STAGE_CONTROLLER_NOT_IMPLEMENTED',
    `No controller action is implemented for ${next.command} ${next.stage || ''}`.trim(),
    { next_action: next }
  );
}

module.exports = {
  runCurrentStageAction
};
