import { describe, expect, it } from 'vitest';
import type { Character, Faction, Item, Skill } from '../types/novel';
import type { LibraryRecord } from '../types/library';
import {
  createEmptyLibraryFilters,
  filterCharacters,
  filterFactions,
  filterItems,
  filterSkills,
  getUniqueFilterValues,
} from './libraryFilters';

const source = { author: '古龙', bookName: '多情剑客无情剑', bookPath: '古龙/多情剑客无情剑' };
const empty = createEmptyLibraryFilters();

describe('library filters', () => {
  it('filters skills by top fields and keyword content', () => {
    const records: LibraryRecord<Skill>[] = [
      {
        key: 'skill:a:s1',
        kind: 'skill',
        source,
        entity: {
          id: 's1',
          name: '小李飞刀',
          rank: '登峰造极',
          type: '暗器',
          faction: null,
          one_line: '例不虚发',
          combat_style: '精准爆发',
          techniques: [{ id: 't1', name: '飞刀一击', type: 'attack', description: '极快' }],
          effects: [{ type: 'burst', description: '瞬间爆发' }],
          progression: [],
          source_refs: [],
        },
      },
    ];

    expect(filterSkills(records, { ...empty, rank: ['登峰造极'], keyword: '爆发' })).toHaveLength(1);
    expect(filterSkills(records, { ...empty, type: ['拳掌'] })).toHaveLength(0);
  });

  it('filters character archetypes', () => {
    const records: LibraryRecord<Character>[] = [
      {
        key: 'character:a:c1',
        kind: 'character',
        source,
        entity: {
          id: 'c1',
          name: '李寻欢',
          role: 'protagonist',
          archetype: 'scholar',
          faction: null,
          rank: '绝顶',
          identity: '探花',
          one_line: '重情重义',
        } as Character,
      },
    ];

    expect(filterCharacters(records, { ...empty, role: ['protagonist'], archetype: ['scholar'] })).toHaveLength(1);
    expect(filterCharacters(records, { ...empty, role: ['villain'] })).toHaveLength(0);
  });

  it('filters factions and items', () => {
    const factions: LibraryRecord<Faction>[] = [
      {
        key: 'faction:a:f1',
        kind: 'faction',
        source,
        entity: {
          id: 'f1',
          name: '金钱帮',
          type: '帮会',
          location: '关中',
          sub_divisions: [],
          one_line: '势力庞大',
          source_refs: [],
        },
      },
    ];
    const items: LibraryRecord<Item>[] = [
      {
        key: 'item:a:i1',
        kind: 'item',
        source,
        entity: {
          id: 'i1',
          name: '小李飞刀',
          type: '暗器',
          rarity: '绝世神兵',
          owner: 'char_li_xun_huan',
          one_line: '例不虚发',
          description: '薄刃',
          effects: [],
          origin: '李家',
          related_skills: ['s1'],
          source_refs: [],
        },
      },
    ];

    expect(filterFactions(factions, { ...empty, type: ['帮会'], keyword: '关中' })).toHaveLength(1);
    expect(filterItems(items, { ...empty, rarity: ['绝世神兵'], keyword: '薄刃' })).toHaveLength(1);
  });

  it('collects unique filter values without blanks', () => {
    expect(getUniqueFilterValues(['古龙', '', null, '金庸', '古龙'])).toEqual(['古龙', '金庸']);
  });
});
