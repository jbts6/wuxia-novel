'use strict';

const SEMANTIC_CONTRACT_VERSION = 5;
const SEMANTIC_PROFILE = 'domain-distill-v1';
const LEGACY_DOMAIN_CONTRACT_VERSION = 4;
const PROFILE_V4 = 'v4';
const PROFILE_V5 = 'v5';
const SUPPORTED_PROFILES = new Set([PROFILE_V4, PROFILE_V5]);
const DOMAIN_UNITS = Object.freeze([
  'distill:factions',
  'distill:characters',
  'distill:skills',
  'distill:items'
]);
const NO_DOMAIN_UNITS = Object.freeze([]);
const SUPPORTED_SEMANTIC_CONTRACT_VERSIONS = new Set([
  LEGACY_DOMAIN_CONTRACT_VERSION,
  SEMANTIC_CONTRACT_VERSION
]);
const FINAL_FILES = Object.freeze({
  characters: 'characters.yaml',
  skills: 'skills.yaml',
  items: 'items.yaml',
  factions: 'factions.yaml',
  chapter_summaries: 'chapter_summaries.yaml'
});
const POWER_RANK_SCALE = Object.freeze([
  Object.freeze({ rank: '平平无奇', standard: '没有可靠证据证明具备稳定的武学实战能力。' }),
  Object.freeze({ rank: '初窥门径', standard: '掌握入门方法，但直接表现有限且容易被有经验者压制。' }),
  Object.freeze({ rank: '略有小成', standard: '已有可重复的实战能力，能够稳定运用所学应对一般对手。' }),
  Object.freeze({ rank: '登堂入室', standard: '达到成熟高手层次，并有多次可靠的直接表现支撑。' }),
  Object.freeze({ rank: '炉火纯青', standard: '技艺高度纯熟，面对多数成名高手仍能稳定发挥。' }),
  Object.freeze({ rank: '出神入化', standard: '武学运用超越常规高手，可靠战果显示出显著层级优势。' }),
  Object.freeze({ rank: '登峰造极', standard: '处于全书极少数巅峰层次，只有同级强者或特殊条件能够抗衡。' }),
  Object.freeze({ rank: '返璞归真', standard: '全书证据稳定支持的最高境界，表现已臻自然无迹且未被后文推翻。' })
]);
const POWER_RANKS = Object.freeze(POWER_RANK_SCALE.map(entry => entry.rank));
const POWER_RANK_CONTRACT = Object.freeze({
  scope: 'complete_book_timeline',
  aggregation: 'stable_judgment_not_chapter_maximum',
  evidence_priority: Object.freeze([
    '后期的直接战果、真实失败、被克制与反转优先于早期描写。',
    '当场可核验的行动与结果优先于旁观者评价。',
    '传闻、自述和身份光环不能单独支持高 rank。'
  ]),
  character_rule: '人物 rank 是读取全书完整时间线后，结局时仍可稳定支持的综合战力判断。',
  skill_rule: '武功 rank 是该武功本身经可靠使用者展示、且未被后文推翻的稳定上限。',
  scale: POWER_RANK_SCALE
});
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

function requiredDomainUnitsForContract(version) {
  if (!SUPPORTED_SEMANTIC_CONTRACT_VERSIONS.has(version)) {
    const error = new RangeError(`Unsupported semantic contract version: ${String(version)}`);
    error.code = 'SEMANTIC_CONTRACT_VERSION_UNSUPPORTED';
    error.version = version;
    throw error;
  }
  return version === LEGACY_DOMAIN_CONTRACT_VERSION ? DOMAIN_UNITS : NO_DOMAIN_UNITS;
}

function requiredDomainUnitsForProfile(profile, version) {
  requiredDomainUnitsForContract(version);
  if (!SUPPORTED_PROFILES.has(profile)) {
    const error = new RangeError(`Unsupported game-kb profile: ${String(profile)}`);
    error.code = 'SEMANTIC_PROFILE_UNSUPPORTED';
    error.profile = profile;
    throw error;
  }
  return profile === PROFILE_V4 ? DOMAIN_UNITS : NO_DOMAIN_UNITS;
}

module.exports = {
  CHARACTER_LEVELS,
  DOMAIN_UNITS,
  FINAL_FIELDS,
  FINAL_FILES,
  ITEM_TYPES,
  POWER_RANK_CONTRACT,
  POWER_RANKS,
  PROFILE_V4,
  PROFILE_V5,
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE,
  SUPPORTED_PROFILES,
  isPowerRank,
  requiredDomainUnitsForContract,
  requiredDomainUnitsForProfile
};
