'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { REJECTION_REASONS } = require('../scripts/lib/candidate-ledger');
const {
  validateCleanDecisionDraft,
  validateMaterialDecisionDraft,
  validateMergeDecisionDraft
} = require('../scripts/lib/category-contract');
const { mappedCandidateKeys, scaleCandidates } = require('./fixtures/merge-clean-scale');

function codes(issues) {
  return issues.map(issue => issue.code);
}

function mergeWorkItem(overrides = {}) {
  return {
    schema_version: 1,
    semantic_contract_version: 2,
    stage: 'merge_decision',
    unit: 'merge:characters:001',
    category: 'characters',
    input_hash: 'sha256:merge-work',
    candidates: [
      { candidate_ref: 'c0001', name: '甲', chapter: 1, facts: { level: '核心' } },
      { candidate_ref: 'c0002', name: '甲别名', chapter: 2, facts: { level: '核心' } }
    ],
    ...overrides
  };
}

function validMergeDecision(overrides = {}) {
  return {
    schema_version: 1,
    stage: 'merge_decision',
    unit: 'merge:characters:001',
    decisions: [{
      entity_ref: 'e0001',
      member_refs: ['c0001', 'c0002'],
      action: 'merge',
      canonical_name: '甲',
      aliases: ['甲别名'],
      fields: { level: '核心', biography: '甲行走江湖。' }
    }],
    ambiguities: [],
    ...overrides
  };
}

function cleanWorkItem(overrides = {}) {
  return {
    schema_version: 1,
    semantic_contract_version: 2,
    stage: 'clean_decision',
    unit: 'clean:characters:001',
    category: 'characters',
    input_hash: 'sha256:clean-work',
    entities: [
      { entity_ref: 'e0001', canonical_name: '甲', facts: { level: '核心' }, obligation_refs: ['o0001'] },
      { entity_ref: 'e0002', canonical_name: '乙', facts: { level: '次要' }, obligation_refs: [] }
    ],
    obligations: [{ obligation_ref: 'o0001', code: 'DETAILED_CHARACTER_BIOGRAPHY_REQUIRED', entity_ref: 'e0001' }],
    ...overrides
  };
}

function validCleanDecision(overrides = {}) {
  return {
    schema_version: 1,
    stage: 'clean_decision',
    unit: 'clean:characters:001',
    decisions: [
      { entity_ref: 'e0001', action: 'edit', patch: { biography: '甲行走江湖。' }, resolves: ['o0001'] },
      { entity_ref: 'e0002', action: 'keep', resolves: [] }
    ],
    quantity_explanation: null,
    ...overrides
  };
}

function materialWorkItem() {
  return {
    schema_version: 1,
    semantic_contract_version: 2,
    stage: 'material_decision',
    unit: 'clean:materials:001',
    input_hash: 'sha256:material-work',
    catalog: [
      { entity_ref: 'e0001', category: 'skills', canonical_name: '玄门内功' },
      { entity_ref: 'e0002', category: 'events', canonical_name: '山中相逢' }
    ]
  };
}

test('real-scale fixtures preserve 1,089 exact keys and the 420-key drop shape', () => {
  const candidates = scaleCandidates();
  assert.equal(candidates.length, 1089);
  assert.equal(new Set(candidates.map(candidate => candidate.candidate_key)).size, 1089);
  assert.equal(mappedCandidateKeys().length, 420);
});

test('AI decision drafts cannot echo controller-owned keys at any depth', () => {
  const draft = validMergeDecision({
    decisions: [{
      ...validMergeDecision().decisions[0],
      fields: { biography: '甲行走江湖。', candidate_key: 'ch001:characters:candidate:0001' }
    }]
  });

  assert.ok(codes(validateMergeDecisionDraft(draft, mergeWorkItem()))
    .includes('MECHANICAL_KEY_FORBIDDEN'));
});

