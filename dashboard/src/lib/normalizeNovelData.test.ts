import { describe, expect, it } from 'vitest';
import { DataContractError, normalizeNovelData } from './normalizeNovelData';

function validRawData() {
  return {
    characters: [{
      id: 'char_jia', name: '甲', aliases: ['甲公子'], identities: ['侠客'],
      level: '核心', rank: null, description: '甲的完整经历。',
      factions: ['faction_qing_cheng'], skills: ['skill_xuan_men'],
    }],
    skills: [{
      id: 'skill_xuan_men', name: '玄门内功', aliases: [], types: ['内功'],
      factions: ['faction_qing_cheng'], rank: '登堂入室', description: null,
      techniques: [{ name: '飞云掌', description: '掌势迅疾。' }],
    }],
    items: [{ id: 'item_dan', name: '回生丹', aliases: [], type: '丹药', description: null }],
    factions: [{ id: 'faction_qing_cheng', name: '青城派', aliases: ['青城'], type: '门派', description: null }],
    chapter_summaries: [{ chapter: 1, title: '第一章', summary: '甲登场。' }],
  };
}

describe('normalizeNovelData strict semantic contract v6', () => {
  it('accepts the exact v6 shapes and preserves nullable values and technique objects', () => {
    const data = normalizeNovelData(validRawData());
    expect(data.characters[0]).toEqual(validRawData().characters[0]);
    expect(data.skills[0].techniques).toEqual([{ name: '飞云掌', description: '掌势迅疾。' }]);
    expect(data.items[0].description).toBeNull();
    expect(data.chapter_summaries[0]).toEqual({ chapter: 1, title: '第一章', summary: '甲登场。' });
  });

  it.each([
    ['character biography', 'characters', 'biography', '旧简介'],
    ['character identity', 'characters', 'identity', '侠客'],
    ['character faction', 'characters', 'faction', 'faction_qing_cheng'],
    ['character items', 'characters', 'items', ['item_dan']],
    ['skill type', 'skills', 'type', '内功'],
    ['skill faction', 'skills', 'faction', 'faction_qing_cheng'],
    ['skill holders', 'skills', 'holders', ['char_jia']],
    ['item owner', 'items', 'owner', 'char_jia'],
    ['faction members', 'factions', 'members', ['char_jia']],
  ])('rejects legacy or inverse field %s', (_label, category, field, value) => {
    const raw = validRawData() as Record<string, Array<Record<string, unknown>>>;
    raw[category][0][field] = value;
    expect(() => normalizeNovelData(raw)).toThrowError(DataContractError);
  });

  it('rejects duplicate IDs', () => {
    const raw = validRawData();
    raw.characters.push({ ...raw.characters[0] });
    expect(() => normalizeNovelData(raw)).toThrow(/DUPLICATE_ID/);
  });

  it.each(['', '未知', '未分类', 'unknown'])('rejects placeholder entity names: %s', (name) => {
    const raw = validRawData();
    raw.items[0].name = name;
    expect(() => normalizeNovelData(raw)).toThrow(/PLACEHOLDER/);
  });

  it('rejects dangling faction and skill references', () => {
    const raw = validRawData();
    raw.characters[0].factions = ['faction_missing'];
    raw.characters[0].skills = ['skill_missing'];
    expect(() => normalizeNovelData(raw)).toThrow(/DANGLING_REFERENCE/);
  });

  it('rejects scalar values where v6 requires arrays', () => {
    const raw = validRawData() as unknown as Record<string, Array<Record<string, unknown>>>;
    raw.characters[0].identities = '侠客';
    expect(() => normalizeNovelData(raw)).toThrow(/ARRAY_REQUIRED/);
  });

  it('rejects unknown top-level files and missing required arrays', () => {
    const raw = validRawData() as Record<string, unknown>;
    raw.events = [];
    expect(() => normalizeNovelData(raw)).toThrow(/FIELD_FORBIDDEN/);
    const missing = validRawData() as Record<string, unknown>;
    delete missing.items;
    expect(() => normalizeNovelData(missing)).toThrow(/FIELD_REQUIRED/);
  });
});
