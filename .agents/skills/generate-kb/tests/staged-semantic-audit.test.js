#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { writeJsonAtomic } = require('../scripts/lib/atomic-json');
const { getPipelinePaths } = require('../scripts/lib/pipeline-paths');
const {
  appendPipelineEvent,
  initializePipelineRun,
  loadPipelineState
} = require('../scripts/lib/pipeline-state');
const { claimWorkItem, submitWorkItem } = require('../scripts/lib/work-items');

const PIPELINE_CLI = path.resolve(__dirname, '../scripts/pipeline.js');
const CHARACTER_KEY = 'entity_character_0123456789abcdef';

function passStage(root, runId, stage, inputHash, outputHash) {
  appendPipelineEvent(root, runId, 'stage_started', {
    stage,
    input_hash: inputHash,
    gate_version: `${stage}-v1`
  });
  appendPipelineEvent(root, runId, 'stage_passed', {
    stage,
    input_hash: inputHash,
    output_hash: outputHash,
    gate_version: `${stage}-v1`
  });
}

function withEnrichedRun(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-staged-semantic-'));
  const runId = 'run-semantic';
  initializePipelineRun(root, { runId, config: { max_workers: 4, risk_limit: 15 } });
  passStage(root, runId, 'prepare', 'source-hash', 'prepare-output-hash');
  passStage(root, runId, 'inventory', 'prepare-output-hash', 'inventory-output-hash');
  passStage(root, runId, 'reconcile', 'inventory-output-hash', 'reconcile-output-hash');
  passStage(root, runId, 'enrich', 'reconcile-output-hash', 'enrich-output-hash');
  const paths = getPipelinePaths(root, runId);
  const enrichDir = path.join(paths.materialized, 'enrich');
  const records = {
    character: [{
      provisional_key: CHARACTER_KEY,
      name: '路人甲',
      importance: '背景'
    }],
    faction: [],
    location: [],
    skill: [],
    technique: [],
    item: [],
    dialogue: [],
    chapter_summary: []
  };
  for (const [category, values] of Object.entries(records)) {
    writeJsonAtomic(path.join(enrichDir, `${category}.json`), values);
  }
  writeJsonAtomic(path.join(enrichDir, 'field-evidence-claims.json'), [{
    work_item_id: 'enrich_character_0123456789abcdef',
    category: 'character',
    provisional_key: CHARACTER_KEY,
    field_evidence_claims: {
      biography: {
        claim: '原文说明路人甲到达无量山。',
        source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: '路人甲来到无量山。' }]
      }
    }
  }]);
  writeJsonAtomic(path.join(enrichDir, 'shared-evidence-justifications.json'), []);
  writeJsonAtomic(path.join(paths.materialized, 'reconcile', 'provisional-entities.json'), [{
    provisional_key: CHARACTER_KEY,
    canonical_name: '路人甲',
    final_category: 'character',
    importance: '背景',
    source_refs: []
  }]);
  writeJsonAtomic(path.join(paths.materialized, 'reconcile', 'strong-signals.json'), {
    signals: [], resolutions: []
  });
  try {
    return callback({ root, runId, paths });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function auditDraft(root, packet, supported) {
  const draftPath = path.join(root, `${packet.work_item_id}.draft.json`);
  fs.writeFileSync(draftPath, `${JSON.stringify({
    schema_version: 1,
    run_id: packet.run_id,
    stage: packet.stage,
    work_item_id: packet.work_item_id,
    input_hash: packet.input_hash,
    worker_id: packet.worker_id,
    lease_id: packet.lease_id,
    payload: {
      evidence_verdicts: [{
        provisional_key: CHARACTER_KEY,
        field: 'biography',
        supported,
        reason: supported
          ? '原文直接说明路人甲到达无量山这一经历。'
          : '原文没有提供能够支持该传记描述的事实。'
      }]
    }
  }, null, 2)}\n`);
  return draftPath;
}

function planAndSubmit(root, runId, supported) {
  const planned = spawnSync(process.execPath, [PIPELINE_CLI, 'run', root, '--json'], {
    encoding: 'utf8'
  });
  assert.equal(planned.status, 0, planned.stderr);
  assert.equal(JSON.parse(planned.stdout).action, 'plan-semantic-audit');
  const claim = claimWorkItem(root, runId, {
    workerId: 'semantic-auditor',
    now: new Date('2026-07-13T07:00:00.000Z')
  });
  submitWorkItem(root, runId, {
    workerId: 'semantic-auditor',
    itemId: claim.packet.work_item_id,
    draftPath: auditDraft(root, claim.packet, supported),
    now: new Date('2026-07-13T07:01:00.000Z')
  });
}

describe('staged semantic audit', () => {
  it('passes only after independent field verdicts are accepted', () => {
    withEnrichedRun(({ root, runId, paths }) => {
      planAndSubmit(root, runId, true);
      const completed = spawnSync(process.execPath, [PIPELINE_CLI, 'run', root, '--json'], {
        encoding: 'utf8'
      });
      assert.equal(completed.status, 0, completed.stderr);
      const result = JSON.parse(completed.stdout);
      assert.equal(result.action, 'complete-semantic-audit');
      assert.equal(result.report.passed, true);
      assert.equal(loadPipelineState(root, runId).stages.publish.status, 'ready');
      assert.equal(fs.existsSync(path.join(paths.materialized, 'semantic-audit', 'report.json')), true);
    });
  });

  it('exits nonzero and leaves the stage blocked for unsupported evidence', () => {
    withEnrichedRun(({ root, runId, paths }) => {
      planAndSubmit(root, runId, false);
      const blocked = spawnSync(process.execPath, [PIPELINE_CLI, 'run', root, '--json'], {
        encoding: 'utf8'
      });
      assert.equal(blocked.status, 1);
      const error = JSON.parse(blocked.stderr).error;
      assert.equal(error.code, 'SEMANTIC_AUDIT_FAILED');
      assert.equal(loadPipelineState(root, runId).stages['semantic-audit'].status, 'blocked');
      const report = JSON.parse(fs.readFileSync(
        path.join(paths.materialized, 'semantic-audit', 'report.json'),
        'utf8'
      ));
      assert.ok(report.errors.some(entry => entry.code === 'FIELD_EVIDENCE_UNSUPPORTED'));
    });
  });
});
