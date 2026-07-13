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
const { validateStageDraft } = require('../scripts/lib/stage-contracts');
const { claimWorkItem, submitWorkItem } = require('../scripts/lib/work-items');
const { buildCompleteData } = require('./helpers/final-data-fixture');
let stagedEnrich = {};
try {
  stagedEnrich = require('../scripts/lib/staged-enrich');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

const PIPELINE_CLI = path.resolve(__dirname, '../scripts/pipeline.js');

function provisionalCharacter() {
  const character = buildCompleteData()['characters.json'][0];
  const record = {
    ...character,
    provisional_key: 'entity_character_0123456789abcdef',
    known_skills: ['entity_skill_1111111111111111'],
    related_skills: ['entity_skill_1111111111111111']
  };
  delete record.id;
  return record;
}

function definition(record) {
  return {
    schema_version: 1,
    stage: 'enrich',
    work_item_id: 'enrich_character_0123456789abcdef',
    input_hash: 'reconcile-output-hash',
    instructions: {
      kind: 'enrich-entity',
      category: 'character',
      provisional_key: record.provisional_key
    },
    source_payload: {
      entity: {
        provisional_key: record.provisional_key,
        canonical_name: record.name,
        final_category: 'character',
        importance: record.importance,
        source_refs: record.source_refs
      }
    },
    entity_keys: [record.provisional_key]
  };
}

function fieldClaims(record) {
  return Object.fromEntries(Object.entries(record.field_source_refs).map(([field, refs]) => [
    field,
    { claim: `${field} 的具体原文事实说明`, source_refs: refs }
  ]));
}

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

function withReconciledRun(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-staged-enrich-'));
  const runId = 'run-enrich';
  initializePipelineRun(root, { runId, config: { max_workers: 4, risk_limit: 15 } });
  passStage(root, runId, 'prepare', 'source-hash', 'prepare-output-hash');
  passStage(root, runId, 'inventory', 'prepare-output-hash', 'inventory-output-hash');
  passStage(root, runId, 'reconcile', 'inventory-output-hash', 'reconcile-output-hash');
  const paths = getPipelinePaths(root, runId);
  writeJsonAtomic(path.join(paths.materialized, 'reconcile', 'provisional-entities.json'), [{
    provisional_key: 'entity_character_0123456789abcdef',
    canonical_name: '主角',
    final_category: 'character',
    importance: '核心',
    source_refs: buildCompleteData()['characters.json'][0].source_refs
  }]);
  writeJsonAtomic(path.join(paths.materialized, 'reconcile', 'chapter-summary-drafts.json'), []);
  try {
    return callback({ root, runId });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeDraft(root, packet, payload) {
  const draftPath = path.join(root, `${packet.work_item_id}.draft.json`);
  fs.writeFileSync(draftPath, `${JSON.stringify({
    schema_version: 1,
    run_id: packet.run_id,
    stage: packet.stage,
    work_item_id: packet.work_item_id,
    input_hash: packet.input_hash,
    worker_id: packet.worker_id,
    lease_id: packet.lease_id,
    payload
  }, null, 2)}\n`);
  return draftPath;
}

function completeCharacterPayload(discoveryAlerts = []) {
  const record = provisionalCharacter();
  return {
    record,
    field_evidence_claims: fieldClaims(record),
    shared_evidence_justification: [{
      fields: ['identity', 'one_line', 'biography', 'personality'],
      source_refs: record.field_source_refs.identity,
      field_facts: {
        identity: '说话者以主角身份直接陈述所学。',
        one_line: '原话明确点出正在修习北冥神功。',
        biography: '这段话构成其修习经历的一部分。',
        personality: '主动直陈所学体现坦率表达方式。'
      }
    }],
    discovery_alerts: discoveryAlerts
  };
}

describe('staged enrich draft contract', () => {
  it('builds deterministic disjoint work items for the eight publish categories', () => {
    assert.equal(typeof stagedEnrich.buildEnrichDefinitions, 'function');
    const character = {
      provisional_key: 'entity_character_0123456789abcdef',
      canonical_name: '段誉',
      final_category: 'character',
      importance: '核心',
      source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: '段誉来到无量山。' }]
    };
    const skill = {
      provisional_key: 'entity_skill_1111111111111111',
      canonical_name: '北冥神功',
      final_category: 'skill',
      importance: '重要',
      source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: '段誉来到无量山。' }]
    };
    const event = {
      provisional_key: 'event_key_2222222222222222',
      canonical_name: '段誉入无量山',
      final_category: 'event',
      importance: '主要',
      source_refs: character.source_refs
    };
    const summary = {
      chapter: 1,
      summary: '段誉来到无量山并开始本章经历。',
      key_events: ['段誉入无量山'],
      key_character_names: ['段誉']
    };
    const forward = stagedEnrich.buildEnrichDefinitions({
      entities: [character, skill, event],
      chapter_summaries: [summary]
    }, 'reconcile-output-hash');
    const reverse = stagedEnrich.buildEnrichDefinitions({
      entities: [event, skill, character],
      chapter_summaries: [summary]
    }, 'reconcile-output-hash');

    assert.deepEqual(forward, reverse);
    assert.equal(forward.length, 3);
    assert.deepEqual(
      forward.map(item => item.instructions.category).sort(),
      ['chapter_summary', 'character', 'skill']
    );
    assert.equal(new Set(forward.flatMap(item => item.entity_keys)).size, 3);
    assert.ok(forward.every(item => item.entity_keys.length === 1));
  });

  it('plans, accepts, and materializes provisional enrich records without writing data JSON', () => {
    assert.equal(typeof stagedEnrich.planEnrichWorkItems, 'function');
    assert.equal(typeof stagedEnrich.completeEnrichStage, 'function');
    withReconciledRun(({ root, runId }) => {
      const planned = spawnSync(process.execPath, [PIPELINE_CLI, 'run', root, '--json'], {
        encoding: 'utf8'
      });
      assert.equal(planned.status, 0, planned.stderr);
      assert.equal(JSON.parse(planned.stdout).action, 'plan-enrich');
      const claim = claimWorkItem(root, runId, {
        workerId: 'enrich-worker',
        now: new Date('2026-07-13T05:00:00.000Z')
      });
      submitWorkItem(root, runId, {
        workerId: 'enrich-worker',
        itemId: claim.packet.work_item_id,
        draftPath: writeDraft(root, claim.packet, completeCharacterPayload()),
        now: new Date('2026-07-13T05:01:00.000Z')
      });

      const completedCommand = spawnSync(process.execPath, [PIPELINE_CLI, 'run', root, '--json'], {
        encoding: 'utf8'
      });
      assert.equal(completedCommand.status, 0, completedCommand.stderr);
      const completed = JSON.parse(completedCommand.stdout);
      assert.equal(completed.action, 'complete-enrich');
      assert.equal(completed.materialized.records_by_category.character.length, 1);
      assert.equal(Object.hasOwn(completed.materialized.records_by_category.character[0], 'id'), false);
      assert.equal(loadPipelineState(root, runId).stages['semantic-audit'].status, 'ready');
      assert.equal(fs.existsSync(path.join(root, 'data')), false);
    });
  });

  it('returns discovery alerts to reconcile instead of adding entities during enrich', () => {
    withReconciledRun(({ root, runId }) => {
      stagedEnrich.planEnrichWorkItems(root, runId);
      const claim = claimWorkItem(root, runId, {
        workerId: 'discovery-worker',
        now: new Date('2026-07-13T06:00:00.000Z')
      });
      const payload = completeCharacterPayload([{
        name: '钟灵',
        category_hint: 'character',
        reason: '当前人物证据中出现了尚未闭环的新命名人物。',
        source_refs: provisionalCharacter().source_refs
      }]);
      submitWorkItem(root, runId, {
        workerId: 'discovery-worker',
        itemId: claim.packet.work_item_id,
        draftPath: writeDraft(root, claim.packet, payload),
        now: new Date('2026-07-13T06:01:00.000Z')
      });

      const blocked = stagedEnrich.completeEnrichStage(root, runId);
      assert.equal(blocked.action, 'block-enrich');
      assert.equal(blocked.failure_code, 'ENRICH_DISCOVERY_ALERT');
      assert.equal(blocked.materialized.discovery_alerts.length, 1);
      assert.equal(blocked.state.stages.reconcile.status, 'invalidated');
      assert.deepEqual(blocked.state.next_action, { command: 'start-stage', stage: 'reconcile' });
    });
  });

  it('blocks three or more fields that reuse identical evidence without justification', () => {
    const record = provisionalCharacter();
    const result = validateStageDraft('enrich', {
      record,
      field_evidence_claims: fieldClaims(record),
      discovery_alerts: []
    }, definition(record));

    assert.equal(result.passed, false);
    assert.equal(result.code, 'EVIDENCE_PADDING');
  });

  it('accepts a complete provisional record with field claims and structured shared evidence', () => {
    const record = provisionalCharacter();
    const sharedRefs = record.field_source_refs.identity;
    const result = validateStageDraft('enrich', {
      record,
      field_evidence_claims: fieldClaims(record),
      shared_evidence_justification: [{
        fields: ['identity', 'one_line', 'biography', 'personality'],
        source_refs: sharedRefs,
        field_facts: {
          identity: '说话者以主角身份直接陈述所学。',
          one_line: '原话明确点出正在修习北冥神功。',
          biography: '这段话构成其修习经历的一部分。',
          personality: '主动直陈所学体现坦率表达方式。'
        }
      }],
      discovery_alerts: []
    }, definition(record));

    assert.equal(result.passed, true, result.errors.join('; '));
    assert.equal(result.output_count, 1);
  });

  it('rejects enrich attempts to change reconcile identity decisions', () => {
    const payload = completeCharacterPayload();
    const plannedDefinition = definition(payload.record);
    payload.record.name = '冒名人物';
    payload.record.importance = '重要';
    payload.record.final_category = 'skill';

    const result = validateStageDraft('enrich', payload, plannedDefinition);

    assert.equal(result.passed, false);
    assert.equal(result.code, 'DRAFT_SCHEMA_INVALID');
    assert.ok(result.errors.some(error => error.includes('canonical_name')));
    assert.ok(result.errors.some(error => error.includes('importance')));
    assert.ok(result.errors.some(error => error.includes('final_category')));
  });
});
