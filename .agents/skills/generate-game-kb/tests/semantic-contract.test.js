'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CHARACTER_LEVELS,
  DOMAIN_UNITS,
  ENTITY_FIELD_CONTRACTS,
  FINAL_FIELDS,
  FINAL_FILES,
  ITEM_INCLUSION_REASONS,
  ITEM_TYPES,
  POWER_RANK_CONTRACT,
  POWER_RANKS,
  LEGACY_PROFILE_V5,
  PROFILE_LITE,
  PROFILE_V4,
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE,
  requiredDomainUnitsForContract,
  requiredDomainUnitsForProfile
} = require('../scripts/lib/semantic-contract');

test('declares the version-6 fast-path YAML contract and retains domain unit names', () => {
  assert.equal(SEMANTIC_CONTRACT_VERSION, 6);
  assert.equal(SEMANTIC_PROFILE, 'domain-distill-v1');
  assert.deepEqual(DOMAIN_UNITS, [
    'distill:factions',
    'distill:characters',
    'distill:skills',
    'distill:items'
  ]);
  assert.deepEqual(FINAL_FILES, {
    characters: 'characters.yaml',
    skills: 'skills.yaml',
    items: 'items.yaml',
    factions: 'factions.yaml',
    chapter_summaries: 'chapter_summaries.yaml'
  });

  for (const legacyUnit of ['distill:plot', 'distill:martial', 'distill:world']) {
    assert.equal(DOMAIN_UNITS.includes(legacyUnit), false);
  }
  for (const filename of Object.values(FINAL_FILES)) {
    assert.match(filename, /\.yaml$/);
    assert.doesNotMatch(filename, /\.json$/);
  }
});

test('required domain units reject unsupported or mistyped semantic versions', () => {
  for (const version of ['6', 3, 4, 5, 7, null, undefined]) {
    assert.throws(
      () => requiredDomainUnitsForContract(version),
      error => error.code === 'SEMANTIC_CONTRACT_VERSION_UNSUPPORTED'
      && error.version === version
    );
  }
  assert.deepEqual(requiredDomainUnitsForContract(6), DOMAIN_UNITS);
});

test('the active semantic contract selects domain units by run profile', () => {
  assert.deepEqual(
    requiredDomainUnitsForProfile(PROFILE_V4, SEMANTIC_CONTRACT_VERSION),
    DOMAIN_UNITS
  );
  assert.deepEqual(
    requiredDomainUnitsForProfile(PROFILE_LITE, SEMANTIC_CONTRACT_VERSION),
    []
  );
  assert.equal(PROFILE_LITE, 'lite');
  assert.equal(LEGACY_PROFILE_V5, 'v5');
  assert.deepEqual(
    requiredDomainUnitsForProfile(LEGACY_PROFILE_V5, SEMANTIC_CONTRACT_VERSION),
    []
  );
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

test('defines one frozen version-6 entity field contract for all stages', () => {
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
      fields: ['id', 'name', 'aliases', 'type', 'description'],
      arrays: ['aliases'],
      nullable: ['type', 'description'],
      requiredStrings: ['id', 'name'],
      forbidden: ['holder', 'holders', 'owner', 'owners', 'holder_names', 'owner_name']
    },
    factions: {
      fields: ['id', 'name', 'aliases', 'type', 'description'],
      arrays: ['aliases'],
      nullable: ['type', 'description'],
      requiredStrings: ['id', 'name'],
      forbidden: ['member', 'members', 'member_names']
    }
  });
  assert.equal(Object.isFrozen(ENTITY_FIELD_CONTRACTS), true);
  for (const contract of Object.values(ENTITY_FIELD_CONTRACTS)) {
    assert.equal(Object.isFrozen(contract), true);
    for (const value of Object.values(contract)) assert.equal(Object.isFrozen(value), true);
  }
});

test('derives the exact final fields from the shared entity contract', () => {
  assert.deepEqual(FINAL_FIELDS, {
    characters: ['id', 'name', 'aliases', 'identities', 'level', 'rank', 'description', 'factions', 'skills'],
    skills: ['id', 'name', 'aliases', 'types', 'factions', 'rank', 'description', 'techniques'],
    items: ['id', 'name', 'aliases', 'type', 'description'],
    factions: ['id', 'name', 'aliases', 'type', 'description'],
    chapter_summaries: ['chapter', 'title', 'summary']
  });
  assert.equal(FINAL_FIELDS.items.includes('tags'), false);
  assert.equal(FINAL_FIELDS.characters.includes('power_rank'), false);
  assert.equal(FINAL_FIELDS.skills.includes('power_rank'), false);
});
