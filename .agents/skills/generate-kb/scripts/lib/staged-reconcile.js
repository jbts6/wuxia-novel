#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  PipelineError,
  readJson,
  sha256,
  stableStringify,
  writeJsonAtomic,
  writeJsonLinesAtomic
} = require('./atomic-json');
const { readJsonl } = require('./ledger');
const { getPipelinePaths } = require('./pipeline-paths');
const {
  clusterId,
  decisionId,
  provisionalKey,
  signalSeed
} = require('./provisional-contracts');
const {
  appendPipelineEvent,
  loadPipelineState
} = require('./pipeline-state');
const {
  createWorkItems,
  loadPlannedDefinition
} = require('./work-items');

const RECONCILE_GATE_VERSION = 'reconcile-v1';
const CORE_IMPORTANCE = new Set(['核心', '重要', 'core', 'important', 'main']);

function normalizeName(value) {
  return String(value ?? '').normalize('NFKC').trim();
}

function loadInventoryMaterialized(paths) {
  const candidatePath = path.join(paths.materialized, 'inventory', 'candidates.jsonl');
  const summaryPath = path.join(paths.materialized, 'inventory', 'chapter-summary-drafts.json');
  if (!fs.existsSync(candidatePath) || !fs.existsSync(summaryPath)) {
    throw new PipelineError(
      'INVENTORY_ARTIFACTS_MISSING',
      'Run-scoped inventory candidates and chapter summaries are required'
    );
  }
  return {
    candidates: readJsonl(candidatePath),
    chapter_summaries: readJson(summaryPath)
  };
}

function loadSourceIndex(paths) {
  const sourceIndex = readJson(path.join(paths.source, 'source-index.json'), null);
  if (!sourceIndex) throw new PipelineError('SOURCE_ARTIFACTS_MISSING', 'source-index.json is missing');
  return sourceIndex;
}

