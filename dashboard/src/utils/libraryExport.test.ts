import { describe, expect, it } from 'vitest';
import type { Skill } from '../types/novel';
import type { AnnotatedLibraryRecord } from '../types/library';
import { serializeLibraryCsv, serializeLibraryJson } from './libraryExport';

const record: AnnotatedLibraryRecord<Skill> = {
  key: 'skill:book:s1',
  kind: 'skill',
  source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' },
  entity: { id: 's1', name: '九阴真经', mastery_rank: '返璞归真', rank: '返璞归真', type: '内功', faction: null, one_line: '武学总纲' } as Skill,
  annotation: {
    key: 'skill:book:s1',
    gameTags: ['ultimate'],
    strengthScore: 10,
    designNotes: 'Endgame reward',
    exportEnabled: true,
    updatedAt: '2026-06-19T00:00:00.000Z',
  },
};

describe('library export', () => {
  it('serializes source, entity, and annotation to JSON', () => {
    const parsed = JSON.parse(serializeLibraryJson([record]));
    expect(parsed.records[0].source.bookName).toBe('射雕英雄传');
    expect(parsed.records[0].annotation.strengthScore).toBe(10);
  });

  it('serializes CSV with escaped fields', () => {
    const csv = serializeLibraryCsv([record]);
    expect(csv).toContain('key,kind,author,bookName,bookPath,name,mastery_rank,power_rank,importance,rarity_tier,rank,rarity,type,role,archetype,faction,gameTags,strengthScore,designNotes');
    expect(csv).toContain('"九阴真经"');
    expect(csv).toContain('"ultimate"');
  });
});
