import { beforeEach, describe, expect, it } from 'vitest';
import { useNovelStore } from './useNovelStore';
import type { NovelData } from '../types/novel';

function data(characterId = 'char_jia'): NovelData {
  return {
    characters: [{ id: characterId, name: characterId === 'char_jia' ? '甲' : '乙', aliases: [], identities: [], level: null, rank: null, description: null, factions: ['faction_a'], skills: ['skill_a'] }],
    skills: [{ id: 'skill_a', name: '甲功', aliases: [], types: [], factions: ['faction_a'], rank: null, description: null, techniques: [] }],
    items: [],
    factions: [{ id: 'faction_a', name: '甲派', aliases: [], type: null, description: null }],
    chapter_summaries: [],
  };
}

describe('useNovelStore v6 projections', () => {
  beforeEach(() => useNovelStore.getState().clearData());

  it('rebuilds entity maps and reverse indexes on every load', () => {
    useNovelStore.getState().loadData(data());
    expect(useNovelStore.getState().characterMap.get('char_jia')).toBe('甲');
    expect(useNovelStore.getState().skillUsers.get('skill_a')).toEqual(['char_jia']);
    expect(useNovelStore.getState().factionMembers.get('faction_a')).toEqual(['char_jia']);

    useNovelStore.getState().loadData(data('char_yi'));
    expect(useNovelStore.getState().characterMap.has('char_jia')).toBe(false);
    expect(useNovelStore.getState().skillUsers.get('skill_a')).toEqual(['char_yi']);
  });

  it('clearData removes maps, reverse indexes, entities, and detail state', () => {
    useNovelStore.getState().loadData(data());
    useNovelStore.getState().showDetail('character', 'char_jia');
    useNovelStore.getState().clearData();
    const state = useNovelStore.getState();
    expect(state.characters).toEqual([]);
    expect(state.characterMap).toEqual(new Map());
    expect(state.skillUsers).toEqual(new Map());
    expect(state.factionMembers).toEqual(new Map());
    expect(state.detailPanel).toEqual({ open: false, type: null, id: null });
  });
});
