import { describe, expect, it } from 'vitest';
import { buildIdMaps, resolveEntityName, resolveIds, UnresolvedEntityError } from './resolveId';

const data = {
  characters: [
    { id: 'char_jia', name: '甲', aliases: [], identities: [], level: null, rank: null, description: null, factions: ['faction_a'], skills: ['skill_a'] },
    { id: 'char_yi', name: '乙', aliases: [], identities: [], level: null, rank: null, description: null, factions: ['faction_a'], skills: ['skill_a'] },
  ],
  skills: [{ id: 'skill_a', name: '甲功', aliases: [], types: [], factions: ['faction_a'], rank: null, description: null, techniques: [] }],
  items: [{ id: 'item_a', name: '甲物', aliases: [], type: null, description: null }],
  factions: [{ id: 'faction_a', name: '甲派', aliases: [], type: null, description: null }],
};

describe('v6 entity maps', () => {
  it('builds current ID-name maps and reverse indexes from characters', () => {
    const maps = buildIdMaps(data);
    expect(maps.characterMap.get('char_jia')).toBe('甲');
    expect(maps.skillMap.get('skill_a')).toBe('甲功');
    expect(maps.skillUsers.get('skill_a')).toEqual(['char_jia', 'char_yi']);
    expect(maps.factionMembers.get('faction_a')).toEqual(['char_jia', 'char_yi']);
  });

  it('throws a visible data error for an unresolved non-null ID', () => {
    const maps = buildIdMaps(data);
    expect(() => resolveEntityName('char_missing', maps.characterMap)).toThrowError(UnresolvedEntityError);
    expect(() => resolveIds(['char_jia', 'char_missing'], maps.characterMap)).toThrowError(UnresolvedEntityError);
  });

  it('returns null only for an absent optional reference', () => {
    expect(resolveEntityName(null, new Map())).toBeNull();
  });
});
