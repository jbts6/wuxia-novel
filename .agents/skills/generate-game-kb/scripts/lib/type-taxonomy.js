'use strict';

const TYPE_TAXONOMIES = Object.freeze({
  skills: Object.freeze(['内功', '心法', '外功', '轻功', '身法', '剑法', '刀法', '枪法', '棍法', '棒法', '鞭法', '拳法', '掌法', '腿法', '爪法', '指法', '点穴', '擒拿', '暗器', '毒功', '医术', '易容', '音律', '阵法', '奇门', '合击', '其他']),
  items: Object.freeze(['武器', '防具', '秘籍', '丹药', '暗器', '坐骑', '异兽', '饰品', '其他']),
  factions: Object.freeze(['门派', '帮会', '组织', '家族', '世家', '朝廷', '官府', '商会', '镖局', '教派', '寺院', '部族', '王朝', '山庄', '其他'])
});

const TYPE_ALIASES = Object.freeze({
  skills: Object.freeze({ internal_skill: '内功', qinggong: '轻功', swordsmanship: '剑法', saber_skill: '刀法', hidden_weapon_skill: '暗器' }),
  items: Object.freeze({ weapon: '武器', armor: '防具', manual: '秘籍', elixir: '丹药', hidden_weapon: '暗器', mount: '坐骑', beast: '异兽', accessory: '饰品' }),
  factions: Object.freeze({ sect: '门派', imperial_court: '朝廷', merchant_guild: '商会', escort_agency: '镖局', clan: '家族' })
});

const TAXONOMY_SETS = Object.freeze(Object.fromEntries(
  Object.entries(TYPE_TAXONOMIES).map(([category, values]) => [category, new Set(values)])
));

function normalizeTypeArray(category, values, fieldPath) {
  const taxonomy = TAXONOMY_SETS[category];
  const aliases = TYPE_ALIASES[category];
  if (!taxonomy) {
    return { values: [], normalizations: [], errors: [{ code: 'TYPE_CATEGORY_UNKNOWN', path: fieldPath, target: category }] };
  }
  if (!Array.isArray(values)) {
    return { values: [], normalizations: [], errors: [{ code: 'TYPE_ARRAY_INVALID', path: fieldPath, target: values }] };
  }

  const result = [];
  const normalizations = [];
  const errors = [];
  const seen = new Set();
  const seenAliases = new Set();

  values.forEach((value, index) => {
    const elementPath = `${fieldPath}[${index}]`;
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push({ code: 'TYPE_VALUE_INVALID', path: elementPath, target: value });
      return;
    }
    const trimmed = value.trim();
    let normalized = trimmed;
    if (taxonomy.has(trimmed)) {
      normalized = trimmed;
    } else if (aliases && Object.hasOwn(aliases, trimmed)) {
      normalized = aliases[trimmed];
      if (!seenAliases.has(trimmed)) {
        seenAliases.add(trimmed);
        normalizations.push({
          field_path: elementPath,
          original_value: trimmed,
          normalized_value: normalized,
          normalization_rule: `${category}.${trimmed}`
        });
      }
    } else {
      errors.push({ code: 'TYPE_VALUE_UNKNOWN', path: elementPath, target: trimmed });
      return;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  });

  return { values: result, normalizations, errors };
}

module.exports = { TYPE_TAXONOMIES, TYPE_ALIASES, normalizeTypeArray };
