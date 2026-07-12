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
});
