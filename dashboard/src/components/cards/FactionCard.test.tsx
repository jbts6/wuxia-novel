import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Character, Faction } from '../../types/novel';
import { useNovelStore } from '../../stores/useNovelStore';
import FactionCard from './FactionCard';

vi.mock('../../stores/useNovelStore', () => ({
  useNovelStore: vi.fn(),
}));

const mockedUseNovelStore = vi.mocked(useNovelStore);

function withStoreState(state: Record<string, unknown>) {
  mockedUseNovelStore.mockImplementation((selector) => selector(state as never));
}

describe('FactionCard', () => {
  it('uses the shared role label for companion members', () => {
    const faction = {
      id: 'faction_li',
      name: '李园',
      type: '宅院',
      location: null,
      sub_divisions: [],
      one_line: '江湖故居',
      source_refs: [],
    } satisfies Faction;
    const companion = {
      id: 'char_tie',
      name: '铁传甲',
      alias: [],
      identity: '护卫',
      faction: 'faction_li',
      role: 'companion',
      archetype: 'warrior',
      power_rank: '登堂入室',
      importance: '配角',
      rank: '登堂入室',
      one_line: '忠义护主',
      personality: { traits: [], speech_style: '', temperament: '' },
      relationships: [],
      known_skills: [],
      related_skills: [],
      source_refs: [],
    } satisfies Character;
    withStoreState({
      factions: [faction],
      characters: [companion],
      locations: [],
      showDetail: vi.fn(),
    });

    render(<FactionCard id="faction_li" />);

    expect(screen.getByText('铁传甲')).toBeInTheDocument();
    expect(screen.getByText('同伴')).toBeInTheDocument();
    expect(screen.queryByText('NPC')).not.toBeInTheDocument();
  });
});
