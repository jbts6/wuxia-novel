#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { computeSourceArtifacts } = require('../prepare-source');
const {
  PipelineError,
  readJson,
  sha256,
  stableStringify,
  writeJsonAtomic,
  writeTextAtomic
} = require('./atomic-json');
const { getPipelinePaths } = require('./pipeline-paths');
const {
  appendPipelineEvent,
  loadPipelineState
} = require('./pipeline-state');
const { validateStageDraft } = require('./stage-contracts');
const { createWorkItems, loadPlannedDefinition } = require('./work-items');

const PREPARE_GATE_VERSION = 'prepare-v1';
const INVENTORY_GATE_VERSION = 'inventory-v2';

function sourceArtifactHash(sourceIndex, scanPlan) {
  return sha256(stableStringify({ sourceIndex, scanPlan }));
}

function prepareRunSource(novelDir, runId, options = {}) {
  const state = loadPipelineState(novelDir, runId);
  if (!['ready', 'invalidated', 'blocked'].includes(state.stages.prepare.status)) {
    throw new PipelineError('INVALID_STAGE_TRANSITION', `prepare is ${state.stages.prepare.status}`);
  }
  const { sourceIndex, scanPlan } = computeSourceArtifacts(novelDir, options);
  if (!sourceIndex.source_alignment_valid) {
    throw new PipelineError('SOURCE_ALIGNMENT_FAILED', 'Chapter files do not align with the original novel');
  }
  const paths = getPipelinePaths(novelDir, runId);
  const indexPath = path.join(paths.source, 'source-index.json');
  const planPath = path.join(paths.source, 'scan-plan.json');
  const inputHash = sha256(stableStringify({
    source_hash: sourceIndex.source_hash,
    chapter_corpus_hash: sourceIndex.chapter_corpus_hash,
    window_lines: sourceIndex.window_lines,
    overlap_lines: sourceIndex.overlap_lines
  }));
  const outputHash = sourceArtifactHash(sourceIndex, scanPlan);
  appendPipelineEvent(novelDir, runId, 'stage_started', {
    stage: 'prepare',
    input_hash: inputHash,
    gate_version: PREPARE_GATE_VERSION
  }, {
    beforeCommit: () => {
      writeJsonAtomic(indexPath, sourceIndex);
      writeJsonAtomic(planPath, scanPlan);
    }
  });
  const nextState = appendPipelineEvent(novelDir, runId, 'stage_passed', {
    stage: 'prepare',
    input_hash: inputHash,
    output_hash: outputHash,
    gate_version: PREPARE_GATE_VERSION
  });
  return { sourceIndex, scanPlan, output_hash: outputHash, state: nextState };
}

function buildInventoryDefinitions(sourceIndex, options = {}) {
  const searchAnchors = [...new Set((options.searchAnchors || [])
    .filter(anchor => typeof anchor === 'string' && anchor.trim())
    .map(anchor => anchor.trim()))].sort();
  const anchorInstructions = searchAnchors.length > 0 ? { search_anchors: searchAnchors } : {};
  const definitions = [];
  for (const window of sourceIndex.windows) {
    const sourcePayload = {
      window_id: window.id,
      chapter: window.chapter,
      line_start: window.line_start,
      line_end: window.line_end,
      text: window.text
    };
    for (const kind of ['event-dialogue', 'named-inventory']) {
      const prefix = kind === 'event-dialogue' ? 'event' : 'named';
      definitions.push({
        work_item_id: `inventory_${prefix}_${window.id}`,
        input_hash: sha256(stableStringify({ kind, sourcePayload, ...anchorInstructions })),
        instructions: {
          prompt_version: `${kind}-v1`,
          kind,
          allowed_output: 'candidate_batch',
          ...anchorInstructions
        },
        source_payload: sourcePayload
      });
    }
  }
  for (const chapter of sourceIndex.chapters) {
    const windows = sourceIndex.windows
      .filter(window => window.chapter === chapter.chapter)
      .map(window => ({
        window_id: window.id,
        line_start: window.line_start,
        line_end: window.line_end,
        text: window.text
      }));
    const sourcePayload = { chapter: chapter.chapter, windows };
    definitions.push({
      work_item_id: `inventory_summary_ch${String(chapter.chapter).padStart(3, '0')}`,
      input_hash: sha256(stableStringify({ kind: 'chapter-summary', sourcePayload })),
      instructions: {
        prompt_version: 'chapter-summary-v1',
        kind: 'chapter-summary',
        allowed_output: 'chapter_summary_draft'
      },
      source_payload: sourcePayload
    });
  }
  return definitions.sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
}

function loadRunSource(paths) {
  const sourceIndex = readJson(path.join(paths.source, 'source-index.json'), null);
  const scanPlan = readJson(path.join(paths.source, 'scan-plan.json'), null);
  if (!sourceIndex || !scanPlan) {
    throw new PipelineError('SOURCE_ARTIFACTS_MISSING', 'Run-scoped source artifacts are missing');
  }
  if (sourceIndex.source_hash !== scanPlan.source_hash
    || sourceIndex.chapter_corpus_hash !== scanPlan.chapter_corpus_hash) {
    throw new PipelineError('SOURCE_ARTIFACTS_STALE', 'Run-scoped source hashes disagree');
  }
  return { sourceIndex, scanPlan };
}

