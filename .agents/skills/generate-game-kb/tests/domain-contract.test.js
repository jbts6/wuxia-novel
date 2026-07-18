'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeDomainDecisionDraft,
  validateDomainDecisionDraft
} = require('../scripts/lib/domain-contract');
const { DOMAIN_PATCH_FIELDS } = require('../scripts/lib/domain-work');
const {
  DOMAIN_UNITS,
  SEMANTIC_CONTRACT_VERSION,
  requiredDomainUnitsForContract
} = require('../scripts/lib/semantic-contract');

test('domain validation accepts only the shared four domain units', () => {
  const baseInput = {
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    unit: 'distill:items',
    allowed_patch_fields: ['name'],
    entries: [{ entry_ref: 'r000001', category: 'items', canonical_name: '铁盒', facts: {} }]
  };
  const draftFor = unit => ({
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    unit,
    input_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    decisions: [{ entry_ref: 'r000001', action: 'reject', reason: 'ordinary_item', detail: '普通物品。' }],
    notes: []
  });

  for (const unit of DOMAIN_UNITS) {
    const errors = validateDomainDecisionDraft(draftFor(unit), { ...baseInput, unit });
    assert.equal(errors.some(error => error.code === 'DOMAIN_UNIT_INVALID'), false);
  }
  for (const unit of ['distill:plot', 'distill:martial', 'distill:world']) {
    const errors = validateDomainDecisionDraft(draftFor(unit), { ...baseInput, unit });
    assert.equal(errors.some(error => error.code === 'DOMAIN_UNIT_INVALID'), true);
  }
});

test('the active version-6 contract requires all four domain decision units', () => {
  assert.equal(typeof requiredDomainUnitsForContract, 'function');
  assert.deepEqual(requiredDomainUnitsForContract(SEMANTIC_CONTRACT_VERSION), DOMAIN_UNITS);
});

test('domain validation rejects unsupported input and draft semantic versions deterministically', () => {
  for (const version of ['6', 3, 4, 5, 7, null, undefined]) {
    const unsupportedInput = input('items', version);
    if (version === undefined) unsupportedInput.semantic_contract_version = undefined;
    const inputErrors = validateDomainDecisionDraft(validDraft(unsupportedInput), unsupportedInput);
    assert.ok(inputErrors.some(error =>
      error.code === 'SEMANTIC_CONTRACT_VERSION_UNSUPPORTED'
      && error.path === 'input.semantic_contract_version'));

    const activeInput = input('items', SEMANTIC_CONTRACT_VERSION);
    const unsupportedDraft = validDraft(activeInput);
    unsupportedDraft.semantic_contract_version = version;
    const draftErrors = validateDomainDecisionDraft(unsupportedDraft, activeInput);
    assert.ok(draftErrors.some(error =>
      error.code === 'SEMANTIC_CONTRACT_VERSION_UNSUPPORTED'
      && error.path === 'semantic_contract_version'));
  }
});

function input(domain = 'skills', semanticContractVersion = SEMANTIC_CONTRACT_VERSION) {
  const entries = {
    characters: [{
      entry_ref: 'r000001', category: 'characters', canonical_name: '胡斐', aliases: [],
      source_chapters: [1], source_refs: [{ chapter: 1, text: '胡斐' }], facts: { level: '核心' }
    }],
    skills: [{
      entry_ref: 'r000002', category: 'skills', canonical_name: '胡家刀法', aliases: [],
      source_chapters: [1], source_refs: [{ chapter: 1, text: '胡家刀法' }],
      facts: { techniques: [{ name: '八方藏刀式', named_in_source: true }] }
    }],
    items: [{
      entry_ref: 'r000003', category: 'items', canonical_name: '铁盒', aliases: [],
      source_chapters: [1], source_refs: [{ chapter: 1, text: '铁盒' }], facts: {}
    }],
    factions: [{
      entry_ref: 'r000004', category: 'factions', canonical_name: '胡家', aliases: [],
      source_chapters: [1], source_refs: [{ chapter: 1, text: '胡家' }], facts: {}
    }]
  }[domain];
  return {
    schema_version: 1,
    semantic_contract_version: semanticContractVersion,
    semantic_profile: 'domain-distill-v1',
    stage: 'domain_distill',
    unit: `distill:${domain}`,
    domain,
    categories: [domain],
    quality_tier: 'hard',
    allowed_patch_fields: [...DOMAIN_PATCH_FIELDS[domain]],
    ...(['characters', 'skills'].includes(domain) ? { allowed_faction_refs: ['r000004'] } : {}),
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
    semantic_contract_version: work.semantic_contract_version,
    unit: work.unit,
    input_hash: work.input_hash,
    decisions: work.entries.map(entry => ({
      entry_ref: entry.entry_ref,
      action: 'keep',
      patch: entry.category === 'characters'
        ? {
            name: entry.canonical_name,
            aliases: [],
            identities: [],
            level: '核心',
            rank: null,
            description: null,
            factions: [],
            skills: []
          }
        : entry.category === 'skills'
          ? {
              name: entry.canonical_name,
              aliases: [],
              types: [],
              factions: [],
              rank: null,
              description: null,
              techniques: [{ name: '八方藏刀式', description: null }]
            }
          : entry.category === 'items'
            ? {
                name: entry.canonical_name,
                aliases: [],
                type: null,
                description: null,
                inclusion_reason: '剧情关键'
              }
            : { name: entry.canonical_name, aliases: [], type: null, description: null }
    })),
    notes: []
  };
}

