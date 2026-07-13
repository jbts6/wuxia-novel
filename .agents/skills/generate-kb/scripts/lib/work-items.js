#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  PipelineError,
  readJson,
  sha256,
  stableStringify,
  writeJsonAtomic
} = require('./atomic-json');
const { assertManagedSegment, getPipelinePaths } = require('./pipeline-paths');
const { validateStageDraft } = require('./stage-contracts');
const {
  appendPipelineEvent,
  loadPipelineState
} = require('./pipeline-state');

const WORK_ITEM_PATTERN = /^[a-z0-9][a-z0-9_-]{2,159}$/;
const MAX_DRAFT_BYTES = 5 * 1024 * 1024;

function validateWorkItemId(value) {
  if (typeof value !== 'string' || !WORK_ITEM_PATTERN.test(value)) {
    throw new PipelineError('INVALID_WORK_ITEM', `Invalid work item ID: ${JSON.stringify(value)}`);
  }
  return value;
}

function itemDirectories(paths, stage) {
  assertManagedSegment(stage, 'stage');
  const root = path.join(paths.workItems, stage);
  return {
    root,
    definitions: path.join(root, 'definitions'),
    packets: path.join(root, 'packets'),
    drafts: path.join(root, 'drafts'),
    receipts: path.join(root, 'receipts')
  };
}

function normalizePlannedItem(stage, item) {
  const workItemId = validateWorkItemId(item?.work_item_id);
  if (typeof item.input_hash !== 'string' || item.input_hash.length === 0) {
    throw new PipelineError('INVALID_WORK_ITEM', `${workItemId} requires input_hash`);
  }
  if (!item.instructions || typeof item.instructions !== 'object' || Array.isArray(item.instructions)) {
    throw new PipelineError('INVALID_WORK_ITEM', `${workItemId} requires instructions`);
  }
  if (!item.source_payload || typeof item.source_payload !== 'object' || Array.isArray(item.source_payload)) {
    throw new PipelineError('INVALID_WORK_ITEM', `${workItemId} requires source_payload`);
  }
  const entityKeys = item.entity_keys || [];
  if (!Array.isArray(entityKeys) || entityKeys.some(key => typeof key !== 'string' || key.length === 0)) {
    throw new PipelineError('INVALID_WORK_ITEM', `${workItemId} has invalid entity_keys`);
  }
  const definition = {
    schema_version: 1,
    stage,
    work_item_id: workItemId,
    input_hash: item.input_hash,
    instructions: item.instructions,
    source_payload: item.source_payload,
    entity_keys: [...new Set(entityKeys)].sort()
  };
  return {
    ...definition,
    definition_hash: sha256(stableStringify(definition))
  };
}

function createWorkItems(novelDir, runId, stage, items) {
  const state = loadPipelineState(novelDir, runId);
  if (state.stages[stage]?.status !== 'running') {
    throw new PipelineError('INVALID_STAGE_TRANSITION', `Cannot create work items for inactive stage ${stage}`);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new PipelineError('INVALID_WORK_ITEM', 'At least one work item is required');
  }
  const normalized = items.map(item => normalizePlannedItem(stage, item))
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
  if (new Set(normalized.map(item => item.work_item_id)).size !== normalized.length) {
    throw new PipelineError('INVALID_WORK_ITEM', 'Work item IDs must be unique');
  }
  const paths = getPipelinePaths(novelDir, runId);
  const dirs = itemDirectories(paths, stage);
  appendPipelineEvent(novelDir, runId, 'work_items_created', {
    stage,
    items: normalized.map(item => ({
      work_item_id: item.work_item_id,
      input_hash: item.input_hash,
      definition_hash: item.definition_hash,
      entity_keys: item.entity_keys
    }))
  }, {
    beforeCommit: () => {
      for (const item of normalized) {
        writeJsonAtomic(path.join(dirs.definitions, `${item.work_item_id}.json`), item);
      }
    }
  });
  return normalized;
}

function activeStage(state) {
  return Object.entries(state.stages).find(([, value]) => value.status === 'running')?.[0] || null;
}

function expireLeases(novelDir, runId, now) {
  let state = loadPipelineState(novelDir, runId);
  const expired = Object.values(state.work_items)
    .filter(item => item.status === 'claimed' && Date.parse(item.lease_expires_at) <= now.getTime())
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
  for (const item of expired) {
    state = appendPipelineEvent(novelDir, runId, 'work_item_lease_expired', {
      stage: item.stage,
      work_item_id: item.work_item_id,
      worker_id: item.worker_id,
      lease_id: item.lease_id,
      expired_at: now.toISOString()
    }, { now });
  }
  return state;
}

