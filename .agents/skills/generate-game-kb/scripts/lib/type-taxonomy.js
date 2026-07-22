'use strict';

// TYPE_TAXONOMIES = 受控词表（终态白名单）。最终 YAML 的 types 只允许这些标准中文词。
// TYPE_ALIASES    = 归一化字典（一对一硬映射）。把 Worker 可能写出的英文/拼音/中文近义变体
//                   机械地扳回标准词。value 必须落在同类目的 TYPE_TAXONOMIES 内（测试强制）。
// 归一化全程零语义理解：先精确命中白名单 → 再按归一化 key 查别名表 → 都不中即报 UNKNOWN 拒绝。
// 未覆盖的写法一律拒绝并暴露（反应式补表），绝不做编辑距离/子串猜测式的静默归类。

const TYPE_TAXONOMIES = Object.freeze({
  skills: Object.freeze(['内功', '心法', '外功', '轻功', '身法', '剑法', '刀法', '枪法', '棍法', '棒法', '鞭法', '拳法', '掌法', '腿法', '爪法', '指法', '点穴', '擒拿', '暗器', '毒功', '医术', '易容', '音律', '阵法', '奇门', '合击', '其他']),
  items: Object.freeze(['武器', '防具', '秘籍', '丹药', '暗器', '坐骑', '异兽', '饰品', '其他']),
  factions: Object.freeze(['门派', '帮会', '组织', '家族', '世家', '朝廷', '官府', '商会', '镖局', '教派', '寺院', '部族', '王朝', '山庄', '其他'])
});

const TYPE_ALIASES = Object.freeze({
  skills: Object.freeze({
    // —— 英文 / 拼音 ——
    internal_skill: '内功', internal_energy: '内功', neigong: '内功', inner_strength: '内功',
    mental_technique: '心法', xinfa: '心法', mind_method: '心法',
    external_skill: '外功', waigong: '外功',
    qinggong: '轻功', lightness_skill: '轻功', lightness_kungfu: '轻功',
    body_technique: '身法', footwork: '身法',
    swordsmanship: '剑法', sword_art: '剑法', sword_technique: '剑法', sword_skill: '剑法',
    saber_skill: '刀法', saber_art: '刀法', blade_skill: '刀法',
    spear_skill: '枪法', spear_art: '枪法',
    staff_skill: '棍法', staff_art: '棍法',
    cudgel_skill: '棒法',
    whip_skill: '鞭法',
    fist_skill: '拳法', boxing: '拳法', fist_art: '拳法',
    palm_skill: '掌法', palm_technique: '掌法',
    leg_skill: '腿法', kicking_skill: '腿法',
    claw_skill: '爪法',
    finger_skill: '指法', finger_technique: '指法',
    acupoint_skill: '点穴', dianxue: '点穴', pressure_point: '点穴',
    grappling: '擒拿', qinna: '擒拿',
    hidden_weapon_skill: '暗器',
    poison_skill: '毒功', poison: '毒功', poison_art: '毒功',
    medicine: '医术', healing: '医术', medical_skill: '医术',
    disguise: '易容',
    music: '音律', music_skill: '音律',
    formation: '阵法', formation_skill: '阵法',
    qimen: '奇门',
    combined_attack: '合击', joint_attack: '合击',
    other: '其他',
    // —— 中文近义变体 ——
    剑术: '剑法', 刀术: '刀法', 枪术: '枪法', 棍术: '棍法', 棒术: '棒法', 鞭术: '鞭法',
    拳术: '拳法', 掌术: '掌法', 掌力: '掌法', 腿术: '腿法', 腿功: '腿法',
    爪功: '爪法', 指力: '指法', 指功: '指法',
    内力: '内功', 内家功: '内功', 内家功夫: '内功',
    心诀: '心法', 心决: '心法',
    毒术: '毒功', 用毒: '毒功',
    医道: '医术', 医学: '医术',
    易容术: '易容', 乔装术: '易容',
    点穴功: '点穴', 擒拿手: '擒拿',
    暗器手法: '暗器', 暗器功夫: '暗器',
    阵图: '阵法', 奇门遁甲: '奇门'
  }),
  items: Object.freeze({
    // —— 英文 ——
    weapon: '武器', armor: '防具', manual: '秘籍', secret_manual: '秘籍',
    elixir: '丹药', pill: '丹药', medicine_pill: '丹药',
    hidden_weapon: '暗器', mount: '坐骑', beast: '异兽', accessory: '饰品',
    other: '其他',
    // —— 中文近义变体 ——
    兵器: '武器', 甲胄: '防具', 铠甲: '防具', 护甲: '防具',
    秘笈: '秘籍', 武功秘籍: '秘籍', 拳谱: '秘籍', 剑谱: '秘籍', 刀谱: '秘籍', 心法秘籍: '秘籍',
    丹: '丹药', 药丸: '丹药', 灵药: '丹药', 仙丹: '丹药',
    神兽: '异兽', 灵兽: '异兽', 异宝: '异兽',
    首饰: '饰品', 配饰: '饰品'
  }),
  factions: Object.freeze({
    // —— 英文 ——
    sect: '门派', imperial_court: '朝廷', merchant_guild: '商会', escort_agency: '镖局',
    clan: '家族', gang: '帮会', organization: '组织', family: '家族',
    noble_family: '世家', government: '官府', temple: '寺院', tribe: '部族',
    dynasty: '王朝', manor: '山庄', religious_sect: '教派', other: '其他',
    // —— 中文近义变体 ——
    宗派: '门派', 门户: '门派', 派系: '门派',
    宗教: '教派', 教门: '教派',
    世族: '世家', 名门: '世家', 望族: '世家',
    皇室: '朝廷', 宫廷: '朝廷', 官方: '官府', 衙门: '官府',
    庄园: '山庄', 山寨: '帮会', 帮派: '帮会',
    寺庙: '寺院', 庙宇: '寺院', 道观: '寺院',
    部落: '部族', 王国: '王朝', 皇朝: '王朝',
    商号: '商会', 商帮: '商会', 家族势力: '家族'
  })
});

// key 机械归一化：NFKC（全角→半角等）+ 去首尾空白 + 小写 + 去内部空白/下划线/连字符。
// 让 Internal_Skill / sword-skill / "weapon " 这类表面变形无需单列即可命中；对中文基本无副作用。
function canonicalizeKey(value) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/[\s_\-]+/g, '');
}

const TAXONOMY_SETS = Object.freeze(Object.fromEntries(
  Object.entries(TYPE_TAXONOMIES).map(([category, values]) => [category, new Set(values)])
));

// 用归一化 key 建别名索引（原始 token 仍用于 normalization_rule 溯源）。
const ALIAS_INDEX = Object.freeze(Object.fromEntries(
  Object.entries(TYPE_ALIASES).map(([category, aliases]) => [
    category,
    new Map(Object.entries(aliases).map(([key, target]) => [canonicalizeKey(key), target]))
  ])
));

function normalizeTypeArray(category, values, fieldPath) {
  const taxonomy = TAXONOMY_SETS[category];
  const aliasIndex = ALIAS_INDEX[category];
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
    } else {
      const key = canonicalizeKey(trimmed);
      if (aliasIndex && aliasIndex.has(key)) {
        normalized = aliasIndex.get(key);
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
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  });

  return { values: result, normalizations, errors };
}

module.exports = { TYPE_TAXONOMIES, TYPE_ALIASES, normalizeTypeArray, canonicalizeKey };
