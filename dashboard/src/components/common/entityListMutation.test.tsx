import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CharacterList from '../characters/CharacterList';
import ItemList from '../items/ItemList';
import SkillTree from '../skills/SkillTree';
import type { Character, Item, Skill } from '../../types/novel';
import { useNovelStore } from '../../stores/useNovelStore';

vi.mock('../../stores/useNovelStore', () => ({
  useNovelStore: vi.fn(),
}));

const mockedUseNovelStore = vi.mocked(useNovelStore);

function withStoreState(state: Record<string, unknown>) {
  mockedUseNovelStore.mockImplementation((selector) => selector(state as never));
}

describe('entity list modules', () => {
  it('does not mutate character data while sorting rows', () => {
    const characters = [
      {
        id: 'weak',
        name: '甲',
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
      },
      {
        id: 'strong',
        name: '乙',
        alias: [],
        identity: '',
        faction: null,
        role: 'npc',
        archetype: 'warrior',
        power_rank: '返璞归真',
        importance: '普通',
        rank: '返璞归真',
        one_line: '',
        personality: { traits: [], speech_style: '', temperament: '' },
        relationships: [],
        known_skills: [],
        related_skills: [],
        source_refs: [],
      },
    ] satisfies Character[];
    withStoreState({
      characters,
      factions: [],
      loading: false,
      showDetail: vi.fn(),
    });

    render(<CharacterList />);

    expect(characters.map((character) => character.id)).toEqual(['weak', 'strong']);
  });

  it('does not mutate skill data while sorting rows', () => {
    const skills = [
      {
        id: 'basic',
        name: '入门拳',
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
      },
      {
        id: 'elite',
        name: '绝学',
        type: '剑法',
        faction: null,
        mastery_rank: '返璞归真',
        rank: '返璞归真',
        one_line: '',
        techniques: [],
        progression: [],
        effects: [],
        combat_style: '',
        source_refs: [],
      },
    ] satisfies Skill[];
    withStoreState({
      skills,
      characters: [],
      loading: false,
      showDetail: vi.fn(),
    });

    render(<SkillTree />);

    expect(skills.map((skill) => skill.id)).toEqual(['basic', 'elite']);
  });

  it('does not mutate item data while sorting rows', () => {
    const items = [
      {
        id: 'plain',
        name: '木棍',
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
      },
      {
        id: 'legend',
        name: '神兵',
        type: 'weapon',
        owner: null,
        one_line: '',
        description: '',
        effects: [],
        origin: '',
        rarity_tier: '绝世神兵',
        rarity: '绝世神兵',
        related_skills: [],
        source_refs: [],
      },
    ] satisfies Item[];
    withStoreState({
      items,
      characters: [],
      loading: false,
      showDetail: vi.fn(),
    });

    render(<ItemList />);

    expect(items.map((item) => item.id)).toEqual(['plain', 'legend']);
  });
});
