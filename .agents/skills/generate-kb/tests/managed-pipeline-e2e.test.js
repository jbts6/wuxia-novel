#!/usr/bin/env node
'use strict';

const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { execute } = require('../scripts/pipeline');
const { loadActivePipelineState } = require('../scripts/lib/pipeline-state');
const { provisionalKey } = require('../scripts/lib/staged-reconcile');
const { buildCompleteData } = require('./helpers/final-data-fixture');

const SOURCE_TEXT = '主角说道：“我练的是北冥神功。”';

function writeJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filename;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createNovelFixture(novelDir) {
  fs.mkdirSync(path.join(novelDir, 'ch_split'), { recursive: true });
  fs.writeFileSync(path.join(novelDir, 'ch_split', 'ch_001.txt'), SOURCE_TEXT, 'utf8');
  fs.writeFileSync(path.join(novelDir, `${path.basename(novelDir)}.txt`), SOURCE_TEXT, 'utf8');

  for (const [filename, records] of Object.entries(buildCompleteData(SOURCE_TEXT))) {
    writeJson(path.join(novelDir, 'data', filename), records);
  }
  fs.writeFileSync(path.join(novelDir, 'data', 'legacy-note.txt'), 'legacy data bytes\n', 'utf8');
  writeJson(path.join(novelDir, 'reports', 'legacy-only.json'), { legacy: true });
}

function writeWorkItemDraft(novelDir, packet, payload) {
  return writeJson(path.join(
    novelDir,
    'external-drafts',
    packet.stage,
    `${packet.work_item_id}.json`
  ), {
    schema_version: 1,
    run_id: packet.run_id,
    stage: packet.stage,
    work_item_id: packet.work_item_id,
    input_hash: packet.input_hash,
    worker_id: packet.worker_id,
    lease_id: packet.lease_id,
    payload
  });
}

function claimAndSubmit(novelDir, workerId, payloadForPacket) {
  const claimed = execute(['claim', novelDir, '--worker', workerId]);
  const packet = claimed.packet;
  const draft = writeWorkItemDraft(novelDir, packet, payloadForPacket(packet));
  execute([
    'submit', novelDir,
    '--worker', workerId,
    '--item', packet.work_item_id,
    '--draft', draft
  ]);
  return packet;
}

function sourceCandidate(packet, ordinal, category, name, extra = {}) {
  const source = packet.source_payload;
  return {
    candidate_id: `cand_${source.window_id}_${String(ordinal).padStart(4, '0')}`,
    category_hint: category,
    name,
    chapter: source.chapter,
    window_id: source.window_id,
    discovery_pass: packet.instructions.kind,
    source_ref: {
      line_start: source.line_start,
      line_end: source.line_start,
      text: source.text.split(/\r?\n/)[0]
    },
    ...extra
  };
}

function inventoryPayload(packet) {
  if (packet.instructions.kind === 'named-inventory') {
    return {
      candidates: [
        sourceCandidate(packet, 1, 'character', '主角'),
        sourceCandidate(packet, 2, 'skill', '北冥神功')
      ]
    };
  }
  if (packet.instructions.kind === 'event-dialogue') {
    return {
      candidates: [
        sourceCandidate(packet, 101, 'event', '主角说明所学', {
          participant_names: ['主角']
        }),
        sourceCandidate(packet, 102, 'dialogue', '主角说明所学', {
          speaker_name: '主角'
        })
      ]
    };
  }
  return {
    chapter_summary: {
      chapter: 1,
      summary: '主角主动说明自己正在修习北冥神功，交代本章唯一的武学信息。',
      key_events: ['主角说明所学'],
      key_character_names: ['主角']
    }
  };
}

function reconcilePayload(packet) {
  const first = packet.source_payload.candidates[0];
  const highRisk = first.name === '北冥神功';
  const importance = {
    character: '核心',
    skill: '重要',
    event: '主要',
    dialogue: '重要'
  }[first.category_hint];
  return {
    decision: {
      decision_id: packet.instructions.decision_id,
      decision: 'keep',
      candidate_ids: packet.source_payload.candidates.map(candidate => candidate.candidate_id),
      canonical_name: first.name,
      final_category: first.category_hint,
      importance,
      reason: '原文具名且候选引用完整，可保留为当前类别。',
      provisional_key: provisionalKey(first.category_hint, packet.instructions.cluster_id),
      risk: {
        level: highRisk ? 'high' : 'low',
        reasons: highRisk ? ['武学分类需要人工确认'] : []
      }
    },
    character_signal_resolutions: []
  };
}

function gapPayload() {
  return {
    candidates: [],
    empty_result: {
      reason: 'no_gap_candidates',
      detail: '独立盲查未发现新的有效候选。'
    }
  };
}

