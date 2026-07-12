import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../components/ui/tooltip';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { LibraryBookStatus, LibraryStatusResponse } from '../types/library';
import Library from './Library';

const copyCommand = vi.fn().mockResolvedValue(undefined);

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
    entityCounts: {
      characters: null,
      factions: null,
      locations: null,
      skills: null,
      techniques: null,
      items: null,
      dialogues: null,
    },
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
  entityCounts: {
    characters: 12,
    factions: 3,
    locations: 7,
    skills: 5,
    techniques: 8,
    items: 6,
    dialogues: 20,
  },
  missingArtifacts: [],
  suggestedAction: null,
});

const status: LibraryStatusResponse = {
  scannedAt: '2026-07-12T09:00:00.000Z',
  summary: { total: 2, notStarted: 1, inProgress: 0, browseable: 1, completed: 1 },
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
    expect(screen.getByText('角色 12 · 武功 5 · 物品 6')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /未生成/ }));

    expect(screen.getByText('待生成书')).toBeInTheDocument();
    expect(screen.queryByText('已完成书')).not.toBeInTheDocument();
    expect(screen.getByText('显示 1 本')).toBeInTheDocument();
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

  it('copies the suggested command without executing it', async () => {
    renderLibrary();
    fireEvent.click(screen.getByRole('row', { name: '查看《待生成书》状态详情' }));

    fireEvent.click(await screen.findByRole('button', { name: '复制建议命令' }));

    await waitFor(() => {
      expect(copyCommand).toHaveBeenCalledWith('codex generate-kb --book "金庸/测试书"');
    });
  });
});
