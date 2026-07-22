import { fireEvent, render, screen } from '@testing-library/react';
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
        types: ['兵器', '暗器'],
        description: '锋锐异常的宝刀。',
      },
      {
        id: 'item_2',
        name: '寻常佩剑',
        aliases: [],
        types: ['兵器'],
        description: null,
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
    expect(screen.getAllByText('兵器')).toHaveLength(2);
    expect(screen.getByText('暗器')).toBeInTheDocument();
    expect(screen.queryByText('稀有度')).not.toBeInTheDocument();
  });

  it('按任一类型成员筛选物品', () => {
    render(
      <MemoryRouter>
        <Items />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '类型' }));
    fireEvent.click(screen.getByRole('button', { name: '暗器' }));

    expect(screen.getByText('冷月宝刀')).toBeInTheDocument();
    expect(screen.queryByText('寻常佩剑')).not.toBeInTheDocument();
  });
});
