import { describe, expect, it } from 'vitest';
import { buildIdMaps, resolveEntityName, resolveId, resolveIds, toChineseDisplayText } from './resolveId';

describe('中文实体名称解析', () => {
  const characterMap = new Map([
    ['char_duan_yu', '段誉'],
    ['char_empty', ''],
  ]);

  it('把内部 ID 解析为中文名称', () => {
    expect(resolveEntityName('char_duan_yu', characterMap)).toBe('段誉');
    expect(resolveId('char_duan_yu', characterMap, '未知人物')).toBe('段誉');
  });

  it('不把无法解析的英文 ID 暴露给页面', () => {
    expect(resolveEntityName('char_unknown', characterMap)).toBeNull();
    expect(resolveId('char_unknown', characterMap, '未知人物')).toBe('未知人物');
    expect(resolveIds(['char_duan_yu', 'char_unknown'], characterMap)).toEqual(['段誉']);
  });

  it('兼容旧数据中直接保存的中文名称', () => {
    expect(resolveEntityName('段誉', characterMap)).toBe('段誉');
    expect(toChineseDisplayText('char_duan_yu')).toBeNull();
  });

  it('去掉混合实体 ID 的技术前缀', () => {
    expect(resolveEntityName('char_左子穆', characterMap)).toBe('左子穆');
    expect(resolveIds(['char_左子穆', 'char_unknown'], characterMap)).toEqual(['左子穆']);
    expect(toChineseDisplayText('unknown_段誉')).toBeNull();
  });

  it('为招式建立独立名称映射', () => {
    const maps = buildIdMaps({
      characters: [],
      factions: [],
      locations: [],
      skills: [],
      techniques: [{ id: 'tech_1', name: '八方藏锋', skill: 'skill_1', description: '测试招式。' }],
      items: [],
    });

    expect(maps.techniqueMap.get('tech_1')).toBe('八方藏锋');
  });
});
