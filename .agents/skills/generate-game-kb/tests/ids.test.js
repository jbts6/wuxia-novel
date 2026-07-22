'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { assignStableIds, nameSlug } = require('../scripts/lib/ids');

function refs(chapter) {
  return [{ chapter, text: `第${chapter}章证据。` }];
}

function collisionNames() {
  return [
    { name: '白石', source_refs: refs(1) },
    { name: '白诗', source_refs: refs(2) }
  ];
}

describe('assignStableIds', () => {
  it('uses an unhashed ID when a pinyin base is unique', () => {
    const result = assignStableIds({ characters: [{ name: '陆小凤', source_refs: refs(1) }] }, {});
    assert.equal(result.recordsByCategory.characters[0].id, 'char_lu_xiao_feng');
  });

  it('uses canonical-name suffixes for different names with the same base', () => {
    const first = assignStableIds({ characters: collisionNames() }, {});
    const second = assignStableIds({ characters: [...collisionNames()].reverse() }, {});
    assert.deepEqual(first, second);
    assert.ok(first.recordsByCategory.characters.every(entry => /^char_[a-z_]+_[a-p]{8}$/.test(entry.id)));
  });

  it('adding source evidence does not change an issued ID', () => {
    const first = assignStableIds({ characters: [{ name: '陆小凤', source_refs: refs(1) }] }, {});
    const second = assignStableIds(
      { characters: [{ name: '陆小凤', source_refs: [...refs(1), ...refs(9)] }] },
      first.idPlan
    );
    assert.equal(first.recordsByCategory.characters[0].id, second.recordsByCategory.characters[0].id);
  });

  it('preserves prior plan IDs for existing entities', () => {
    const first = assignStableIds({ characters: collisionNames() }, {});
    const second = assignStableIds({ characters: collisionNames() }, first.idPlan);
    assert.deepEqual(
      first.recordsByCategory.characters.map(r => r.id),
      second.recordsByCategory.characters.map(r => r.id)
    );
  });

  it('preserves an issued unhashed ID when a new colliding name appears', () => {
    const first = assignStableIds({ characters: [collisionNames()[0]] }, {});
    const originalId = first.recordsByCategory.characters[0].id;
    const second = assignStableIds({ characters: collisionNames() }, first.idPlan);
    const byName = Object.fromEntries(second.recordsByCategory.characters.map(record => [record.name, record.id]));

    assert.equal(byName['白石'], originalId);
    assert.match(byName['白诗'], /^char_bai_shi_[a-p]{8}$/);
  });

  it('throws on duplicate same-name records', () => {
    assert.throws(
      () => assignStableIds({ characters: [{ name: '甲', source_refs: refs(1) }, { name: '甲', source_refs: refs(2) }] }, {}),
      error => error.code === 'IDENTITY_COLLISION_REVIEW_REQUIRED'
    );
  });

  it('idPlan records collision metadata', () => {
    const result = assignStableIds({ characters: collisionNames() }, {});
    const plan = result.idPlan.characters;
    assert.equal(plan.length, 2);
    assert.ok(plan.every(p => p.collision_reason === 'pinyin_base_collision'));
    assert.ok(plan.every(p => p.suffix_input.includes('characters\0')));
    assert.deepEqual(Object.keys(plan[0]).sort(), [
      'base_id', 'canonical_name', 'category', 'collision_reason', 'issued_id', 'suffix_input'
    ]);
    assert.equal(JSON.stringify(plan).includes('source_refs'), false);
    assert.equal(JSON.stringify(plan).includes('candidate_key'), false);
  });

  it('rejects model-authored IDs and disambiguators', () => {
    for (const field of ['id', 'disambiguator']) {
      assert.throws(
        () => assignStableIds({ characters: [{ name: '甲', [field]: 'forged' }] }, {}),
        error => error.code === 'ID_DISAMBIGUATOR_FORBIDDEN'
      );
    }
  });

  it('handles multiple categories independently', () => {
    const result = assignStableIds({
      characters: [{ name: '陆小凤', source_refs: refs(1) }],
      skills: [{ name: '玄门内功', source_refs: refs(1) }],
      items: [{ name: '回生丹', types: ['丹药'], source_refs: refs(1) }],
      factions: [{ name: '玄门', types: ['门派'], source_refs: refs(1) }]
    }, {});
    assert.equal(result.recordsByCategory.characters[0].id, 'char_lu_xiao_feng');
    assert.equal(result.recordsByCategory.skills[0].id, 'skill_xuan_men_nei_gong');
    assert.equal(result.recordsByCategory.items[0].id, 'item_hui_sheng_dan');
    assert.equal(result.recordsByCategory.factions[0].id, 'faction_xuan_men');
  });
});

describe('nameSlug', () => {
  it('converts Chinese name to pinyin slug', () => {
    assert.equal(nameSlug('陆小凤'), 'lu_xiao_feng');
  });

  it('handles empty name with fallback', () => {
    const slug = nameSlug('');
    assert.ok(slug.startsWith('x'));
  });
});
