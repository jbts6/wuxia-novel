'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildCandidateRegistry, mergeRegistryRecords } = require('../scripts/lib/candidate-registry');
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

test('exact normalized names remain separate until a full-book domain decision merges them', () => {
  const registry = buildCandidateRegistry([
    chapter(1, {
      characters: [{
        local_key: 'character:hu-fei', name: '胡斐', identities: ['胡家后人'],
        skills: ['skill:hu-dao'], factions: ['faction:hu-jia'],
        source_refs: [sourceRef(1, '少年胡斐')]
      }],
      items: [{
        local_key: 'item:tie-he', name: '铁盒',
        source_refs: [sourceRef(1, '胡斐收起铁盒')]
      }],
      skills: [{
        local_key: 'skill:hu-dao', name: '胡家刀法', factions: ['faction:hu-jia'],
        source_refs: [sourceRef(1, '胡家刀法')]
      }],
      factions: [{
        local_key: 'faction:hu-jia', name: '胡家', source_refs: [sourceRef(1, '胡家传人')]
      }]
    }),
    chapter(2, {
      characters: [{
        local_key: 'character:hu-fei', name: '  胡斐  ', identities: ['胡家后人'],
        source_refs: [sourceRef(2, '胡斐赶到')]
      }]
    })
  ]);

  assert.deepEqual(Object.keys(registry.categories), ['characters', 'items', 'skills', 'factions']);
  assert.equal('events' in registry.categories, false);
  const characters = registry.categories.characters;
  const item = registry.categories.items[0];
  const skill = registry.categories.skills[0];
  const faction = registry.categories.factions[0];
  assert.equal(characters.length, 2);
  assert.equal(characters.every(character => character.canonical_name === '胡斐'), true);
  assert.equal(characters.every(character => character.member_refs.length === 1), true);
  assert.deepEqual(characters[0].record.skills, [skill.registry_key]);
  assert.deepEqual(characters[0].record.factions, [faction.registry_key]);
  assert.deepEqual(skill.record.factions, [faction.registry_key]);
  assert.equal(registry.pending.some(row => row.reason === 'EXACT_NAME'), true);
  assert.equal(registry.stats.input_candidates, 5);
  assert.equal(registry.stats.registered_entries, 5);
});

test('category-aware merge applies ordered unions, level precedence, and structured scalar conflicts', () => {
  const character = mergeRegistryRecords('characters', [
    { name: '甲', aliases: ['旧称'], identities: ['少主'], factions: ['faction:a'], skills: ['skill:a'], level: '次要', rank: null, description: '早期。', source_refs: [sourceRef(1)] },
    { name: '甲', aliases: ['别号', '旧称'], identities: ['掌门'], factions: ['faction:b'], skills: ['skill:b'], level: '核心', rank: '炉火纯青', description: '后期。', source_refs: [sourceRef(2)] }
  ]);
  assert.deepEqual(character.record.aliases, ['旧称', '别号']);
  assert.deepEqual(character.record.identities, ['少主', '掌门']);
  assert.deepEqual(character.record.factions, ['faction:a', 'faction:b']);
  assert.deepEqual(character.record.skills, ['skill:a', 'skill:b']);
  assert.equal(character.record.level, '核心');
  assert.equal(character.record.rank, '炉火纯青');
  assert.equal(character.record.description, null);
  assert.deepEqual(character.conflicts.map(row => row.field), ['description']);

  const skill = mergeRegistryRecords('skills', [
    { name: '剑法', aliases: [], types: ['剑法'], factions: ['faction:a'], rank: null, description: null,
      techniques: [{ name: '起手式', description: '初见。' }], source_refs: [sourceRef(1)] },
    { name: '剑法', aliases: [], types: ['内功'], factions: ['faction:b'], rank: null, description: null,
      techniques: [{ name: '起手式', description: '后证。' }, { name: '收势', description: null }], source_refs: [sourceRef(2)] }
  ]);
  assert.deepEqual(skill.record.types, ['剑法', '内功']);
  assert.deepEqual(skill.record.techniques.map(row => row.name), ['起手式', '收势']);
  assert.ok(skill.conflicts.some(row => row.field === 'techniques'));

  for (const category of ['items', 'factions']) {
    const merged = mergeRegistryRecords(category, [
      { name: '同名', aliases: [], type: '甲类', description: null, source_refs: [sourceRef(1)] },
      { name: '同名', aliases: [], type: '乙类', description: null, source_refs: [sourceRef(2)] }
    ]);
    assert.deepEqual(merged.conflicts, [{ field: 'type', values: ['甲类', '乙类'] }]);
    assert.equal(merged.record.type, null);
  }
});

test('identity conflicts, cross-category names, and near names remain explicit pending candidates', () => {
  const registry = buildCandidateRegistry([
    chapter(1, {
      characters: [
        { local_key: 'character:miao-a', name: '苗若兰', identities: ['苗人凤之女'], source_refs: [sourceRef(1)] },
        { local_key: 'character:miao-b', name: '苗若兰', identities: ['江湖化名'], source_refs: [sourceRef(1, '另一身份')] },
        { local_key: 'character:hu', name: '胡斐', source_refs: [sourceRef(1, '胡斐')] },
        { local_key: 'character:xiao-hu', name: '小胡斐', source_refs: [sourceRef(1, '小胡斐')] }
      ],
      skills: [{ local_key: 'skill:fei-hu', name: '飞狐', source_refs: [sourceRef(1, '飞狐之技')] }],
      factions: [{ local_key: 'faction:fei-hu', name: '飞狐', source_refs: [sourceRef(1, '飞狐一脉')] }]
    })
  ]);

  assert.equal(registry.categories.characters.filter(entry => entry.canonical_name === '苗若兰').length, 2);
  assert.equal(registry.categories.characters.filter(entry => /胡斐/.test(entry.canonical_name)).length, 2);
  assert.equal(registry.pending.some(item => item.reason === 'EXACT_NAME'), true);
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

test('candidate registry output is deeply and byte deterministic across input order', () => {
  const chapters = [
    chapter(2, {
      characters: [{
        local_key: 'character:hu-2', name: '胡斐', identities: ['胡家后人'],
        source_refs: [sourceRef(2, '胡斐赶到')]
      }]
    }),
    chapter(1, {
      characters: [{
        local_key: 'character:hu-1', name: '胡斐', identities: ['胡家后人'],
        source_refs: [sourceRef(1, '少年胡斐')]
      }]
    })
  ];

  const first = buildCandidateRegistry(chapters);
  const second = buildCandidateRegistry([...chapters].reverse());
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test('unrelated candidates do not renumber existing registry keys', () => {
  const initial = buildCandidateRegistry([
    chapter(1, {
      characters: [{
        local_key: 'character:old', name: 'Zulu', source_refs: [sourceRef(1, 'Zulu')]
      }]
    })
  ]);
  const revised = buildCandidateRegistry([
    chapter(1, {
      characters: [{
        local_key: 'character:old', name: 'Zulu', source_refs: [sourceRef(1, 'Zulu')]
      }]
    }),
    chapter(2, {
      characters: [{
        local_key: 'character:new', name: 'Alpha', source_refs: [sourceRef(2, 'Alpha')]
      }]
    })
  ]);
  const findOld = registry => registry.categories.characters.find(entry => (
    entry.member_refs.includes('ch001:characters:character:old')
  ));

  assert.equal(findOld(revised).registry_key, findOld(initial).registry_key);
});
