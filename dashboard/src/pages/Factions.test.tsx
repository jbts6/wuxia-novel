import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNovelStore } from '../stores/useNovelStore';
import Factions from './Factions';

function renderFactions(initialEntry = '/factions') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><Factions /></MemoryRouter>);
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
      skills: [],
    }],
    skills: [],
    items: [],
    factions: [
      { id: 'faction_1', name: '胡家', aliases: ['辽东胡家'], type: '世家', description: '辽东武林世家。' },
      { id: 'faction_2', name: '无名门派', aliases: [], type: null, description: null },
    ],
    chapter_summaries: [],
  });
});

describe('势力录 V6 视图', () => {
  it('成员只由人物势力引用反向推导', async () => {
    renderFactions('/factions?detail=faction_1');
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByRole('heading', { name: '人物' })).toBeInTheDocument();
    expect(within(dialog).getByText('胡斐')).toBeInTheDocument();
  });

  it('势力可空字段为空时不显示占位内容', async () => {
    renderFactions('/factions?detail=faction_2');
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).queryByText(/类型：/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: '简介' })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/未知|未注明|暂无/)).not.toBeInTheDocument();
  });
});