function groupCandidates(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.category_hint}\0${normalizeName(candidate.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  return [...groups.values()]
    .map(group => group.sort((left, right) => left.candidate_id.localeCompare(right.candidate_id)))
    .sort((left, right) => left[0].candidate_id.localeCompare(right[0].candidate_id));
}

function buildReconcileDefinitions(candidates, round, parentInputHash) {
  return groupCandidates(candidates).map(group => {
    const cluster = clusterId(group, round);
    const sourcePayload = { candidates: group };
    return {
      work_item_id: `reconcile_cluster_r${round}_${cluster}`,
      input_hash: sha256(stableStringify({
        parent_input_hash: parentInputHash,
        prompt_version: 'reconcile-cluster-v1',
        source_payload: sourcePayload
      })),
      instructions: {
        kind: 'reconcile-cluster',
        prompt_version: 'reconcile-cluster-v1',
        reconcile_round: round,
        cluster_id: cluster,
        decision_id: decisionId(cluster),
        formal_ids_forbidden: true
      },
      source_payload: sourcePayload
    };
  }).sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
}

function planReconcileWorkItems(novelDir, runId) {
  let state = loadPipelineState(novelDir, runId);
  if (!['ready', 'invalidated', 'blocked'].includes(state.stages.reconcile.status)) {
    throw new PipelineError('INVALID_STAGE_TRANSITION', `reconcile is ${state.stages.reconcile.status}`);
  }
  if (state.stages.inventory.status !== 'passed') {
    throw new PipelineError('INVALID_STAGE_TRANSITION', 'inventory must pass before reconcile');
  }
  if (state.stages.reconcile.status === 'blocked') {
    state = appendPipelineEvent(novelDir, runId, 'downstream_invalidated', {
      from_stage: 'reconcile',
      include_stage: true,
      reason: 'reconcile_remediation'
    });
  }
  state = appendPipelineEvent(novelDir, runId, 'stage_started', {
    stage: 'reconcile',
    input_hash: state.stages.inventory.output_hash,
    gate_version: RECONCILE_GATE_VERSION
  });
  const paths = getPipelinePaths(novelDir, runId);
  const inventory = loadInventoryMaterialized(paths);
  const definitions = buildReconcileDefinitions(
    inventory.candidates,
    0,
    state.stages.reconcile.input_hash
  );
  if (definitions.length > 0) createWorkItems(novelDir, runId, 'reconcile', definitions);
  return definitions;
}

function buildGapDefinitions(sourceIndex, round) {
  const start = round === 1 ? 5001 : 7001;
  const end = start + 999;
  return sourceIndex.windows.map(window => {
    const sourcePayload = {
      window_id: window.id,
      chapter: window.chapter,
      line_start: window.line_start,
      line_end: window.line_end,
      text: window.text
    };
    return {
      work_item_id: `reconcile_gap_r${round}_${window.id}`,
      input_hash: sha256(stableStringify({
        prompt_version: 'blind-gap-audit-v1',
        round,
        source_payload: sourcePayload
      })),
      instructions: {
        kind: 'gap-audit',
        prompt_version: 'blind-gap-audit-v1',
        round,
        candidate_id_start: start,
        candidate_id_end: end,
        blind: true
      },
      source_payload: sourcePayload
    };
  }).sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
}

function planGapAuditRound(novelDir, runId, round) {
  const state = loadPipelineState(novelDir, runId);
  if (state.stages.reconcile.status !== 'running') {
    throw new PipelineError('INVALID_STAGE_TRANSITION', 'reconcile must be running');
  }
  const paths = getPipelinePaths(novelDir, runId);
  const definitions = buildGapDefinitions(loadSourceIndex(paths), round);
  createWorkItems(novelDir, runId, 'reconcile', definitions);
  return definitions;
}

function reconcileItems(state, prefix) {
  return Object.values(state.work_items)
    .filter(item => item.stage === 'reconcile' && item.work_item_id.startsWith(prefix))
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
}

function allAccepted(items) {
  return items.length > 0 && items.every(item => item.status === 'accepted');
}

function loadAcceptedDraft(novelDir, runId, item) {
  const paths = getPipelinePaths(novelDir, runId);
  loadPlannedDefinition(novelDir, runId, 'reconcile', item);
  const draft = readJson(path.join(
    paths.workItems, 'reconcile', 'drafts', `${item.work_item_id}.json`
  ), null);
  if (!draft) throw new PipelineError('DRAFT_INVALID', `Missing accepted draft ${item.work_item_id}`);
  if (sha256(stableStringify(draft.payload)) !== item.output_hash) {
    throw new PipelineError('DRAFT_INVALID', `Accepted draft hash changed: ${item.work_item_id}`);
  }
  return draft;
}

function collectGapRound(novelDir, runId, round) {
  const state = loadPipelineState(novelDir, runId);
  const items = reconcileItems(state, `reconcile_gap_r${round}_`);
  if (!allAccepted(items)) {
    throw new PipelineError('RECONCILE_WORK_INCOMPLETE', `gap round ${round} is incomplete`);
  }
  const candidates = items.flatMap(item =>
    loadAcceptedDraft(novelDir, runId, item).payload.candidates
  ).sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));
  const ids = candidates.map(candidate => candidate.candidate_id);
  if (new Set(ids).size !== ids.length) {
    throw new PipelineError('DUPLICATE_CANDIDATE_ID', `gap round ${round} has duplicate candidate IDs`);
  }
  const paths = getPipelinePaths(novelDir, runId);
  writeJsonLinesAtomic(
    path.join(paths.materialized, 'reconcile', `gap-round-${round}-candidates.jsonl`),
    candidates
  );
  return candidates;
}

function collectClusterDrafts(novelDir, runId) {
  const state = loadPipelineState(novelDir, runId);
  return Object.values(state.work_items)
    .filter(item => item.stage === 'reconcile'
      && item.work_item_id.startsWith('reconcile_cluster_')
      && item.status === 'accepted')
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id))
    .map(item => ({ item, draft: loadAcceptedDraft(novelDir, runId, item) }));
}

