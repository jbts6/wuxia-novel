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
    events: [],
    items: [],
    skills: [],
    techniques: [],
    factions: [],
    locations: [],
    dialogues: [],
    ...overrides
  }));
}

test('exact normalized names merge evidence and migrate chapter-local references', () => {
  const chapters = [
    chapter(1, {
      characters: [{
        local_key: 'character:hu-fei', name: '胡斐', identity: '胡家后人',
        source_refs: [sourceRef(1, '少年胡斐')]
      }],
      events: [{
        local_key: 'event:meet', name: '雪山相逢', importance: '重要', quote_status: 'quotable',
        source_refs: [sourceRef(1, '雪山相逢')]
      }],
      dialogues: [{
        local_key: 'dialogue:meet', event_local_key: 'event:meet', speaker_name: '胡斐', text: '且慢。',
        source_refs: [sourceRef(1, '且慢')]
      }],
      skills: [{
        local_key: 'skill:hu-dao', name: '胡家刀法', source_refs: [sourceRef(1, '胡家刀法')]
      }],
      techniques: [{
        local_key: 'technique:ba-fang', name: '八方藏刀式', named_in_source: true,
        source_skill_local_key: 'skill:hu-dao', source_refs: [sourceRef(1, '八方藏刀式')]
      }]
    }),
    chapter(2, {
      characters: [{
        local_key: 'character:hu-fei', name: '  胡斐  ', identity: '胡家后人',
        source_refs: [sourceRef(2, '胡斐赶到')]
      }]
    })
  ];

  const registry = buildCandidateRegistry(chapters);
  const character = registry.categories.characters[0];
  assert.equal(character.canonical_name, '胡斐');
  assert.equal(character.member_refs.length, 2);
  assert.deepEqual(character.record.source_refs, [sourceRef(1, '少年胡斐'), sourceRef(2, '胡斐赶到')]);
  assert.equal(registry.stats.input_candidates, 6);
  assert.equal(registry.stats.registered_entries, 5);

  const event = registry.categories.events[0];
  const dialogue = registry.categories.dialogues[0];
  const skill = registry.categories.skills[0];
  const technique = registry.categories.techniques[0];
  assert.equal(dialogue.record.event_registry_key, event.registry_key);
  assert.equal(technique.record.source_skill_registry_key, skill.registry_key);
  assert.equal(registry.bindings['ch001:characters:character:hu-fei'], character.registry_key);
  assert.equal(registry.bindings['ch002:characters:character:hu-fei'], character.registry_key);
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
      techniques: [{
        local_key: 'technique:fei-hu', name: '飞狐', named_in_source: true,
        source_refs: [sourceRef(1, '飞狐一式')]
      }]
    })
  ]);

  assert.equal(registry.categories.characters.filter(entry => entry.canonical_name === '苗若兰').length, 2);
  assert.equal(registry.categories.characters.filter(entry => /胡斐/.test(entry.canonical_name)).length, 2);
  assert.equal(registry.pending.some(item => item.reason === 'IDENTITY_CONFLICT'), true);
  assert.equal(registry.pending.some(item => item.reason === 'NEAR_NAME'), true);
  assert.equal(registry.pending.some(item => item.reason === 'CROSS_CATEGORY_NAME'), true);
  assert.equal(Object.keys(registry.bindings).length, 6);
});

test('reference migration fails closed for missing and ambiguous chapter-local targets', () => {
  const missing = chapter(1, {
    dialogues: [{
      local_key: 'dialogue:missing', event_local_key: 'event:missing', speaker_name: '胡斐', text: '无人回应。',
      source_refs: [sourceRef(1)]
    }]
  });
  assert.throws(
    () => buildCandidateRegistry([missing]),
    error => error.code === 'REGISTRY_REFERENCE_MISSING'
  );

  const ambiguous = chapter(1, {
    events: [
      { local_key: 'event:same', name: '相逢甲', importance: '次要', quote_status: 'not_quotable', no_quote_reason: '无关键对白', source_refs: [sourceRef(1)] },
      { local_key: 'event:same', name: '相逢乙', importance: '次要', quote_status: 'not_quotable', no_quote_reason: '无关键对白', source_refs: [sourceRef(1, '另一处')] }
    ],
    dialogues: [{
      local_key: 'dialogue:same', event_local_key: 'event:same', speaker_name: '胡斐', text: '又见面了。',
      source_refs: [sourceRef(1)]
    }]
  });
  assert.throws(
    () => buildCandidateRegistry([ambiguous]),
    error => error.code === 'REGISTRY_REFERENCE_AMBIGUOUS'
  );
});
