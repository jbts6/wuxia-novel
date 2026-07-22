import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../components/ui/tooltip';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { LibraryBookStatus, LibraryStatusResponse } from '../types/library';
import Library from './Library';

const copyCommand = vi.fn().mockResolvedValue(undefined);

const emptyContentCoverage: LibraryBookStatus['contentCoverage'] = {
  state: 'empty',
  total: 0,
  detailed: 0,
  indexOnly: 0,
  byEntity: {
    characters: { total: 0, detailed: 0, indexOnly: 0 },
    factions: { total: 0, detailed: 0, indexOnly: 0 },
    skills: { total: 0, detailed: 0, indexOnly: 0 },
    items: { total: 0, detailed: 0, indexOnly: 0 },
  },
};

function createBook(overrides: Partial<LibraryBookStatus>): LibraryBookStatus {
  return {
    path: '金庸/测试书',
    author: '金庸',
    name: '测试书',
    generationStage: 'not-started',
    validationStatus: 'not-validated',
    browseable: false,
    completed: false,
    schemaVersion: null,
    lastUpdatedAt: null,
    scanProgress: {
      'named-inventory': { completed: 0, total: 0 },
      'event-dialogue': { completed: 0, total: 0 },
      'gap-audit': { completed: 0, total: 0 },
    },
    artifacts: {
      sourceText: true,
      chapterSplit: false,
      sourceIndex: false,
      scanManifest: false,
      candidates: false,
      decisions: false,
      qualityReport: false,
    },
    dataCompleteness: { present: 0, valid: 0, required: 8 },
    contentCoverage: emptyContentCoverage,
    entityCounts: {
      characters: null,
      factions: null,
      skills: null,
      items: null,
    },
    review: { status: 'missing', warningCount: 0, reportPath: null },
    missingArtifacts: ['data/characters.json'],
    errors: [],
    gateFailures: [],
    suggestedAction: {
      label: '开始生成知识库',
      reason: '尚未发现完整生成产物。',
      command: 'codex generate-kb --book "金庸/测试书"',
    },
    ...overrides,
  };
}

const pendingBook = createBook({ name: '待生成书', path: '金庸/待生成书' });
const completedBook = createBook({
  name: '已完成书',
  path: '古龙/已完成书',
  author: '古龙',
  generationStage: 'data-produced',
  validationStatus: 'passed',
  browseable: true,
  completed: true,
  schemaVersion: '2.0',
  lastUpdatedAt: '2026-07-12T08:00:00.000Z',
  scanProgress: {
    'named-inventory': { completed: 10, total: 10 },
    'event-dialogue': { completed: 10, total: 10 },
    'gap-audit': { completed: 10, total: 10 },
  },
  dataCompleteness: { present: 8, valid: 8, required: 8 },
  contentCoverage: {
    state: 'complete',
    total: 26,
    detailed: 26,
    indexOnly: 0,
    byEntity: {
      characters: { total: 12, detailed: 12, indexOnly: 0 },
      factions: { total: 3, detailed: 3, indexOnly: 0 },
      skills: { total: 5, detailed: 5, indexOnly: 0 },
      items: { total: 6, detailed: 6, indexOnly: 0 },
    },
  },
  entityCounts: {
    characters: 12,
    factions: 3,
    skills: 5,
    items: 6,
  },
  missingArtifacts: [],
  suggestedAction: null,
});

const status: LibraryStatusResponse = {
  scannedAt: '2026-07-12T09:00:00.000Z',
  summary: { total: 2, notStarted: 1, inProgress: 0, browseable: 1, contentIncomplete: 0, completed: 1 },
  books: [pendingBook, completedBook],
  warnings: [],
};