function extractStrongSignals(candidates, summaries) {
  const signals = new Map();
  const add = (name, source, candidateIds = []) => {
    const normalized = normalizeName(name);
    if (!normalized) return;
    if (!signals.has(normalized)) {
      signals.set(normalized, { name: normalized, sources: [], candidate_ids: [] });
    }
    const signal = signals.get(normalized);
    signal.sources.push(source);
    signal.candidate_ids.push(...candidateIds);
  };
  for (const candidate of candidates) {
    for (const name of candidate.participant_names || []) {
      add(name, 'event-participant', [candidate.candidate_id]);
    }
    if (candidate.speaker_name) add(candidate.speaker_name, 'dialogue-speaker', [candidate.candidate_id]);
    for (const signal of candidate.character_signals || []) {
      add(signal?.name, signal?.role || 'candidate-signal', [candidate.candidate_id]);
    }
  }
  for (const summary of summaries) {
    for (const name of summary.key_character_names || []) {
      add(name, `chapter-summary:${summary.chapter}`);
    }
  }
  return [...signals.values()].map(signal => ({
    ...signal,
    sources: [...new Set(signal.sources)].sort(),
    candidate_ids: [...new Set(signal.candidate_ids)].sort()
  })).sort((left, right) => left.name.localeCompare(right.name));
}

function buildReconcileMaterialized(novelDir, runId, gapCandidates = []) {
  const paths = getPipelinePaths(novelDir, runId);
  const inventory = loadInventoryMaterialized(paths);
  const candidates = [...inventory.candidates, ...gapCandidates]
    .sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));
  const candidateById = new Map(candidates.map(candidate => [candidate.candidate_id, candidate]));
  const decisions = [];
  const resolutions = [];
  for (const { draft } of collectClusterDrafts(novelDir, runId)) {
    decisions.push(draft.payload.decision);
    for (const resolution of draft.payload.character_signal_resolutions || []) {
      resolutions.push({
        ...resolution,
        source_candidate_ids: draft.payload.decision.candidate_ids
      });
    }
  }
  decisions.sort((left, right) => left.decision_id.localeCompare(right.decision_id));

  const errors = [];
  const closed = new Map();
  for (const decision of decisions) {
    for (const candidateId of decision.candidate_ids || []) {
      if (!candidateById.has(candidateId)) errors.push(`${decision.decision_id}: unknown candidate ${candidateId}`);
      closed.set(candidateId, (closed.get(candidateId) || 0) + 1);
    }
  }
  for (const candidate of candidates) {
    if (closed.get(candidate.candidate_id) !== 1) {
      errors.push(`${candidate.candidate_id}: candidate must be closed exactly once`);
    }
  }

  const entities = decisions
    .filter(decision => decision.decision !== 'reject')
    .map(decision => ({
      provisional_key: decision.provisional_key,
      canonical_name: decision.canonical_name,
      final_category: decision.final_category,
      importance: decision.importance,
      candidate_ids: [...decision.candidate_ids].sort(),
      source_refs: decision.candidate_ids.flatMap(candidateId => {
        const candidate = candidateById.get(candidateId);
        return candidate ? [{ chapter: candidate.chapter, ...candidate.source_ref }] : [];
      })
    }));

  const resolutionByName = new Map();
  for (const resolution of resolutions) {
    const name = normalizeName(resolution.name);
    if (resolutionByName.has(name)
      && stableStringify(resolutionByName.get(name)) !== stableStringify(resolution)) {
      errors.push(`${name}: conflicting character signal resolutions`);
      continue;
    }
    resolutionByName.set(name, resolution);
    if (resolution.decision === 'keep') {
      const seed = signalSeed(name, resolution.source_candidate_ids);
      const sourceRefs = resolution.source_candidate_ids.flatMap(candidateId => {
        const candidate = candidateById.get(candidateId);
        return candidate ? [{ chapter: candidate.chapter, ...candidate.source_ref }] : [];
      });
      entities.push({
        provisional_key: provisionalKey('character', seed),
        canonical_name: name,
        final_category: 'character',
        importance: resolution.importance,
        candidate_ids: [...resolution.source_candidate_ids].sort(),
        source_refs: sourceRefs,
        created_from_strong_signal: true
      });
    }
  }

  const strongSignals = extractStrongSignals(candidates, inventory.chapter_summaries);
  const retainedCharacters = new Set(entities
    .filter(entity => entity.final_category === 'character')
    .map(entity => normalizeName(entity.canonical_name)));
  for (const signal of strongSignals) {
    if (!retainedCharacters.has(signal.name) && !resolutionByName.has(signal.name)) {
      errors.push(`${signal.name}: strong character signal is unresolved`);
    }
  }

  const uniqueEntities = new Map();
  for (const entity of entities) {
    if (uniqueEntities.has(entity.provisional_key)) {
      const existing = uniqueEntities.get(entity.provisional_key);
      if (stableStringify(existing) !== stableStringify(entity)) {
        errors.push(`${entity.provisional_key}: provisional entity key collision`);
      }
    } else {
      uniqueEntities.set(entity.provisional_key, entity);
    }
  }
  const materialized = {
    candidates,
    decisions,
    entities: [...uniqueEntities.values()]
      .sort((left, right) => left.provisional_key.localeCompare(right.provisional_key)),
    strong_signals: strongSignals,
    signal_resolutions: [...resolutionByName.values()]
      .sort((left, right) => normalizeName(left.name).localeCompare(normalizeName(right.name))),
    chapter_summaries: inventory.chapter_summaries,
    errors
  };
  materialized.output_hash = sha256(stableStringify({
    decisions: materialized.decisions,
    entities: materialized.entities,
    strong_signals: materialized.strong_signals,
    signal_resolutions: materialized.signal_resolutions,
    chapter_summaries: materialized.chapter_summaries
  }));
  return materialized;
}

