import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '../components/ui/tooltip';
import { buildGlobalLibraryRecords } from '../lib/globalLibrary';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { LibraryBookStatus, LibraryStatusResponse } from '../types/library';
import type { NovelData } from '../types/novel';
import BrowseLibrary from './BrowseLibrary';

const book: LibraryBookStatus = {
  path: '金庸/测试书',
  author: '金庸',
  name: '测试书',
  generationStage: 'data-produced',
  validationStatus: 'passed',
  browseable: true,
  completed: true,
  schemaVersion: '2.0',
  lastUpdatedAt: null,
  scanProgress: {
    'named-inventory': { completed: 1, total: 1 },
    'event-dialogue': { completed: 1, total: 1 },
    'gap-audit': { completed: 1, total: 1 },
  },
  artifacts: {
    sourceText: true,
    chapterSplit: true,
    sourceIndex: true,
    scanManifest: true,
    candidates: true,
    decisions: true,
    qualityReport: true,
  },
  dataCompleteness: { present: 8, valid: 8, required: 8 },
  entityCounts: { characters: 60, factions: 0, locations: 0, skills: 0, techniques: 0, items: 0, dialogues: 0 },
  missingArtifacts: [],
  errors: [],
  gateFailures: [],
  suggestedAction: null,
};

const data: NovelData = {
  characters: Array.from({ length: 60 }, (_, index) => ({
    id: `character-${index + 1}`,
    name: `人物-${index + 1}`,
    alias: index === 54 ? ['关键别名'] : [],
    role: index % 2 === 0 ? '核心' : '重要',
    identity: '江湖人物',
    personality: { traits: [], speech_style: '' },
    relationships: [],
    source_refs: [{ chapter: index + 1, text: `第 ${index + 1} 条原文证据` }],
  })),
  skills: [],
  items: [],
  factions: [],
  locations: [],
  dialogues: [],
  techniques: [],
  chapter_summaries: [],
};

const records = buildGlobalLibraryRecords(book, data);
const status: LibraryStatusResponse = {
  scannedAt: '2026-07-12T10:00:00.000Z',
  summary: { total: 1, notStarted: 0, inProgress: 0, browseable: 1, completed: 1 },
  books: [book],
  warnings: [],
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(entry = '/browse') {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[entry]}>
        <BrowseLibrary />
        <LocationProbe />
      </MemoryRouter>
    </TooltipProvider>,
  );
}

describe('global library browser', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useLibraryStore.setState({
      status,
      books: [book],
      statusLoading: false,
      statusError: null,
      currentBook: null,
      bookCache: { [book.path]: data },
      bookLoading: {},
      bookErrors: {},
      globalRecords: records,
      globalLoading: false,
      globalError: null,
      globalWarnings: [],
      globalLoadProgress: { completed: 1, total: 1 },
      globalLoadedBookPaths: [book.path],
    });
  });

  it('renders at most fifty result rows and paginates the remainder', () => {
    renderPage();

    expect(screen.getAllByRole('row', { name: /查看人物/ })).toHaveLength(50);
    expect(screen.getByText('1-50 / 60 条记录')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getAllByRole('row', { name: /查看人物/ })).toHaveLength(10);
    expect(screen.getByText('51-60 / 60 条记录')).toBeInTheDocument();
  });

  it('searches aliases, opens source evidence, and links to the exact single-book entity', async () => {
    renderPage('/browse?q=关键别名&author=金庸');

    const row = screen.getByRole('row', { name: '查看人物“人物-55”详情' });
    fireEvent.click(row);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('第 55 条原文证据')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /打开单书详情/ });
    expect(link).toHaveAttribute('href', '/%E9%87%91%E5%BA%B8/%E6%B5%8B%E8%AF%95%E4%B9%A6/characters?detail=character-55');
  });

  it('keeps typing local until the user submits the search', () => {
    renderPage('/browse?author=%E9%87%91%E5%BA%B8');

    const input = screen.getByRole('textbox', { name: '搜索全库知识' });
    fireEvent.change(input, { target: { value: '关键别名' } });

    expect(screen.getAllByRole('row', { name: /查看人物/ })).toHaveLength(50);
    expect(new URLSearchParams(screen.getByTestId('location').textContent?.split('?')[1]).get('q')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '搜索' }));

    expect(screen.getAllByRole('row', { name: /查看人物/ })).toHaveLength(1);
    expect(new URLSearchParams(screen.getByTestId('location').textContent?.split('?')[1]).get('q')).toBe('关键别名');
  });

  it('does not submit while an IME composition is active', () => {
    renderPage();

    const input = screen.getByRole('textbox', { name: '搜索全库知识' });
    const form = screen.getByRole('search', { name: '全库知识搜索' });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '关键别名' } });
    fireEvent.submit(form);

    expect(new URLSearchParams(screen.getByTestId('location').textContent?.split('?')[1]).get('q')).toBeNull();

    fireEvent.compositionEnd(input);
    fireEvent.submit(form);

    expect(new URLSearchParams(screen.getByTestId('location').textContent?.split('?')[1]).get('q')).toBe('关键别名');
  });

  it('resolves relation IDs to Chinese names in global details without leaking unknown IDs', async () => {
    const relationData: NovelData = {
      characters: [{
        id: 'char_duan_yu',
        name: '段誉',
        alias: [],
        role: '核心',
        faction: 'faction_dali',
        personality: { traits: [], speech_style: '' },
        relationships: [],
      }],
      skills: [{
        id: 'skill_lingbo',
        name: '凌波微步',
        type: '轻功',
        faction: 'faction_unknown',
        description: '逍遥派轻功。',
        holders: ['char_duan_yu', 'char_unknown'],
      }],
      items: [],
      factions: [{ id: 'faction_dali', name: '大理段氏', type: '世家', description: '大理皇族。' }],
      locations: [],
      dialogues: [],
      techniques: [],
      chapter_summaries: [],
    };
    useLibraryStore.setState({
      bookCache: { [book.path]: relationData },
      globalRecords: buildGlobalLibraryRecords(book, relationData),
    });
    renderPage('/browse?q=%E5%87%8C%E6%B3%A2%E5%BE%AE%E6%AD%A5');

    fireEvent.click(screen.getByRole('row', { name: '查看武功“凌波微步”详情' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('段誉')).toBeInTheDocument();
    expect(within(dialog).getByText('未注明势力')).toBeInTheDocument();
    expect(within(dialog).queryByText('char_duan_yu')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('char_unknown')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('faction_unknown')).not.toBeInTheDocument();
  });
});
