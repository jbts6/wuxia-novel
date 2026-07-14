import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BookExtrasData } from '../types/novel';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useCurrentBookExtras } from './useCurrentBookExtras';

const extras: BookExtrasData = {
  events: { status: 'available', data: [] },
  gameMaterials: { status: 'missing', data: null },
};

beforeEach(() => {
  useLibraryStore.setState({
    currentBook: null,
    extrasCache: {},
    extrasLoading: {},
    extrasErrors: {},
  });
});

describe('useCurrentBookExtras', () => {
  it('returns a stable empty state before a book is selected', () => {
    const { result } = renderHook(() => useCurrentBookExtras());

    expect(result.current).toEqual({ bookPath: null, extras: null, isLoading: false, error: null });
  });

  it('selects cached data and request state for the current book only', () => {
    useLibraryStore.setState({
      currentBook: '古龙/测试书',
      extrasCache: { '古龙/测试书': extras, '金庸/另一书': { events: { status: 'missing', data: null }, gameMaterials: { status: 'missing', data: null } } },
      extrasLoading: { '古龙/测试书': false, '金庸/另一书': true },
      extrasErrors: { '古龙/测试书': null, '金庸/另一书': '其他错误' },
    });

    const { result } = renderHook(() => useCurrentBookExtras());

    expect(result.current).toEqual({
      bookPath: '古龙/测试书',
      extras,
      isLoading: false,
      error: null,
    });
  });
});