function writeReconcileMaterialized(paths, materialized) {
  const outputDir = path.join(paths.materialized, 'reconcile');
  writeJsonLinesAtomic(path.join(outputDir, 'decisions.jsonl'), materialized.decisions);
  writeJsonAtomic(path.join(outputDir, 'provisional-entities.json'), materialized.entities);
  writeJsonAtomic(path.join(outputDir, 'strong-signals.json'), {
    signals: materialized.strong_signals,
    resolutions: materialized.signal_resolutions
  });
  writeJsonAtomic(path.join(outputDir, 'chapter-summary-drafts.json'), materialized.chapter_summaries);
}

function sourceScale(sourceIndex) {
  const chapterCount = sourceIndex.chapters.length;
  const lineCount = sourceIndex.chapters
    .reduce((total, chapter) => total + (Number(chapter.line_count) || 0), 0);
  return {
    chapter_count: chapterCount,
    line_count: lineCount,
    window_count: sourceIndex.windows.length,
    scale: chapterCount >= 30 || lineCount >= 12_000 ? 'long' : chapterCount >= 10 ? 'medium' : 'short'
  };
}

function buildRecallReviewPacket({
  runId,
  sourceHash,
  reconcileOutputHash,
  sourceIndex,
  materialized,
  riskLimit
}) {
  const scale = sourceScale(sourceIndex);
  const highRisk = materialized.decisions
    .filter(decision => decision.risk?.level === 'high')
    .sort((left, right) => left.decision_id.localeCompare(right.decision_id));
  const chapterByNumber = new Map((materialized.chapter_summaries || [])
    .map(summary => [summary.chapter, summary]));
  const chapterAnomalies = sourceIndex.chapters.flatMap(chapter => {
    const summary = chapterByNumber.get(chapter.chapter);
    if (!summary) return [{ chapter: chapter.chapter, issue: 'missing_chapter_summary' }];
    if (!Array.isArray(summary.key_events) || summary.key_events.length === 0) {
      return [{ chapter: chapter.chapter, issue: 'missing_key_events' }];
    }
    return [];
  });
  const needsAiReview = highRisk.length > riskLimit;
  const requiresHuman = scale.scale === 'long' || highRisk.length > 0 || chapterAnomalies.length > 0;
  const body = {
    schema_version: 1,
    run_id: runId,
    source_hash: sourceHash,
    reconcile_output_hash: reconcileOutputHash,
    status: needsAiReview
      ? 'needs_ai_review'
      : (requiresHuman ? 'awaiting_human_review' : 'auto_approved'),
    requires_human_review: requiresHuman && !needsAiReview,
    risk_limit: riskLimit,
    source_scale: scale,
    core_important_characters: materialized.entities.filter(entity =>
      entity.final_category === 'character' && CORE_IMPORTANCE.has(entity.importance)
    ),
    main_events: materialized.entities.filter(entity =>
      entity.final_category === 'event' && CORE_IMPORTANCE.has(entity.importance)
    ),
    major_martial: materialized.entities.filter(entity =>
      ['skill', 'technique'].includes(entity.final_category) && CORE_IMPORTANCE.has(entity.importance)
    ),
    chapter_anomalies: chapterAnomalies,
    suspected_gaps: materialized.strong_signals.filter(signal =>
      !materialized.entities.some(entity =>
        entity.final_category === 'character'
        && normalizeName(entity.canonical_name) === signal.name
      )
    ),
    high_risk_total: highRisk.length,
    high_risk_decisions: highRisk,
    high_risk_omitted: 0,
    actions: ['accept_recall', 'rerun_recall']
  };
  return { ...body, packet_hash: sha256(stableStringify(body)) };
}

