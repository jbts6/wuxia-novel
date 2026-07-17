'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildCandidateRegistry } = require('../scripts/lib/candidate-registry');
const { normalizeChapterDraft } = require('../scripts/lib/chapter-contract');
const { sourceRef, validChapterDraft } = require('./helpers');

function chapter(number, overrides = {}) {
  return normalizeChapterDraft(validChapterDraft({
    chapter: number,
    source_hash: `sha256:chapter-${number}`,
    title: `第${number}章`,
    characters: [],
    items: [],
    skills: [],
    factions: [],
    ...overrides
  }));
}

test('exact normalized names merge evidence and migrate four-domain local references', () => {
  const registry = buildCandidateRegistry([
    chapter(1, {
      characters: [{
        local_key: 'character:hu-fei', name: '胡斐', identity: '胡家后人',
        skill_local_keys: ['skill:hu-dao'], faction_local_key: 'faction:hu-jia',
        source_refs: [sourceRef(1, '少年胡斐')]
      }],
      items: [{
        local_key: 'item:tie-he', name: '铁盒', owner_local_key: 'character:hu-fei',
        source_refs: [sourceRef(1, '胡斐收起铁盒')]
      }],
      skills: [{
        local_key: 'skill:hu-dao', name: '胡家刀法', faction_local_key: 'faction:hu-jia',
        source_refs: [sourceRef(1, '胡家刀法')]
      }],
      factions: [{
        local_key: 'faction:hu-jia', name: '胡家', source_refs: [sourceRef(1, '胡家传人')]
      }]
    }),
    chapter(2, {
      characters: [{
        local_key: 'character:hu-fei', name: '  胡斐  ', identity: '胡家后人',
        source_refs: [sourceRef(2, '胡斐赶到')]
      }]
    })
  ]);

  assert.deepEqual(Object.keys(registry.categories), ['characters', 'items', 'skills', 'factions']);
  assert.equal('events' in registry.categories, false);
  const character = registry.categories.characters[0];
  const item = registry.categories.items[0];
  const skill = registry.categories.skills[0];
  const faction = registry.categories.factions[0];
  assert.equal(character.canonical_name, '胡斐');
  assert.equal(character.member_refs.length, 2);
  assert.deepEqual(character.record.source_refs, [sourceRef(1, '少年胡斐'), sourceRef(2, '胡斐赶到')]);
  assert.deepEqual(character.record.skill_registry_keys, [skill.registry_key]);
  assert.equal(character.record.faction_registry_key, faction.registry_key);
  assert.equal(item.record.owner_registry_key, character.registry_key);
  assert.equal(skill.record.faction_registry_key, faction.registry_key);
  assert.equal(registry.stats.input_candidates, 5);
  assert.equal(registry.stats.registered_entries, 4);
});

test('identity conflicts, cross-category names, and near names remain explicit pending candidates', () => {
  const registry = buildCandidateRegistry([
    chapter(1, {
      characters: [
        { local_key: 'character:miao-a', name: '苗若兰', identity: '苗人凤之女', source_refs: [sourceRef(1)] },
        { local_key: 'character:miao-b', name: '苗若兰', identity: '江湖化名', source_refs: [sourceRef(1, '另一身份')] },
        { local_key: 'character:hu', name: '胡斐', source_refs: [sourceRef(1, '胡斐')] },
        { local_key: 'character:xiao-hu', name: '小胡斐', source_refs: [sourceRef(1, '小胡斐')] }
      ],
      skills: [{ local_key: 'skill:fei-hu', name: '飞狐', source_refs: [sourceRef(1, '飞狐之技')] }],
      factions: [{ local_key: 'faction:fei-hu', name: '飞狐', source_refs: [sourceRef(1, '飞狐一脉')] }]
    })
  ]);

  assert.equal(registry.categories.characters.filter(entry => entry.canonical_name === '苗若兰').length, 2);
  assert.equal(registry.categories.characters.filter(entry => /胡斐/.test(entry.canonical_name)).length, 2);
  assert.equal(registry.pending.some(item => item.reason === 'IDENTITY_CONFLICT'), true);
  assert.equal(registry.pending.some(item => item.reason === 'NEAR_NAME'), true);
  assert.equal(registry.pending.some(item => item.reason === 'CROSS_CATEGORY_NAME'), true);
  assert.equal(Object.keys(registry.bindings).length, 6);
});

test('four-domain reference migration fails closed for missing and ambiguous chapter-local targets', () => {
  const missing = chapter(1, {
    characters: [{
      local_key: 'character:missing', name: '无门客', skill_local_keys: ['skill:missing'],
      source_refs: [sourceRef(1)]
    }]
  });
  assert.throws(
    () => buildCandidateRegistry([missing]),
    error => error.code === 'REGISTRY_REFERENCE_MISSING'
  );

  const ambiguous = chapter(1, {
    characters: [{
      local_key: 'character:holder', name: '持剑人', skill_local_keys: ['skill:same'],
      source_refs: [sourceRef(1)]
    }],
    skills: [
      { local_key: 'skill:same', name: '同名剑法甲', source_refs: [sourceRef(1)] },
      { local_key: 'skill:same', name: '同名剑法乙', source_refs: [sourceRef(1, '另一处')] }
    ]
  });
  assert.throws(
    () => buildCandidateRegistry([ambiguous]),
    error => error.code === 'REGISTRY_REFERENCE_AMBIGUOUS'
  );
});
