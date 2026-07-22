'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const semanticContract = require('../scripts/lib/semantic-contract');
const {
  CHARACTER_LEVELS,
  ENTITY_FIELD_CONTRACTS,
  FINAL_FIELDS,
  FINAL_FILES,
  ITEM_INCLUSION_REASONS,
  ITEM_TYPES,
  POWER_RANK_CONTRACT,
  POWER_RANKS,
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE,
  validateEntitySemantics
} = semanticContract;

test('declares the version-7 direct-chapter YAML contract without domain APIs', () => {
  assert.equal(SEMANTIC_CONTRACT_VERSION, 7);
  assert.equal(SEMANTIC_PROFILE, 'chapter-direct-v1');
  assert.equal(semanticContract.DOMAIN_UNITS, undefined);
  assert.equal(semanticContract.requiredDomainUnitsForContract, undefined);
  assert.equal(semanticContract.requiredDomainUnitsForMode, undefined);
  assert.deepEqual(FINAL_FILES, {
    characters: 'characters.yaml',
    skills: 'skills.yaml',
    items: 'items.yaml',
    factions: 'factions.yaml',
    chapter_summaries: 'chapter_summaries.yaml'
  });
  for (const filename of Object.values(FINAL_FILES)) {
    assert.match(filename, /\.yaml$/);
    assert.doesNotMatch(filename, /\.json$/);
  }
});

test('centralizes enums used by chapter and final records', () => {
  assert.deepEqual(POWER_RANKS, [
    '平平无奇',
    '初窥门径',
    '略有小成',
    '登堂入室',
    '炉火纯青',
    '出神入化',
    '登峰造极',
    '返璞归真'
  ]);
  assert.deepEqual(CHARACTER_LEVELS, ['核心', '重要', '次要', '龙套', '背景']);
  assert.deepEqual(ITEM_TYPES, ['武器', '防具', '秘籍', '丹药', '暗器', '坐骑', '异兽', '饰品', '其他']);
  assert.deepEqual(ITEM_INCLUSION_REASONS, [
    '秘籍', '剧情关键', '高级药毒', '神兵利器', '其他稀有特殊'
  ]);
  assert.equal(Object.isFrozen(ITEM_INCLUSION_REASONS), true);
});

test('centralizes the whole-book rank scale and evidence priority', () => {
  assert.deepEqual(POWER_RANK_CONTRACT.scale.map(entry => entry.rank), POWER_RANKS);
  assert.equal(POWER_RANK_CONTRACT.scope, 'complete_book_timeline');
  assert.equal(POWER_RANK_CONTRACT.aggregation, 'stable_judgment_not_chapter_maximum');
  assert.match(POWER_RANK_CONTRACT.evidence_priority[0], /后期.*直接.*战果|直接.*战果.*后期/);
  assert.match(POWER_RANK_CONTRACT.evidence_priority.join('\n'), /失败|反转|克制/);
  assert.match(POWER_RANK_CONTRACT.evidence_priority.at(-1), /传闻|自述|身份/);
  assert.match(POWER_RANK_CONTRACT.character_rule, /全书|完整.*时间线/);
  assert.match(POWER_RANK_CONTRACT.skill_rule, /可靠.*使用者|后文.*推翻/);
});

test('defines one frozen version-7 entity field contract for all stages', () => {
  assert.deepEqual(ENTITY_FIELD_CONTRACTS, {
    characters: {
      fields: ['id', 'name', 'aliases', 'identities', 'level', 'rank', 'description', 'factions', 'skills'],
      arrays: ['aliases', 'identities', 'factions', 'skills'],
      nullable: ['level', 'rank', 'description'],
      requiredStrings: ['id', 'name'],
      forbidden: [
        'identity', 'biography', 'faction', 'items', 'personality', 'relationships',
        'relationship_names', 'skill_names', 'item_names'
      ]
    },
    skills: {
      fields: ['id', 'name', 'aliases', 'types', 'factions', 'rank', 'description', 'techniques'],
      arrays: ['aliases', 'types', 'factions', 'techniques'],
      nullable: ['rank', 'description'],
      requiredStrings: ['id', 'name'],
      forbidden: ['type', 'faction', 'holders', 'users', 'holder_names', 'user_names']
    },
    items: {
      fields: ['id', 'name', 'aliases', 'types', 'description'],
      arrays: ['aliases', 'types'],
      nullable: ['description'],
      requiredStrings: ['id', 'name'],
      forbidden: ['type', 'holder', 'holders', 'owner', 'owners', 'holder_names', 'owner_name']
    },
    factions: {
      fields: ['id', 'name', 'aliases', 'types', 'description'],
      arrays: ['aliases', 'types'],
      nullable: ['description'],
      requiredStrings: ['id', 'name'],
      forbidden: ['type', 'member', 'members', 'member_names']
    }
  });
  assert.equal(Object.isFrozen(ENTITY_FIELD_CONTRACTS), true);
  for (const contract of Object.values(ENTITY_FIELD_CONTRACTS)) {
    assert.equal(Object.isFrozen(contract), true);
    for (const value of Object.values(contract)) assert.equal(Object.isFrozen(value), true);
  }
});

test('accepts v7 type arrays and rejects legacy single type fields', () => {
  assert.deepEqual(validateEntitySemantics('items', {
    name: '小李飞刀',
    aliases: [],
    types: ['武器', '暗器'],
    description: null
  }, { requireStrings: true }), []);
  assert.deepEqual(validateEntitySemantics('items', {
    name: '未分类信物',
    aliases: [],
    types: ['其他'],
    description: null
  }, { requireStrings: true }), []);
  assert.ok(validateEntitySemantics('factions', {
    name: '青衣楼',
    aliases: [],
    type: '组织',
    description: null
  }, { requireStrings: true }).some(issue => issue.code === 'ENTITY_FIELD_FORBIDDEN'));
});

test('derives the exact final fields from the shared entity contract', () => {
  assert.deepEqual(FINAL_FIELDS, {
    characters: ['id', 'name', 'aliases', 'identities', 'level', 'rank', 'description', 'factions', 'skills'],
    skills: ['id', 'name', 'aliases', 'types', 'factions', 'rank', 'description', 'techniques'],
    items: ['id', 'name', 'aliases', 'types', 'description'],
    factions: ['id', 'name', 'aliases', 'types', 'description'],
    chapter_summaries: ['chapter', 'title', 'summary']
  });
  assert.equal(FINAL_FIELDS.items.includes('tags'), false);
  assert.equal(FINAL_FIELDS.characters.includes('power_rank'), false);
  assert.equal(FINAL_FIELDS.skills.includes('power_rank'), false);
});