function recallReceiptDraft(packet) {
  return {
    schema_version: 1,
    run_id: packet.run_id,
    packet_hash: packet.packet_hash,
    source_hash: packet.source_hash,
    reconcile_output_hash: packet.reconcile_output_hash,
    reviewer: null,
    reviewed_at: null,
    action: null,
    high_risk_resolutions: packet.high_risk_decisions.map(decision => ({
      decision_id: decision.decision_id,
      conclusion: null,
      note: ''
    })),
    search_anchors: []
  };
}

function finalizeReconcile(novelDir, runId, gapCandidates) {
  const state = loadPipelineState(novelDir, runId);
  const paths = getPipelinePaths(novelDir, runId);
  const sourceIndex = loadSourceIndex(paths);
  const materialized = buildReconcileMaterialized(novelDir, runId, gapCandidates);
  if (materialized.errors.length > 0) {
    const strongSignalFailure = materialized.errors
      .some(error => error.includes('strong character signal'));
    const failureCode = strongSignalFailure
      ? 'STRONG_CHARACTER_SIGNAL_UNRESOLVED'
      : 'RECONCILE_LEDGER_NOT_CLOSED';
    const nextState = appendPipelineEvent(novelDir, runId, 'stage_gate_failed', {
      stage: 'reconcile',
      failure_code: failureCode,
      remediation_stage: 'reconcile',
      errors: materialized.errors
    });
    return {
      action: 'block-reconcile',
      failure_code: failureCode,
      errors: materialized.errors,
      state: nextState
    };
  }
  const packet = buildRecallReviewPacket({
    runId,
    sourceHash: sourceIndex.source_hash,
    reconcileOutputHash: materialized.output_hash,
    sourceIndex,
    materialized,
    riskLimit: state.config.risk_limit
  });
  const writeOutputs = () => {
    writeReconcileMaterialized(paths, materialized);
    writeJsonAtomic(path.join(paths.review, 'recall-packet.json'), packet);
    writeJsonAtomic(path.join(paths.review, 'recall-receipt-draft.json'), recallReceiptDraft(packet));
  };
  if (packet.status === 'needs_ai_review') {
    const nextState = appendPipelineEvent(novelDir, runId, 'stage_gate_failed', {
      stage: 'reconcile',
      failure_code: 'RECALL_RISK_LIMIT_EXCEEDED',
      remediation_stage: 'reconcile',
      high_risk_total: packet.high_risk_total,
      risk_limit: packet.risk_limit
    }, { beforeCommit: writeOutputs });
    return { action: 'needs-ai-review', packet, materialized, state: nextState };
  }
  if (packet.requires_human_review) {
    const nextState = appendPipelineEvent(novelDir, runId, 'review_requested', {
      stage: 'reconcile',
      input_hash: state.stages.reconcile.input_hash,
      output_hash: materialized.output_hash,
      gate_version: state.stages.reconcile.gate_version,
      packet_hash: packet.packet_hash,
      source_hash: packet.source_hash
    }, { beforeCommit: writeOutputs });
    return { action: 'request-recall-review', packet, materialized, state: nextState };
  }
  const nextState = appendPipelineEvent(novelDir, runId, 'stage_passed', {
    stage: 'reconcile',
    input_hash: state.stages.reconcile.input_hash,
    output_hash: materialized.output_hash,
    gate_version: state.stages.reconcile.gate_version
  }, { beforeCommit: writeOutputs });
  return { action: 'complete-reconcile', packet, materialized, state: nextState };
}

