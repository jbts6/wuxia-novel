import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/novel';
import { buildCharacterRows, resolveFactionName } from './characterRows';

function character(partial: Partial<Character> & Pick<Character, 'id' | 'name'>): Character {
  return {
    alias: [],
    identity: '',
    faction: null,
    role: 'npc',
    archetype: 'warrior',
    power_rank: '平平无奇',
    importance: '普通',
    rank: '平平无奇',
    one_line: '',
    personality: { traits: [], speech_style: '', temperament: '' },
    relationships: [],
    known_skills: [],
    related_skills: [],
    source_refs: [],
    ...partial,
  };
}

describe('characterRows', () => {
  it('resolves faction ids, names, and empty values', () => {
    const factions = [{ id: 'faction_gaibang', name: '丐帮' }];

    expect(resolveFactionName('faction_gaibang', factions)).toBe('丐帮');
    expect(resolveFactionName('丐帮', factions)).toBe('丐帮');
    expect(resolveFactionName(null, factions)).toBe('无门派');
    expect(resolveFactionName('unknown', factions)).toBe('unknown');
  });

  it('filters, sorts, and maps rows without mutating input characters', () => {
    const characters = [
      character({ id: 'weak', name: '甲', identity: '路人', power_rank: '平平无奇', rank: '平平无奇' }),
      character({ id: 'strong', name: '乙', alias: ['剑圣'], identity: '高手', power_rank: '返璞归真', rank: '返璞归真', faction: 'faction_gaibang' }),
    ];

    const rows = buildCharacterRows(
      characters,
      [{ id: 'faction_gaibang', name: '丐帮' }],
      { search: '剑圣', roles: [], ranks: [], factions: [] },
    );

    expect(rows).toEqual([
      {
        id: 'strong',
        name: '乙',
        alias: ['剑圣'],
        role: 'npc',
        rank: '返璞归真',
        faction: 'faction_gaibang',
        factionName: '丐帮',
        summary: '高手',
      },
    ]);
    expect(characters.map((item) => item.id)).toEqual(['weak', 'strong']);
  });
});
