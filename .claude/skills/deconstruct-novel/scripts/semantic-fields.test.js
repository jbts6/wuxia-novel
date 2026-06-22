const assert = require('node:assert/strict');
const test = require('node:test');
const {
  RANK_VALUES,
  ITEM_RARITY_VALUES,
  normalizeSkill,
  normalizeCharacter,
  normalizeItem,
} = require('./semantic-fields');

test('rank values are ordered from weakest to strongest', () => {
  assert.deepEqual(RANK_VALUES, ['平平无奇', '初窥门径', '略有小成', '登堂入室', '炉火纯青', '出神入化', '登峰造极', '返璞归真']);
});

test('normalizes skill mastery from legacy rank and preserves original dirty value', () => {
  const skill = { id: 'skill_x', name: '小李飞刀', rank: 'top' };
  const result = normalizeSkill(skill);

  assert.equal(result.entity.mastery_rank, '登峰造极');
  assert.equal(result.entity.rank, '登峰造极');
  assert.equal(result.entity.legacy_rank, 'top');
  assert.equal(result.changed, true);
});

test('normalizes character power and importance from overloaded legacy rank', () => {
  const character = { id: 'char_x', name: '李寻欢', rank: '主要人物' };
  const result = normalizeCharacter(character);

  assert.equal(result.entity.power_rank, '平平无奇');
  assert.equal(result.entity.importance, '重要');
  assert.equal(result.entity.legacy_rank, '主要人物');
});

test('normalizes numeric power rank using the shared 1-8 order', () => {
  const character = { id: 'char_y', name: '扫地僧', rank: 8 };
  const result = normalizeCharacter(character);

  assert.equal(result.entity.power_rank, '返璞归真');
  assert.equal(result.entity.rank, '返璞归真');
});

test('normalizes item rarity and keeps unknown descriptive values auditable', () => {
  const rare = normalizeItem({ id: 'item_x', name: '宝刀', rarity: 'rare' });
  assert.equal(rare.entity.rarity_tier, '稀世珍品');
  assert.equal(rare.entity.rarity, '稀世珍品');
  assert.equal(rare.entity.legacy_rarity, 'rare');

  const unknown = normalizeItem({ id: 'item_y', name: '令牌', rarity: '危险' });
  assert.equal(unknown.entity.rarity_tier, '未知');
  assert.equal(unknown.entity.legacy_rarity, '危险');
  assert.ok(unknown.entity.migration_notes.includes('unresolved rarity: 危险'));
});

test('item rarity values include unknown fallback', () => {
  assert.deepEqual(ITEM_RARITY_VALUES, ['寻常凡品', '上乘佳品', '稀世珍品', '绝世神兵', '未知']);
});