function renderLibrary() {
  return render(
    <TooltipProvider>
      <MemoryRouter>
        <Library />
      </MemoryRouter>
    </TooltipProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Library workbench', () => {
  beforeEach(() => {
    copyCommand.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copyCommand },
    });
    useLibraryStore.setState({
      status,
      books: status.books,
      statusLoading: false,
      statusError: null,
      currentBook: null,
      bookCache: {},
      bookLoading: {},
      bookErrors: {},
    });
  });

  it('filters the table from summary status buttons', () => {
    renderLibrary();

    expect(screen.getByRole('columnheader', { name: '知识条目' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '内容' })).toBeInTheDocument();
    expect(screen.getByText('角色 12 · 武功 5 · 物品 6')).toBeInTheDocument();
    expect(screen.getByText('内容完整')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /未生成/ }));

    expect(screen.getByText('待生成书')).toBeInTheDocument();
    expect(screen.queryByText('已完成书')).not.toBeInTheDocument();
    expect(screen.getByText('显示 1 本')).toBeInTheDocument();
  });

  it('filters books whose entity files contain only index records', () => {
    const indexOnlyBook = createBook({
      name: '仅索引书',
      path: '金庸/仅索引书',
      generationStage: 'data-produced',
      browseable: true,
      contentCoverage: {
        state: 'index-only',
        total: 4,
        detailed: 0,
        indexOnly: 4,
        byEntity: {
          characters: { total: 1, detailed: 0, indexOnly: 1 },
          factions: { total: 1, detailed: 0, indexOnly: 1 },
          skills: { total: 1, detailed: 0, indexOnly: 1 },
          items: { total: 1, detailed: 0, indexOnly: 1 },
        },
      },
    });
    const indexStatus: LibraryStatusResponse = {
      ...status,
      summary: { ...status.summary, total: 3, browseable: 2, contentIncomplete: 1 },
      books: [...status.books, indexOnlyBook],
    };
    useLibraryStore.setState({ status: indexStatus, books: indexStatus.books });

    renderLibrary();
    fireEvent.click(screen.getByRole('button', { name: /内容待补全/ }));

    expect(screen.getByText('仅索引书')).toBeInTheDocument();
    expect(screen.queryByText('已完成书')).not.toBeInTheDocument();
    expect(screen.getByText('仅有索引')).toBeInTheDocument();
  });

  it('opens the selected book status in the detail sheet', async () => {
    renderLibrary();

    fireEvent.click(screen.getByRole('row', { name: '查看《待生成书》状态详情' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '知识条目' })).toBeInTheDocument();
    expect(screen.getByText('建议下一步')).toBeInTheDocument();
    expect(screen.getByText('data/characters.json')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '知识库尚不可浏览' })).toBeDisabled();
  });

  it('shows only contracted entity count and scan rows in the detail sheet', async () => {
    renderLibrary();

    fireEvent.click(screen.getByRole('row', { name: '查看《已完成书》状态详情' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('人物');
    expect(dialog).toHaveTextContent('势力');
    expect(dialog).toHaveTextContent('武功');
    expect(dialog).toHaveTextContent('物品');
    expect(dialog).not.toHaveTextContent('地点');
    expect(dialog).not.toHaveTextContent('招式');
    expect(dialog).not.toHaveTextContent('对话');
    expect(dialog).not.toHaveTextContent('事件');
  });

  it('loads review warning details only after opening the selected book sheet', async () => {
    const warningBook: LibraryBookStatus = {
      ...completedBook,
      name: '有警告书',
      path: '古龙/有警告书',
      review: { status: 'current', warningCount: 1, reportPath: 'reports/game-kb-review.json' },
    };
    const warningStatus: LibraryStatusResponse = {
      ...status,
      summary: { ...status.summary, total: 1, browseable: 1, completed: 1 },
      books: [warningBook],
    };
    useLibraryStore.setState({ status: warningStatus, books: warningStatus.books });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      report_version: 1,
      source_hash: 'sha256:source',
      final_data_hash: 'sha256:data',
      summary: {
        warning_count: 1,
        by_code: { GENERIC_CANDIDATE_FILTERED: 1 },
        by_category: { characters: 1 },
      },
      entries: [{
        code: 'GENERIC_CANDIDATE_FILTERED',
        severity: 'warning',
        category: 'characters',
        name: '店小二',
        chapter_numbers: [1],
        source_refs: [],
        member_refs: [],
        reason: '泛称',
        resolution: 'filtered',
      }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    renderLibrary();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('row', { name: '查看《有警告书》状态详情' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('1 条审查警告')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '查看审查警告' }));

    expect(await within(dialog).findByText('GENERIC_CANDIDATE_FILTERED')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('copies the suggested command without executing it', async () => {
    renderLibrary();
    fireEvent.click(screen.getByRole('row', { name: '查看《待生成书》状态详情' }));

    fireEvent.click(await screen.findByRole('button', { name: '复制建议命令' }));

    await waitFor(() => {
      expect(copyCommand).toHaveBeenCalledWith('codex generate-kb --book "金庸/测试书"');
    });
  });
});
