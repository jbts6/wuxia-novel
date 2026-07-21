'use strict';

const SEMANTIC_CONTRACT_VERSION = 7;
const SEMANTIC_PROFILE = 'chapter-direct-v1';
const DOMAIN_UNITS = Object.freeze([
  'distill:factions',
  'distill:characters',
  'distill:skills',
  'distill:items'
]);
const NO_DOMAIN_UNITS = Object.freeze([]);
const SUPPORTED_SEMANTIC_CONTRACT_VERSIONS = new Set([SEMANTIC_CONTRACT_VERSION]);
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
const ITEM_TYPES = Object.freeze(['武器', '防具', '秘籍', '丹药', '暗器', '坐骑', '异兽', '饰品', '其他']);
const ITEM_INCLUSION_REASONS = Object.freeze([
  '秘籍', '剧情关键', '高级药毒', '神兵利器', '其他稀有特殊'
]);

function entityFieldContract({ fields, arrays, nullable, requiredStrings, forbidden }) {
  return Object.freeze({
    fields: Object.freeze(fields),
    arrays: Object.freeze(arrays),
    nullable: Object.freeze(nullable),
    requiredStrings: Object.freeze(requiredStrings),
    forbidden: Object.freeze(forbidden)
  });
}

const ENTITY_FIELD_CONTRACTS = Object.freeze({
  characters: entityFieldContract({
    fields: ['id', 'name', 'aliases', 'identities', 'level', 'rank', 'description', 'factions', 'skills'],
    arrays: ['aliases', 'identities', 'factions', 'skills'],
    nullable: ['level', 'rank', 'description'],
    requiredStrings: ['id', 'name'],
    forbidden: [
      'identity', 'biography', 'faction', 'items', 'personality', 'relationships',
      'relationship_names', 'skill_names', 'item_names'
    ]
  }),
  skills: entityFieldContract({
    fields: ['id', 'name', 'aliases', 'types', 'factions', 'rank', 'description', 'techniques'],
    arrays: ['aliases', 'types', 'factions', 'techniques'],
    nullable: ['rank', 'description'],
    requiredStrings: ['id', 'name'],
    forbidden: ['type', 'faction', 'holders', 'users', 'holder_names', 'user_names']
  }),
  items: entityFieldContract({
    fields: ['id', 'name', 'aliases', 'type', 'description'],
    arrays: ['aliases'],
    nullable: ['type', 'description'],
    requiredStrings: ['id', 'name'],
    forbidden: ['holder', 'holders', 'owner', 'owners', 'holder_names', 'owner_name']
  }),
  factions: entityFieldContract({
    fields: ['id', 'name', 'aliases', 'type', 'description'],
    arrays: ['aliases'],
    nullable: ['type', 'description'],
    requiredStrings: ['id', 'name'],
    forbidden: ['member', 'members', 'member_names']
  })
});
const FINAL_FIELDS = Object.freeze({
  characters: ENTITY_FIELD_CONTRACTS.characters.fields,
  skills: ENTITY_FIELD_CONTRACTS.skills.fields,
  items: ENTITY_FIELD_CONTRACTS.items.fields,
  factions: ENTITY_FIELD_CONTRACTS.factions.fields,
  chapter_summaries: Object.freeze(['chapter', 'title', 'summary'])
});
const POWER_RANK_SET = new Set(POWER_RANKS);
const PLACEHOLDER_VALUES = new Set(['未知', '其他', '暂无描述', '不详', 'unknown', 'n/a', 'none']);

function entityIssue(code, path, target = '') {
  return { code, path, target };
}

