import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Character, Dialogue, Faction, Item, Location, Skill, Technique } from '../types/novel';
import {
  buildNovelFileUrl,
  getStaticBookMeta,
  getStaticNovelData,
  loadNovelData,
  type BookMeta,
  type NovelDataFileFetcher,
} from './novelData';

describe('novelData', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__BOOK_META__');
    Reflect.deleteProperty(window, '__NOVEL_DATA__');
  });

  it('builds encoded data urls for book files', () => {
    expect(buildNovelFileUrl('characters.json', '金庸/天龙八部')).toBe(
      '/api/novel/characters.json?book=%E9%87%91%E5%BA%B8%2F%E5%A4%A9%E9%BE%99%E5%85%AB%E9%83%A8',
    );
  });

  it('reads static globals without leaking window casts to callers', () => {
    const book: BookMeta = {
      path: '古龙/多情剑客无情剑',
      author: '古龙',
      name: '多情剑客无情剑',
      characters: 1,
      skills: 2,
      factions: 3,
    };
    Object.defineProperty(window, '__BOOK_META__', { configurable: true, value: book });
    Object.defineProperty(window, '__NOVEL_DATA__', {
      configurable: true,
      value: { characters: [{ id: 'char_li', name: '李寻欢' }] },
    });

    expect(getStaticBookMeta()).toEqual(book);
    expect(getStaticNovelData()).toEqual({
      characters: [{ id: 'char_li', name: '李寻欢' }],
      skills: [],
      techniques: [],
      items: [],
      locations: [],
      factions: [],
      dialogues: [],
    });
  });

  it('loads the complete single-book data set through one file-fetcher interface', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (file: string) => {
      calls.push(file);
      const data = {
        'characters.json': [] as Character[],
        'skills.json': [] as Skill[],
        'techniques.json': [] as Technique[],
        'items.json': [] as Item[],
        'locations.json': [] as Location[],
        'factions.json': [] as Faction[],
        'dialogues.json': [] as Dialogue[],
      };
      return data[file as keyof typeof data];
    }) as NovelDataFileFetcher;

    const data = await loadNovelData('金庸/天龙八部', fetcher);

    expect(calls).toEqual([
      'characters.json',
      'skills.json',
      'techniques.json',
      'items.json',
      'locations.json',
      'factions.json',
      'dialogues.json',
    ]);
    expect(data).toEqual({
      characters: [],
      skills: [],
      techniques: [],
      items: [],
      locations: [],
      factions: [],
      dialogues: [],
    });
  });
});
