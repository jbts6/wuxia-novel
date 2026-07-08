import { describe, it, expect } from 'vitest';
import { useNovelStore } from './useNovelStore';

describe('useNovelStore', () => {
  it('初始状态为空', () => {
    const state = useNovelStore.getState();
    expect(state.characters).toEqual([]);
    expect(state.skills).toEqual([]);
    expect(state.detailPanel).toEqual({ open: false, type: null, id: null });
  });

  it('showDetail 打开详情面板', () => {
    const { showDetail } = useNovelStore.getState();
    showDetail('character', 'char_1');
    expect(useNovelStore.getState().detailPanel).toEqual({
      open: true,
      type: 'character',
      id: 'char_1',
    });
  });

  it('hideDetail 关闭详情面板', () => {
    const { hideDetail } = useNovelStore.getState();
    hideDetail();
    expect(useNovelStore.getState().detailPanel).toEqual({
      open: false,
      type: null,
      id: null,
    });
  });
});
