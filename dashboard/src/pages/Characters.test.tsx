import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNovelStore } from '../stores/useNovelStore';
import Characters from './Characters';

function renderCharacters(initialEntry = '/characters') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><Characters /></MemoryRouter>);
}

beforeEach(() => {
  useNovelStore.getState().clearData();
  useNovelStore.getState().loadData({
    characters: [{
      id: 'char_1',
      name: '胡斐',
      aliases: ['雪狐'],
      identities: ['胡家传人', '侠客'],
      level: '核心',
      rank: null,
      description: '行走江湖的青年侠客。',
      factions: ['faction_1', 'faction_2'],
      skills: ['skill_1'],
    }, {
      id: 'char_2',
      name: '程灵素',
      aliases: [],
      identities: ['药师'],
      level: null,
      rank: null,
      description: null,
      factions: ['faction_1'],
      skills: [],
    }],
    skills: [{
      id: 'skill_1',
      name: '胡家刀法',
      aliases: [],
      types: ['刀法'],
      factions: ['faction_1'],
      rank: null,
      description: '胡家世传刀法。',
      techniques: [],
    }],
    items: [],
    factions: [
      { id: 'faction_1', name: '胡家', aliases: [], types: ['世家'], description: '辽东武林世家。' },
      { id: 'faction_2', name: '雪山派', aliases: [], types: ['门派'], description: '雪山门派。' },
    ],
    chapter_summaries: [],
  });
});

describe('人物志 V6 视图', () => {
  it('可搜索复数身份和别名，并按复数势力成员匹配', () => {
    renderCharacters();
    const search = screen.getByPlaceholderText('搜索姓名/别名/身份...');

    fireEvent.change(search, { target: { value: '胡家传人' } });
    expect(screen.getByText('胡斐')).toBeInTheDocument();
    expect(screen.queryByText('程灵素')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '势力' }));
    fireEvent.click(screen.getByRole('button', { name: '雪山派' }));
    expect(screen.getByText('胡斐')).toBeInTheDocument();
    expect(screen.queryByText('程灵素')).not.toBeInTheDocument();
  });

  it('空的可空字段不生成占位行', async () => {
    renderCharacters('/characters?detail=char_2');
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).queryByText(/层级：/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/境界：/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: '简介' })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/未知|未注明|暂无/)).not.toBeInTheDocument();
  });
});
