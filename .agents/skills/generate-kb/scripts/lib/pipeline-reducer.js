#!/usr/bin/env node
'use strict';

const { PipelineError } = require('./pipeline-events');

const STAGES = Object.freeze([
  'prepare',
  'inventory',
  'reconcile',
  'enrich',
  'semantic-audit',
  'publish'
]);

const STAGE_SET = new Set(STAGES);

function emptyStage(status = 'not_started') {
  return {
    status,
    input_hash: null,
    output_hash: null,
    gate_version: null,
    failure_code: null,
    remediation_stage: null,
    last_event_seq: null
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function invalid(message, details = null) {
  throw new PipelineError('INVALID_STAGE_TRANSITION', message, details);
}

function requireStage(payload) {
  const stage = payload?.stage;
  if (!STAGE_SET.has(stage)) invalid(`Unknown stage: ${JSON.stringify(stage)}`);
  return stage;
}

function invalidateFrom(state, stage, includeStage, event) {
  const start = STAGES.indexOf(stage) + (includeStage ? 0 : 1);
  const invalidatedStages = new Set(STAGES.slice(start));
  for (const downstream of STAGES.slice(start)) {
    state.stages[downstream] = {
      ...emptyStage('invalidated'),
      last_event_seq: event.seq
    };
  }
  for (const item of Object.values(state.work_items)) {
    if (invalidatedStages.has(item.stage)) {
      item.status = 'invalidated';
      item.last_event_seq = event.seq;
    }
  }
  state.review = null;
  state.publish = null;
}

function calculateNextAction(state) {
  if (state.review?.status === 'pending') {
    return { command: 'record-review', stage: 'reconcile' };
  }
  for (const stage of STAGES) {
    const status = state.stages[stage].status;
    if (status === 'running') {
      if (stage === 'publish') {
        if (state.publish?.status === 'built') return { command: 'promote', stage };
        if (!state.publish) return { command: 'build-publish', stage };
      }
      const items = Object.values(state.work_items).filter(item => item.stage === stage);
      if (items.some(item => item.status === 'pending')) return { command: 'claim', stage };
      if (items.some(item => item.status === 'claimed')) return { command: 'submit', stage };
      if (items.length > 0 && items.every(item => item.status === 'accepted')) {
        return { command: 'check', stage };
      }
      return { command: 'continue-stage', stage };
    }
    if (status === 'ready' || status === 'invalidated') return { command: 'start-stage', stage };
    if (status === 'blocked') return { command: 'remediate-stage', stage };
    if (status === 'awaiting_recall_review') return { command: 'record-review', stage };
  }
  return { command: 'complete', stage: null };
}

function initializeState(event) {
  if (event.type !== 'run_initialized') invalid('First event must be run_initialized');
  const stages = Object.fromEntries(STAGES.map((stage, index) => [
    stage,
    emptyStage(index === 0 ? 'ready' : 'not_started')
  ]));
  return {
    schema_version: 1,
    run_id: event.run_id,
    status: 'active',
    config: clone(event.payload.config || {}),
    stages,
    work_items: {},
    review: null,
    publish: null,
    last_seq: event.seq,
    last_event_id: event.event_id,
    last_event_hash: event.event_hash,
    next_action: { command: 'start-stage', stage: 'prepare' }
  };
}

function reducePipelineEvent(currentState, event) {
  if (currentState === null) return initializeState(event);
  if (event.run_id !== currentState.run_id) invalid('Event run ID does not match state');
  if (event.seq !== currentState.last_seq + 1) invalid('Event sequence does not follow state');
  if (event.type === 'run_initialized') invalid('run_initialized may only be the first event');

  const state = clone(currentState);
  if (event.type === 'stage_started') {
    const stage = requireStage(event.payload);
    const index = STAGES.indexOf(stage);
    const stageState = state.stages[stage];
    if (index > 0 && !['passed', 'published'].includes(state.stages[STAGES[index - 1]].status)) {
      invalid(`${stage} requires ${STAGES[index - 1]} to pass first`);
    }
    if (!['ready', 'blocked', 'invalidated', 'passed'].includes(stageState.status)) {
      invalid(`Cannot start ${stage} from ${stageState.status}`);
    }
    if (stageState.status === 'passed') {
      const changed = stageState.input_hash !== event.payload.input_hash
        || stageState.gate_version !== event.payload.gate_version;
      if (!changed) invalid(`${stage} already passed with the same input and gate version`);
    }
    invalidateFrom(state, stage, false, event);
    state.stages[stage] = {
      ...emptyStage('running'),
      input_hash: event.payload.input_hash || null,
      gate_version: event.payload.gate_version || null,
      last_event_seq: event.seq
    };
  } else if (event.type === 'stage_passed') {
    const stage = requireStage(event.payload);
    const index = STAGES.indexOf(stage);
    const stageState = state.stages[stage];
    if (stageState.status !== 'running') invalid(`Cannot pass ${stage} from ${stageState.status}`);
    if (stageState.input_hash !== (event.payload.input_hash || null)) {
      invalid(`${stage} input hash changed while running`);
    }
    if (stageState.gate_version !== (event.payload.gate_version || null)) {
      invalid(`${stage} gate version changed while running`);
    }
    if (typeof event.payload.output_hash !== 'string' || event.payload.output_hash.length === 0) {
      invalid(`${stage} requires an output hash`);
    }
    const stageItems = Object.values(state.work_items).filter(item => item.stage === stage);
    if (stageItems.some(item => item.status !== 'accepted')) {
      invalid(`${stage} cannot pass before all work items are accepted`);
    }
    state.stages[stage] = {
      ...stageState,
      status: 'passed',
      output_hash: event.payload.output_hash,
      failure_code: null,
      remediation_stage: null,
      last_event_seq: event.seq
    };
    if (index + 1 < STAGES.length) {
      const nextStage = STAGES[index + 1];
      state.stages[nextStage] = {
        ...emptyStage('ready'),
        last_event_seq: event.seq
      };
    }
  } else if (event.type === 'stage_gate_failed') {
    const stage = requireStage(event.payload);
    if (state.stages[stage].status !== 'running') invalid(`Cannot block ${stage} when it is not running`);
    state.stages[stage] = {
      ...state.stages[stage],
      status: 'blocked',
      failure_code: event.payload.failure_code || 'STAGE_GATE_FAILED',
      remediation_stage: event.payload.remediation_stage || stage,
      last_event_seq: event.seq
    };
  } else if (event.type === 'downstream_invalidated') {
    const stage = requireStage({ stage: event.payload.from_stage });
    invalidateFrom(state, stage, Boolean(event.payload.include_stage), event);
  } else if (event.type === 'work_items_created') {
    const stage = requireStage(event.payload);
    if (state.stages[stage].status !== 'running') invalid(`Cannot create work items while ${stage} is not running`);
    if (!Array.isArray(event.payload.items) || event.payload.items.length === 0) {
      invalid('work_items_created requires at least one item');
    }
    for (const item of event.payload.items) {
      if (state.work_items[item.work_item_id]
        && state.work_items[item.work_item_id].status !== 'invalidated') {
        invalid(`Duplicate work item ${item.work_item_id}`);
      }
      state.work_items[item.work_item_id] = {
        work_item_id: item.work_item_id,
        stage,
        status: 'pending',
        input_hash: item.input_hash,
        definition_hash: item.definition_hash,
        packet_hash: null,
        entity_keys: item.entity_keys || [],
        worker_id: null,
        lease_id: null,
        lease_expires_at: null,
        output_hash: null,
        receipt_hash: null,
        last_rejection: null,
        last_event_seq: event.seq
      };
    }
  } else if (event.type === 'work_item_claimed') {
    const item = state.work_items[event.payload.work_item_id];
    if (!item || item.status !== 'pending') invalid(`Work item is not pending: ${event.payload.work_item_id}`);
    if (item.stage !== event.payload.stage) invalid('Claim stage does not match work item stage');
    Object.assign(item, {
      status: 'claimed',
      worker_id: event.payload.worker_id,
      lease_id: event.payload.lease_id,
      lease_expires_at: event.payload.lease_expires_at,
      packet_hash: event.payload.packet_hash,
      last_rejection: null,
      last_event_seq: event.seq
    });
  } else if (event.type === 'work_item_lease_expired') {
    const item = state.work_items[event.payload.work_item_id];
    if (!item || item.status !== 'claimed' || item.lease_id !== event.payload.lease_id) {
      invalid(`Lease is not active: ${event.payload.work_item_id}`);
    }
    Object.assign(item, {
      status: 'pending',
      worker_id: null,
      lease_id: null,
      lease_expires_at: null,
      last_event_seq: event.seq
    });
  } else if (event.type === 'work_item_submission_rejected') {
    const item = state.work_items[event.payload.work_item_id];
    if (!item) invalid(`Unknown work item: ${event.payload.work_item_id}`);
    item.last_rejection = {
      code: event.payload.code,
      message: event.payload.message,
      event_id: event.event_id
    };
    item.last_event_seq = event.seq;
  } else if (event.type === 'work_item_accepted') {
    const item = state.work_items[event.payload.work_item_id];
    if (!item || item.status !== 'claimed') invalid(`Work item is not claimed: ${event.payload.work_item_id}`);
    if (item.stage !== event.payload.stage
      || item.worker_id !== event.payload.worker_id
      || item.lease_id !== event.payload.lease_id
      || item.input_hash !== event.payload.input_hash) {
      invalid(`Accepted work item identity does not match: ${event.payload.work_item_id}`);
    }
    Object.assign(item, {
      status: 'accepted',
      output_hash: event.payload.output_hash,
      receipt_hash: event.payload.receipt_hash,
      last_rejection: null,
      last_event_seq: event.seq
    });
  } else if (event.type === 'review_requested') {
    const stage = requireStage(event.payload);
    if (stage !== 'reconcile' || state.stages[stage].status !== 'running') {
      invalid('Recall review can only be requested by running reconcile');
    }
    const stageItems = Object.values(state.work_items).filter(item => item.stage === stage);
    if (stageItems.some(item => item.status !== 'accepted')) {
      invalid('Recall review requires every reconcile work item to be accepted');
    }
    if (state.stages[stage].input_hash !== (event.payload.input_hash || null)
      || state.stages[stage].gate_version !== (event.payload.gate_version || null)) {
      invalid('Recall review input or gate version changed');
    }
    if (typeof event.payload.output_hash !== 'string' || !event.payload.output_hash
      || typeof event.payload.packet_hash !== 'string' || !event.payload.packet_hash
      || typeof event.payload.source_hash !== 'string' || !event.payload.source_hash) {
      invalid('Recall review requires output, packet, and source hashes');
    }
    state.stages[stage] = {
      ...state.stages[stage],
      status: 'awaiting_recall_review',
      output_hash: event.payload.output_hash,
      last_event_seq: event.seq
    };
    state.review = {
      status: 'pending',
      stage,
      packet_hash: event.payload.packet_hash,
      source_hash: event.payload.source_hash,
      output_hash: event.payload.output_hash,
      requested_event_id: event.event_id,
      receipt_hash: null,
      reviewer: null,
      last_event_seq: event.seq
    };
  } else if (event.type === 'review_recorded') {
    const stage = requireStage(event.payload);
    if (stage !== 'reconcile'
      || state.stages[stage].status !== 'awaiting_recall_review'
      || state.review?.status !== 'pending') {
      invalid('No recall review is pending');
    }
    if (event.payload.packet_hash !== state.review.packet_hash
      || event.payload.source_hash !== state.review.source_hash
      || event.payload.output_hash !== state.review.output_hash) {
      invalid('Recall review receipt hashes are stale');
    }
    if (event.payload.action !== 'accept_recall'
      || typeof event.payload.receipt_hash !== 'string' || !event.payload.receipt_hash) {
      invalid('Recorded recall review must accept current recall with a receipt hash');
    }
    state.stages[stage] = {
      ...state.stages[stage],
      status: 'passed',
      failure_code: null,
      remediation_stage: null,
      last_event_seq: event.seq
    };
    state.review = {
      ...state.review,
      status: 'accepted',
      receipt_hash: event.payload.receipt_hash,
      reviewer: event.payload.reviewer || null,
      recorded_event_id: event.event_id,
      last_event_seq: event.seq
    };
    state.stages.enrich = {
      ...emptyStage('ready'),
      last_event_seq: event.seq
    };
  } else if (event.type === 'publish_bundle_built') {
    if (event.payload.stage !== 'publish' || state.stages.publish.status !== 'running') {
      invalid('Publish bundle can only be built by a running publish stage');
    }
    if (state.publish) invalid('Publish bundle has already been built for this publish stage');
    if (state.stages.publish.input_hash !== (event.payload.input_hash || null)) {
      invalid('Publish bundle input hash changed while building');
    }
    for (const key of ['bundle_hash', 'final_data_hash', 'output_hash', 'manifest_hash']) {
      if (typeof event.payload[key] !== 'string' || event.payload[key].length === 0) {
        invalid(`Publish bundle requires ${key}`);
      }
    }
    state.publish = {
      status: 'built',
      bundle_hash: event.payload.bundle_hash,
      final_data_hash: event.payload.final_data_hash,
      manifest_hash: event.payload.manifest_hash,
      output_hash: event.payload.output_hash,
      bundle_root: event.payload.bundle_root || null,
      last_event_seq: event.seq
    };
    state.stages.publish.output_hash = event.payload.output_hash;
    state.stages.publish.last_event_seq = event.seq;
  } else if (event.type === 'bundle_promoted') {
    if (event.payload.stage !== 'publish'
      || state.stages.publish.status !== 'running'
      || state.publish?.status !== 'built') {
      invalid('Bundle promotion requires a built publish bundle');
    }
    if (event.payload.bundle_hash !== state.publish.bundle_hash) {
      invalid('Promoted bundle does not match the built publish bundle');
    }
    if (typeof event.payload.receipt_hash !== 'string' || !event.payload.receipt_hash) {
      invalid('Bundle promotion requires a receipt hash');
    }
    state.publish = {
      ...state.publish,
      status: 'promoted',
      receipt_hash: event.payload.receipt_hash,
      promoted_at: event.payload.promoted_at || null,
      last_event_seq: event.seq
    };
    state.stages.publish = {
      ...state.stages.publish,
      status: 'published',
      output_hash: event.payload.bundle_hash,
      last_event_seq: event.seq
    };
  } else if (event.type === 'bundle_rolled_back') {
    if (event.payload.stage !== 'publish'
      || state.stages.publish.status !== 'published'
      || state.publish?.status !== 'promoted') {
      invalid('Bundle rollback requires a promoted publish bundle');
    }
    if (typeof event.payload.bundle_hash !== 'string' || !event.payload.bundle_hash) {
      invalid('Bundle rollback requires a target bundle hash');
    }
    if (typeof event.payload.receipt_hash !== 'string' || !event.payload.receipt_hash) {
      invalid('Bundle rollback requires a receipt hash');
    }
    state.publish = {
      ...state.publish,
      status: 'rolled_back',
      rollback_bundle_hash: event.payload.bundle_hash,
      rollback_final_data_hash: event.payload.final_data_hash || null,
      rollback_receipt_hash: event.payload.receipt_hash,
      last_event_seq: event.seq
    };
  } else {
    invalid(`Event ${event.type} is not implemented by the reducer yet`);
  }

  state.last_seq = event.seq;
  state.last_event_id = event.event_id;
  state.last_event_hash = event.event_hash;
  state.next_action = calculateNextAction(state);
  return state;
}

function replayPipelineEvents(events) {
  let state = null;
  for (const event of events) state = reducePipelineEvent(state, event);
  if (state === null) throw new PipelineError('RUN_NOT_FOUND', 'Pipeline event log is empty');
  return state;
}

module.exports = {
  STAGES,
  calculateNextAction,
  reducePipelineEvent,
  replayPipelineEvents
};
