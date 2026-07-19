import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNovelStore } from '../stores/useNovelStore';
import Dialogues from './Dialogues';

describe('dialogue pagination', () => {
  beforeEach(() => {
    useNovelStore.getState().clearData();
    useNovelStore.setState({
      characterMap: new Map([['char_test', '测试人物']]),
      dialogues: Array.from({ length: 5001 }, (_, index) => ({
        id: `dialogue-${index + 1}`,
        speaker: 'char_test',
        chapter: 1,
        line_start: index + 1,
        text: `对话内容 ${index + 1}`,
      })),
    });
  });

  it('keeps a five-thousand-record result set to one hundred rendered nodes per page', () => {
    const { container } = render(
      <MemoryRouter>
        <Dialogues />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('[data-dialogue-row]')).toHaveLength(100);
    expect(screen.getByText('1-100 / 5001 条对话')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(container.querySelectorAll('[data-dialogue-row]')).toHaveLength(100);
    expect(screen.getByText('101-200 / 5001 条对话')).toBeInTheDocument();
  });

  it('只显示解析后的中文说话者名称，不泄漏技术 ID', () => {
    useNovelStore.setState({
      characters: [{
        id: 'char_duan_yu',
        name: '段誉',
        aliases: [],
        identities: ['大理世子'],
        level: '核心',
        rank: null,
        description: '大理段氏世子。',
        factions: [],
        skills: [],
      }],
      characterMap: new Map([['char_duan_yu', '段誉']]),
      dialogues: [
        { id: 'dialogue-1', speaker: 'char_duan_yu', chapter: 1, text: '在下段誉。' },
      ],
    });

    render(
      <MemoryRouter>
        <Dialogues />
      </MemoryRouter>,
    );

    expect(screen.getByText('段誉')).toBeInTheDocument();
    expect(screen.queryByText('char_duan_yu')).not.toBeInTheDocument();
  });
});