function blockGapNotConverged(novelDir, runId, candidates) {
  const nextState = appendPipelineEvent(novelDir, runId, 'stage_gate_failed', {
    stage: 'reconcile',
    failure_code: 'GAP_AUDIT_NOT_CONVERGED',
    remediation_stage: 'inventory',
    candidate_ids: candidates.map(candidate => candidate.candidate_id)
  });
  return {
    action: 'block-reconcile',
    failure_code: 'GAP_AUDIT_NOT_CONVERGED',
    errors: ['second blind gap round still found valid candidates'],
    state: nextState
  };
}

function advanceReconcileStage(novelDir, runId) {
  let state = loadPipelineState(novelDir, runId);
  if (state.stages.reconcile.status !== 'running') {
    throw new PipelineError('INVALID_STAGE_TRANSITION', `reconcile is ${state.stages.reconcile.status}`);
  }
  const incomplete = Object.values(state.work_items)
    .filter(item => item.stage === 'reconcile' && ['pending', 'claimed'].includes(item.status));
  if (incomplete.length > 0) {
    return { action: 'awaiting-work-items', state, next_action: state.next_action };
  }

  const gapRoundOneItems = reconcileItems(state, 'reconcile_gap_r1_');
  if (gapRoundOneItems.length === 0) {
    const definitions = planGapAuditRound(novelDir, runId, 1);
    return {
      action: 'plan-gap-audit',
      round: 1,
      work_item_count: definitions.length,
      state: loadPipelineState(novelDir, runId)
    };
  }

  const roundOneCandidates = collectGapRound(novelDir, runId, 1);
  if (roundOneCandidates.length === 0) return finalizeReconcile(novelDir, runId, []);

  state = loadPipelineState(novelDir, runId);
  const gapReconcileItems = reconcileItems(state, 'reconcile_cluster_r1_');
  if (gapReconcileItems.length === 0) {
    const inventoryIds = new Set(loadInventoryMaterialized(getPipelinePaths(novelDir, runId))
      .candidates.map(candidate => candidate.candidate_id));
    const duplicate = roundOneCandidates.find(candidate => inventoryIds.has(candidate.candidate_id));
    if (duplicate) {
      throw new PipelineError('DUPLICATE_CANDIDATE_ID', `gap candidate already exists: ${duplicate.candidate_id}`);
    }
    const definitions = buildReconcileDefinitions(
      roundOneCandidates,
      1,
      sha256(stableStringify(roundOneCandidates))
    );
    createWorkItems(novelDir, runId, 'reconcile', definitions);
    return {
      action: 'plan-gap-reconcile',
      round: 1,
      work_item_count: definitions.length,
      state: loadPipelineState(novelDir, runId)
    };
  }
  if (!allAccepted(gapReconcileItems)) {
    return { action: 'awaiting-work-items', state, next_action: state.next_action };
  }

  const gapRoundTwoItems = reconcileItems(state, 'reconcile_gap_r2_');
  if (gapRoundTwoItems.length === 0) {
    const definitions = planGapAuditRound(novelDir, runId, 2);
    return {
      action: 'plan-gap-audit',
      round: 2,
      work_item_count: definitions.length,
      state: loadPipelineState(novelDir, runId)
    };
  }
  const roundTwoCandidates = collectGapRound(novelDir, runId, 2);
  if (roundTwoCandidates.length > 0) {
    return blockGapNotConverged(novelDir, runId, roundTwoCandidates);
  }
  return finalizeReconcile(novelDir, runId, roundOneCandidates);
}

