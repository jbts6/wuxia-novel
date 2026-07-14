import { describe, it, expect } from 'vitest';
import { useNovelStore } from './useNovelStore';

describe('useNovelStore', () => {
  it('初始状态为空', () => {
    const state = useNovelStore.getState();
    expect(state.characters).toEqual([]);
    expect(state.skills).toEqual([]);
    expect(state.techniqueMap).toEqual(new Map());
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

  it('加载并清理招式名称映射', () => {
    const { loadData, clearData } = useNovelStore.getState();
    loadData({
      characters: [],
      skills: [],
      items: [],
      factions: [],
      locations: [],
      dialogues: [],
      techniques: [{ id: 'tech_1', name: '八方藏锋', skill: 'skill_1', description: '招式描述' }],
      chapter_summaries: [],
    });

    expect(useNovelStore.getState().techniqueMap.get('tech_1')).toBe('八方藏锋');

    clearData();
    expect(useNovelStore.getState().techniqueMap).toEqual(new Map());
  });
});
