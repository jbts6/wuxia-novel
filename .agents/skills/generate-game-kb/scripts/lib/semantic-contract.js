'use strict';

const SEMANTIC_CONTRACT_VERSION = 3;
const SEMANTIC_PROFILE = 'domain-distill-v1';
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
const POWER_RANK_SET = new Set(POWER_RANKS);

function isPowerRank(value) {
  return typeof value === 'string' && POWER_RANK_SET.has(value);
}

module.exports = {
  POWER_RANKS,
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE,
  isPowerRank
};
