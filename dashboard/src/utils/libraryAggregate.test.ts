import { describe, expect, it } from 'vitest';
import type { Character, Faction, Item, Skill } from '../types/novel';
import {
  aggregateLibraryCollections,
  isLegendaryItem,
  isTopTierSkill,
  summarizeLibrary,
} from './libraryAggregate';

const source = { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' };

describe('library aggregation', () => {
  it('classifies top-tier martial arts by current rank policy', () => {
    expect(isTopTierSkill({ rank: '返璞归真' } as Skill)).toBe(true);
    expect(isTopTierSkill({ rank: '登峰造极' } as Skill)).toBe(true);
    expect(isTopTierSkill({ rank: '出神入化' } as Skill)).toBe(false);
  });

  it('classifies legendary items by current rarity policy', () => {
    expect(isLegendaryItem({ rarity: '绝世神兵' } as Item)).toBe(true);
    expect(isLegendaryItem({ rarity: '稀世珍品' } as Item)).toBe(false);
  });

  it('attaches source metadata and stable keys', () => {
    const collections = aggregateLibraryCollections([
      {
        source,
        skills: [{ id: 'skill_1', name: '九阴真经', rank: '返璞归真' } as Skill],
        characters: [{ id: 'char_1', name: '郭靖', role: 'protagonist' } as Character],
        factions: [{ id: 'faction_1', name: '全真教' } as Faction],
        items: [{ id: 'item_1', name: '打狗棒', rarity: '绝世神兵' } as Item],
      },
    ]);

    expect(collections.skills[0].key).toBe('skill:金庸%2F射雕英雄传:skill_1');
    expect(collections.skills[0].source.bookName).toBe('射雕英雄传');
    expect(collections.characters[0].kind).toBe('character');
    expect(collections.factions[0].kind).toBe('faction');
    expect(collections.items[0].kind).toBe('item');
  });

  it('summarizes all library material', () => {
    const summary = summarizeLibrary({
      skills: [
        { key: 'a', kind: 'skill', source, entity: { id: 's1', rank: '返璞归真' } as Skill },
        { key: 'b', kind: 'skill', source, entity: { id: 's2', rank: '炉火纯青' } as Skill },
      ],
      characters: [{ key: 'c', kind: 'character', source, entity: { id: 'c1' } as Character }],
      factions: [{ key: 'f', kind: 'faction', source, entity: { id: 'f1' } as Faction }],
      items: [{ key: 'i', kind: 'item', source, entity: { id: 'i1', rarity: '绝世神兵' } as Item }],
    });

    expect(summary).toEqual({
      authors: 1,
      books: 1,
      skills: 2,
      topTierSkills: 1,
      characters: 1,
      factions: 1,
      items: 1,
      legendaryItems: 1,
    });
  });
});
