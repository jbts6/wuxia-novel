import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNovelStore } from '../stores/useNovelStore';
import ChapterSummaries from './ChapterSummaries';

function renderChapterSummaries(initialEntry = '/chapter-summaries') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ChapterSummaries />
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
      description: '行走江湖的青年侠客。',
      factions: [],
      skills: [],
    }],
    skills: [],
    items: [],
    factions: [],
    chapter_summaries: [{
      chapter: 1,
      title: '第一回 风雪初遇',
      summary: '胡斐踏入苗疆。',
    }],
  });
});

describe('章回录', () => {
  it('默认显示章节摘要且不提供关键事件标签页', () => {
    renderChapterSummaries();

    expect(screen.getByText('胡斐踏入苗疆。')).toBeInTheDocument();
    expect(screen.getByText('第一回 风雪初遇')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '关键事件' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('旧事件深链接只显示章节摘要，不恢复事件内容或详情', () => {
    renderChapterSummaries('/chapter-summaries?view=events&detail=event_1');

    expect(screen.getByText('胡斐踏入苗疆。')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '关键事件' })).not.toBeInTheDocument();
    expect(screen.queryByText('雪山夺刀')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
