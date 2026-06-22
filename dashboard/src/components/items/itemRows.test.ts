import { describe, expect, it } from 'vitest';
import type { Character, Item } from '../../types/novel';
import { buildItemRows, normalizeItemType } from './itemRows';

function item(partial: Partial<Item> & Pick<Item, 'id' | 'name'>): Item {
  return {
    type: 'weapon',
    owner: null,
    one_line: '',
    description: '',
    effects: [],
    origin: '',
    rarity_tier: '寻常凡品',
    rarity: '寻常凡品',
    related_skills: [],
    source_refs: [],
    ...partial,
  };
}

describe('itemRows', () => {
  it('normalizes legacy item type labels', () => {
    expect(normalizeItemType('weapon')).toBe('兵器');
    expect(normalizeItemType('暗器')).toBe('暗器');
    expect(normalizeItemType('')).toBe('未分类');
  });

  it('filters, sorts, maps owners, and preserves input order', () => {
    const items = [
      item({ id: 'plain', name: '木棍', rarity_tier: '寻常凡品', rarity: '寻常凡品' }),
      item({ id: 'legend', name: '神兵', one_line: '剑圣佩剑', rarity_tier: '绝世神兵', rarity: '绝世神兵', owner: 'char_holder' }),
    ];
    const characters = [{ id: 'char_holder', name: '剑圣' }] as Character[];

    const rows = buildItemRows(items, characters, { search: '神兵', types: [], rarities: [] });

    expect(rows).toEqual([
      {
        id: 'legend',
        name: '神兵',
        type: '兵器',
        rank: '绝世神兵',
        ownerName: '剑圣',
        ownerId: 'char_holder',
        summary: '剑圣佩剑',
      },
    ]);
    expect(items.map((entry) => entry.id)).toEqual(['plain', 'legend']);
  });
});