function fieldEvidenceClaims(record) {
  return Object.fromEntries(Object.entries(record.field_source_refs || {}).map(([field, refs]) => [
    field,
    {
      claim: `${field} 字段由本章原文中的明确陈述支持。`,
      source_refs: refs
    }
  ]));
}

function sharedEvidenceJustification(category, record) {
  const claims = fieldEvidenceClaims(record);
  const groups = new Map();
  for (const [field, claim] of Object.entries(claims)) {
    const signature = JSON.stringify(claim.source_refs);
    if (!groups.has(signature)) groups.set(signature, { fields: [], source_refs: claim.source_refs });
    groups.get(signature).fields.push(field);
  }
  const facts = category === 'character'
    ? {
        identity: '原文中的说话者被明确写作本段故事主角。',
        one_line: '原话直接说出主角正在修习北冥神功。',
        biography: '这句话记录主角已经开始修习该内功的经历。',
        personality: '主角主动说明所学，体现坦率直接的表达。'
      }
    : {
        one_line: '原话把北冥神功明确称作主角正在修习的武学。',
        progression: '原文只确认当前正在修习，未出现前后阶段变化。',
        combat_style: '本段仅描述内功修习，没有出现具体交手招式。'
      };
  return [...groups.values()]
    .filter(group => group.fields.length >= 3)
    .map(group => ({
      fields: group.fields,
      source_refs: group.source_refs,
      field_facts: Object.fromEntries(group.fields.map(field => [field, facts[field]]))
    }));
}

function provisionalRecords(entities) {
  const complete = buildCompleteData(SOURCE_TEXT);
  const keys = Object.fromEntries(entities.map(entity => [entity.final_category, entity.provisional_key]));
  const character = clone(complete['characters.json'][0]);
  character.provisional_key = keys.character;
  character.known_skills = [keys.skill];
  character.related_skills = [keys.skill];
  delete character.id;

  const skill = clone(complete['skills.json'][0]);
  skill.provisional_key = keys.skill;
  delete skill.id;

  const dialogue = clone(complete['dialogues.json'][0]);
  dialogue.provisional_key = keys.dialogue;
  dialogue.speaker = keys.character;
  dialogue.event_id = keys.event;
  delete dialogue.id;

  const summary = clone(complete['chapter_summaries.json'][0]);
  summary.key_characters = [keys.character];
  return { keys, character, skill, dialogue, chapter_summary: summary };
}

function enrichPayload(packet, records) {
  const category = packet.instructions.category;
  const record = records[category];
  return {
    record,
    field_evidence_claims: fieldEvidenceClaims(record),
    shared_evidence_justification: sharedEvidenceJustification(category, record),
    discovery_alerts: []
  };
}

function semanticAuditPayload(packet) {
  return {
    evidence_verdicts: packet.instructions.fields.map(field => ({
      provisional_key: packet.instructions.provisional_key,
      field,
      supported: true,
      reason: `逐字核对后，原文事实能够直接支持 ${field} 字段的当前表述。`
    }))
  };
}

function tokenPlan(keys) {
  return {
    [keys.character]: { canonical_name: '主角', pinyin_tokens: ['zhu', 'jue'] },
    [keys.skill]: {
      canonical_name: '北冥神功', pinyin_tokens: ['bei', 'ming', 'shen', 'gong']
    },
    [keys.event]: {
      canonical_name: '主角说明所学',
      pinyin_tokens: ['zhu', 'jue', 'shuo', 'ming', 'suo', 'xue']
    },
    [keys.dialogue]: {
      canonical_name: '主角说明所学',
      pinyin_tokens: ['zhu', 'jue', 'shuo', 'ming', 'suo', 'xue']
    }
  };
}

