import { describe, expect, it, vi } from 'vitest';
import type { Character, Faction, Item, Skill } from '../types/novel';
import type { BookMeta } from '../stores/useBookStore';
import { loadLibraryData, type LibraryFileFetcher } from './useLibraryData';

const books: BookMeta[] = [
  { author: '金庸', name: '射雕英雄传', path: '金庸/射雕英雄传', characters: 2 },
  { author: '古龙', name: '多情剑客无情剑', path: '古龙/多情剑客无情剑', characters: 1 },
];

describe('loadLibraryData', () => {
  it('loads all global material and keeps partial warnings', async () => {
    const fetcher: LibraryFileFetcher = vi.fn(async (file: string, book: BookMeta) => {
      if (book.author === '古龙' && file === 'items.json') {
        throw new Error('missing items');
      }
      if (file === 'skills.json') return [{ id: `${book.author}_skill`, name: '武功', mastery_rank: '登峰造极', rank: '登峰造极' }] as Skill[];
      if (file === 'characters.json') return [{ id: `${book.author}_char`, name: '人物', power_rank: '出神入化', rank: '出神入化', importance: '主角', role: 'protagonist', archetype: 'warrior' }] as Character[];
      if (file === 'factions.json') return [{ id: `${book.author}_faction`, name: '门派', type: '门派' }] as Faction[];
      if (file === 'items.json') return [{ id: `${book.author}_item`, name: '神兵', rarity_tier: '绝世神兵', rarity: '绝世神兵' }] as Item[];
      return [];
    }) as LibraryFileFetcher;

    const data = await loadLibraryData(books, fetcher, 2);

    expect(data.skills).toHaveLength(2);
    expect(data.characters).toHaveLength(2);
    expect(data.factions).toHaveLength(2);
    expect(data.items).toHaveLength(1);
    expect(data.warnings).toEqual([
      {
        bookPath: '古龙/多情剑客无情剑',
        bookName: '多情剑客无情剑',
        file: 'items.json',
        message: 'missing items',
      },
    ]);
  });
});
