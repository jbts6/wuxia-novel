import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '../components/ui/tooltip';
import { buildGlobalLibraryRecords } from '../lib/globalLibrary';
import { UnresolvedEntityError } from '../lib/resolveId';
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

    validationContract: 'none',
    validationWarnings: [],
    validationRunId: null,
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

    v7InstallReceipt: false,
    v7VerificationReport: false,
    v7ReviewReport: false,
  },
  dataCompleteness: { present: 8, valid: 8, required: 8 },
  contentCoverage: {
    state: 'complete',
    total: 60,
    detailed: 60,
    indexOnly: 0,
    byEntity: {
      characters: { total: 60, detailed: 60, indexOnly: 0 },
      factions: { total: 0, detailed: 0, indexOnly: 0 },
      skills: { total: 0, detailed: 0, indexOnly: 0 },
      items: { total: 0, detailed: 0, indexOnly: 0 },
    },
  },
  entityCounts: { characters: 60, factions: 0, skills: 0, items: 0 },
  review: { status: 'missing', warningCount: 0, reportPath: null },
  missingArtifacts: [],
  errors: [],
  gateFailures: [],
  suggestedAction: null,
};

const data: NovelData = {
  characters: Array.from({ length: 60 }, (_, index) => ({
    id: `character-${index + 1}`,
    name: `人物-${index + 1}`,
    aliases: index === 54 ? ['关键别名'] : [],
    identities: ['江湖人物'],
    level: index % 2 === 0 ? '核心' : '重要',
    rank: null,
    description: `第 ${index + 1} 条人物简介`,
    factions: [],
    skills: [],
  })),
  skills: [],
  items: [],
  factions: [],
  chapter_summaries: [],
};

const records = buildGlobalLibraryRecords(book, data);
const status: LibraryStatusResponse = {
  scannedAt: '2026-07-12T10:00:00.000Z',
  summary: { total: 1, notStarted: 0, inProgress: 0, browseable: 1, contentIncomplete: 0, completed: 1 },
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
  }, 10_000);

  it('does not expose legacy locations in records or filters', () => {
    renderPage();

    expect(records.map((record) => record.kind)).not.toContain('location');
    expect(screen.getByText('跨书检索人物、武功、物品和势力。')).toBeInTheDocument();
    expect(screen.queryByText('地点')).not.toBeInTheDocument();
    expect(within(screen.getByRole('combobox', { name: '按实体类型筛选' })).queryByRole('option', { name: '地点' })).not.toBeInTheDocument();
  });

  it('searches aliases and links to the exact single-book entity', async () => {
    renderPage('/browse?q=关键别名&author=金庸');

    const row = screen.getByRole('row', { name: '查看人物“人物-55”详情' });
    fireEvent.click(row);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('第 55 条人物简介')).toBeInTheDocument();
    expect(within(dialog).queryByText('原文证据')).not.toBeInTheDocument();
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

  it('rejects unresolved relation IDs instead of leaking IDs or placeholder text', () => {
    const relationData: NovelData = {
      characters: [{
        id: 'char_duan_yu',
        name: '段誉',
        aliases: [],
        identities: ['大理世子'],
        level: '核心',
        rank: null,
        description: '大理段氏世子。',
        factions: ['faction_dali'],
        skills: ['skill_lingbo'],
      }],
      skills: [{
        id: 'skill_lingbo',
        name: '凌波微步',
        aliases: [],
        types: ['轻功'],
        factions: ['faction_unknown'],
        rank: null,
        description: '逍遥派轻功。',
        techniques: [],
      }],
      items: [],
      factions: [{ id: 'faction_dali', name: '大理段氏', aliases: [], types: ['世家'], description: '大理皇族。' }],
      chapter_summaries: [],
    };

    expect(() => buildGlobalLibraryRecords(book, relationData)).toThrow(UnresolvedEntityError);
  });

  it('shows every entity type in the global detail sheet', async () => {
    const multiTypeData: NovelData = {
      characters: [],
      skills: [],
      items: [{
        id: 'item_kong_que_ling',
        name: '孔雀翎',
        aliases: [],
        types: ['兵器', '暗器'],
        description: '名震天下的暗器。',
      }],
      factions: [],
      chapter_summaries: [],
    };
    useLibraryStore.setState({
      bookCache: { [book.path]: multiTypeData },
      globalRecords: buildGlobalLibraryRecords(book, multiTypeData),
    });
    renderPage('/browse?q=%E5%AD%94%E9%9B%80%E7%BF%8E');

    fireEvent.click(screen.getByRole('row', { name: '查看物品“孔雀翎”详情' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('兵器、暗器')).toBeInTheDocument();
  });

  it('labels valid v6 index-only entities without inventing metadata', async () => {
    const indexOnlyData: NovelData = {
      characters: [],
      skills: [],
      items: [{
        id: 'auto_item_生死符',
        name: '生死符',
        aliases: [],
        types: [],
        description: null,
      }],
      factions: [],
      chapter_summaries: [],
    };
    useLibraryStore.setState({
      bookCache: { [book.path]: indexOnlyData },
      globalRecords: buildGlobalLibraryRecords(book, indexOnlyData),
    });
    renderPage('/browse?q=%E7%94%9F%E6%AD%BB%E7%AC%A6');

    fireEvent.click(screen.getByRole('row', { name: '查看物品“生死符”详情' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('仅有索引记录')).toBeInTheDocument();
    expect(within(dialog).queryByText('基础信息')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('简介')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('原文证据')).not.toBeInTheDocument();
  });
});