function loadSearchAnchors(paths) {
  const anchors = readJson(path.join(paths.review, 'search-anchors.json'), []);
  if (!Array.isArray(anchors)
    || anchors.some(anchor => typeof anchor !== 'string' || !anchor.trim())) {
    throw new PipelineError('REVIEW_RECEIPT_INVALID', 'search-anchors.json must contain strings');
  }
  return anchors;
}

function planInventoryWorkItems(novelDir, runId) {
  let state = loadPipelineState(novelDir, runId);
  const paths = getPipelinePaths(novelDir, runId);
  const { sourceIndex, scanPlan } = loadRunSource(paths);
  const expectedPrepareHash = sourceArtifactHash(sourceIndex, scanPlan);
  if (state.stages.prepare.output_hash !== expectedPrepareHash) {
    throw new PipelineError('SOURCE_ARTIFACTS_STALE', 'Prepare output hash does not match source artifacts');
  }
  if (['ready', 'invalidated', 'blocked'].includes(state.stages.inventory.status)) {
    state = appendPipelineEvent(novelDir, runId, 'stage_started', {
      stage: 'inventory',
      input_hash: expectedPrepareHash,
      gate_version: INVENTORY_GATE_VERSION
    });
  }
  if (state.stages.inventory.status !== 'running') {
    throw new PipelineError('INVALID_STAGE_TRANSITION', `inventory is ${state.stages.inventory.status}`);
  }
  if (Object.values(state.work_items).some(item => item.stage === 'inventory' && item.status !== 'invalidated')) {
    throw new PipelineError('WORK_ITEMS_ALREADY_PLANNED', 'Inventory work items already exist');
  }
  const definitions = buildInventoryDefinitions(sourceIndex, {
    searchAnchors: loadSearchAnchors(paths)
  });
  createWorkItems(novelDir, runId, 'inventory', definitions);
  return definitions;
}

function expectedInventoryIds(sourceIndex) {
  return new Set(buildInventoryDefinitions(sourceIndex).map(item => item.work_item_id));
}

function definitionMatchesExpected(definition, expected) {
  return definition.stage === 'inventory'
    && definition.work_item_id === expected.work_item_id
    && definition.input_hash === expected.input_hash
    && stableStringify(definition.instructions) === stableStringify(expected.instructions)
    && stableStringify(definition.source_payload) === stableStringify(expected.source_payload)
    && stableStringify(definition.entity_keys || []) === '[]';
}

function readManagedJson(filePath, label, errors) {
  try {
    const value = readJson(filePath, null);
    if (value === null) errors.push(`${label}: missing managed artifact`);
    return value;
  } catch (error) {
    errors.push(`${label}: invalid JSON (${error.message})`);
    return null;
  }
}

