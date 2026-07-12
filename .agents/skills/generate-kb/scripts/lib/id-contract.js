'use strict';

const CATEGORY_PREFIXES = Object.freeze({
  character: 'char_',
  faction: 'faction_',
  location: 'loc_',
  skill: 'skill_',
  technique: 'tech_',
  item: 'item_',
  event: 'event_',
  dialogue: 'dialogue_'
});

const ID_BODY_SOURCE = '[a-z]+(?:_[a-z]+)*';
const ID_PATTERNS = Object.freeze(Object.fromEntries(
  Object.entries(CATEGORY_PREFIXES).map(([category, prefix]) => [
    category,
    new RegExp(`^${prefix}${ID_BODY_SOURCE}$`)
  ])
));

const CANDIDATE_ID_PATTERN = /^cand_ch\d{3}_w\d{3}_\d{4}$/;
const WINDOW_ID_PATTERN = /^ch\d{3}_w\d{3}$/;

function isValidId(value, category) {
  const pattern = ID_PATTERNS[category];
  return typeof value === 'string' && Boolean(pattern) && pattern.test(value);
}

function isValidIdForAnyCategory(value, categories) {
  return categories.some(category => isValidId(value, category));
}

function expectedIdFormat(category) {
  const prefix = CATEGORY_PREFIXES[category];
  return prefix ? `${prefix}<lowercase_pinyin_words>` : '<known category ID>';
}

module.exports = {
  CANDIDATE_ID_PATTERN,
  CATEGORY_PREFIXES,
  ID_PATTERNS,
  WINDOW_ID_PATTERN,
  expectedIdFormat,
  isValidId,
  isValidIdForAnyCategory
};
