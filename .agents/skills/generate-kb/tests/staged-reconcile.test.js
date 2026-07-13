#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PipelineError } = require('../scripts/lib/pipeline-events');
const { getPipelinePaths } = require('../scripts/lib/pipeline-paths');
const { initializePipelineRun, loadPipelineState } = require('../scripts/lib/pipeline-state');
const {
  advanceReconcileStage,
  buildRecallReviewPacket,
  planReconcileWorkItems,
  provisionalKey,
  recordRecallReview,
  validateReviewReceipt
} = require('../scripts/lib/staged-reconcile');
const {
  completeInventoryStage,
  planInventoryWorkItems,
  prepareRunSource
} = require('../scripts/lib/staged-inventory');
const { claimWorkItem, submitWorkItem } = require('../scripts/lib/work-items');

const PIPELINE_CLI = path.resolve(__dirname, '../scripts/pipeline.js');

function withNovel(options, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-staged-reconcile-'));
  const lineCount = options.lineCount || 4;
  const lines = Array.from({ length: lineCount }, (_, index) =>
    index === 0 ? '段誉来到无量山。' : `这是用于阶段测试的原文第${index + 1}行。`
  );
  fs.mkdirSync(path.join(root, 'ch_split'), { recursive: true });
  fs.writeFileSync(path.join(root, 'ch_split', 'ch_001.txt'), lines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(root, '原著.txt'), lines.join('\n'), 'utf8');
  try {
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function draftPath(root, packet, payload, suffix = '') {
  const file = path.join(root, `${packet.work_item_id}${suffix}.draft.json`);
  fs.writeFileSync(file, `${JSON.stringify({
    schema_version: 1,
    run_id: packet.run_id,
    stage: packet.stage,
    work_item_id: packet.work_item_id,
    input_hash: packet.input_hash,
    worker_id: packet.worker_id,
    lease_id: packet.lease_id,
    payload
  }, null, 2)}\n`, 'utf8');
  return file;
}

function inventoryCandidate(packet, spec, ordinal) {
  const source = packet.source_payload;
  return {
    candidate_id: `cand_${source.window_id}_${String(ordinal).padStart(4, '0')}`,
    category_hint: spec.category,
    name: spec.name,
    chapter: source.chapter,
    window_id: source.window_id,
    discovery_pass: packet.instructions.kind,
    source_ref: {
      line_start: source.line_start,
      line_end: source.line_start,
      text: source.text.split(/\r?\n/)[0]
    },
    ...(spec.extra || {})
  };
}

function initializeInventory(root, options = {}) {
  const runId = options.runId || 'run-reconcile';
  initializePipelineRun(root, {
    runId,
    config: { max_workers: 4, risk_limit: options.riskLimit || 15 }
  });
  prepareRunSource(root, runId, {
    windowLines: options.windowLines || 20_000,
    overlapLines: 0
  });
  planInventoryWorkItems(root, runId);

  let tick = 0;
  while (loadPipelineState(root, runId).next_action.command === 'claim') {
    const claim = claimWorkItem(root, runId, {
      workerId: `inventory-worker-${tick}`,
      now: new Date(Date.UTC(2026, 6, 13, 0, 0, tick))
    });
    const kind = claim.packet.instructions.kind;
    let payload;
    if (kind === 'chapter-summary') {
      payload = {
        chapter_summary: {
          chapter: 1,
          summary: '本回用于验证阶段化归并、查漏与人工召回审核流程。',
          key_events: ['段誉来到无量山'],
          key_character_names: options.summaryNames || []
        }
      };
    } else {
      const specs = kind === 'named-inventory'
        ? (options.namedCandidates || [])
        : (options.eventCandidates || []);
      const base = kind === 'named-inventory' ? 1 : 101;
      const candidates = specs.map((spec, index) => inventoryCandidate(claim.packet, spec, base + index));
      payload = candidates.length > 0
        ? { candidates }
        : {
            candidates: [],
            empty_result: {
              reason: kind === 'named-inventory' ? 'no_named_entities' : 'no_events_or_dialogues',
              detail: '本窗口没有该类候选实体。'
            }
          };
    }
    submitWorkItem(root, runId, {
      workerId: claim.packet.worker_id,
      itemId: claim.packet.work_item_id,
      draftPath: draftPath(root, claim.packet, payload),
      now: new Date(Date.UTC(2026, 6, 13, 0, 1, tick))
    });
    tick += 1;
  }
  completeInventoryStage(root, runId);
  return runId;
}

function submitReconcileClusters(root, runId, options = {}) {
  let tick = 0;
  while (loadPipelineState(root, runId).next_action.command === 'claim') {
    const claim = claimWorkItem(root, runId, {
      workerId: `reconcile-worker-${tick}`,
      now: new Date(Date.UTC(2026, 6, 13, 1, 0, tick))
    });
    if (claim.packet.instructions.kind !== 'reconcile-cluster') break;
    const candidates = claim.packet.source_payload.candidates;
    const first = candidates[0];
    const finalCategory = options.categoryByName?.[first.name] || first.category_hint;
    const payload = {
      decision: {
        decision_id: claim.packet.instructions.decision_id,
        decision: 'keep',
        candidate_ids: candidates.map(candidate => candidate.candidate_id),
        canonical_name: first.name,
        final_category: finalCategory,
        importance: options.importanceByName?.[first.name] || '重要',
        reason: '原文具名且有完整窗口证据。',
        provisional_key: provisionalKey(finalCategory, claim.packet.instructions.cluster_id),
        risk: options.riskByName?.[first.name] || { level: 'low', reasons: [] }
      },
      character_signal_resolutions: options.signalResolutionsByName?.[first.name] || []
    };
    submitWorkItem(root, runId, {
      workerId: claim.packet.worker_id,
      itemId: claim.packet.work_item_id,
      draftPath: draftPath(root, claim.packet, payload, `-${tick}`),
      now: new Date(Date.UTC(2026, 6, 13, 1, 1, tick))
    });
    tick += 1;
  }
}

function submitGapRound(root, runId, candidates = []) {
  let tick = 0;
  while (loadPipelineState(root, runId).next_action.command === 'claim') {
    const claim = claimWorkItem(root, runId, {
      workerId: `gap-worker-${tick}`,
      now: new Date(Date.UTC(2026, 6, 13, 2, 0, tick))
    });
    assert.equal(claim.packet.instructions.kind, 'gap-audit');
    assert.equal(Object.hasOwn(claim.packet.source_payload, 'existing_candidates'), false);
    assert.equal(Object.hasOwn(claim.packet.source_payload, 'decisions'), false);
    const source = claim.packet.source_payload;
    const payloadCandidates = candidates.map(spec => ({
      candidate_id: spec.candidate_id,
      category_hint: spec.category,
      name: spec.name,
      chapter: source.chapter,
      window_id: source.window_id,
      discovery_pass: 'gap-audit',
      source_ref: {
        line_start: source.line_start,
        line_end: source.line_start,
        text: source.text.split(/\r?\n/)[0]
      }
    }));
    const payload = payloadCandidates.length > 0
      ? { candidates: payloadCandidates }
      : {
          candidates: [],
          empty_result: { reason: 'no_gap_candidates', detail: '盲查漏未发现新的有效候选。' }
        };
    submitWorkItem(root, runId, {
      workerId: claim.packet.worker_id,
      itemId: claim.packet.work_item_id,
      draftPath: draftPath(root, claim.packet, payload, `-${tick}`),
      now: new Date(Date.UTC(2026, 6, 13, 2, 1, tick))
    });
    tick += 1;
  }
}

function basicCandidates() {
  return {
    namedCandidates: [{ category: 'character', name: '段誉' }],
    eventCandidates: [{
      category: 'event',
      name: '段誉入无量山',
      extra: { participant_names: ['段誉'] }
    }],
    summaryNames: ['段誉']
  };
}

describe('staged reconcile and gap audit', () => {
  it('closes every candidate with provisional keys and no formal IDs', () => {
    withNovel({}, root => {
      const runId = initializeInventory(root, basicCandidates());
      const planned = spawnSync(process.execPath, [PIPELINE_CLI, 'run', root, '--json'], {
        encoding: 'utf8'
      });
      assert.equal(planned.status, 0, planned.stderr);
      const plannedResult = JSON.parse(planned.stdout);
      assert.equal(plannedResult.action, 'plan-reconcile');
      assert.equal(plannedResult.work_item_count, 2);
      submitReconcileClusters(root, runId);

      const gapPlanned = spawnSync(process.execPath, [PIPELINE_CLI, 'run', root, '--json'], {
        encoding: 'utf8'
      });
      assert.equal(gapPlanned.status, 0, gapPlanned.stderr);
      assert.equal(JSON.parse(gapPlanned.stdout).action, 'plan-gap-audit');
      submitGapRound(root, runId);
      const completedRun = spawnSync(process.execPath, [PIPELINE_CLI, 'run', root, '--json'], {
        encoding: 'utf8'
      });
      assert.equal(completedRun.status, 0, completedRun.stderr);
      const completed = JSON.parse(completedRun.stdout);
      assert.equal(completed.action, 'complete-reconcile');

      const materialized = completed.materialized;
      assert.equal(materialized.decisions.length, 2);
      assert.equal(materialized.entities.length, 2);
      assert.ok(materialized.entities.every(entity => /^(entity_|event_key_)/.test(entity.provisional_key)));
      assert.ok(materialized.decisions.every(decision => !Object.hasOwn(decision, 'final_id')));
      assert.equal(loadPipelineState(root, runId).stages.enrich.status, 'ready');
      assert.equal(fs.existsSync(path.join(root, 'data')), false);
    });
  });

  it('blocks a character signal that appears only in an event unless explicitly resolved', () => {
    withNovel({}, root => {
      const runId = initializeInventory(root, {
        eventCandidates: [{
          category: 'event',
          name: '少林寺相认',
          extra: { participant_names: ['虚竹'] }
        }],
        summaryNames: ['虚竹']
      });
      planReconcileWorkItems(root, runId);
      submitReconcileClusters(root, runId);
      advanceReconcileStage(root, runId);
      submitGapRound(root, runId);
      const blocked = advanceReconcileStage(root, runId);

      assert.equal(blocked.action, 'block-reconcile');
      assert.equal(blocked.failure_code, 'STRONG_CHARACTER_SIGNAL_UNRESOLVED');
      assert.ok(blocked.errors.some(error => error.includes('虚竹')));
      assert.equal(loadPipelineState(root, runId).stages.reconcile.status, 'blocked');
    });

    withNovel({}, root => {
      const runId = initializeInventory(root, {
        eventCandidates: [{
          category: 'event',
          name: '少林寺相认',
          extra: { participant_names: ['虚竹'] }
        }],
        summaryNames: ['虚竹']
      });
      planReconcileWorkItems(root, runId);
      submitReconcileClusters(root, runId, {
        signalResolutionsByName: {
          少林寺相认: [{
            name: '虚竹',
            decision: 'keep',
            importance: '核心',
            reason: '事件参与者在原文中明确指向人物。'
          }]
        }
      });
      advanceReconcileStage(root, runId);
      submitGapRound(root, runId);
      const completed = advanceReconcileStage(root, runId);

      assert.equal(completed.action, 'complete-reconcile');
      assert.ok(completed.materialized.entities.some(entity =>
        entity.final_category === 'character' && entity.canonical_name === '虚竹'
      ));
    });
  });

  it('blocks when the second blind gap round still finds valid candidates', () => {
    withNovel({}, root => {
      const runId = initializeInventory(root, basicCandidates());
      planReconcileWorkItems(root, runId);
      submitReconcileClusters(root, runId);
      advanceReconcileStage(root, runId);
      submitGapRound(root, runId, [{
        candidate_id: 'cand_ch001_w001_5001', category: 'character', name: '钟灵'
      }]);
      const reopened = advanceReconcileStage(root, runId);
      assert.equal(reopened.action, 'plan-gap-reconcile');

      submitReconcileClusters(root, runId);
      const secondRound = advanceReconcileStage(root, runId);
      assert.equal(secondRound.action, 'plan-gap-audit');
      assert.equal(secondRound.round, 2);
      submitGapRound(root, runId, [{
        candidate_id: 'cand_ch001_w001_7001', category: 'character', name: '木婉清'
      }]);
      const blocked = advanceReconcileStage(root, runId);

      assert.equal(blocked.action, 'block-reconcile');
      assert.equal(blocked.failure_code, 'GAP_AUDIT_NOT_CONVERGED');
      assert.equal(loadPipelineState(root, runId).stages.reconcile.status, 'blocked');
    });
  });
});

describe('recall review checkpoint', () => {
  it('rejects duplicate high-risk resolutions that leave another decision unresolved', () => {
    const packet = {
      run_id: 'run-review-duplicates',
      packet_hash: 'packet-hash',
      source_hash: 'source-hash',
      reconcile_output_hash: 'reconcile-hash',
      high_risk_decisions: [
        { decision_id: 'decision_001' },
        { decision_id: 'decision_002' }
      ]
    };
    assert.throws(
      () => validateReviewReceipt(packet, {
        schema_version: 1,
        run_id: packet.run_id,
        packet_hash: packet.packet_hash,
        source_hash: packet.source_hash,
        reconcile_output_hash: packet.reconcile_output_hash,
        reviewer: '人工审核者',
        reviewed_at: '2026-07-13T03:00:00.000Z',
        action: 'accept_recall',
        high_risk_resolutions: [
          { decision_id: 'decision_001', conclusion: 'accept', note: '' },
          { decision_id: 'decision_001', conclusion: 'accept', note: '' }
        ]
      }),
      error => error instanceof PipelineError && error.code === 'REVIEW_RECEIPT_INVALID'
    );
  });

  it('requires a current hash-bound receipt for a long novel', () => {
    withNovel({ lineCount: 12_000 }, root => {
      const runId = initializeInventory(root, { ...basicCandidates(), lineCount: 12_000 });
      planReconcileWorkItems(root, runId);
      submitReconcileClusters(root, runId);
      advanceReconcileStage(root, runId);
      submitGapRound(root, runId);
      const requested = advanceReconcileStage(root, runId);

      assert.equal(requested.action, 'request-recall-review');
      assert.equal(loadPipelineState(root, runId).stages.reconcile.status, 'awaiting_recall_review');
      assert.throws(
        () => claimWorkItem(root, runId, { workerId: 'enrich-too-early' }),
        error => error instanceof PipelineError && error.code === 'NO_WORK_ITEM_AVAILABLE'
      );

      const paths = getPipelinePaths(root, runId);
      const draft = JSON.parse(fs.readFileSync(path.join(paths.review, 'recall-receipt-draft.json')));
      const packetCommand = spawnSync(process.execPath, [
        PIPELINE_CLI, 'review-packet', root, '--json'
      ], { encoding: 'utf8' });
      assert.equal(packetCommand.status, 0, packetCommand.stderr);
      assert.equal(JSON.parse(packetCommand.stdout).packet.packet_hash, draft.packet_hash);
      assert.throws(
        () => recordRecallReview(root, runId, {
          ...draft,
          reviewer: '人工审核者',
          reviewed_at: '2026-07-13T03:00:00.000Z',
          action: 'accept_recall',
          reconcile_output_hash: 'stale-hash'
        }),
        error => error instanceof PipelineError && error.code === 'REVIEW_RECEIPT_STALE'
      );

      const receiptPath = path.join(root, 'accepted-recall-receipt.json');
      fs.writeFileSync(receiptPath, `${JSON.stringify({
        ...draft,
        reviewer: '人工审核者',
        reviewed_at: '2026-07-13T03:00:00.000Z',
        action: 'accept_recall'
      }, null, 2)}\n`, 'utf8');
      const accepted = spawnSync(process.execPath, [
        PIPELINE_CLI, 'record-review', root, '--input', receiptPath, '--json'
      ], { encoding: 'utf8' });
      assert.equal(accepted.status, 0, accepted.stderr);
      const acceptedResult = JSON.parse(accepted.stdout);
      assert.equal(acceptedResult.state.stages.reconcile.status, 'passed');
      assert.equal(acceptedResult.state.stages.enrich.status, 'ready');
    });
  });

  it('invalidates downstream work and returns human search anchors to inventory packets', () => {
    withNovel({ lineCount: 12_000 }, root => {
      const runId = initializeInventory(root, { ...basicCandidates(), lineCount: 12_000 });
      planReconcileWorkItems(root, runId);
      submitReconcileClusters(root, runId);
      advanceReconcileStage(root, runId);
      submitGapRound(root, runId);
      advanceReconcileStage(root, runId);

      const paths = getPipelinePaths(root, runId);
      const draft = JSON.parse(fs.readFileSync(path.join(paths.review, 'recall-receipt-draft.json')));
      const rerun = recordRecallReview(root, runId, {
        ...draft,
        reviewer: '人工审核者',
        reviewed_at: '2026-07-13T03:00:00.000Z',
        action: 'rerun_recall',
        search_anchors: ['王语嫣']
      });
      assert.equal(rerun.state.stages.inventory.status, 'invalidated');
      assert.equal(rerun.state.stages.reconcile.status, 'invalidated');

      planInventoryWorkItems(root, runId);
      const claim = claimWorkItem(root, runId, {
        workerId: 'anchor-worker',
        now: new Date('2026-07-13T04:00:00.000Z')
      });
      assert.deepEqual(claim.packet.instructions.search_anchors, ['王语嫣']);
    });
  });

  it('returns excess high-risk decisions to AI instead of truncating the human queue', () => {
    const decisions = Array.from({ length: 16 }, (_, index) => ({
      decision_id: `decision_${String(index + 1).padStart(3, '0')}`,
      canonical_name: `高风险项${index + 1}`,
      final_category: 'item',
      decision: 'keep',
      candidate_ids: [`cand_ch001_w001_${String(index + 1).padStart(4, '0')}`],
      provisional_key: `entity_item_${String(index + 1).padStart(16, '0')}`,
      risk: { level: 'high', reasons: ['分类边界需要复核'] }
    }));
    const packet = buildRecallReviewPacket({
      runId: 'run-risk',
      sourceHash: 'source-hash',
      reconcileOutputHash: 'reconcile-hash',
      sourceIndex: { chapters: [{ chapter: 1, line_count: 10 }], windows: [] },
      materialized: { decisions, entities: [], strong_signals: [], chapter_summaries: [] },
      riskLimit: 15
    });

    assert.equal(packet.status, 'needs_ai_review');
    assert.equal(packet.high_risk_total, 16);
    assert.equal(packet.high_risk_decisions.length, 16);
    assert.equal(packet.high_risk_omitted, 0);

    const loweredLimit = buildRecallReviewPacket({
      runId: 'run-risk',
      sourceHash: 'source-hash',
      reconcileOutputHash: 'reconcile-hash',
      sourceIndex: { chapters: [{ chapter: 1, line_count: 10 }], windows: [] },
      materialized: { decisions: decisions.slice(0, 11), entities: [], strong_signals: [], chapter_summaries: [] },
      riskLimit: 10
    });
    assert.equal(loweredLimit.status, 'needs_ai_review');
    assert.equal(loweredLimit.risk_limit, 10);
    assert.equal(loweredLimit.high_risk_decisions.length, 11);
  });
});