test('each merge short ref must be decided exactly once', () => {
  const draft = validMergeDecision({
    decisions: [
      { ...validMergeDecision().decisions[0], member_refs: ['c0001'] },
      { ...validMergeDecision().decisions[0], entity_ref: 'e0002', member_refs: ['c0001'] }
    ]
  });

  assert.ok(codes(validateMergeDecisionDraft(draft, mergeWorkItem()))
    .includes('WORK_REF_INVALID'));
});

test('merge rejects missing, unknown, and cross-work-item refs', () => {
  const draft = validMergeDecision({
    decisions: [{ ...validMergeDecision().decisions[0], member_refs: ['c9999'] }]
  });

  assert.ok(codes(validateMergeDecisionDraft(draft, mergeWorkItem()))
    .includes('WORK_REF_INVALID'));
});

test('clean drop reuses the single candidate-ledger rejection enum', () => {
  assert.equal(REJECTION_REASONS.has('entity_removed_during_cleaning'), false);
  const draft = validCleanDecision({
    decisions: [
      { entity_ref: 'e0001', action: 'drop', reason: 'entity_removed_during_cleaning', detail: '删除', resolves: ['o0001'] },
      { entity_ref: 'e0002', action: 'keep', resolves: [] }
    ]
  });

  assert.ok(codes(validateCleanDecisionDraft(draft, cleanWorkItem()))
    .includes('SEMANTIC_DECISION_INVALID'));
});

test('clean decisions cover each entity exactly once and only claim known obligations', () => {
  const draft = validCleanDecision({
    decisions: [
      { entity_ref: 'e0001', action: 'keep', resolves: ['o9999'] },
      { entity_ref: 'e0001', action: 'keep', resolves: [] }
    ]
  });
  const issueCodes = codes(validateCleanDecisionDraft(draft, cleanWorkItem()));

  assert.ok(issueCodes.includes('WORK_REF_INVALID'));
  assert.ok(issueCodes.includes('SEMANTIC_DECISION_INVALID'));
});

test('category patch fields are strict and mechanical fields stay controller-owned', () => {
  const draft = validCleanDecision({
    decisions: [
      { entity_ref: 'e0001', action: 'edit', patch: { biography: '甲行走江湖。', local_key: 'character:甲' }, resolves: ['o0001'] },
      { entity_ref: 'e0002', action: 'keep', resolves: [] }
    ]
  });
  const issueCodes = codes(validateCleanDecisionDraft(draft, cleanWorkItem()));

  assert.ok(issueCodes.includes('MECHANICAL_KEY_FORBIDDEN'));
  assert.ok(issueCodes.includes('SEMANTIC_DECISION_INVALID'));
});

test('strict top-level contracts reject extra transport fields', () => {
  const issues = validateMergeDecisionDraft(
    { ...validMergeDecision(), candidate_resolutions: [] },
    mergeWorkItem()
  );

  assert.ok(codes(issues).includes('SEMANTIC_DECISION_INVALID'));
});

test('material decisions use only known compact-catalog refs', () => {
  const valid = {
    schema_version: 1,
    stage: 'material_decision',
    unit: 'clean:materials:001',
    materials: [{
      material_type: '战斗系统原型',
      source_ref: 'e0001',
      relevance: '高',
      suggested_use: '内功系统原型',
      reason: '原著明确命名。'
    }]
  };
  assert.deepEqual(validateMaterialDecisionDraft(valid, materialWorkItem()), []);

  const unknown = structuredClone(valid);
  unknown.materials[0].source_ref = 'e9999';
  assert.ok(codes(validateMaterialDecisionDraft(unknown, materialWorkItem()))
    .includes('WORK_REF_INVALID'));
});

test('valid merge and clean decisions return no issues', () => {
  assert.deepEqual(validateMergeDecisionDraft(validMergeDecision(), mergeWorkItem()), []);
  assert.deepEqual(validateCleanDecisionDraft(validCleanDecision(), cleanWorkItem()), []);
});