function validateInventoryStage(novelDir, runId) {
  const state = loadPipelineState(novelDir, runId);
  const paths = getPipelinePaths(novelDir, runId);
  const { sourceIndex, scanPlan } = loadRunSource(paths);
  const expectedPrepareHash = sourceArtifactHash(sourceIndex, scanPlan);
  const expectedDefinitions = new Map(buildInventoryDefinitions(sourceIndex, {
    searchAnchors: loadSearchAnchors(paths)
  })
    .map(definition => [definition.work_item_id, definition]));
  const expected = new Set(expectedDefinitions.keys());
  const items = Object.values(state.work_items).filter(item => item.stage === 'inventory');
  const actual = new Set(items.map(item => item.work_item_id));
  const errors = [];
  if (state.stages.prepare.output_hash !== expectedPrepareHash) {
    errors.push('prepare output hash mismatch for current run-scoped source artifacts');
  }
  if (state.stages.inventory.input_hash !== expectedPrepareHash) {
    errors.push('inventory input hash does not match current prepare output');
  }
  for (const itemId of expected) {
    if (!actual.has(itemId)) errors.push(`missing work item ${itemId}`);
  }
  for (const item of items) {
    const expectedDefinition = expectedDefinitions.get(item.work_item_id);
    if (!expectedDefinition) errors.push(`unexpected work item ${item.work_item_id}`);
    if (expectedDefinition && item.input_hash !== expectedDefinition.input_hash) {
      errors.push(`${item.work_item_id}: stale work item input hash`);
    }

    let definition = null;
    try {
      definition = loadPlannedDefinition(novelDir, runId, 'inventory', item);
      if (expectedDefinition && !definitionMatchesExpected(definition, expectedDefinition)) {
        errors.push(`${item.work_item_id}: definition does not match current source window and prompt`);
      }
    } catch (error) {
      errors.push(`${item.work_item_id}: definition hash mismatch (${error.code || error.message})`);
    }

    if (item.status !== 'accepted') errors.push(`${item.work_item_id}: status is ${item.status}, expected accepted`);
    const receiptPath = path.join(paths.workItems, 'inventory', 'receipts', `${item.work_item_id}.json`);
    const receipt = readManagedJson(receiptPath, `${item.work_item_id} receipt`, errors);
    if (!receipt) {
      errors.push(`${item.work_item_id}: missing receipt`);
      continue;
    }
    if (sha256(stableStringify(receipt)) !== item.receipt_hash) {
      errors.push(`${item.work_item_id}: receipt hash mismatch`);
    }
    if (receipt.run_id !== runId
      || receipt.stage !== 'inventory'
      || receipt.work_item_id !== item.work_item_id
      || receipt.input_hash !== item.input_hash
      || receipt.output_hash !== item.output_hash
      || receipt.status !== 'accepted') {
      errors.push(`${item.work_item_id}: receipt identity does not match accepted work item`);
    }
    if (!Number.isInteger(receipt.output_count) || receipt.output_count < 0) {
      errors.push(`${item.work_item_id}: receipt output_count is missing`);
    }
    if (receipt.output_count === 0 && !receipt.empty_result) {
      errors.push(`${item.work_item_id}: zero output receipt lacks empty_result`);
    }

    const draftPath = path.join(paths.workItems, 'inventory', 'drafts', `${item.work_item_id}.json`);
    const draft = readManagedJson(draftPath, `${item.work_item_id} draft`, errors);
    if (!draft) continue;
    if (sha256(stableStringify(draft)) !== receipt.draft_hash) {
      errors.push(`${item.work_item_id}: draft hash mismatch`);
    }
    const draftOutputHash = sha256(stableStringify(draft.payload));
    if (draftOutputHash !== receipt.output_hash || draftOutputHash !== item.output_hash) {
      errors.push(`${item.work_item_id}: draft output hash mismatch`);
    }
    if (definition) {
      const stageValidation = validateStageDraft('inventory', draft.payload, definition);
      if (!stageValidation.passed) {
        errors.push(`${item.work_item_id}: accepted draft no longer passes ${stageValidation.code}`);
      } else {
        if (receipt.output_count !== stageValidation.output_count) {
          errors.push(`${item.work_item_id}: receipt output_count does not match draft`);
        }
        if (stableStringify(receipt.empty_result) !== stableStringify(stageValidation.empty_result)) {
          errors.push(`${item.work_item_id}: receipt empty_result does not match draft`);
        }
      }
    }
  }
  return {
    passed: errors.length === 0,
    expected_count: expected.size,
    accepted_count: items.filter(item => item.status === 'accepted').length,
    errors
  };
}

function materializeInventory(novelDir, runId) {
  const paths = getPipelinePaths(novelDir, runId);
  const state = loadPipelineState(novelDir, runId);
  const items = Object.values(state.work_items)
    .filter(item => item.stage === 'inventory' && item.status === 'accepted')
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
  const candidates = [];
  const summaries = [];
  for (const item of items) {
    const definition = readJson(path.join(
      paths.workItems, 'inventory', 'definitions', `${item.work_item_id}.json`
    ));
    const draft = readJson(path.join(
      paths.workItems, 'inventory', 'drafts', `${item.work_item_id}.json`
    ));
    if (definition.instructions.kind === 'chapter-summary') {
      summaries.push(draft.payload.chapter_summary);
    } else {
      candidates.push(...draft.payload.candidates);
    }
  }
  candidates.sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));
  summaries.sort((left, right) => left.chapter - right.chapter);
  const candidateIds = candidates.map(candidate => candidate.candidate_id);
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new PipelineError('DUPLICATE_CANDIDATE_ID', 'Inventory drafts contain duplicate candidate IDs');
  }
  const outputDir = path.join(paths.materialized, 'inventory');
  writeTextAtomic(
    path.join(outputDir, 'candidates.jsonl'),
    candidates.length > 0 ? `${candidates.map(candidate => stableStringify(candidate)).join('\n')}\n` : ''
  );
  writeJsonAtomic(path.join(outputDir, 'chapter-summary-drafts.json'), summaries);
  return {
    candidates,
    chapter_summaries: summaries,
    output_hash: sha256(stableStringify({ candidates, summaries }))
  };
}

function completeInventoryStage(novelDir, runId) {
  const validation = validateInventoryStage(novelDir, runId);
  if (!validation.passed) {
    throw new PipelineError('INVENTORY_GATE_FAILED', validation.errors.join('; '), validation);
  }
  const materialized = materializeInventory(novelDir, runId);
  const state = loadPipelineState(novelDir, runId);
  const nextState = appendPipelineEvent(novelDir, runId, 'stage_passed', {
    stage: 'inventory',
    input_hash: state.stages.inventory.input_hash,
    output_hash: materialized.output_hash,
    gate_version: state.stages.inventory.gate_version
  });
  return { validation, materialized, state: nextState };
}

module.exports = {
  buildInventoryDefinitions,
  completeInventoryStage,
  materializeInventory,
  planInventoryWorkItems,
  prepareRunSource,
  validateInventoryStage
};
