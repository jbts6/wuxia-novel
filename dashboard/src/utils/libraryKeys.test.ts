import { describe, expect, it } from 'vitest';
import { buildLibraryKey, parseLibraryKey } from './libraryKeys';

describe('library keys', () => {
  it('builds a stable source-aware key', () => {
    expect(buildLibraryKey('skill', '金庸/射雕英雄传', 'skill_jiu_yin')).toBe(
      'skill:金庸%2F射雕英雄传:skill_jiu_yin',
    );
  });

  it('parses a stable source-aware key', () => {
    expect(parseLibraryKey('item:古龙%2F多情剑客无情剑:item_xiao_li_fei_dao')).toEqual({
      kind: 'item',
      bookPath: '古龙/多情剑客无情剑',
      entityId: 'item_xiao_li_fei_dao',
    });
  });

  it('rejects malformed keys', () => {
    expect(parseLibraryKey('skill:only-two-parts')).toBeNull();
  });
});
