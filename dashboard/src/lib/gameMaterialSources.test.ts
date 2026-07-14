import { describe, expect, it } from 'vitest';
import { buildGameMaterialSourceIndex, resolveGameMaterialSource } from './gameMaterialSources';

const index = buildGameMaterialSourceIndex({
  authorName: '金庸',
  bookName: '飞狐外传',
  characters: [{ id: 'skill_misleading_character', name: '胡斐' }],
  skills: [{ id: 'char_misleading_skill', name: '胡家刀法' }],
  techniques: [{ id: 'tech_ba_fang_cang_feng', name: '八方藏锋' }],
  items: [{ id: 'item_leng_yue_bao_dao', name: '冷月宝刀' }],
  factions: [{ id: 'faction_hu_jia', name: '胡家' }],
  locations: [{ id: 'loc_shang_jia_bao', name: '商家堡' }],
  events: [{ id: 'event_xue_shan_zhui_zong', name: '雪山追踪' }],
});

describe('game material source resolution', () => {
  it('resolves all seven supported source kinds to stable deep links', () => {
    expect(resolveGameMaterialSource('skill_misleading_character', index)).toEqual({
      status: 'resolved',
      id: 'skill_misleading_character',
      kind: 'character',
      name: '胡斐',
      href: '/%E9%87%91%E5%BA%B8/%E9%A3%9E%E7%8B%90%E5%A4%96%E4%BC%A0/characters?detail=skill_misleading_character',
    });
    expect(resolveGameMaterialSource('char_misleading_skill', index)).toMatchObject({
      status: 'resolved',
      kind: 'skill',
      name: '胡家刀法',
      href: '/%E9%87%91%E5%BA%B8/%E9%A3%9E%E7%8B%90%E5%A4%96%E4%BC%A0/skills?detail=char_misleading_skill',
    });
    expect(resolveGameMaterialSource('tech_ba_fang_cang_feng', index)).toMatchObject({
      status: 'resolved',
      kind: 'technique',
      href: '/%E9%87%91%E5%BA%B8/%E9%A3%9E%E7%8B%90%E5%A4%96%E4%BC%A0/skills?view=techniques&detail=tech_ba_fang_cang_feng',
    });
    expect(resolveGameMaterialSource('item_leng_yue_bao_dao', index)).toMatchObject({ kind: 'item' });
    expect(resolveGameMaterialSource('faction_hu_jia', index)).toMatchObject({ kind: 'faction' });
    expect(resolveGameMaterialSource('loc_shang_jia_bao', index)).toMatchObject({ kind: 'location' });
    expect(resolveGameMaterialSource('event_xue_shan_zhui_zong', index)).toMatchObject({
      status: 'resolved',
      kind: 'event',
      href: '/%E9%87%91%E5%BA%B8/%E9%A3%9E%E7%8B%90%E5%A4%96%E4%BC%A0/chapter-summaries?view=events&detail=event_xue_shan_zhui_zong',
    });
  });

  it('uses collection membership rather than technical id prefixes', () => {
    expect(resolveGameMaterialSource('skill_misleading_character', index)).toMatchObject({ kind: 'character' });
    expect(resolveGameMaterialSource('char_misleading_skill', index)).toMatchObject({ kind: 'skill' });
  });

  it('returns an explicit unresolved result without inventing a link', () => {
    expect(resolveGameMaterialSource('char_missing', index)).toEqual({
      status: 'unresolved',
      id: 'char_missing',
    });
  });
});
