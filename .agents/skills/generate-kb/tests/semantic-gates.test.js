#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateProvisionalRecord } = require('../scripts/lib/final-data-contract');
const { validateStageDraft } = require('../scripts/lib/stage-contracts');
const { buildCompleteData } = require('./helpers/final-data-fixture');

let semanticGates = {};
try {
  semanticGates = require('../scripts/lib/semantic-gates');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

const CHARACTER_KEY = 'entity_character_0123456789abcdef';
const OTHER_CHARACTER_KEY = 'entity_character_1111111111111111';
const FIXTURES = path.join(__dirname, 'fixtures');

function baseInput() {
  return {
    records_by_category: {
      character: [{
        provisional_key: CHARACTER_KEY,
        name: '段誉',
        importance: '核心'
      }],
      faction: [],
      location: [],
      skill: [],
      technique: [],
      item: [],
      dialogue: [],
      chapter_summary: []
    },
    events: [],
    exemptions: { personas: [], event_participants: [] },
    dialogue_signals: [],
    shared_evidence_justifications: []
  };
}

function codes(result) {
  return result.errors.map(error => error.code);
}

describe('semantic hard gates', () => {
  it('requires semantic-audit work items to close every field claim exactly once', () => {
    const definition = {
      instructions: {
        kind: 'semantic-evidence-audit',
        provisional_key: CHARACTER_KEY,
        fields: ['biography', 'personality']
      },
      source_payload: {
        field_evidence_claims: {
          biography: { claim: '传记事实', source_refs: [{ chapter: 1 }] },
          personality: { claim: '性格事实', source_refs: [{ chapter: 1 }] }
        }
      }
    };
    const incomplete = validateStageDraft('semantic-audit', {
      evidence_verdicts: [{
        provisional_key: CHARACTER_KEY,
        field: 'biography',
        supported: true,
        reason: '原文直接说明人物经历的起点。'
      }]
    }, definition);
    assert.equal(incomplete.passed, false);
    assert.equal(incomplete.code, 'DRAFT_SCHEMA_INVALID');

    const complete = validateStageDraft('semantic-audit', {
      evidence_verdicts: [{
        provisional_key: CHARACTER_KEY,
        field: 'biography',
        supported: true,
        reason: '原文直接说明人物经历的起点。'
      }, {
        provisional_key: CHARACTER_KEY,
        field: 'personality',
        supported: false,
        reason: '原文动作不能充分支持性格判断。'
      }]
    }, definition);
    assert.equal(complete.passed, true, complete.errors.join('; '));
    assert.equal(complete.output_count, 2);
  });

  it('rejects persona dialogue with an unknown or nonexistent speaker', () => {
    assert.equal(typeof semanticGates.runSemanticGates, 'function');
    const input = baseInput();
    input.records_by_category.dialogue = [{
      provisional_key: 'dialogue_key_2222222222222222',
      selection_type: 'persona',
      speaker: null,
      speaker_name: '未知'
    }, {
      provisional_key: 'dialogue_key_3333333333333333',
      selection_type: 'both',
      speaker: OTHER_CHARACTER_KEY,
      speaker_name: '虚竹'
    }];

    const result = semanticGates.runSemanticGates(input);
    assert.equal(result.passed, false);
    assert.equal(codes(result).filter(code => code === 'DIALOGUE_SPEAKER_INVALID').length, 2);
  });

  it('rejects a generic persona exemption when source dialogue signals exist', () => {
    assert.equal(typeof semanticGates.runSemanticGates, 'function');
    const input = baseInput();
    input.exemptions.personas = [{
      provisional_key: CHARACTER_KEY,
      reason: '没有关联对白',
      search_scope: [],
      source_refs: []
    }];
    input.dialogue_signals = [{
      speaker_name: '段誉',
      source_refs: [{ chapter: 1, line_start: 8, line_end: 8, text: '段誉说道：“我去便是。”' }]
    }];

    const result = semanticGates.runSemanticGates(input);
    assert.ok(codes(result).includes('PERSONA_EXEMPTION_INVALID'));
    assert.ok(codes(result).includes('PERSONA_EXEMPTION_CONTRADICTED'));
  });

  it('requires every event participant and chapter key character to resolve', () => {
    assert.equal(typeof semanticGates.runSemanticGates, 'function');
    const input = baseInput();
    input.events = [{
      provisional_key: 'event_key_4444444444444444',
      name: '少林寺相认',
      importance: '主要',
      participant_names: ['虚竹']
    }];
    input.records_by_category.chapter_summary = [{
      chapter: 1,
      key_characters: [OTHER_CHARACTER_KEY]
    }];

    const result = semanticGates.runSemanticGates(input);
    assert.ok(codes(result).includes('EVENT_PARTICIPANT_UNRESOLVED'));
    assert.ok(codes(result).includes('SUMMARY_CHARACTER_UNRESOLVED'));
  });

  it('rejects circular shared-evidence facts even when the structure is complete', () => {
    assert.equal(typeof semanticGates.runSemanticGates, 'function');
    const input = baseInput();
    input.shared_evidence_justifications = [{
      provisional_key: CHARACTER_KEY,
      fields: ['identity', 'biography', 'personality'],
      source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: '段誉来到无量山。' }],
      field_facts: {
        identity: '原文支持 identity',
        biography: '原文支持 biography',
        personality: '原文支持 personality'
      }
    }];

    const result = semanticGates.runSemanticGates(input);
    assert.ok(codes(result).includes('SHARED_EVIDENCE_JUSTIFICATION_INVALID'));
  });

  it('requires an independent supported verdict for every field evidence claim', () => {
    assert.equal(typeof semanticGates.runSemanticGates, 'function');
    const input = baseInput();
    input.field_evidence_claims = [{
      provisional_key: CHARACTER_KEY,
      field_evidence_claims: {
        biography: {
          claim: '这段原文说明人物在无量山经历的起点。',
          source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: '段誉来到无量山。' }]
        },
        personality: {
          claim: '这段原文没有提供足够性格事实。',
          source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: '段誉来到无量山。' }]
        }
      }
    }];
    input.evidence_audit_verdicts = [{
      provisional_key: CHARACTER_KEY,
      field: 'biography',
      supported: true,
      reason: '原文直接描述人物到达无量山这一经历。'
    }, {
      provisional_key: CHARACTER_KEY,
      field: 'personality',
      supported: false,
      reason: '仅有到达地点的动作，不能支持性格判断。'
    }];

    const unsupported = semanticGates.runSemanticGates(input);
    assert.ok(codes(unsupported).includes('FIELD_EVIDENCE_UNSUPPORTED'));

    input.evidence_audit_verdicts.pop();
    const missing = semanticGates.runSemanticGates(input);
    assert.ok(codes(missing).includes('FIELD_EVIDENCE_AUDIT_MISSING'));
  });

  it('blocks deterministic classification errors without misclassifying legitimate manuals', () => {
    assert.equal(typeof semanticGates.runSemanticGates, 'function');
    const input = baseInput();
    input.records_by_category.skill = [{ name: '任脉' }, { name: '易筋经' }];
    input.records_by_category.technique = [{ name: '一阳指' }, { name: '膻中穴' }];
    input.records_by_category.item = [{ name: '十八学士', type: '兵器' }];

    const result = semanticGates.runSemanticGates(input);
    const classificationErrors = result.errors.filter(error => error.code === 'CLASSIFICATION_ERROR');
    assert.equal(classificationErrors.length, 4);
    assert.ok(classificationErrors.some(error => error.path.includes('一阳指')));
    assert.ok(classificationErrors.some(error => error.path.includes('膻中穴')));
    assert.ok(classificationErrors.some(error => error.path.includes('任脉')));
    assert.ok(classificationErrors.some(error => error.path.includes('十八学士')));
    assert.ok(!classificationErrors.some(error => error.path.includes('易筋经')));
  });

  it('blocks the combined Tianlongbabu historical false-pass fixture', () => {
    const fixture = JSON.parse(fs.readFileSync(
      path.join(FIXTURES, 'tianlongbabu-semantic-false-pass-minimal.json'),
      'utf8'
    ));
    const result = semanticGates.runSemanticGates(fixture.semantic_input);
    const resultCodes = codes(result);

    assert.equal(result.passed, false);
    for (const code of fixture.expected.required_error_codes) {
      assert.ok(resultCodes.includes(code), code);
    }
    const classificationErrors = result.errors.filter(error =>
      error.code === 'CLASSIFICATION_ERROR'
    );
    for (const name of fixture.expected.classification_error_names) {
      assert.ok(classificationErrors.some(error => error.path.includes(name)), name);
    }
    for (const name of fixture.expected.classification_control_names) {
      assert.ok(!classificationErrors.some(error => error.path.includes(name)), name);
    }

    const placeholder = fixture.placeholder_case;
    const record = {
      ...buildCompleteData()['skills.json'][0],
      provisional_key: placeholder.provisional_key,
      ...placeholder.overrides
    };
    delete record.id;
    const validation = validateProvisionalRecord(placeholder.category, record);
    for (const field of placeholder.expected_fields) {
      assert.ok(validation.enrichment_errors.some(error =>
        error.includes(`.${field}:`) && error.includes('placeholder')
      ), field);
    }
  });
});
