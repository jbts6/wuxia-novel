import { describe, expect, it } from 'vitest';
import { normalizeNovelData } from './normalizeNovelData';

describe('normalizeNovelData', () => {
  it('provides safe defaults for sparse character records', () => {
    const data = normalizeNovelData({
      characters: [{ id: 'c1', name: '段誉', source_refs: [{ chapter: 1, text: '原文' }] }],
    });

    expect(data.characters[0]).toMatchObject({
      id: 'c1',
      name: '段誉',
      alias: [],
      role: '未标注',
      personality: { traits: [], speech_style: '' },
      relationships: [],
    });
  });

  it('normalizes legacy dialogue name records into the current display shape', () => {
    const data = normalizeNovelData({
      dialogues: [
        {
          id: 'd1',
          name: '段誉：我说不比，就是不比',
          source_refs: [{ chapter: 1, line_start: 37, line_end: 37, text: '原文段落' }],
        },
      ],
    });

    expect(data.dialogues[0]).toMatchObject({
      speaker: '段誉',
      chapter: 1,
      line_start: 37,
      text: '段誉：我说不比，就是不比',
    });
  });

  it('creates a stable display id for legacy dialogues without ids', () => {
    const data = normalizeNovelData({
      dialogues: [{ speaker: '袁承志', chapter: 3, line_start: 18, text: '旧版对话正文' }],
    });

    expect(data.dialogues[0]).toMatchObject({
      id: 'dialogue-3-18-1',
      speaker: '袁承志',
      chapter: 3,
      line_start: 18,
      text: '旧版对话正文',
    });
  });

  it('normalizes legacy skill ranks into canonical power_rank only', () => {
    const data = normalizeNovelData({
      skills: [
        { id: 's1', name: '胡家刀法', mastery_rank: '登堂入室' },
        { id: 's2', name: '苗家剑法', rank: '炉火纯青' },
      ],
    });

    expect(data.skills).toMatchObject([
      { id: 's1', power_rank: '登堂入室' },
      { id: 's2', power_rank: '炉火纯青' },
    ]);
    expect(data.skills[0]).not.toHaveProperty('mastery_rank');
    expect(data.skills[1]).not.toHaveProperty('rank');
  });

  it('drops legacy item rarity fields at the raw data boundary', () => {
    const data = normalizeNovelData({
      items: [{ id: 'i1', name: '冷月宝刀', rarity_tier: '珍稀', rarity: 'rare' }],
    });

    expect(data.items[0]).not.toHaveProperty('rarity_tier');
    expect(data.items[0]).not.toHaveProperty('rarity');
  });
});
