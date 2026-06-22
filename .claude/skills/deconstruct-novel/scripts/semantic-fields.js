const RANK_VALUES = ['平平无奇', '初窥门径', '略有小成', '登堂入室', '炉火纯青', '出神入化', '登峰造极', '返璞归真'];
const CHARACTER_IMPORTANCE_VALUES = ['核心', '重要', '次要', '龙套', '背景'];
const ITEM_RARITY_VALUES = ['寻常凡品', '上乘佳品', '稀世珍品', '绝世神兵', '未知'];

const DIRECT_RANK = new Set(RANK_VALUES);
const DIRECT_IMPORTANCE = new Set(CHARACTER_IMPORTANCE_VALUES);
const DIRECT_RARITY = new Set(ITEM_RARITY_VALUES);

const POWER_ALIASES = new Map([
  ['top', '登峰造极'],
  ['绝顶高手', '登峰造极'],
  ['绝顶', '登峰造极'],
  ['宗师', '登峰造极'],
  ['高手', '出神入化'],
  ['一流高手', '出神入化'],
  ['一流', '出神入化'],
  ['二流高手', '炉火纯青'],
  ['二流', '炉火纯青'],
  ['三流', '登堂入室'],
  ['普通', '平平无奇'],
  ['凡', '平平无奇'],
  ['不入流', '平平无奇'],
  ['未知', '平平无奇'],
]);

const IMPORTANCE_ALIASES = new Map([
  // 新五级制
  ['核心', '核心'],
  ['重要', '重要'],
  ['次要', '次要'],
  ['龙套', '龙套'],
  ['背景', '背景'],
  // 旧值映射
  ['protagonist', '核心'],
  ['主角', '核心'],
  ['主要人物', '重要'],
  ['重要人物', '重要'],
  ['major', '重要'],
  ['companion', '重要'],
  ['配角', '次要'],
  ['minor', '次要'],
  ['npc', '龙套'],
  ['villain', '次要'],
  ['路人', '龙套'],
  ['群众', '背景'],
  ['unknown', '龙套'],
  ['未知', '龙套'],
]);

const RARITY_ALIASES = new Map([
  ['legendary', '绝世神兵'],
  ['绝世', '绝世神兵'],
  ['神兵', '绝世神兵'],
  ['绝世神兵', '绝世神兵'],
  ['rare', '稀世珍品'],
  ['稀有', '稀世珍品'],
  ['珍稀', '稀世珍品'],
  ['稀世', '稀世珍品'],
  ['稀世珍品', '稀世珍品'],
  ['uncommon', '上乘佳品'],
  ['上乘', '上乘佳品'],
  ['珍贵', '上乘佳品'],
  ['上乘佳品', '上乘佳品'],
  ['common', '寻常凡品'],
  ['普通', '寻常凡品'],
  ['寻常', '寻常凡品'],
  ['寻常凡品', '寻常凡品'],
]);

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function appendNote(entity, note) {
  const notes = Array.isArray(entity.migration_notes) ? entity.migration_notes : [];
  if (!notes.includes(note)) entity.migration_notes = [...notes, note];
}

function preserveLegacy(entity, legacyField, auditField, original, canonical) {
  const raw = clean(original);
  if (!raw || raw === canonical) return;
  if (!entity[auditField]) entity[auditField] = raw;
}

function rankFrom(value) {
  const raw = clean(value);
  if (DIRECT_RANK.has(raw)) return raw;
  if (/^[1-8]$/.test(raw)) return RANK_VALUES[Number(raw) - 1];
  return POWER_ALIASES.get(raw) || null;
}

function importanceFrom(value) {
  const raw = clean(value);
  if (DIRECT_IMPORTANCE.has(raw)) return raw;
  return IMPORTANCE_ALIASES.get(raw) || null;
}

function rarityFrom(value) {
  const raw = clean(value);
  if (DIRECT_RARITY.has(raw)) return raw;
  return RARITY_ALIASES.get(raw) || null;
}

function hasChanged(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function normalizeSkill(input) {
  const entity = { ...input };
  const original = entity.mastery_rank || entity.rank;
  const mapped = rankFrom(original) || '平平无奇';

  entity.mastery_rank = mapped;
  preserveLegacy(entity, 'rank', 'legacy_rank', entity.rank, mapped);
  entity.rank = mapped;
  if (!rankFrom(original)) appendNote(entity, `unresolved mastery rank: ${clean(original) || '<blank>'}`);

  return { entity, changed: hasChanged(input, entity) };
}

function normalizeCharacter(input) {
  const entity = { ...input };
  const rawRank = entity.power_rank || entity.rank;
  const rawImportance = entity.importance || entity.rank || entity.role;
  const mappedRank = rankFrom(rawRank) || '平平无奇';
  const mappedImportance = importanceFrom(rawImportance) || '未知';

  entity.power_rank = mappedRank;
  entity.importance = mappedImportance;
  preserveLegacy(entity, 'rank', 'legacy_rank', entity.rank, mappedRank);
  entity.rank = mappedRank;
  if (!rankFrom(rawRank)) appendNote(entity, `unresolved power rank: ${clean(rawRank) || '<blank>'}`);
  if (!importanceFrom(rawImportance)) appendNote(entity, `unresolved importance: ${clean(rawImportance) || '<blank>'}`);

  return { entity, changed: hasChanged(input, entity) };
}

function normalizeItem(input) {
  const entity = { ...input };
  const original = entity.rarity_tier || entity.rarity;
  const mapped = rarityFrom(original) || '未知';

  entity.rarity_tier = mapped;
  preserveLegacy(entity, 'rarity', 'legacy_rarity', entity.rarity, mapped);
  entity.rarity = mapped;
  if (!rarityFrom(original)) appendNote(entity, `unresolved rarity: ${clean(original) || '<blank>'}`);

  return { entity, changed: hasChanged(input, entity) };
}

module.exports = {
  RANK_VALUES,
  CHARACTER_IMPORTANCE_VALUES,
  ITEM_RARITY_VALUES,
  rankFrom,
  importanceFrom,
  rarityFrom,
  normalizeSkill,
  normalizeCharacter,
  normalizeItem,
};
