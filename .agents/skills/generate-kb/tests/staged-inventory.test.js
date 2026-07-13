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
  completeInventoryStage,
  planInventoryWorkItems,
  prepareRunSource,
  validateInventoryStage
} = require('../scripts/lib/staged-inventory');
const { claimWorkItem, submitWorkItem } = require('../scripts/lib/work-items');

const PIPELINE_CLI = path.resolve(__dirname, '../scripts/pipeline.js');
const VALIDATE_INVENTORY_CLI = path.resolve(__dirname, '../scripts/validate-inventory.js');

function withNovel(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-staged-inventory-'));
  const chapter = [
    '段誉来到无量山。',
    '他遇见了钟灵。',
    '木婉清策马而来。',
    '众人谈起六脉神剑。'
  ].join('\n');
  fs.mkdirSync(path.join(root, 'ch_split'), { recursive: true });
  fs.writeFileSync(path.join(root, 'ch_split', 'ch_001.txt'), chapter, 'utf8');
  fs.writeFileSync(path.join(root, '原著.txt'), chapter, 'utf8');
  try {
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function initializePrepared(root, runId = 'run-inventory') {
  initializePipelineRun(root, { runId, config: { max_workers: 4, risk_limit: 15 } });
  return prepareRunSource(root, runId, { windowLines: 2, overlapLines: 0 });
}

function draftPath(root, packet, payload, name = packet.work_item_id) {
  const file = path.join(root, `${name}.draft.json`);
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

function emptyPayload(packet) {
  if (packet.instructions.kind === 'chapter-summary') {
    return {
      chapter_summary: {
        chapter: packet.source_payload.chapter,
        summary: '本回讲述段誉初入无量山并结识江湖人物。',
        key_events: ['段誉来到无量山'],
        key_character_names: ['段誉']
      }
    };
  }
  return {
    candidates: [],
    empty_result: {
      reason: packet.instructions.kind === 'named-inventory'
        ? 'no_named_entities'
        : 'no_events_or_dialogues',
      detail: '本窗口没有该类新增候选。'
    }
  };
}

function candidatePayload(packet) {
  if (packet.instructions.kind === 'chapter-summary') return emptyPayload(packet);
  const source = packet.source_payload;
  const ordinal = packet.instructions.kind === 'named-inventory' ? '0001' : '0002';
  const citation = source.text.split(/\r?\n/)[0];
  return {
    candidates: [{
      candidate_id: `cand_${source.window_id}_${ordinal}`,
      category_hint: packet.instructions.kind === 'named-inventory' ? 'character' : 'event',
      name: `候选${ordinal}`,
      chapter: source.chapter,
      window_id: source.window_id,
      discovery_pass: packet.instructions.kind,
      source_ref: {
        line_start: source.line_start,
        line_end: source.line_start,
        text: citation
      }
    }]
  };
}

function acceptPlannedInventory(root, runId, options = {}) {
  const submitted = [];
  let tick = 0;
  while (true) {
    const state = loadPipelineState(root, runId);
    const pending = Object.values(state.work_items)
      .filter(item => item.stage === 'inventory' && item.status === 'pending');
    if (pending.length === 0) break;

    const claims = [];
    for (let index = 0; index < Math.min(4, pending.length); index += 1) {
      claims.push(claimWorkItem(root, runId, {
        workerId: `worker-${runId}-${tick}-${index}`,
        now: new Date(Date.UTC(2026, 6, 13, 0, 0, tick + index))
      }));
    }
    const ordered = options.reverseSubmit ? claims.reverse() : claims;
    for (const claim of ordered) {
      const packet = claim.packet;
      submitWorkItem(root, runId, {
        workerId: packet.worker_id,
        itemId: packet.work_item_id,
        draftPath: draftPath(
          root,
          packet,
          options.withCandidates ? candidatePayload(packet) : emptyPayload(packet),
          `${runId}-${packet.work_item_id}`
        ),
        now: new Date(Date.UTC(2026, 6, 13, 0, 1, tick))
      });
      submitted.push(packet.work_item_id);
      tick += 1;
    }
  }
  return submitted;
}

describe('run-scoped prepare and inventory', () => {
  it('writes source artifacts only inside the active run and passes prepare', () => {
    withNovel(root => {
      initializePipelineRun(root, { runId: 'run-inventory', config: {} });
      const prepared = prepareRunSource(root, 'run-inventory', { windowLines: 2, overlapLines: 0 });
      const paths = getPipelinePaths(root, 'run-inventory');

      assert.equal(prepared.sourceIndex.windows.length, 2);
      assert.ok(fs.existsSync(path.join(paths.source, 'source-index.json')));
      assert.ok(fs.existsSync(path.join(paths.source, 'scan-plan.json')));
      assert.equal(fs.existsSync(path.join(root, 'build', 'source-index.json')), false);
      const state = loadPipelineState(root, 'run-inventory');
      assert.equal(state.stages.prepare.status, 'passed');
      assert.equal(state.stages.inventory.status, 'ready');
    });
  });

  it('plans stable window/chapter work items without exposing legacy final data', () => {
    withNovel(root => {
      fs.mkdirSync(path.join(root, 'data'), { recursive: true });
      fs.writeFileSync(path.join(root, 'data', 'characters.json'), '[{"name":"legacy-final-marker"}]\n');
      initializePrepared(root);
      const items = planInventoryWorkItems(root, 'run-inventory');

      assert.equal(items.length, 5);
      assert.equal(new Set(items.map(item => item.work_item_id)).size, 5);
      const claim = claimWorkItem(root, 'run-inventory', {
        workerId: 'worker-a', now: new Date('2026-07-13T00:00:00Z')
      });
      assert.doesNotMatch(JSON.stringify(claim.packet), /legacy-final-marker/);
      assert.equal(claim.packet.stage, 'inventory');
      assert.ok(['named-inventory', 'event-dialogue', 'chapter-summary'].includes(claim.packet.instructions.kind));
    });
  });

  it('rejects fabricated citations and requires structured empty-output evidence', () => {
    withNovel(root => {
      initializePrepared(root);
      planInventoryWorkItems(root, 'run-inventory');
      const first = claimWorkItem(root, 'run-inventory', {
        workerId: 'worker-a', now: new Date('2026-07-13T00:00:00Z')
      });
      assert.notEqual(first.packet.instructions.kind, 'chapter-summary');
      const source = first.packet.source_payload;
      const fabricated = {
        candidates: [{
          candidate_id: `cand_${source.window_id}_0001`,
          category_hint: 'character',
          name: '伪造人物',
          chapter: source.chapter,
          window_id: source.window_id,
          discovery_pass: first.packet.instructions.kind,
          source_ref: { line_start: source.line_start, line_end: source.line_start, text: '原文不存在的话' }
        }]
      };
      assert.throws(
        () => submitWorkItem(root, 'run-inventory', {
          workerId: 'worker-a', itemId: first.packet.work_item_id,
          draftPath: draftPath(root, first.packet, fabricated, 'fabricated'),
          now: new Date('2026-07-13T00:00:01Z')
        }),
        error => error instanceof PipelineError && error.code === 'INVENTORY_SOURCE_REF_INVALID'
      );

      const second = claimWorkItem(root, 'run-inventory', {
        workerId: 'worker-b', now: new Date('2026-07-13T00:00:02Z')
      });
      assert.notEqual(second.packet.instructions.kind, 'chapter-summary');
      assert.throws(
        () => submitWorkItem(root, 'run-inventory', {
          workerId: 'worker-b', itemId: second.packet.work_item_id,
          draftPath: draftPath(root, second.packet, { candidates: [] }, 'missing-empty-reason'),
          now: new Date('2026-07-13T00:00:03Z')
        }),
        error => error instanceof PipelineError && error.code === 'DRAFT_EMPTY_REASON_REQUIRED'
      );
      const accepted = submitWorkItem(root, 'run-inventory', {
        workerId: 'worker-b', itemId: second.packet.work_item_id,
        draftPath: draftPath(root, second.packet, emptyPayload(second.packet), 'structured-empty'),
        now: new Date('2026-07-13T00:00:04Z')
      });
      assert.equal(accepted.receipt.output_count, 0);
      assert.equal(accepted.receipt.empty_result.reason, emptyPayload(second.packet).empty_result.reason);
    });
  });

  it('materializes accepted drafts by work item ID and refuses missing receipts', () => {
    withNovel(root => {
      initializePrepared(root);
      planInventoryWorkItems(root, 'run-inventory');

      for (let index = 0; index < 5; index += 1) {
        const claim = claimWorkItem(root, 'run-inventory', {
          workerId: `worker-${index}`,
          now: new Date(`2026-07-13T00:00:0${index}Z`)
        });
        submitWorkItem(root, 'run-inventory', {
          workerId: `worker-${index}`,
          itemId: claim.packet.work_item_id,
          draftPath: draftPath(root, claim.packet, emptyPayload(claim.packet), `accepted-${index}`),
          now: new Date(`2026-07-13T00:01:0${index}Z`)
        });
      }

      const paths = getPipelinePaths(root, 'run-inventory');
      const receiptDir = path.join(paths.workItems, 'inventory', 'receipts');
      const removedReceipt = path.join(receiptDir, fs.readdirSync(receiptDir).sort()[0]);
      const receiptBytes = fs.readFileSync(removedReceipt);
      fs.rmSync(removedReceipt);
      const missing = validateInventoryStage(root, 'run-inventory');
      assert.equal(missing.passed, false);
      assert.ok(missing.errors.some(error => error.includes('missing receipt')));
      fs.writeFileSync(removedReceipt, receiptBytes);

      const completed = completeInventoryStage(root, 'run-inventory');
      assert.equal(completed.validation.passed, true);
      assert.ok(fs.existsSync(path.join(paths.materialized, 'inventory', 'candidates.jsonl')));
      assert.ok(fs.existsSync(path.join(paths.materialized, 'inventory', 'chapter-summary-drafts.json')));
      assert.equal(loadPipelineState(root, 'run-inventory').stages.inventory.status, 'passed');
    });
  });

  it('rejects a run-scoped source window changed after work items were planned', () => {
    withNovel(root => {
      initializePrepared(root);
      planInventoryWorkItems(root, 'run-inventory');
      const paths = getPipelinePaths(root, 'run-inventory');
      const sourcePath = path.join(paths.source, 'source-index.json');
      const sourceIndex = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      sourceIndex.windows[0].text = `${sourceIndex.windows[0].text}\n篡改内容`;
      fs.writeFileSync(sourcePath, `${JSON.stringify(sourceIndex, null, 2)}\n`, 'utf8');

      const validation = validateInventoryStage(root, 'run-inventory');
      assert.equal(validation.passed, false);
      assert.ok(validation.errors.some(error => error.includes('prepare output hash mismatch')));
    });
  });

  it('rejects tampered work item definitions and receipts', () => {
    withNovel(root => {
      initializePrepared(root);
      planInventoryWorkItems(root, 'run-inventory');
      acceptPlannedInventory(root, 'run-inventory');
      const paths = getPipelinePaths(root, 'run-inventory');
      const state = loadPipelineState(root, 'run-inventory');
      const itemId = Object.keys(state.work_items).sort()[0];
      const definitionPath = path.join(
        paths.workItems, 'inventory', 'definitions', `${itemId}.json`
      );
      const definitionBytes = fs.readFileSync(definitionPath);
      const definition = JSON.parse(definitionBytes.toString('utf8'));
      definition.instructions.prompt_version = 'tampered-prompt';
      fs.writeFileSync(definitionPath, `${JSON.stringify(definition, null, 2)}\n`, 'utf8');

      const definitionValidation = validateInventoryStage(root, 'run-inventory');
      assert.equal(definitionValidation.passed, false);
      assert.ok(definitionValidation.errors.some(error => error.includes('definition hash mismatch')));

      fs.writeFileSync(definitionPath, definitionBytes);
      const receiptPath = path.join(paths.workItems, 'inventory', 'receipts', `${itemId}.json`);
      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
      receipt.output_count += 1;
      fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

      const receiptValidation = validateInventoryStage(root, 'run-inventory');
      assert.equal(receiptValidation.passed, false);
      assert.ok(receiptValidation.errors.some(error => error.includes('receipt hash mismatch')));
    });
  });

  it('produces the same materialized hash regardless of submit order', () => {
    withNovel(root => {
      for (const runId of ['run-forward', 'run-reverse']) {
        initializePrepared(root, runId);
        planInventoryWorkItems(root, runId);
        acceptPlannedInventory(root, runId, {
          reverseSubmit: runId === 'run-reverse',
          withCandidates: true
        });
      }

      const forward = completeInventoryStage(root, 'run-forward');
      const reverse = completeInventoryStage(root, 'run-reverse');
      assert.equal(forward.materialized.output_hash, reverse.materialized.output_hash);
      assert.deepEqual(forward.materialized.candidates, reverse.materialized.candidates);
      assert.deepEqual(forward.materialized.chapter_summaries, reverse.materialized.chapter_summaries);
    });
  });

  it('validates the active or selected staged run without trusting a legacy manifest', () => {
    withNovel(root => {
      initializePrepared(root);
      planInventoryWorkItems(root, 'run-inventory');
      acceptPlannedInventory(root, 'run-inventory');
      fs.mkdirSync(path.join(root, 'build'), { recursive: true });
      fs.writeFileSync(path.join(root, 'build', 'scan-manifest.json'), JSON.stringify({
        passes: {
          'named-inventory': { completed_window_ids: ['fabricated-complete'] },
          'event-dialogue': { completed_window_ids: ['fabricated-complete'] }
        }
      }));

      const active = spawnSync(process.execPath, [
        VALIDATE_INVENTORY_CLI, root, '--dry-run', '--json'
      ], { encoding: 'utf8' });
      assert.equal(active.status, 0, active.stderr);
      assert.equal(JSON.parse(active.stdout).mode, 'staged');

      const selected = spawnSync(process.execPath, [
        VALIDATE_INVENTORY_CLI, root, '--run-id', 'run-inventory', '--dry-run', '--json'
      ], { encoding: 'utf8' });
      assert.equal(selected.status, 0, selected.stderr);
      const parsed = JSON.parse(selected.stdout);
      assert.equal(parsed.run_id, 'run-inventory');
      assert.equal(parsed.validation.expected_count, 5);
      assert.equal(fs.existsSync(path.join(root, 'reports', 'inventory_validation.json')), false);
    });
  });

  it('preserves the legacy report shape and legacy dry-run behavior', () => {
    withNovel(root => {
      const reportPath = path.join(root, 'reports', 'inventory_validation.json');
      const dryRun = spawnSync(process.execPath, [
        VALIDATE_INVENTORY_CLI, root, '--legacy', '--dry-run', '--json'
      ], { encoding: 'utf8' });
      assert.notEqual(dryRun.status, 0);
      assert.equal(fs.existsSync(reportPath), false);

      const written = spawnSync(process.execPath, [
        VALIDATE_INVENTORY_CLI, root, '--legacy', '--json'
      ], { encoding: 'utf8' });
      assert.notEqual(written.status, 0);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      assert.equal(typeof report.passed, 'boolean');
      assert.equal(Object.hasOwn(report, 'validation'), false);
      assert.equal(Object.hasOwn(report, 'mode'), false);
    });
  });

  it('runs exactly one prepare or inventory controller action per invocation', () => {
    withNovel(root => {
      const initialized = spawnSync(process.execPath, [
        PIPELINE_CLI, 'init', root, '--run-id', 'run-controller', '--concurrency', '4', '--json'
      ], { encoding: 'utf8' });
      assert.equal(initialized.status, 0, initialized.stderr);

      const prepared = spawnSync(process.execPath, [
        PIPELINE_CLI, 'run', root, '--json'
      ], { encoding: 'utf8' });
      assert.equal(prepared.status, 0, prepared.stderr);
      const preparedResult = JSON.parse(prepared.stdout);
      assert.equal(preparedResult.action, 'prepare-source');
      assert.equal(preparedResult.state.stages.prepare.status, 'passed');
      assert.equal(preparedResult.state.stages.inventory.status, 'ready');

      const planned = spawnSync(process.execPath, [
        PIPELINE_CLI, 'run', root, '--json'
      ], { encoding: 'utf8' });
      assert.equal(planned.status, 0, planned.stderr);
      const plannedResult = JSON.parse(planned.stdout);
      assert.equal(plannedResult.action, 'plan-inventory');
      assert.equal(plannedResult.state.stages.inventory.status, 'running');
      assert.equal(plannedResult.state.next_action.command, 'claim');

      const waiting = spawnSync(process.execPath, [
        PIPELINE_CLI, 'run', root, '--json'
      ], { encoding: 'utf8' });
      assert.equal(waiting.status, 0, waiting.stderr);
      const waitingResult = JSON.parse(waiting.stdout);
      assert.equal(waitingResult.action, 'awaiting-work-items');
      assert.equal(waitingResult.state.last_seq, plannedResult.state.last_seq);

      acceptPlannedInventory(root, 'run-controller');
      const completed = spawnSync(process.execPath, [
        PIPELINE_CLI, 'run', root, '--json'
      ], { encoding: 'utf8' });
      assert.equal(completed.status, 0, completed.stderr);
      const completedResult = JSON.parse(completed.stdout);
      assert.equal(completedResult.action, 'complete-inventory');
      assert.equal(completedResult.state.stages.inventory.status, 'passed');
      assert.equal(completedResult.state.stages.reconcile.status, 'ready');
    });
  });
});
