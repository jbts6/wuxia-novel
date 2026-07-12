import { describe, expect, it } from 'vitest';
import { displayChineseValues, displayTaxonomyValue } from './displayText';

describe('页面中文展示词汇', () => {
  it('把英文枚举映射为中文', () => {
    expect(displayTaxonomyValue('assassin')).toBe('刺客');
    expect(displayTaxonomyValue('important')).toBe('重要');
    expect(displayTaxonomyValue('movement')).toBe('身法');
  });

  it('保留中文值并隐藏未知英文结构值', () => {
    expect(displayTaxonomyValue('武者')).toBe('武者');
    expect(displayTaxonomyValue('internal_unknown_value', '未分类')).toBe('未分类');
    expect(displayChineseValues(['降龙十八掌', 'skill_xianglong'])).toEqual(['降龙十八掌']);
  });
});