function claimWorkItem(novelDir, runId, { workerId, now = new Date(), leaseMs = 15 * 60_000 }) {
  assertManagedSegment(workerId, 'worker ID');
  if (!Number.isInteger(leaseMs) || leaseMs < 1) {
    throw new PipelineError('INVALID_LEASE', 'leaseMs must be a positive integer');
  }
  const claimTime = now instanceof Date ? now : new Date(now);
  let state = expireLeases(novelDir, runId, claimTime);
  const stage = activeStage(state);
  if (!stage) throw new PipelineError('NO_WORK_ITEM_AVAILABLE', 'No stage is currently running');

  const stageItems = Object.values(state.work_items).filter(item => item.stage === stage);
  const claimed = stageItems.filter(item => item.status === 'claimed');
  const concurrency = ['inventory', 'enrich'].includes(stage) ? state.config.max_workers : 1;
  if (claimed.length >= concurrency) {
    throw new PipelineError('NO_WORK_ITEM_AVAILABLE', `Stage ${stage} has reached concurrency ${concurrency}`);
  }

  const claimedKeys = new Set(claimed.flatMap(item => item.entity_keys || []));
  const item = stageItems
    .filter(candidate => candidate.status === 'pending')
    .filter(candidate => stage !== 'enrich' || !(candidate.entity_keys || []).some(key => claimedKeys.has(key)))
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id))[0];
  if (!item) throw new PipelineError('NO_WORK_ITEM_AVAILABLE', `No claimable work item for ${stage}`);

  const paths = getPipelinePaths(novelDir, runId);
  const dirs = itemDirectories(paths, stage);
  const leaseId = `lease-${sha256(`${runId}\0${item.work_item_id}\0${workerId}\0${claimTime.toISOString()}\0${state.last_seq}`).slice(0, 20)}`;
  const leaseExpiresAt = new Date(claimTime.getTime() + leaseMs).toISOString();
  const definition = {
    schema_version: 1,
    run_id: runId,
    stage,
    work_item_id: item.work_item_id,
    input_hash: item.input_hash,
    worker_id: workerId,
    lease_id: leaseId,
    lease_expires_at: leaseExpiresAt,
    instructions: null,
    source_payload: null
  };
  const planned = loadPlannedDefinition(novelDir, runId, stage, item);
  definition.instructions = planned.instructions;
  definition.source_payload = planned.source_payload;
  const packetHash = sha256(stableStringify(definition));
  const packetPath = path.join(dirs.packets, `${item.work_item_id}.json`);

  state = appendPipelineEvent(novelDir, runId, 'work_item_claimed', {
    stage,
    work_item_id: item.work_item_id,
    worker_id: workerId,
    lease_id: leaseId,
    lease_expires_at: leaseExpiresAt,
    packet_hash: packetHash
  }, {
    now: claimTime,
    beforeCommit: () => writeJsonAtomic(packetPath, definition)
  });
  return { packet: definition, packet_path: packetPath, state };
}

function loadPlannedDefinition(novelDir, runId, stage, item) {
  const paths = getPipelinePaths(novelDir, runId);
  const dirs = itemDirectories(paths, stage);
  const definitionPath = path.join(dirs.definitions, `${item.work_item_id}.json`);
  const definition = readJson(definitionPath, null);
  if (!definition) {
    throw new PipelineError('WORK_ITEM_DEFINITION_MISSING', `Missing definition for ${item.work_item_id}`);
  }
  const { definition_hash: storedHash, ...definitionBody } = definition;
  const actualHash = sha256(stableStringify(definitionBody));
  if (actualHash !== item.definition_hash || storedHash !== item.definition_hash) {
    throw new PipelineError('WORK_ITEM_DEFINITION_TAMPERED', `Definition hash mismatch for ${item.work_item_id}`);
  }
  return definition;
}

function rejectSubmission(novelDir, runId, item, code, message, now) {
  appendPipelineEvent(novelDir, runId, 'work_item_submission_rejected', {
    stage: item.stage,
    work_item_id: item.work_item_id,
    code,
    message
  }, { now });
  throw new PipelineError(code, message);
}

function readDraft(draftPath) {
  let stat;
  try {
    stat = fs.lstatSync(draftPath);
  } catch (error) {
    throw new PipelineError('DRAFT_INVALID', `Cannot read draft: ${error.message}`);
  }
  if (!stat.isFile() || stat.size > MAX_DRAFT_BYTES) {
    throw new PipelineError('DRAFT_INVALID', 'Draft must be a regular file no larger than 5 MiB');
  }
  try {
    return JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  } catch (error) {
    throw new PipelineError('DRAFT_INVALID', `Draft is not valid JSON: ${error.message}`);
  }
}

