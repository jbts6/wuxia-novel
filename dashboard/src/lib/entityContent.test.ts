import { describe, expect, it } from 'vitest';
import {
  createEmptyContentCoverage,
  hasEntityContent,
  summarizeContentCoverage,
} from './entityContent';

describe('entity content coverage', () => {
  it('treats id, name, and source evidence as an index-only record', () => {
    expect(hasEntityContent('items', {
      id: 'auto_item_生死符',
      name: '生死符',
      source_refs: [{ chapter: 1, text: '原文定位' }],
    })).toBe(false);
  });

  it('recognizes current and legacy descriptive fields', () => {
    expect(hasEntityContent('characters', { id: 'c1', name: '段誉', biography: '大理世子。' })).toBe(true);
    expect(hasEntityContent('factions', { id: 'f1', name: '少林派', headquarters: '少林寺' })).toBe(true);
    expect(hasEntityContent('skills', { id: 's1', name: '降龙十八掌', effects: ['刚猛掌力'] })).toBe(true);
  });

  it('recognizes v4 character level, rank, and summary as content', () => {
    expect(hasEntityContent('characters', { id: 'c1', name: '段誉', level: '核心' })).toBe(true);
    expect(hasEntityContent('characters', { id: 'c2', name: '萧峰', rank: '绝顶' })).toBe(true);
    expect(hasEntityContent('characters', { id: 'c3', name: '虚竹', summary: '逍遥派掌门。' })).toBe(true);
  });

  it('recognizes a v4 skill rank while retaining power_rank compatibility', () => {
    expect(hasEntityContent('skills', { id: 's1', name: '六脉神剑', rank: '绝学' })).toBe(true);
    expect(hasEntityContent('skills', { id: 's2', name: '降龙十八掌', power_rank: '绝学' })).toBe(true);
  });

  it('summarizes index-only and partial books without counting source refs as content', () => {
    const coverage = createEmptyContentCoverage();
    coverage.byEntity.items = { total: 2, detailed: 0, indexOnly: 2 };
    coverage.byEntity.characters = { total: 2, detailed: 1, indexOnly: 1 };

    expect(summarizeContentCoverage(coverage.byEntity)).toMatchObject({
      state: 'partial',
      total: 4,
      detailed: 1,
      indexOnly: 3,
    });
  });
});