test('version-6 character and skill rank patches are nullable or omitted', () => {
  for (const domain of ['characters', 'skills']) {
    const work = input(domain);

    const missing = validDraft(work);
    delete missing.decisions[0].patch.rank;
    assert.equal(validateDomainDecisionDraft(missing, work).some(error =>
      error.path === 'decisions[0].patch.rank'), false);

    const unresolved = validDraft(work);
    unresolved.decisions[0].patch.rank = null;
    assert.equal(validateDomainDecisionDraft(unresolved, work).some(error =>
      error.path === 'decisions[0].patch.rank'), false);

    const invalid = validDraft(work);
    invalid.decisions[0].patch.rank = '天下无敌';
    assert.ok(validateDomainDecisionDraft(invalid, work).some(error =>
      error.code === 'POWER_RANK_INVALID'
      && error.path === 'decisions[0].patch.rank'));
  }
});

test('normalization fills missing version-6 arrays and nullable scalars in keep patches', () => {
  for (const domain of ['characters', 'skills']) {
    const work = input(domain);
    const draft = validDraft(work);
    draft.decisions[0].patch = { name: work.entries[0].canonical_name };
    assert.deepEqual(validateDomainDecisionDraft(draft, work), []);
    const patch = normalizeDomainDecisionDraft(draft, work).decisions[0].patch;
    const expectedArrays = domain === 'characters'
      ? ['aliases', 'identities', 'factions', 'skills']
      : ['aliases', 'types', 'factions', 'techniques'];
    const expectedNullable = domain === 'characters'
      ? ['level', 'rank', 'description']
      : ['rank', 'description'];
    for (const field of expectedArrays) assert.deepEqual(patch[field], []);
    for (const field of expectedNullable) assert.equal(patch[field], null);
  }
});

test('character and skill faction patches accept only explicitly authorized refs', () => {
  for (const domain of ['characters', 'skills']) {
    const work = input(domain);
    const allowed = validDraft(work);
    allowed.decisions[0].patch.factions = ['r000004'];
    assert.deepEqual(validateDomainDecisionDraft(allowed, work), []);

    const unknown = validDraft(work);
    unknown.decisions[0].patch.factions = ['r999999'];
    assert.ok(validateDomainDecisionDraft(unknown, work).some(error =>
      error.code === 'DOMAIN_REFERENCE_UNKNOWN'
      && error.path === 'decisions[0].patch.factions[0]'));

    const existingButUnauthorized = validDraft(work);
    existingButUnauthorized.decisions[0].patch.factions = [work.entries[0].entry_ref];
    assert.ok(validateDomainDecisionDraft(existingButUnauthorized, work).some(error =>
      error.code === 'DOMAIN_REFERENCE_UNAUTHORIZED'
      && error.path === 'decisions[0].patch.factions[0]'));
  }
});

