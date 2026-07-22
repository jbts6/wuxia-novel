import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryBookStatus, LibraryStatusResponse } from '../types/library';
import { useLibraryStore } from './useLibraryStore';

const book: LibraryBookStatus = {
  path: '古龙/测试书',
  author: '古龙',
  name: '测试书',
  generationStage: 'data-produced',
  validationStatus: 'legacy-unproven',
  browseable: true,
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
  dataCompleteness: { present: 8, valid: 8, required: 8 },
  contentCoverage: {
    state: 'index-only',
    total: 0,
    detailed: 0,
    indexOnly: 0,
    byEntity: {
      characters: { total: 0, detailed: 0, indexOnly: 0 },
      factions: { total: 0, detailed: 0, indexOnly: 0 },
      skills: { total: 0, detailed: 0, indexOnly: 0 },
      items: { total: 0, detailed: 0, indexOnly: 0 },
    },
  },
  entityCounts: { characters: 0, factions: 0, skills: 0, items: 0 },
  review: { status: 'missing', warningCount: 0, reportPath: null },
  missingArtifacts: [],
  errors: [],
  gateFailures: [],
  suggestedAction: null,
};

const status: LibraryStatusResponse = {
  scannedAt: '2026-07-14T00:00:00.000Z',
  summary: { total: 1, notStarted: 0, inProgress: 0, browseable: 1, contentIncomplete: 1, completed: 0 },
  books: [book],
  warnings: [],
};

const rawExtras = {
  events: {
    status: 'available' as const,
    data: [{ id: 'event_1', name: '事件', process: '过程', source_refs: [{ chapter: 1 }] }],
  },
  gameMaterials: {
    status: 'available' as const,
    data: {
      schema_version: 1,
      entries: [
        {
          material_type: '经典剧情桥段',
          source_id: 'event_1',
          relevance: '高',
          suggested_use: '主线桥段',
          reason: '具有代表性',
        },
      ],
    },
  },
};

beforeEach(() => {
  useLibraryStore.setState({
    status,
    books: [book],
    currentBook: null,
    bookCache: {},
    bookLoading: {},
    bookErrors: { [book.path]: null },
    extrasCache: {},
    extrasLoading: {},
    extrasErrors: {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useLibraryStore book extras', () => {
  it('deduplicates concurrent requests and caches normalized extras by book path', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(rawExtras), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const loadBookExtras = useLibraryStore.getState().loadBookExtras;
    const [first, second] = await Promise.all([loadBookExtras(book.path), loadBookExtras(book.path)]);
    const cached = await loadBookExtras(book.path);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/library/book-extras?path=%E5%8F%A4%E9%BE%99%2F%E6%B5%8B%E8%AF%95%E4%B9%A6',
      { cache: 'no-store' },
    );
    expect(first).toEqual(second);
    expect(cached).toEqual(first);
    expect(first.events).toMatchObject({ status: 'available', data: [{ id: 'event_1', importance: '' }] });
    expect(useLibraryStore.getState().extrasCache[book.path]).toEqual(first);
  });

  it('records extras failures separately without poisoning core book errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: '扩展接口暂时不可用' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(useLibraryStore.getState().loadBookExtras(book.path)).rejects.toThrow('扩展接口暂时不可用');

    expect(useLibraryStore.getState().extrasErrors[book.path]).toBe('扩展接口暂时不可用');
    expect(useLibraryStore.getState().bookErrors).toEqual({ [book.path]: null });
    expect(useLibraryStore.getState().bookCache).toEqual({});
  });
});
