import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNovelStore } from '../stores/useNovelStore';
import Skills from './Skills';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function renderSkills(initialEntry = '/skills') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Skills />
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useNovelStore.getState().clearData();
  useNovelStore.getState().loadData({
    characters: [{
      id: 'char_1',
      name: '胡斐',
      aliases: [],
      identities: ['侠客'],
      level: '核心',
      rank: null,
      description: '胡家后人。',
      factions: ['faction_1'],
      skills: ['skill_1'],
    }],
    skills: [{
      id: 'skill_1',
      name: '胡家刀法',
      aliases: ['胡家刀'],
      types: ['刀法', '绝学'],
      factions: ['faction_1', 'faction_2'],
      rank: '登堂入室',
      description: '胡家世传刀法。',
      techniques: [{ name: '八方藏锋', description: '藏锋于八方变化之中。' }],
    }, {
      id: 'skill_2',
      name: '普通剑法',
      aliases: [],
      types: ['剑法'],
      factions: ['faction_2'],
      rank: null,
      description: null,
      techniques: [],
    }],
    items: [],
    factions: [
      { id: 'faction_1', name: '胡家', aliases: [], types: ['世家'], description: '辽东武林世家。' },
      { id: 'faction_2', name: '北地剑门', aliases: [], types: ['门派'], description: '北地剑派。' },
    ],
    chapter_summaries: [],
  });
});

describe('武功阁 V6 视图', () => {
  it('保留功法深链接并显示嵌套招式、势力和反向推导的使用人物', async () => {
    renderSkills('/skills?detail=skill_1');

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('胡家刀法')).toBeInTheDocument();
    expect(within(dialog).getByText('境界：登堂入室')).toBeInTheDocument();
    expect(within(dialog).getByText('八方藏锋')).toBeInTheDocument();
    expect(within(dialog).getByText('藏锋于八方变化之中。')).toBeInTheDocument();
    expect(within(dialog).getByText('胡家')).toBeInTheDocument();
    expect(within(dialog).getByText('胡斐')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('?detail=skill_1');
  });

  it('可按别名和嵌套招式说明搜索，不提供独立招式标签页', () => {
    renderSkills();

    const search = screen.getByPlaceholderText('搜索武功/招式...');
    fireEvent.change(search, { target: { value: '胡家刀' } });
    expect(screen.getByText('胡家刀法')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: '八方变化' } });
    expect(screen.getByText('胡家刀法')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '招式' })).not.toBeInTheDocument();
  });

  it('复数类型和势力筛选按数组成员匹配', () => {
    const { container } = renderSkills();

    fireEvent.click(screen.getByRole('button', { name: '类型' }));
    fireEvent.click(screen.getByRole('button', { name: '绝学' }));
    expect(screen.getByText('胡家刀法')).toBeInTheDocument();
    expect(screen.queryByText('普通剑法')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '势力' }));
    fireEvent.click(screen.getByRole('button', { name: '胡家' }));
    expect(screen.getByText('胡家刀法')).toBeInTheDocument();
    expect(screen.queryByText('普通剑法')).not.toBeInTheDocument();
    expect(container.querySelector('button button')).toBeNull();
  });
});
