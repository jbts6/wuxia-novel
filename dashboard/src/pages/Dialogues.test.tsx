import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNovelStore } from '../stores/useNovelStore';
import Dialogues from './Dialogues';

describe('dialogue pagination', () => {
  beforeEach(() => {
    useNovelStore.getState().loadData({
      characters: [],
      skills: [],
      items: [],
      factions: [],
      locations: [],
      techniques: [],
      chapter_summaries: [],
      dialogues: Array.from({ length: 5001 }, (_, index) => ({
        id: `dialogue-${index + 1}`,
        speaker: '测试人物',
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
});
