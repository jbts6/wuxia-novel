#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PipelineError, readEventLog } = require('../scripts/lib/pipeline-events');
const { getPipelinePaths } = require('../scripts/lib/pipeline-paths');
const {
  appendPipelineEvent,
  initializePipelineRun,
  loadPipelineState
} = require('../scripts/lib/pipeline-state');
const {
  claimWorkItem,
  createWorkItems,
  submitWorkItem
} = require('../scripts/lib/work-items');

const PIPELINE_CLI = path.resolve(__dirname, '../scripts/pipeline.js');

function withNovel(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-work-items-'));
  try {
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function startInventory(root, runId = 'run-work') {
  initializePipelineRun(root, { runId, config: { max_workers: 2, risk_limit: 15 } });
  appendPipelineEvent(root, runId, 'stage_started', {
    stage: 'prepare', input_hash: 'source-v1', gate_version: 'prepare-v1'
  });
  appendPipelineEvent(root, runId, 'stage_passed', {
    stage: 'prepare', input_hash: 'source-v1', output_hash: 'prepared-v1', gate_version: 'prepare-v1'
  });
  appendPipelineEvent(root, runId, 'stage_started', {
    stage: 'inventory', input_hash: 'prepared-v1', gate_version: 'inventory-v1'
  });
}

function inventoryItems() {
  return [
    {
      work_item_id: 'inventory_named_ch001_w001',
      input_hash: 'window-001',
      instructions: { prompt_version: 'inventory-v1', allowed_output: 'candidate_batch' },
      source_payload: { chapter: 1, text: '段誉来到无量山。' }
    },
    {
      work_item_id: 'inventory_named_ch001_w002',
      input_hash: 'window-002',
      instructions: { prompt_version: 'inventory-v1', allowed_output: 'candidate_batch' },
      source_payload: { chapter: 1, text: '木婉清策马而来。' }
    }
  ];
}

function writeDraft(root, name, claim, overrides = {}) {
  const file = path.join(root, name);
  const draft = {
    schema_version: 1,
    run_id: claim.packet.run_id,
    stage: claim.packet.stage,
    work_item_id: claim.packet.work_item_id,
    input_hash: claim.packet.input_hash,
    worker_id: claim.packet.worker_id,
    lease_id: claim.packet.lease_id,
    payload: { candidates: [] },
    ...overrides
  };
  fs.writeFileSync(file, `${JSON.stringify(draft, null, 2)}\n`, 'utf8');
  return file;
}

describe('work item protocol', () => {
  it('claims stable inventory items up to configured concurrency', () => {
    withNovel(root => {
      startInventory(root);
      createWorkItems(root, 'run-work', 'inventory', inventoryItems());

      const first = claimWorkItem(root, 'run-work', {
        workerId: 'worker-a', now: new Date('2026-07-13T00:00:00Z'), leaseMs: 60_000
      });
      const second = claimWorkItem(root, 'run-work', {
        workerId: 'worker-b', now: new Date('2026-07-13T00:00:01Z'), leaseMs: 60_000
      });

      assert.equal(first.packet.work_item_id, 'inventory_named_ch001_w001');
      assert.equal(second.packet.work_item_id, 'inventory_named_ch001_w002');
      assert.ok(fs.existsSync(first.packet_path));
      assert.throws(
        () => claimWorkItem(root, 'run-work', {
          workerId: 'worker-c', now: new Date('2026-07-13T00:00:02Z'), leaseMs: 60_000
        }),
        error => error instanceof PipelineError && error.code === 'NO_WORK_ITEM_AVAILABLE'
      );
    });
  });

  it('records lease expiry before reclaiming the same work item', () => {
    withNovel(root => {
      startInventory(root);
      createWorkItems(root, 'run-work', 'inventory', [inventoryItems()[0]]);
      const first = claimWorkItem(root, 'run-work', {
        workerId: 'worker-a', now: new Date('2026-07-13T00:00:00Z'), leaseMs: 1_000
      });
      const reclaimed = claimWorkItem(root, 'run-work', {
        workerId: 'worker-b', now: new Date('2026-07-13T00:00:02Z'), leaseMs: 1_000
      });

      assert.notEqual(reclaimed.packet.lease_id, first.packet.lease_id);
      assert.equal(reclaimed.packet.worker_id, 'worker-b');
      const events = readEventLog(getPipelinePaths(root, 'run-work').events);
      assert.ok(events.some(event => event.type === 'work_item_lease_expired'));
    });
  });

  it('loads immutable work item definitions after a process-level module reset', () => {
    withNovel(root => {
      startInventory(root);
      createWorkItems(root, 'run-work', 'inventory', [inventoryItems()[0]]);

      const modulePath = require.resolve('../scripts/lib/work-items');
      delete require.cache[modulePath];
      const freshWorkItems = require('../scripts/lib/work-items');
      const claimed = freshWorkItems.claimWorkItem(root, 'run-work', {
        workerId: 'worker-new-process',
        now: new Date('2026-07-13T00:00:00Z'),
        leaseMs: 60_000
      });

      assert.equal(claimed.packet.source_payload.text, '段誉来到无量山。');
    });
  });

  it('rejects the wrong worker or stale lease without writing accepted artifacts', () => {
    withNovel(root => {
      startInventory(root);
      createWorkItems(root, 'run-work', 'inventory', [inventoryItems()[0]]);
      const claim = claimWorkItem(root, 'run-work', {
        workerId: 'worker-a', now: new Date('2026-07-13T00:00:00Z'), leaseMs: 60_000
      });
      const draftPath = writeDraft(root, 'wrong-worker.json', claim, { worker_id: 'worker-b' });

      assert.throws(
        () => submitWorkItem(root, 'run-work', {
          workerId: 'worker-b', itemId: claim.packet.work_item_id, draftPath,
          now: new Date('2026-07-13T00:00:01Z')
        }),
        error => error instanceof PipelineError && error.code === 'WORK_ITEM_OWNER_MISMATCH'
      );

      const paths = getPipelinePaths(root, 'run-work');
      const receipt = path.join(paths.workItems, 'inventory', 'receipts', `${claim.packet.work_item_id}.json`);
      assert.equal(fs.existsSync(receipt), false);
      assert.equal(loadPipelineState(root, 'run-work').work_items[claim.packet.work_item_id].status, 'claimed');
    });
  });

  it('accepts one matching draft and rejects a duplicate submission', () => {
    withNovel(root => {
      startInventory(root);
      createWorkItems(root, 'run-work', 'inventory', [inventoryItems()[0]]);
      const claim = claimWorkItem(root, 'run-work', {
        workerId: 'worker-a', now: new Date('2026-07-13T00:00:00Z'), leaseMs: 60_000
      });
      const draftPath = writeDraft(root, 'accepted.json', claim);
      const accepted = submitWorkItem(root, 'run-work', {
        workerId: 'worker-a', itemId: claim.packet.work_item_id, draftPath,
        now: new Date('2026-07-13T00:00:01Z')
      });

      assert.equal(accepted.receipt.status, 'accepted');
      assert.ok(fs.existsSync(accepted.receipt_path));
      assert.equal(loadPipelineState(root, 'run-work').work_items[claim.packet.work_item_id].status, 'accepted');
      assert.throws(
        () => submitWorkItem(root, 'run-work', {
          workerId: 'worker-a', itemId: claim.packet.work_item_id, draftPath,
          now: new Date('2026-07-13T00:00:02Z')
        }),
        error => error instanceof PipelineError && error.code === 'WORK_ITEM_ALREADY_ACCEPTED'
      );
    });
  });

  it('rejects a cross-stage draft', () => {
    withNovel(root => {
      startInventory(root);
      createWorkItems(root, 'run-work', 'inventory', [inventoryItems()[0]]);
      const claim = claimWorkItem(root, 'run-work', {
        workerId: 'worker-a', now: new Date('2026-07-13T00:00:00Z'), leaseMs: 60_000
      });
      const draftPath = writeDraft(root, 'cross-stage.json', claim, { stage: 'enrich' });

      assert.throws(
        () => submitWorkItem(root, 'run-work', {
          workerId: 'worker-a', itemId: claim.packet.work_item_id, draftPath,
          now: new Date('2026-07-13T00:00:01Z')
        }),
        error => error instanceof PipelineError && error.code === 'DRAFT_IDENTITY_MISMATCH'
      );
    });
  });
});

describe('pipeline CLI', () => {
  it('initializes and resumes through machine-readable status', () => {
    withNovel(root => {
      const initialized = spawnSync(process.execPath, [
        PIPELINE_CLI, 'init', root, '--run-id', 'run-cli', '--concurrency', '2', '--risk-limit', '15', '--json'
      ], { encoding: 'utf8' });
      assert.equal(initialized.status, 0, initialized.stderr);
      assert.equal(JSON.parse(initialized.stdout).run_id, 'run-cli');

      const status = spawnSync(process.execPath, [PIPELINE_CLI, 'status', root, '--json'], { encoding: 'utf8' });
      assert.equal(status.status, 0, status.stderr);
      const parsed = JSON.parse(status.stdout);
      assert.equal(parsed.stages.prepare.status, 'ready');
      assert.deepEqual(parsed.next_action, { command: 'start-stage', stage: 'prepare' });
    });
  });

  it('returns a stable error code for invalid configuration', () => {
    withNovel(root => {
      const result = spawnSync(process.execPath, [
        PIPELINE_CLI, 'init', root, '--run-id', 'run-cli', '--concurrency', '5', '--json'
      ], { encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.equal(JSON.parse(result.stderr).error.code, 'INVALID_CONFIG');
    });
  });
});