function validateReviewReceipt(packet, receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new PipelineError('REVIEW_RECEIPT_INVALID', 'Review receipt must be an object');
  }
  for (const [field, expected] of [
    ['schema_version', 1],
    ['run_id', packet.run_id],
    ['packet_hash', packet.packet_hash],
    ['source_hash', packet.source_hash],
    ['reconcile_output_hash', packet.reconcile_output_hash]
  ]) {
    if (receipt[field] !== expected) {
      throw new PipelineError('REVIEW_RECEIPT_STALE', `${field} does not match current review packet`);
    }
  }
  if (typeof receipt.reviewer !== 'string' || !receipt.reviewer.trim()) {
    throw new PipelineError('REVIEW_RECEIPT_INVALID', 'reviewer is required');
  }
  if (!Number.isFinite(Date.parse(receipt.reviewed_at))) {
    throw new PipelineError('REVIEW_RECEIPT_INVALID', 'reviewed_at must be an ISO timestamp');
  }
  if (!['accept_recall', 'rerun_recall'].includes(receipt.action)) {
    throw new PipelineError('REVIEW_RECEIPT_INVALID', 'action must be accept_recall or rerun_recall');
  }
  const anchors = receipt.search_anchors ?? [];
  if (!Array.isArray(anchors) || anchors.some(anchor => typeof anchor !== 'string' || !anchor.trim())) {
    throw new PipelineError('REVIEW_RECEIPT_INVALID', 'search_anchors must be non-empty strings');
  }
  if (anchors.length > 0 && receipt.action !== 'rerun_recall') {
    throw new PipelineError('REVIEW_RECEIPT_INVALID', 'search anchors require rerun_recall');
  }
  const expectedRisks = new Set(packet.high_risk_decisions.map(decision => decision.decision_id));
  const resolutions = receipt.high_risk_resolutions ?? [];
  const resolvedRisks = new Set(Array.isArray(resolutions)
    ? resolutions.map(resolution => resolution?.decision_id)
    : []);
  if (!Array.isArray(resolutions)
    || resolutions.length !== expectedRisks.size
    || resolvedRisks.size !== expectedRisks.size
    || resolutions.some(resolution => !expectedRisks.has(resolution.decision_id)
      || !['accept', 'revise', 'rerun', 'manual_investigation'].includes(resolution.conclusion)
      || typeof resolution.note !== 'string')) {
    throw new PipelineError('REVIEW_RECEIPT_INVALID', 'every high-risk decision requires one conclusion and note');
  }
  return { ...receipt, search_anchors: [...new Set(anchors.map(anchor => anchor.trim()))].sort() };
}

function recordRecallReview(novelDir, runId, receiptInput) {
  const state = loadPipelineState(novelDir, runId);
  if (state.stages.reconcile.status !== 'awaiting_recall_review' || state.review?.status !== 'pending') {
    throw new PipelineError('INVALID_STAGE_TRANSITION', 'No recall review is pending');
  }
  const paths = getPipelinePaths(novelDir, runId);
  const packet = readJson(path.join(paths.review, 'recall-packet.json'), null);
  if (!packet) throw new PipelineError('REVIEW_PACKET_MISSING', 'recall-packet.json is missing');
  const receipt = validateReviewReceipt(packet, receiptInput);
  const receiptHash = sha256(stableStringify(receipt));
  const receiptPath = path.join(paths.review, 'recall-receipt.json');
  if (receipt.action === 'rerun_recall') {
    const nextState = appendPipelineEvent(novelDir, runId, 'downstream_invalidated', {
      from_stage: 'inventory',
      include_stage: true,
      reason: 'recall_review_rerun',
      receipt_hash: receiptHash,
      search_anchors: receipt.search_anchors
    }, {
      beforeCommit: () => {
        writeJsonAtomic(receiptPath, receipt);
        writeJsonAtomic(path.join(paths.review, 'search-anchors.json'), receipt.search_anchors);
      }
    });
    return { receipt, receipt_hash: receiptHash, state: nextState };
  }
  const nextState = appendPipelineEvent(novelDir, runId, 'review_recorded', {
    stage: 'reconcile',
    packet_hash: packet.packet_hash,
    source_hash: packet.source_hash,
    output_hash: packet.reconcile_output_hash,
    receipt_hash: receiptHash,
    action: receipt.action,
    reviewer: receipt.reviewer
  }, { beforeCommit: () => writeJsonAtomic(receiptPath, receipt) });
  return { receipt, receipt_hash: receiptHash, state: nextState };
}

module.exports = {
  RECONCILE_GATE_VERSION,
  advanceReconcileStage,
  buildGapDefinitions,
  buildRecallReviewPacket,
  buildReconcileDefinitions,
  buildReconcileMaterialized,
  planGapAuditRound,
  planReconcileWorkItems,
  provisionalKey,
  recordRecallReview,
  sourceScale,
  validateReviewReceipt
};
