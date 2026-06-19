import { describe, expect, it } from 'vitest';
import type { BookMeta } from '../stores/useBookStore';
import type { Character, Faction, Item, Skill } from '../types/novel';
import type { LibraryCollections } from '../types/library';
import { getLibraryFilterOptions } from './libraryFilterOptions';

const books: BookMeta[] = [
  { author: '金庸', name: '射雕英雄传', path: '金庸/射雕英雄传', characters: 2 },
  { author: '古龙', name: '多情剑客无情剑', path: '古龙/多情剑客无情剑', characters: 1 },
];

const collections: LibraryCollections = {
  skills: [
    {
      key: 'skill:book:s1',
      kind: 'skill',
      source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' },
      entity: { id: 's1', name: '九阴真经', rank: '返璞归真', type: '内功', faction: null } as Skill,
    },
    {
      key: 'skill:book:s2',
      kind: 'skill',
      source: { author: '古龙', bookName: '多情剑客无情剑', bookPath: '古龙/多情剑客无情剑' },
      entity: { id: 's2', name: '基础拳脚', rank: '初窥门径', type: '拳脚', faction: null } as Skill,
    },
    {
      key: 'skill:book:s3',
      kind: 'skill',
      source: { author: '古龙', bookName: '多情剑客无情剑', bookPath: '古龙/多情剑客无情剑' },
      entity: { id: 's3', name: '旧数值技能', rank: 8, type: '剑法', faction: null } as unknown as Skill,
    },
  ],
  characters: [
    {
      key: 'character:book:c1',
      kind: 'character',
      source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' },
      entity: { id: 'c1', name: '郭靖', rank: 6, role: 'protagonist', archetype: 'warrior', faction: '丐帮' } as unknown as Character,
    },
  ],
  factions: [
    {
      key: 'faction:book:f1',
      kind: 'faction',
      source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' },
      entity: { id: 'f1', name: '丐帮', type: '帮会' } as Faction,
    },
  ],
  items: [
    {
      key: 'item:book:i1',
      kind: 'item',
      source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' },
      entity: { id: 'i1', name: '打狗棒', type: '兵器', rarity: '绝世神兵' } as Item,
    },
  ],
};

describe('library filter options', () => {
  it('limits skill rank options to ranks visible in the top-tier skill view', () => {
    expect(getLibraryFilterOptions('skills', collections, books).rank).toEqual(['返璞归真']);
  });

  it('omits rank options from views that do not use rank filtering', () => {
    expect(getLibraryFilterOptions('characters', collections, books).rank).toBeUndefined();
    expect(getLibraryFilterOptions('factions', collections, books).rank).toBeUndefined();
    expect(getLibraryFilterOptions('items', collections, books).rank).toBeUndefined();
  });
});
