#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  resolveInside,
  sha256,
  stableStringify,
  writeJsonAtomic
} = require('../scripts/lib/atomic-json');
const { PipelineError } = require('../scripts/lib/pipeline-events');
const { STAGES } = require('../scripts/lib/pipeline-reducer');
const {
  appendPipelineEvent,
  initializePipelineRun,
  loadPipelineState
} = require('../scripts/lib/pipeline-state');

function withNovel(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-pipeline-'));
  try {
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function passStage(novelDir, runId, stage, inputHash, outputHash, gateVersion = 'v1') {
  appendPipelineEvent(novelDir, runId, 'stage_started', {
    stage,
    input_hash: inputHash,
    gate_version: gateVersion
  });
  return appendPipelineEvent(novelDir, runId, 'stage_passed', {
    stage,
    input_hash: inputHash,
    output_hash: outputHash,
    gate_version: gateVersion
  });
}

describe('pipeline atomic primitives', () => {
  it('stable-stringifies, hashes, writes atomically, and rejects path escape', () => {
    withNovel(root => {
      assert.equal(stableStringify({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');
      assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

      const file = path.join(root, 'state.json');
      writeJsonAtomic(file, { b: 2, a: 1 });
      assert.equal(fs.readFileSync(file, 'utf8'), '{\n  "a": 1,\n  "b": 2\n}\n');
      assert.equal(resolveInside(root, 'safe', 'file.json'), path.join(root, 'safe', 'file.json'));
      assert.throws(() => resolveInside(root, '..', 'escape.json'), error => (
        error instanceof PipelineError && error.code === 'PATH_OUTSIDE_RUN'
      ));
    });
  });
});

describe('six-stage pipeline state', () => {
  it('initializes all stages and rejects skipping a prerequisite', () => {
    withNovel(root => {
      const state = initializePipelineRun(root, { runId: 'run-001', config: { max_workers: 1 } });

      assert.deepEqual(Object.keys(state.stages), STAGES);
      assert.equal(state.stages.prepare.status, 'ready');
      assert.ok(STAGES.slice(1).every(stage => state.stages[stage].status === 'not_started'));
      assert.equal(state.next_action.command, 'start-stage');
      assert.equal(state.next_action.stage, 'prepare');

      assert.throws(
        () => appendPipelineEvent(root, 'run-001', 'stage_started', {
          stage: 'inventory', input_hash: 'source-v1', gate_version: 'inventory-v1'
        }),
        error => error instanceof PipelineError && error.code === 'INVALID_STAGE_TRANSITION'
      );
    });
  });

  it('advances in order and invalidates downstream state when an upstream gate version changes', () => {
    withNovel(root => {
      initializePipelineRun(root, { runId: 'run-002', config: {} });
      passStage(root, 'run-002', 'prepare', 'source-v1', 'prepared-v1', 'prepare-v1');
      passStage(root, 'run-002', 'inventory', 'prepared-v1', 'inventory-v1', 'inventory-v1');

      const rerun = appendPipelineEvent(root, 'run-002', 'stage_started', {
        stage: 'prepare', input_hash: 'source-v1', gate_version: 'prepare-v2'
      });

      assert.equal(rerun.stages.prepare.status, 'running');
      assert.equal(rerun.stages.prepare.gate_version, 'prepare-v2');
      assert.equal(rerun.stages.inventory.status, 'invalidated');
      assert.equal(rerun.stages.reconcile.status, 'invalidated');
      assert.equal(rerun.review, null);
      assert.equal(rerun.publish, null);
    });
  });

  it('rebuilds a missing state projection from the append-only event log', () => {
    withNovel(root => {
      initializePipelineRun(root, { runId: 'run-003', config: {} });
      passStage(root, 'run-003', 'prepare', 'source-v1', 'prepared-v1');

      const statePath = path.join(root, 'build', 'generate-kb', 'runs', 'run-003', 'state.json');
      fs.rmSync(statePath);
      const rebuilt = loadPipelineState(root, 'run-003');

      assert.equal(rebuilt.last_seq, 3);
      assert.equal(rebuilt.stages.prepare.status, 'passed');
      assert.equal(rebuilt.stages.inventory.status, 'ready');
      assert.ok(fs.existsSync(statePath));
    });
  });

  it('rejects a tampered event instead of trusting a stale state cache', () => {
    withNovel(root => {
      initializePipelineRun(root, { runId: 'run-004', config: {} });
      const eventPath = path.join(root, 'build', 'generate-kb', 'runs', 'run-004', 'events.jsonl');
      const event = JSON.parse(fs.readFileSync(eventPath, 'utf8').trim());
      event.payload.config.injected = true;
      fs.writeFileSync(eventPath, `${JSON.stringify(event)}\n`, 'utf8');

      assert.throws(
        () => loadPipelineState(root, 'run-004'),
        error => error instanceof PipelineError && error.code === 'EVENT_HASH_MISMATCH'
      );
    });
  });

  it('tracks publish bundle build, promote, and rollback events', () => {
    withNovel(root => {
      initializePipelineRun(root, { runId: 'run-005', config: {} });
      let state = passStage(root, 'run-005', 'prepare', 'source-v1', 'prepared-v1');
      state = passStage(root, 'run-005', 'inventory', 'prepared-v1', 'inventory-v1');
      state = passStage(root, 'run-005', 'reconcile', 'inventory-v1', 'reconcile-v1');
      state = passStage(root, 'run-005', 'enrich', 'reconcile-v1', 'enrich-v1');
      state = passStage(root, 'run-005', 'semantic-audit', 'enrich-v1', 'semantic-v1');
      assert.equal(state.stages.publish.status, 'ready');
      state = appendPipelineEvent(root, 'run-005', 'stage_started', {
        stage: 'publish', input_hash: 'semantic-v1', gate_version: 'publish-v1'
      });

      state = appendPipelineEvent(root, 'run-005', 'publish_bundle_built', {
        stage: 'publish',
        input_hash: 'semantic-v1',
        bundle_hash: 'a'.repeat(64),
        final_data_hash: 'f'.repeat(64),
        output_hash: 'a'.repeat(64),
        manifest_hash: 'm'.repeat(64)
      });
      assert.equal(state.publish.status, 'built');
      assert.equal(state.next_action.command, 'promote');

      state = appendPipelineEvent(root, 'run-005', 'bundle_promoted', {
        stage: 'publish',
        bundle_hash: 'a'.repeat(64),
        final_data_hash: 'f'.repeat(64),
        receipt_hash: 'r'.repeat(64)
      });
      assert.equal(state.publish.status, 'promoted');
      assert.equal(state.stages.publish.status, 'published');
      assert.equal(state.next_action.command, 'complete');

      state = appendPipelineEvent(root, 'run-005', 'bundle_rolled_back', {
        stage: 'publish',
        bundle_hash: 'b'.repeat(64),
        final_data_hash: 'e'.repeat(64),
        receipt_hash: 'q'.repeat(64)
      });
      assert.equal(state.publish.status, 'rolled_back');
      assert.equal(state.publish.rollback_bundle_hash, 'b'.repeat(64));
      assert.equal(state.stages.publish.status, 'published');
    });
  });
});
