import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DATA_FILE_NAMES, type LibraryBookStatus, type LibraryStatusResponse } from '../types/library';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useBookData } from './useBookData';

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
    state: 'empty',
    total: 0,
    detailed: 0,
    indexOnly: 0,
    byEntity: Object.fromEntries(
      ['characters', 'factions', 'skills', 'items'].map((key) => [
        key,
        { total: 0, detailed: 0, indexOnly: 0 },
      ]),
    ) as LibraryBookStatus['contentCoverage']['byEntity'],
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
  summary: { total: 1, notStarted: 0, inProgress: 0, browseable: 1, contentIncomplete: 0, completed: 0 },
  books: [book],
  warnings: [],
};

const rawBookData = Object.fromEntries(Object.keys(DATA_FILE_NAMES).map((key) => [key, []]));

function Probe() {
  const { isLoading, error } = useBookData();
  return <div>{`loading:${String(isLoading)};error:${error ?? 'none'}`}</div>;
}

beforeEach(() => {
  useLibraryStore.setState({
    status: null,
    books: [],
    statusLoading: false,
    statusError: null,
    currentBook: null,
    bookCache: {},
    bookLoading: {},
    bookErrors: {},
    extrasCache: {},
    extrasLoading: {},
    extrasErrors: {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useBookData', () => {
  it('loads extras independently so an extras failure does not block core book data', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/library/status') {
        return new Response(JSON.stringify(status), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.startsWith('/api/library/book-data?')) {
        return new Response(JSON.stringify(rawBookData), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.startsWith('/api/library/book-extras?')) {
        return new Response(JSON.stringify({ error: '扩展接口暂时不可用' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: '未知测试请求' }), { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/%E5%8F%A4%E9%BE%99/%E6%B5%8B%E8%AF%95%E4%B9%A6']}>
        <Routes>
          <Route path="/:authorName/:bookName" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('loading:false;error:none')).toBeInTheDocument());
    await waitFor(() => expect(useLibraryStore.getState().extrasErrors[book.path]).toBe('扩展接口暂时不可用'));

    expect(useLibraryStore.getState().bookCache[book.path]).toBeDefined();
    expect(useLibraryStore.getState().bookErrors[book.path]).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      '/api/library/book-extras?path=%E5%8F%A4%E9%BE%99%2F%E6%B5%8B%E8%AF%95%E4%B9%A6',
    );
  });
});
