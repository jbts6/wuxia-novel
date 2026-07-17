'use strict';

const SEMANTIC_CONTRACT_VERSION = 4;
const SEMANTIC_PROFILE = 'domain-distill-v1';
const DOMAIN_UNITS = Object.freeze([
  'distill:factions',
  'distill:characters',
  'distill:skills',
  'distill:items'
]);
const FINAL_FILES = Object.freeze({
  characters: 'characters.yaml',
  skills: 'skills.yaml',
  items: 'items.yaml',
  factions: 'factions.yaml',
  chapter_summaries: 'chapter_summaries.yaml'
});
const POWER_RANKS = Object.freeze([
  '平平无奇',
  '初窥门径',
  '略有小成',
  '登堂入室',
  '炉火纯青',
  '出神入化',
  '登峰造极',
  '返璞归真'
]);
const CHARACTER_LEVELS = Object.freeze(['核心', '重要', '次要', '龙套', '背景']);
const ITEM_TYPES = Object.freeze(['武器', '防具', '秘籍', '丹药', '暗器', '其他']);
const FINAL_FIELDS = Object.freeze({
  characters: Object.freeze([
    'id', 'name', 'aliases', 'identity', 'level', 'rank', 'biography', 'faction', 'skills', 'items'
  ]),
  skills: Object.freeze(['id', 'name', 'type', 'faction', 'rank', 'description', 'techniques']),
  items: Object.freeze(['id', 'name', 'type', 'description']),
  factions: Object.freeze(['id', 'name', 'type', 'description']),
  chapter_summaries: Object.freeze(['chapter', 'title', 'summary'])
});
const POWER_RANK_SET = new Set(POWER_RANKS);

function isPowerRank(value) {
  return typeof value === 'string' && POWER_RANK_SET.has(value);
}

module.exports = {
  CHARACTER_LEVELS,
  DOMAIN_UNITS,
  FINAL_FIELDS,
  FINAL_FILES,
  ITEM_TYPES,
  POWER_RANKS,
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE,
  isPowerRank
};