test('domain patches reject legacy, inverse, empty, and placeholder fields', () => {
  const cases = [
    ['characters', 'identity', '侠客'],
    ['characters', 'biography', '旧传记'],
    ['characters', 'faction', 'r000004'],
    ['characters', 'items', []],
    ['skills', 'type', '内功'],
    ['skills', 'holders', ['甲']],
    ['items', 'owners', ['甲']],
    ['factions', 'members', ['甲']]
  ];
  for (const [domain, field, value] of cases) {
    const work = input(domain);
    const draft = validDraft(work);
    draft.decisions[0].patch[field] = value;
    assert.ok(validateDomainDecisionDraft(draft, work).some(error =>
      error.code === 'DOMAIN_PATCH_FIELD_FORBIDDEN'
      && error.path === `decisions[0].patch.${field}`));
  }

  for (const value of ['', '暂无描述']) {
    const work = input('characters');
    const draft = validDraft(work);
    draft.decisions[0].patch.description = value;
    assert.ok(validateDomainDecisionDraft(draft, work).some(error =>
      ['ENTITY_VALUE_EMPTY', 'ENTITY_VALUE_PLACEHOLDER'].includes(error.code)
      && error.path === 'decisions[0].patch.description'));
  }
});

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
  work.entries.push({
    entry_ref: 'r000003', category: 'items', canonical_name: '铁盒', aliases: [],
    source_chapters: [1], source_refs: [{ chapter: 1, text: '铁盒' }], facts: {}
  });

  const privateKey = validDraft(work);
  privateKey.decisions[0].patch.registry_key = 'registry:skills:0001';
  assert.equal(validateDomainDecisionDraft(privateKey, work).some(error => error.code === 'CONTROLLER_FIELD_FORBIDDEN'), true);

  const crossCategory = validDraft(work);
  crossCategory.decisions[0] = {
    entry_ref: 'r000002', action: 'merge', target_ref: 'r000003', patch: {}
  };
  assert.equal(validateDomainDecisionDraft(crossCategory, work).some(error => error.code === 'DOMAIN_MERGE_CATEGORY_MISMATCH'), true);

  const unknownPatch = validDraft(work);
  unknownPatch.decisions[0].patch.final_id = 'skill_fake';
  assert.equal(validateDomainDecisionDraft(unknownPatch, work).some(error => error.code === 'DOMAIN_PATCH_FIELD_FORBIDDEN'), true);
});

test('skill techniques use only name and description while items retain finite noise reasons', () => {
  const skills = input('skills');
  const keptAction = validDraft(skills);
  keptAction.decisions[0].patch.techniques[0].named_in_source = true;
  assert.ok(validateDomainDecisionDraft(keptAction, skills).some(error =>
    error.code === 'ENTITY_FIELD_FORBIDDEN'
    && error.path === 'decisions[0].patch.techniques[0].named_in_source'));

  delete keptAction.decisions[0].patch.techniques[0].named_in_source;
  keptAction.decisions[0].patch.techniques[0].name = '';
  assert.equal(validateDomainDecisionDraft(keptAction, skills).some(error => error.code === 'TECHNIQUE_NAME_REQUIRED'), true);

  const items = input('items');
  const keepOrdinary = validDraft(items);
  delete keepOrdinary.decisions[0].patch.inclusion_reason;
  assert.equal(validateDomainDecisionDraft(keepOrdinary, items).some(error => error.code === 'ITEM_INCLUSION_REASON_REQUIRED'), true);

  const invalidKeepReason = validDraft(items);
  invalidKeepReason.decisions[0].patch.inclusion_reason = '普通物品';
  assert.ok(validateDomainDecisionDraft(invalidKeepReason, items).some(error =>
    error.code === 'ITEM_INCLUSION_REASON_INVALID'
    && error.path === 'decisions[0].patch.inclusion_reason'));

  const rejectOrdinary = validDraft(items);
  rejectOrdinary.decisions[0] = {
    entry_ref: 'r000003', action: 'reject', reason: 'ordinary_item', detail: '普通容器，无稀有性或剧情作用。'
  };
  assert.deepEqual(validateDomainDecisionDraft(rejectOrdinary, items), []);

  rejectOrdinary.decisions[0].reason = 'whatever';
  assert.equal(validateDomainDecisionDraft(rejectOrdinary, items).some(error => error.code === 'DOMAIN_REJECTION_REASON_INVALID'), true);
});

test('current V4 item domain work requires a nonempty inclusion reason', () => {
  const active = input('items');
  for (const value of [undefined, null, '', '   ', false, [], {}]) {
    const invalid = validDraft(active);
    if (value === undefined) delete invalid.decisions[0].patch.inclusion_reason;
    else invalid.decisions[0].patch.inclusion_reason = value;
    assert.ok(validateDomainDecisionDraft(invalid, active).some(error =>
      error.code.startsWith('ITEM_INCLUSION_REASON_')
      && error.path === 'decisions[0].patch.inclusion_reason'));
  }
});

test('pending decisions require evidence-bearing detail and never masquerade as accepted output', () => {
  const work = input();
  const draft = validDraft(work);
  draft.decisions[0] = { entry_ref: work.entries[0].entry_ref, action: 'pending', detail: '' };
  assert.equal(validateDomainDecisionDraft(draft, work).some(error => error.code === 'DOMAIN_PENDING_DETAIL_REQUIRED'), true);

  draft.decisions[0].detail = '同名身份仍不能唯一判定。';
  assert.deepEqual(
    validateDomainDecisionDraft(draft, work).map(error => error.code),
    ['DOMAIN_PENDING_UNRESOLVED']
  );
});

module.exports = { input, validDraft };
