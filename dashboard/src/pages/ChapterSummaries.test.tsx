import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useNovelStore } from '../stores/useNovelStore';
import type { BookExtrasData } from '../types/novel';
import ChapterSummaries from './ChapterSummaries';

const BOOK_PATH = '金庸/飞狐外传';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function renderChapterSummaries(initialEntry = '/chapter-summaries') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ChapterSummaries />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function setEvents(
  resource: BookExtrasData['events'],
  options: { loading?: boolean; error?: string | null } = {},
) {
  useLibraryStore.setState({
    currentBook: BOOK_PATH,
    extrasCache: resource.status === 'available' || resource.status === 'missing' || resource.status === 'invalid'
      ? { [BOOK_PATH]: { events: resource, gameMaterials: { status: 'missing', data: null } } }
      : {},
    extrasLoading: { [BOOK_PATH]: options.loading === true },
    extrasErrors: { [BOOK_PATH]: options.error ?? null },
  });
}

beforeEach(() => {
  useNovelStore.getState().clearData();
  useNovelStore.getState().loadData({
    characters: [{
      id: 'char_1',
      name: '胡斐',
      alias: [],
      role: '主角',
      personality: { traits: [], speech_style: '' },
      relationships: [],
    }],
    skills: [],
    items: [],
    factions: [],
    locations: [{ id: 'loc_1', name: '苗疆', region: '', description: '' }],
    dialogues: [],
    techniques: [],
    chapter_summaries: [{
      chapter: 1,
      title: '第一回 风雪初遇',
      summary: '胡斐踏入苗疆。',
      key_events: ['风雪初遇'],
      key_characters: ['char_1'],
    }],
  });
  setEvents({
    status: 'available',
    data: [{
      id: 'event_1',
      name: '雪山夺刀',
      importance: '高',
      cause: '宝刀现世',
      process: '众人争夺宝刀',
      result: '胡斐暂得宝刀',
      participants: ['char_1'],
      locations: ['loc_1'],
      source_refs: [
        { chapter: 1, text: '第一章夺刀' },
        { chapter: 2, text: '第二章追逐' },
      ],
    }],
  });
});

describe('章回录关键事件视图', () => {
  it('默认显示章节摘要并保留原有章节内容', () => {
    renderChapterSummaries();

    expect(screen.getByRole('tab', { name: '章节摘要' })).toBeInTheDocument();
    expect(screen.getByText('胡斐踏入苗疆。')).toBeInTheDocument();
    expect(screen.getByText('第一回 风雪初遇')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('');
  });

  it('事件视图展示参与者、地点和跨章证据并同步 URL', () => {
    renderChapterSummaries('/chapter-summaries?view=events');

    expect(screen.getByRole('tab', { name: '关键事件' })).toBeInTheDocument();
    expect(screen.getByText('雪山夺刀')).toBeInTheDocument();
    expect(screen.getByText('胡斐')).toBeInTheDocument();
    expect(screen.getByText('苗疆')).toBeInTheDocument();
    expect(screen.getByText('第 1 章')).toBeInTheDocument();
    expect(screen.getByText('第 2 章')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('?view=events');
  });

  it('事件深链接自动打开详情并保留全部章节引用', async () => {
    renderChapterSummaries('/chapter-summaries?view=events&detail=event_1');

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: '雪山夺刀' })).toBeInTheDocument();
    expect(within(dialog).getByText('宝刀现世')).toBeInTheDocument();
    expect(within(dialog).getByText('众人争夺宝刀')).toBeInTheDocument();
    expect(within(dialog).getByText('胡斐')).toBeInTheDocument();
    expect(within(dialog).getByText('苗疆')).toBeInTheDocument();
    expect(within(dialog).getByText('第 1 章')).toBeInTheDocument();
    expect(within(dialog).getByText('第 2 章')).toBeInTheDocument();
  });

  it('事件缺失时显示尚未生成状态', () => {
    setEvents({ status: 'missing', data: null });
    renderChapterSummaries('/chapter-summaries?view=events');
    expect(screen.getByText('本书尚未生成关键事件')).toBeInTheDocument();
  });

  it('事件损坏时显示读取错误', () => {
    setEvents({ status: 'invalid', data: null, error: 'events.json 响应结构无效' });
    renderChapterSummaries('/chapter-summaries?view=events');
    expect(screen.getByText(/events\.json 响应结构无效/)).toBeInTheDocument();
  });

  it('事件加载中时显示独立加载状态', () => {
    setEvents({ status: 'available', data: [] }, { loading: true });
    renderChapterSummaries('/chapter-summaries?view=events');
    expect(screen.getByText('正在加载关键事件')).toBeInTheDocument();
  });

  it('首次请求失败且没有缓存时显示暂时不可用', () => {
    useLibraryStore.setState({
      currentBook: BOOK_PATH,
      extrasCache: {},
      extrasLoading: { [BOOK_PATH]: false },
      extrasErrors: { [BOOK_PATH]: '扩展接口不可用' },
    });
    renderChapterSummaries('/chapter-summaries?view=events');
    expect(screen.getByText(/关键事件暂时不可用：扩展接口不可用/)).toBeInTheDocument();
  });
});
