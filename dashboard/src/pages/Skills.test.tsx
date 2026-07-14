import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  useNovelStore.getState().hideDetail();
  useNovelStore.getState().loadData({
    characters: [],
    skills: [
      {
        id: 'skill_1',
        name: '胡家刀法',
        type: '刀法',
        mastery_rank: '绝学',
        description: '胡家世传刀法。',
      },
    ],
    items: [],
    factions: [],
    locations: [],
    dialogues: [],
    techniques: [
      {
        id: 'tech_1',
        name: '八方藏锋',
        skill: 'skill_1',
        type: '刀招',
        description: '藏锋于八方变化之中。',
        source_refs: [{ chapter: 3, text: '八方藏锋' }],
      },
    ],
    chapter_summaries: [],
  });
});

describe('武功阁双视图', () => {
  it('默认保持功法视图并保留既有功法深链接', async () => {
    renderSkills('/skills?detail=skill_1');

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(within(screen.getByRole('dialog')).getByText('胡家刀法')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('?detail=skill_1');
  });

  it('切换到招式视图时写入 URL 并清理功法详情参数', async () => {
    renderSkills('/skills?detail=skill_1');

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    act(() => useNovelStore.getState().hideDetail());

    fireEvent.click(screen.getByRole('tab', { name: '招式' }));

    expect(screen.getByText('八方藏锋')).toBeInTheDocument();
    expect(screen.getByText('胡家刀法')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('?view=techniques');
  });

  it('从招式深链接自动打开对应招式详情', async () => {
    renderSkills('/skills?view=techniques&detail=tech_1');

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: '八方藏锋' })).toBeInTheDocument();
    expect(within(dialog).getByText('藏锋于八方变化之中。')).toBeInTheDocument();
    expect(within(dialog).getByText(/所属功法：胡家刀法/)).toBeInTheDocument();
    expect(within(dialog).getByText('第 3 章')).toBeInTheDocument();
  });

  it('招式为空时显示明确空状态', () => {
    useNovelStore.setState({ techniques: [] });
    renderSkills('/skills?view=techniques');

    expect(screen.getByText('暂无招式')).toBeInTheDocument();
  });
});
