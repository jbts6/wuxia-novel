import { describe, expect, it } from 'vitest';
import type { Character, Skill } from '../../types/novel';
import { buildSkillRows } from './skillRows';

function skill(partial: Partial<Skill> & Pick<Skill, 'id' | 'name'>): Skill {
  return {
    type: '拳法',
    faction: null,
    mastery_rank: '平平无奇',
    rank: '平平无奇',
    one_line: '',
    techniques: [],
    progression: [],
    effects: [],
    combat_style: '',
    source_refs: [],
    ...partial,
  };
}

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

describe('skillRows', () => {
  it('filters, sorts, maps holders, and preserves input order', () => {
    const skills = [
      skill({ id: 'basic', name: '入门拳', mastery_rank: '平平无奇', rank: '平平无奇' }),
      skill({ id: 'elite', name: '绝学', type: '剑法', mastery_rank: '返璞归真', rank: '返璞归真', one_line: '剑圣绝学' }),
    ];
    const characters = [
      character({ id: 'holder', name: '剑圣', known_skills: ['elite'] }),
    ];

    const rows = buildSkillRows(skills, characters, { search: '剑圣', types: [], ranks: [] });

    expect(rows).toEqual([
      {
        id: 'elite',
        name: '绝学',
        type: '剑法',
        rank: '返璞归真',
        summary: '剑圣绝学',
        techniqueNames: '',
        techniqueCount: 0,
        holderNames: '剑圣',
        holderIds: ['holder'],
      },
    ]);
    expect(skills.map((item) => item.id)).toEqual(['basic', 'elite']);
  });
});