function isPlaceholderValue(value, field) {
  if (field === 'type') return false;
  return typeof value === 'string' && PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

function validateEntitySemantics(category, record, options = {}) {
  const contract = ENTITY_FIELD_CONTRACTS[category];
  if (!contract) throw new RangeError(`Unknown entity category: ${String(category)}`);
  if (!record || typeof record !== 'object' || Array.isArray(record)) return [];

  const label = options.label || category;
  const allowed = new Set(contract.fields);
  if (options.includeId !== true) allowed.delete('id');
  for (const field of options.stageFields || []) allowed.add(field);

  const errors = [];
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) {
      errors.push(entityIssue('ENTITY_FIELD_FORBIDDEN', `${label}.${field}`, field));
    }
  }

  for (const field of contract.requiredStrings) {
    if (field === 'id' && options.includeId !== true) continue;
    const value = record[field];
    if (options.requireStrings === true && (typeof value !== 'string' || value.trim() === '')) {
      errors.push(entityIssue('ENTITY_STRING_REQUIRED', `${label}.${field}`, value));
    } else if (typeof value === 'string' && value.trim() === '') {
      errors.push(entityIssue('ENTITY_VALUE_EMPTY', `${label}.${field}`, value));
    } else if (isPlaceholderValue(value, field)) {
      errors.push(entityIssue('ENTITY_VALUE_PLACEHOLDER', `${label}.${field}`, value));
    }
  }

  for (const field of contract.arrays) {
    const value = record[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      errors.push(entityIssue('ENTITY_ARRAY_INVALID', `${label}.${field}`, value));
      continue;
    }
    if (field === 'techniques') {
      value.forEach((technique, index) => {
        const techniquePath = `${label}.techniques[${index}]`;
        if (!technique || typeof technique !== 'object' || Array.isArray(technique)) {
          errors.push(entityIssue('TECHNIQUE_INVALID', techniquePath, technique));
          return;
        }
        const actualFields = Object.keys(technique).sort();
        const expectedFields = ['description', 'name'];
        if (options.requireTechniqueFields === true
          && JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
          errors.push(entityIssue('TECHNIQUE_FIELDS_INVALID', techniquePath, actualFields.join(',')));
        }
        if (typeof technique.name !== 'string' || technique.name.trim() === '') {
          errors.push(entityIssue('TECHNIQUE_NAME_REQUIRED', `${techniquePath}.name`, technique.name));
        } else if (isPlaceholderValue(technique.name, 'name')) {
          errors.push(entityIssue('ENTITY_VALUE_PLACEHOLDER', `${techniquePath}.name`, technique.name));
        }
        if (technique.description !== undefined && technique.description !== null
          && (typeof technique.description !== 'string' || technique.description.trim() === '')) {
          errors.push(entityIssue(
            'TECHNIQUE_DESCRIPTION_INVALID',
            `${techniquePath}.description`,
            technique.description
          ));
        } else if (isPlaceholderValue(technique.description, 'description')) {
          errors.push(entityIssue(
            'ENTITY_VALUE_PLACEHOLDER',
            `${techniquePath}.description`,
            technique.description
          ));
        }
      });
      if (options.rejectDuplicates === true) {
        const names = value.map(technique => technique?.name).filter(name => typeof name === 'string');
        if (new Set(names).size !== names.length) {
          errors.push(entityIssue('ENTITY_ARRAY_DUPLICATE', `${label}.techniques`));
        }
      }
      continue;
    }
    value.forEach((entry, index) => {
      const path = `${label}.${field}[${index}]`;
      if (typeof entry !== 'string' || entry.trim() === '') {
        errors.push(entityIssue('ENTITY_VALUE_EMPTY', path, entry));
      } else if (isPlaceholderValue(entry, field)) {
        errors.push(entityIssue('ENTITY_VALUE_PLACEHOLDER', path, entry));
      }
    });
    if (options.rejectDuplicates === true && new Set(value).size !== value.length) {
      errors.push(entityIssue('ENTITY_ARRAY_DUPLICATE', `${label}.${field}`));
    }
  }

  for (const field of contract.nullable) {
    const value = record[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(entityIssue('ENTITY_VALUE_EMPTY', `${label}.${field}`, value));
    } else if (isPlaceholderValue(value, field)) {
      errors.push(entityIssue('ENTITY_VALUE_PLACEHOLDER', `${label}.${field}`, value));
    }
  }
  return errors;
}

function normalizeEntitySemantics(category, record) {
  const contract = ENTITY_FIELD_CONTRACTS[category];
  if (!contract) throw new RangeError(`Unknown entity category: ${String(category)}`);
  const normalized = { ...record };
  for (const field of contract.arrays) {
    if (normalized[field] === undefined) normalized[field] = [];
  }
  for (const field of contract.nullable) {
    if (normalized[field] === undefined) normalized[field] = null;
  }
  if (category === 'skills' && Array.isArray(normalized.techniques)) {
    normalized.techniques = normalized.techniques.map(technique => (
      technique && typeof technique === 'object' && !Array.isArray(technique)
        ? { ...technique, description: technique.description ?? null }
        : technique
    ));
  }
  return normalized;
}

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
  return DOMAIN_UNITS;
}

function requiredDomainUnitsForMode(deep, version) {
  requiredDomainUnitsForContract(version);
  if (typeof deep !== 'boolean') {
    const error = new TypeError(`Deep mode must be boolean: ${String(deep)}`);
    error.code = 'DEEP_MODE_INVALID';
    error.deep = deep;
    throw error;
  }
  return deep ? DOMAIN_UNITS : NO_DOMAIN_UNITS;
}

module.exports = {
  CHARACTER_LEVELS,
  DOMAIN_UNITS,
  ENTITY_FIELD_CONTRACTS,
  FINAL_FIELDS,
  FINAL_FILES,
  ITEM_INCLUSION_REASONS,
  ITEM_TYPES,
  POWER_RANK_CONTRACT,
  POWER_RANKS,
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE,
  isPowerRank,
  normalizeEntitySemantics,
  requiredDomainUnitsForContract,
  requiredDomainUnitsForMode,
  validateEntitySemantics
};
