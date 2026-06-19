import { render, screen } from '@testing-library/react';
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
        entity: { id: 's1', name: '九阴真经', rank: '返璞归真', type: '内功', techniques: [], effects: [] },
      },
    ],
    characters: [],
    factions: [],
    items: [],
    loading: false,
    error: null,
    warnings: [],
  }),
}));

describe('GlobalLibraryDashboard', () => {
  it('renders the global library summary and sections', () => {
    render(<GlobalLibraryDashboard />);

    expect(screen.getByText('全库总览')).toBeInTheDocument();
    expect(screen.getAllByText('顶级武功').length).toBeGreaterThan(0);
    expect(screen.getByText('人物原型')).toBeInTheDocument();
    expect(screen.getByText('门派资源')).toBeInTheDocument();
    expect(screen.getByText('神兵物品')).toBeInTheDocument();
  });
});