function submitWorkItem(novelDir, runId, { workerId, itemId, draftPath, now = new Date() }) {
  validateWorkItemId(itemId);
  assertManagedSegment(workerId, 'worker ID');
  const submitTime = now instanceof Date ? now : new Date(now);
  const state = loadPipelineState(novelDir, runId);
  const item = state.work_items[itemId];
  if (!item) throw new PipelineError('WORK_ITEM_NOT_FOUND', `Unknown work item: ${itemId}`);
  if (item.status === 'accepted') {
    return rejectSubmission(novelDir, runId, item, 'WORK_ITEM_ALREADY_ACCEPTED', `${itemId} was already accepted`, submitTime);
  }
  if (item.status !== 'claimed') {
    return rejectSubmission(novelDir, runId, item, 'WORK_ITEM_NOT_CLAIMED', `${itemId} is not claimed`, submitTime);
  }
  if (item.worker_id !== workerId) {
    return rejectSubmission(novelDir, runId, item, 'WORK_ITEM_OWNER_MISMATCH', `${itemId} belongs to ${item.worker_id}`, submitTime);
  }
  if (Date.parse(item.lease_expires_at) <= submitTime.getTime()) {
    appendPipelineEvent(novelDir, runId, 'work_item_lease_expired', {
      stage: item.stage,
      work_item_id: item.work_item_id,
      worker_id: item.worker_id,
      lease_id: item.lease_id,
      expired_at: submitTime.toISOString()
    }, { now: submitTime });
    const pending = loadPipelineState(novelDir, runId).work_items[itemId];
    return rejectSubmission(novelDir, runId, pending, 'WORK_ITEM_LEASE_EXPIRED', `${itemId} lease expired`, submitTime);
  }

  const draft = readDraft(path.resolve(draftPath));
  const identity = {
    schema_version: 1,
    run_id: runId,
    stage: item.stage,
    work_item_id: item.work_item_id,
    input_hash: item.input_hash,
    worker_id: item.worker_id,
    lease_id: item.lease_id
  };
  if (Object.entries(identity).some(([key, value]) => draft?.[key] !== value)) {
    return rejectSubmission(novelDir, runId, item, 'DRAFT_IDENTITY_MISMATCH', `${itemId} draft identity is stale or cross-stage`, submitTime);
  }
  if (!draft.payload || typeof draft.payload !== 'object' || Array.isArray(draft.payload)) {
    return rejectSubmission(novelDir, runId, item, 'DRAFT_SCHEMA_INVALID', `${itemId} payload must be an object`, submitTime);
  }

  const definition = loadPlannedDefinition(novelDir, runId, item.stage, item);
  const stageValidation = validateStageDraft(item.stage, draft.payload, definition);
  if (!stageValidation.passed) {
    return rejectSubmission(
      novelDir,
      runId,
      item,
      stageValidation.code,
      stageValidation.errors.join('; '),
      submitTime
    );
  }

  const outputHash = sha256(stableStringify(draft.payload));
  const receipt = {
    schema_version: 1,
    run_id: runId,
    stage: item.stage,
    work_item_id: item.work_item_id,
    input_hash: item.input_hash,
    worker_id: workerId,
    lease_id: item.lease_id,
    draft_hash: sha256(stableStringify(draft)),
    output_hash: outputHash,
    output_count: stageValidation.output_count,
    empty_result: stageValidation.empty_result,
    status: 'accepted',
    accepted_at: submitTime.toISOString()
  };
  const receiptHash = sha256(stableStringify(receipt));
  const paths = getPipelinePaths(novelDir, runId);
  const dirs = itemDirectories(paths, item.stage);
  const managedDraftPath = path.join(dirs.drafts, `${itemId}.json`);
  const receiptPath = path.join(dirs.receipts, `${itemId}.json`);
  const nextState = appendPipelineEvent(novelDir, runId, 'work_item_accepted', {
    stage: item.stage,
    work_item_id: itemId,
    input_hash: item.input_hash,
    worker_id: workerId,
    lease_id: item.lease_id,
    output_hash: outputHash,
    receipt_hash: receiptHash
  }, {
    now: submitTime,
    beforeCommit: () => {
      writeJsonAtomic(managedDraftPath, draft);
      writeJsonAtomic(receiptPath, receipt);
    }
  });
  return {
    receipt,
    receipt_path: receiptPath,
    draft_path: managedDraftPath,
    state: nextState
  };
}

module.exports = {
  claimWorkItem,
  createWorkItems,
  loadPlannedDefinition,
  submitWorkItem,
  validateWorkItemId
};
