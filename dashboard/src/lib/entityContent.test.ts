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
    expect(hasEntityContent('locations', { id: 'l1', name: '少林寺', related_characters: ['玄慈'] })).toBe(true);
    expect(hasEntityContent('skills', { id: 's1', name: '降龙十八掌', effects: ['刚猛掌力'] })).toBe(true);
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
