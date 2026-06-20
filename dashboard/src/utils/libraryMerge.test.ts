import { describe, expect, it } from 'vitest';
import type { LibraryCharacterRecord } from '../types/library';
import { mergeCharacterRecords } from './libraryMerge';

const source1 = { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' };
const source2 = { author: '金庸', bookName: '神雕侠侣', bookPath: '金庸/神雕侠侣' };

function makeCharRecord(source: typeof source1, overrides: Record<string, unknown> = {}): LibraryCharacterRecord {
  return {
    key: `character:${source.bookPath}:char_guo_jing`,
    kind: 'character',
    source,
    entity: {
      id: 'char_guo_jing',
      name: '郭靖',
      alias: ['郭大侠'],
      identity: '丐帮帮主',
      one_line: '侠之大者',
      personality: { traits: ['忠厚'], speech_style: '朴实', temperament: '沉稳' },
      role: 'protagonist',
      archetype: 'warrior',
      power_rank: '出神入化',
      rank: '出神入化',
      importance: '主角',
      faction: '丐帮',
      relationships: [],
      known_skills: ['降龙十八掌'],
      source_refs: [],
      ...overrides,
    } as never,
  };
}

describe('mergeCharacterRecords', () => {
  it('merges same character from multiple books into one record', () => {
    const records = [
      makeCharRecord(source1, { role: 'protagonist', power_rank: '出神入化' }),
      makeCharRecord(source2, { role: 'companion', power_rank: '炉火纯青' }),
    ];
    const merged = mergeCharacterRecords(records);

    expect(merged).toHaveLength(1);
    expect(merged[0].entityId).toBe('char_guo_jing');
    expect(merged[0].name).toBe('郭靖');
    expect(merged[0].appearances).toHaveLength(2);
    expect(merged[0].primary.role).toBe('protagonist');
  });

  it('keeps protagonist as primary over other roles', () => {
    const records = [
      makeCharRecord(source2, { role: 'companion', power_rank: '炉火纯青' }),
      makeCharRecord(source1, { role: 'protagonist', power_rank: '出神入化' }),
    ];
    const merged = mergeCharacterRecords(records);
    expect(merged[0].primary.source.bookPath).toBe('金庸/射雕英雄传');
    expect(merged[0].primary.role).toBe('protagonist');
  });

  it('handles distinct characters separately', () => {
    const records: LibraryCharacterRecord[] = [
      makeCharRecord(source1),
      {
        key: `character:${source2.bookPath}:char_yang_guo`,
        kind: 'character',
        source: source2,
        entity: {
          id: 'char_yang_guo',
          name: '杨过',
          alias: [],
          identity: '',
          one_line: '',
          personality: { traits: [], speech_style: '', temperament: '' },
          role: 'protagonist',
          archetype: 'warrior',
          power_rank: '登峰造极',
          rank: '登峰造极',
          importance: '主角',
          faction: null,
          relationships: [],
          known_skills: [],
          source_refs: [],
        } as never,
      },
    ];
    const merged = mergeCharacterRecords(records);
    expect(merged).toHaveLength(2);
  });
});
