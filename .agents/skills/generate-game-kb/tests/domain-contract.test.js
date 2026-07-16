'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { validateDomainDecisionDraft } = require('../scripts/lib/domain-contract');

function input(domain = 'martial') {
  const entries = domain === 'martial'
    ? [
        {
          entry_ref: 'r000001', category: 'skills', canonical_name: '胡家刀法', aliases: [],
          source_chapters: [1], source_refs: [{ chapter: 1, text: '胡家刀法' }], facts: {}
        },
        {
          entry_ref: 'r000002', category: 'techniques', canonical_name: '八方藏刀式', aliases: [],
          source_chapters: [1], source_refs: [{ chapter: 1, text: '八方藏刀式' }],
          facts: { named_in_source: true, source_skill_ref: 'r000001' }
        }
      ]
    : [{
        entry_ref: 'r000003', category: 'items', canonical_name: '铁盒', aliases: [],
        source_chapters: [1], source_refs: [{ chapter: 1, text: '铁盒' }], facts: {}
      }];
  return {
    schema_version: 1,
    semantic_contract_version: 2,
    semantic_profile: 'domain-distill-v1',
    stage: 'domain_distill',
    unit: `distill:${domain}`,
    domain,
    categories: domain === 'martial' ? ['skills', 'techniques'] : ['items'],
    quality_tier: 'hard',
    allowed_patch_fields: domain === 'martial'
      ? ['canonical_name', 'aliases', 'type', 'description', 'source_skill_ref', 'named_in_source']
      : ['canonical_name', 'aliases', 'type', 'description', 'inclusion_reason'],
    entries,
    pending: [],
    decision_contract: {
      actions: ['keep', 'merge', 'reject', 'pending'],
      every_entry_exactly_once: true,
      controller_fields_forbidden: true
    },
    input_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  };
}

function validDraft(work = input()) {
  return {
    schema_version: 1,
    semantic_contract_version: 2,
    unit: work.unit,
    input_hash: work.input_hash,
    decisions: work.entries.map(entry => ({
      entry_ref: entry.entry_ref,
      action: 'keep',
      patch: entry.category === 'techniques'
        ? { canonical_name: entry.canonical_name, named_in_source: true, source_skill_ref: 'r000001' }
        : { canonical_name: entry.canonical_name }
    })),
    notes: []
  };
}

test('a domain decision covers every visible entry exactly once', () => {
  const work = input();
  assert.deepEqual(validateDomainDecisionDraft(validDraft(work), work), []);

  const missing = validDraft(work);
  missing.decisions.pop();
  assert.equal(validateDomainDecisionDraft(missing, work).some(error => error.code === 'DOMAIN_DECISION_MISSING'), true);

  const duplicate = validDraft(work);
  duplicate.decisions.push(structuredClone(duplicate.decisions[0]));
  assert.equal(validateDomainDecisionDraft(duplicate, work).some(error => error.code === 'DOMAIN_DECISION_DUPLICATE'), true);

  const unknown = validDraft(work);
  unknown.decisions[0].entry_ref = 'r999999';
  assert.equal(validateDomainDecisionDraft(unknown, work).some(error => error.code === 'DOMAIN_ENTRY_UNKNOWN'), true);
});

test('controller fields, cross-category merges, and unknown patch fields fail closed', () => {
  const work = input();

  const privateKey = validDraft(work);
  privateKey.decisions[0].patch.registry_key = 'registry:skills:0001';
  assert.equal(validateDomainDecisionDraft(privateKey, work).some(error => error.code === 'CONTROLLER_FIELD_FORBIDDEN'), true);

  const crossCategory = validDraft(work);
  crossCategory.decisions[0] = {
    entry_ref: 'r000001', action: 'merge', target_ref: 'r000002', patch: {}
  };
  assert.equal(validateDomainDecisionDraft(crossCategory, work).some(error => error.code === 'DOMAIN_MERGE_CATEGORY_MISMATCH'), true);

  const unknownPatch = validDraft(work);
  unknownPatch.decisions[0].patch.final_id = 'skill_fake';
  assert.equal(validateDomainDecisionDraft(unknownPatch, work).some(error => error.code === 'DOMAIN_PATCH_FIELD_FORBIDDEN'), true);
});

test('martial and item semantics enforce named techniques and finite noise reasons', () => {
  const martial = input();
  martial.entries[1].facts.named_in_source = false;
  const keptAction = validDraft(martial);
  assert.equal(validateDomainDecisionDraft(keptAction, martial).some(error => error.code === 'TECHNIQUE_NOT_NAMED'), true);

  const rejectedAction = validDraft(martial);
  rejectedAction.decisions[1] = {
    entry_ref: 'r000002', action: 'reject', reason: 'ordinary_action', detail: '原文只有泛化动作。'
  };
  assert.deepEqual(validateDomainDecisionDraft(rejectedAction, martial), []);

  const items = input('items');
  const keepOrdinary = validDraft(items);
  assert.equal(validateDomainDecisionDraft(keepOrdinary, items).some(error => error.code === 'ITEM_INCLUSION_REASON_REQUIRED'), true);

  const rejectOrdinary = validDraft(items);
  rejectOrdinary.decisions[0] = {
    entry_ref: 'r000003', action: 'reject', reason: 'ordinary_item', detail: '普通容器，无稀有性或剧情作用。'
  };
  assert.deepEqual(validateDomainDecisionDraft(rejectOrdinary, items), []);

  rejectOrdinary.decisions[0].reason = 'whatever';
  assert.equal(validateDomainDecisionDraft(rejectOrdinary, items).some(error => error.code === 'DOMAIN_REJECTION_REASON_INVALID'), true);
});

test('pending decisions require evidence-bearing detail and never masquerade as accepted output', () => {
  const work = input();
  const draft = validDraft(work);
  draft.decisions[0] = { entry_ref: 'r000001', action: 'pending', detail: '' };
  assert.equal(validateDomainDecisionDraft(draft, work).some(error => error.code === 'DOMAIN_PENDING_DETAIL_REQUIRED'), true);

  draft.decisions[0].detail = '同名身份仍不能唯一判定。';
  assert.deepEqual(
    validateDomainDecisionDraft(draft, work).map(error => error.code),
    ['DOMAIN_PENDING_UNRESOLVED']
  );
});

module.exports = { input, validDraft };
