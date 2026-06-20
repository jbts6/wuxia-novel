import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import GlobalLibraryDashboard from './GlobalLibraryDashboard';

vi.mock('../../stores/useBookStore', () => ({
  useBookStore: (selector?: unknown) => {
    const state = {
      books: [{ author: '金庸', name: '射雕英雄传', path: '金庸/射雕英雄传', characters: 2 }],
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('../../hooks/useLibraryData', () => ({
  useLibraryData: () => ({
    skills: [
      {
        key: 'skill:book:s1',
        kind: 'skill',
        source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' },
        entity: { id: 's1', name: '九阴真经', mastery_rank: '返璞归真', rank: '返璞归真', type: '内功', techniques: [], effects: [] },
      },
    ],
    characters: [
      {
        key: 'character:book:c1',
        kind: 'character',
        source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' },
        entity: { id: 'c1', name: '郭靖', power_rank: '出神入化', rank: '出神入化', importance: '主角', role: 'protagonist', archetype: 'warrior', faction: null },
      },
    ],
    factions: [],
    items: [
      {
        key: 'item:book:i1',
        kind: 'item',
        source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' },
        entity: { id: 'i1', name: '打狗棒', rarity_tier: '绝世神兵', rarity: '绝世神兵', type: 'weapon' },
      },
    ],
    loading: false,
    error: null,
    warnings: [],
  }),
}));

describe('GlobalLibraryDashboard', () => {
  it('renders the global library summary and sections', () => {
    render(
      <MemoryRouter>
        <GlobalLibraryDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('全库总览')).toBeInTheDocument();
    expect(screen.getAllByText('顶级武功').length).toBeGreaterThan(0);
    expect(screen.getByText('人物原型')).toBeInTheDocument();
    expect(screen.getByText('门派资源')).toBeInTheDocument();
    expect(screen.getByText('神兵物品')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('顶级武功')[0]);

    expect(screen.getByLabelText('素材类型')).toBeInTheDocument();
  });
});
