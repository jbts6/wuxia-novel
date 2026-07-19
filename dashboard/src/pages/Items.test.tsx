import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNovelStore } from '../stores/useNovelStore';
import Items from './Items';

beforeEach(() => {
  useNovelStore.getState().hideDetail();
  useNovelStore.getState().loadData({
    characters: [],
    skills: [],
    items: [
      {
        id: 'item_1',
        name: '冷月宝刀',
        aliases: [],
        type: '兵器',
        description: '锋锐异常的宝刀。',
      },
    ],
    factions: [],
    chapter_summaries: [],
  });
});

describe('物品页面', () => {
  it('does not expose item rarity as a filter or table field', () => {
    render(
      <MemoryRouter>
        <Items />
      </MemoryRouter>,
    );

    expect(screen.getByText('冷月宝刀')).toBeInTheDocument();
    expect(screen.queryByText('稀有度')).not.toBeInTheDocument();
  });
});
