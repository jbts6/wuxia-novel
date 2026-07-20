'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildFinalData } = require('../scripts/lib/finalize');
const {
  mapLegacyBook,
  mapLegacyItemType,
  mergeLegacyDescription
} = require('../scripts/lib/legacy-map');
const { sourceRef } = require('./helpers');

function legacyFixture(overrides = {}) {
  return {
    characters: [{
      id: 'char_a_fei',
      name: '阿飞',
      alias: '飞剑客',
      aliases: ['阿飞', '飞剑客'],
      identity: '江湖人士',
      importance: '重要',
      description: '以快剑行走江湖。',
      biography: '身世成谜。',
      bio: '身世成谜。',
      personality: '沉默寡言。',
      faction: 'faction_jiang_hu',
      skills: ['skill_kuai_jian'],
      items: ['item_tie_jian'],
      source_refs: [sourceRef(1, '阿飞拔剑出手。')]
    }],
    skills: [{
      id: 'skill_kuai_jian',
      name: '快剑',
      alias: '飞剑',
      type: '剑法',
      mastery_rank: '登峰造极',
      description: '剑招以快取胜。',
      holders: ['char_a_fei'],
      techniques: [{ name: '流星一剑', description: '剑光如流星。' }],
      faction: 'faction_jiang_hu',
      source_refs: [sourceRef(1, '剑光一闪，快如流星。')]
    }],
    items: [{
      id: 'item_tie_jian',
      name: '铁剑',
      type: '古剑兵器',
      description: '一柄寻常铁剑。',
      owner: 'char_a_fei',
      source_refs: [sourceRef(1, '阿飞手持铁剑。')]
    }],
    factions: [{
      id: 'faction_jiang_hu',
      name: '江湖散人',
      type: '群体',
      description: '无固定门庭。',
      members: ['char_a_fei'],
      source_refs: [sourceRef(1, '他本是江湖散人。')]
    }],
    chapter_summaries: [{
      chapter: 1,
      title: '第一章 快剑',
      summary: '阿飞以快剑击退来敌。',
      source_refs: [sourceRef(1, '阿飞以快剑击退来敌。')]
    }],
    ...overrides
  };
}

test('maps legacy fields without carrying forbidden V6 relationships or legacy ranks', () => {
  const mapped = mapLegacyBook(legacyFixture());
  const [character] = mapped.book.characters;
  const [skill] = mapped.book.skills;
  const [item] = mapped.book.items;
  const [faction] = mapped.book.factions;

  assert.deepEqual(character.aliases, ['阿飞', '飞剑客']);
  assert.deepEqual(character.identities, ['江湖人士']);
  assert.equal(character.level, '重要');
  assert.equal(character.rank, null);
  assert.match(character.description, /简介：以快剑行走江湖。/);
  assert.match(character.description, /生平：身世成谜。/);
  assert.equal(character.description.match(/身世成谜。/g).length, 1);
  assert.equal('items' in character, false);

  assert.deepEqual(skill.aliases, ['飞剑']);
  assert.deepEqual(skill.types, ['剑法']);
  assert.equal(skill.rank, null);
  assert.equal('holders' in skill, false);
  assert.equal(item.type, '武器');
  assert.equal('owner' in item, false);
  assert.equal('members' in faction, false);
  assert.deepEqual(mapped.rejected, []);
  assert.deepEqual(mapped.unresolved, []);
});

test('maps item types and merges only non-placeholder unique legacy text', () => {
  assert.equal(mapLegacyItemType('武功秘籍'), '秘籍');
  assert.equal(mapLegacyItemType('解毒丹药'), '丹药');
  assert.equal(mapLegacyItemType('飞刀暗器'), '暗器');
  assert.equal(mapLegacyItemType('护身软甲'), '防具');
  assert.equal(mapLegacyItemType('青锋宝剑'), '武器');
  assert.equal(mapLegacyItemType('白马坐骑'), '坐骑');
  assert.equal(mapLegacyItemType('神雕异兽'), '异兽');
  assert.equal(mapLegacyItemType('传家玉镯饰品'), '饰品');
  assert.equal(mapLegacyItemType('机关盒'), '其他');
  assert.equal(mapLegacyItemType('未知'), null);
  assert.equal(mapLegacyItemType(null), null);

  assert.equal(mergeLegacyDescription([
    ['简介', '  第一段。 '],
    ['生平', '未知'],
    ['概述', '第一段。'],
    ['性格', '沉稳。']
  ]), '简介：第一段。\n性格：沉稳。');
});

