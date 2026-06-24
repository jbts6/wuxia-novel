const assert = require('node:assert/strict');
const test = require('node:test');
const { validateEntityCollections } = require('./validators');

const ref = [{ chapter: 1, line_start: 1, line_end: 2, text: '原文' }];

test('accepts entities with canonical semantic fields', () => {
  const errors = validateEntityCollections({
    characters: [{ id: 'char_li_xun_huan', name: '李寻欢', power_rank: '返璞归真', importance: '核心', source_refs: ref }],
    skills: [{ id: 'skill_xiao_li_fei_dao', name: '小李飞刀', mastery_rank: '登峰造极', source_refs: ref }],
    techniques: [],
    factions: [],
    locations: [],
    items: [{ id: 'item_fei_dao', name: '飞刀', rarity_tier: '绝世神兵', source_refs: ref }],
  }, 'test');

  assert.deepEqual(errors, []);
});

test('rejects missing or invalid canonical fields', () => {
  const errors = validateEntityCollections({
    characters: [{ id: 'char_a_bao', name: '阿宝', rank: '绝顶', source_refs: ref }],
    skills: [{ id: 'skill_a_b', name: '武功', mastery_rank: '绝顶高手', source_refs: ref }],
    techniques: [],
    factions: [],
    locations: [],
    items: [{ id: 'item_a_b', name: '宝物', rarity_tier: 'rare', source_refs: ref }],
  }, 'test');

  assert.ok(errors.some((line) => line.includes('power_rank')));
  assert.ok(errors.some((line) => line.includes('importance')));
  assert.ok(errors.some((line) => line.includes('mastery_rank')));
  assert.ok(errors.some((line) => line.includes('rarity_tier')));
});
