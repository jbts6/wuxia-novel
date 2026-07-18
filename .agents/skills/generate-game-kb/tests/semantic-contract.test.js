'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CHARACTER_LEVELS,
  DOMAIN_UNITS,
  FINAL_FIELDS,
  FINAL_FILES,
  ITEM_TYPES,
  POWER_RANKS,
  PROFILE_V4,
  PROFILE_V5,
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE,
  requiredDomainUnitsForContract,
  requiredDomainUnitsForProfile
} = require('../scripts/lib/semantic-contract');

test('declares the fast-path YAML contract and retains legacy domain unit names', () => {
  assert.equal(SEMANTIC_CONTRACT_VERSION, 5);
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
  for (const version of ['4', 3, 6, null, undefined]) {
    assert.throws(
      () => requiredDomainUnitsForContract(version),
      error => error.code === 'SEMANTIC_CONTRACT_VERSION_UNSUPPORTED'
        && error.version === version
    );
  }
  assert.deepEqual(requiredDomainUnitsForContract(4), DOMAIN_UNITS);
  assert.deepEqual(requiredDomainUnitsForContract(5), []);
});

test('the active semantic contract selects domain units by run profile', () => {
  assert.deepEqual(
    requiredDomainUnitsForProfile(PROFILE_V4, SEMANTIC_CONTRACT_VERSION),
    DOMAIN_UNITS
  );
  assert.deepEqual(
    requiredDomainUnitsForProfile(PROFILE_V5, SEMANTIC_CONTRACT_VERSION),
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
  assert.deepEqual(ITEM_TYPES, ['武器', '防具', '秘籍', '丹药', '暗器', '其他']);
});

test('defines the simplified fields for all five final files', () => {
  assert.deepEqual(FINAL_FIELDS, {
    characters: ['id', 'name', 'aliases', 'identity', 'level', 'rank', 'biography', 'faction', 'skills', 'items'],
    skills: ['id', 'name', 'type', 'faction', 'rank', 'description', 'techniques'],
    items: ['id', 'name', 'type', 'description'],
    factions: ['id', 'name', 'type', 'description'],
    chapter_summaries: ['chapter', 'title', 'summary']
  });
  assert.equal(FINAL_FIELDS.items.includes('tags'), false);
  assert.equal(FINAL_FIELDS.characters.includes('power_rank'), false);
  assert.equal(FINAL_FIELDS.skills.includes('power_rank'), false);
});