test('preserves compatible unique legacy IDs and feeds the existing final builder', () => {
  const mapped = mapLegacyBook(legacyFixture());
  const result = buildFinalData(mapped.book, {
    chapters: [{ number: 1, title: '第一章 快剑' }]
  }, mapped.priorRegistry);

  assert.deepEqual(result.issues, []);
  assert.deepEqual(Object.keys(result.data).sort(), [
    'chapter_summaries.yaml',
    'characters.yaml',
    'factions.yaml',
    'items.yaml',
    'skills.yaml'
  ]);
  assert.equal(result.data['characters.yaml'][0].id, 'char_a_fei');
  assert.equal(result.data['skills.yaml'][0].id, 'skill_kuai_jian');
});

test('keeps same-name records separate and assigns deterministic IDs across pinyin collisions', () => {
  const mapped = mapLegacyBook(legacyFixture({
    characters: [
      { name: '陆晓峰', source_refs: [sourceRef(1, '陆晓峰仗剑而立。')] },
      { name: '路小凤', source_refs: [sourceRef(2, '路小凤推门而入。')] },
      { name: '阿飞', source_refs: [sourceRef(1, '阿飞拔剑。')] },
      { name: '阿飞', source_refs: [sourceRef(2, '阿飞收剑。')] }
    ],
    skills: [],
    items: [],
    factions: [],
    chapter_summaries: [1, 2].map(chapter => ({
      chapter,
      title: `第${chapter}章`,
      summary: `第${chapter}章摘要。`,
      source_refs: [sourceRef(chapter, `第${chapter}章摘要。`)]
    }))
  }));
  const manifest = { chapters: [{ number: 1 }, { number: 2 }] };
  const first = buildFinalData(mapped.book, manifest, mapped.priorRegistry);
  const repeated = buildFinalData(mapped.book, manifest, mapped.priorRegistry);
  const ids = first.data['characters.yaml'].map(record => record.id);

  assert.deepEqual(first.issues, []);
  assert.equal(new Set(ids).size, 4);
  assert.equal(first.data['characters.yaml'].filter(record => record.name === '阿飞').length, 2);
  assert.equal(JSON.stringify(first.id_plan), JSON.stringify(repeated.id_plan));
});

test('reports invalid records and unresolved allowed references without inventing targets', () => {
  const mapped = mapLegacyBook(legacyFixture({
    characters: [
      { id: 'char_missing_name', source_refs: [sourceRef(1)] },
      { name: '独行客', faction: '不存在的门派', source_refs: [sourceRef(1, '独行客一人上路。')] }
    ],
    skills: [],
    items: [],
    factions: []
  }));

  assert.equal(mapped.book.characters.length, 1);
  assert.equal(mapped.rejected.length, 1);
  assert.equal(mapped.unresolved.length, 1);
  assert.deepEqual(mapped.book.characters[0].factions, []);
});

test('resolves object-shaped legacy references by ID or name', () => {
  const mapped = mapLegacyBook(legacyFixture({
    characters: [{
      name: '阿飞',
      faction: { id: 'faction_jiang_hu' },
      skills: [{ name: '快剑' }],
      source_refs: [sourceRef(1, '阿飞拔剑出手。')]
    }]
  }));

  assert.deepEqual(mapped.unresolved, []);
  assert.equal(mapped.book.characters[0].factions.length, 1);
  assert.equal(mapped.book.characters[0].skills.length, 1);
});

test('keeps collision IDs stable when source reference order changes', () => {
  const firstRef = sourceRef(1, '阿飞拔剑。');
  const secondRef = sourceRef(2, '阿飞收剑。');
  const makeInput = refs => legacyFixture({
    characters: [
      { name: '阿飞', source_refs: refs },
      { name: '阿飞', source_refs: [sourceRef(3, '另一名阿飞现身。')] }
    ],
    skills: [],
    items: [],
    factions: [],
    chapter_summaries: [1, 2, 3].map(chapter => ({
      chapter,
      title: `第${chapter}章`,
      summary: `第${chapter}章摘要。`,
      source_refs: [sourceRef(chapter, `第${chapter}章摘要。`)]
    }))
  });
  const manifest = { chapters: [1, 2, 3].map(number => ({ number })) };
  const first = mapLegacyBook(makeInput([firstRef, secondRef]));
  const reordered = mapLegacyBook(makeInput([secondRef, firstRef]));
  const firstResult = buildFinalData(first.book, manifest, first.priorRegistry);
  const reorderedResult = buildFinalData(reordered.book, manifest, reordered.priorRegistry);

  assert.deepEqual(firstResult.issues, []);
  assert.deepEqual(reorderedResult.issues, []);
  assert.deepEqual(firstResult.id_plan, reorderedResult.id_plan);
});