it('runs the managed six-stage pipeline through promote and rollback', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-managed-e2e-'));
  const novelDir = path.join(tempRoot, '临时小说');
  try {
    createNovelFixture(novelDir);
    const legacyCharacters = fs.readFileSync(path.join(novelDir, 'data', 'characters.json'));
    execute([
      'init', novelDir,
      '--run-id', 'run-managed-e2e',
      '--concurrency', '1',
      '--risk-limit', '15'
    ]);

    assert.equal(execute(['run', novelDir]).action, 'prepare-source');
    assert.equal(execute(['run', novelDir]).action, 'plan-inventory');
    let inventoryIndex = 0;
    while (loadActivePipelineState(novelDir).next_action.command === 'claim') {
      claimAndSubmit(novelDir, `inventory-worker-${inventoryIndex}`, inventoryPayload);
      inventoryIndex += 1;
    }
    assert.equal(execute(['run', novelDir]).action, 'complete-inventory');

    assert.equal(execute(['run', novelDir]).action, 'plan-reconcile');
    let reconcileIndex = 0;
    while (loadActivePipelineState(novelDir).next_action.command === 'claim') {
      claimAndSubmit(novelDir, `reconcile-worker-${reconcileIndex}`, reconcilePayload);
      reconcileIndex += 1;
    }
    assert.equal(execute(['run', novelDir]).action, 'plan-gap-audit');
    let gapIndex = 0;
    while (loadActivePipelineState(novelDir).next_action.command === 'claim') {
      claimAndSubmit(novelDir, `gap-worker-${gapIndex}`, gapPayload);
      gapIndex += 1;
    }
    const reviewRequested = execute(['run', novelDir]);
    assert.equal(reviewRequested.action, 'request-recall-review');
    assert.equal(reviewRequested.packet.high_risk_decisions.length, 1);

    const reviewPacket = execute(['review-packet', novelDir]).packet;
    const reviewInput = writeJson(path.join(novelDir, 'review-input.json'), {
      schema_version: 1,
      run_id: reviewPacket.run_id,
      packet_hash: reviewPacket.packet_hash,
      source_hash: reviewPacket.source_hash,
      reconcile_output_hash: reviewPacket.reconcile_output_hash,
      reviewer: '端到端测试审核者',
      reviewed_at: '2026-07-13T08:00:00.000Z',
      action: 'accept_recall',
      high_risk_resolutions: reviewPacket.high_risk_decisions.map(decision => ({
        decision_id: decision.decision_id,
        conclusion: 'accept',
        note: '已核对原文中的武学名称与类别。'
      })),
      search_anchors: []
    });
    execute(['record-review', novelDir, '--input', reviewInput]);

    const records = provisionalRecords(reviewRequested.materialized.entities);
    assert.equal(execute(['run', novelDir]).action, 'plan-enrich');
    let enrichIndex = 0;
    while (loadActivePipelineState(novelDir).next_action.command === 'claim') {
      claimAndSubmit(
        novelDir,
        `enrich-worker-${enrichIndex}`,
        packet => enrichPayload(packet, records)
      );
      enrichIndex += 1;
    }
    assert.equal(execute(['run', novelDir]).action, 'complete-enrich');

    assert.equal(execute(['run', novelDir]).action, 'plan-semantic-audit');
    let auditIndex = 0;
    while (loadActivePipelineState(novelDir).next_action.command === 'claim') {
      claimAndSubmit(novelDir, `audit-worker-${auditIndex}`, semanticAuditPayload);
      auditIndex += 1;
    }
    const audited = execute(['run', novelDir]);
    assert.equal(audited.action, 'complete-semantic-audit');
    assert.equal(audited.report.passed, true);

    const beforePublish = loadActivePipelineState(novelDir);
    assert.equal(beforePublish.stages.publish.status, 'ready');
    assert.deepEqual(
      fs.readFileSync(path.join(novelDir, 'data', 'characters.json')),
      legacyCharacters
    );
    assert.equal(fs.existsSync(path.join(novelDir, '.kb', 'current')), false);

    const publishStarted = execute(['advance', novelDir]);
    const publishDraft = writeJson(path.join(novelDir, 'publish-draft.json'), {
      schema_version: 1,
      run_id: publishStarted.run_id,
      semantic_audit_hash: audited.report.output_hash,
      token_plan: tokenPlan(records.keys)
    });
    const built = execute(['build-publish', novelDir, '--draft', publishDraft]);
    assert.equal(built.action, 'publish-bundle-built');
    assert.deepEqual(
      fs.readFileSync(path.join(novelDir, 'data', 'characters.json')),
      legacyCharacters
    );

    const promoted = execute([
      'promote', novelDir,
      '--bundle', built.manifest.bundle_hash,
      '--expected-current', 'none'
    ]);
    assert.equal(promoted.state.stages.publish.status, 'published');
    assert.equal(promoted.state.publish.status, 'promoted');
    assert.equal(execute(['check', novelDir]).publish.status, 'promoted');
    assert.equal(
      fs.readlinkSync(path.join(novelDir, '.kb', 'current')),
      `versions/${built.manifest.bundle_hash}`
    );

    const rolledBack = execute([
      'rollback', novelDir,
      '--bundle', promoted.legacy_bundle_hash,
      '--expected-current', built.manifest.bundle_hash
    ]);
    assert.equal(rolledBack.state.publish.status, 'rolled_back');
    assert.equal(rolledBack.state.publish.rollback_bundle_hash, promoted.legacy_bundle_hash);
    assert.equal(
      fs.readlinkSync(path.join(novelDir, '.kb', 'current')),
      `versions/${promoted.legacy_bundle_hash}`
    );
    assert.equal(fs.readFileSync(path.join(novelDir, 'data', 'legacy-note.txt'), 'utf8'), 'legacy data bytes\n');
    assert.equal(fs.existsSync(rolledBack.receipt_path), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
