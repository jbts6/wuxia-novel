'use strict';

const HIGH_PRIORITY_CATEGORIES = Object.freeze([
  'characters',
  'events',
  'items',
  'skills',
  'techniques'
]);
const LOW_PRIORITY_CATEGORIES = Object.freeze([
  'factions',
  'chapter_summaries'
]);
const HIGH_PRIORITY_SET = new Set(HIGH_PRIORITY_CATEGORIES);
const LOW_PRIORITY_SET = new Set(LOW_PRIORITY_CATEGORIES);
const HIGH_PRIORITY_QUALITY_GROUPS = new Set([
  'martial',
  'skills_techniques',
  'events',
  'characters',
  'items'
]);

function isHighPriorityCategory(category) {
  return HIGH_PRIORITY_SET.has(category);
}

function isLowPriorityCategory(category) {
  return LOW_PRIORITY_SET.has(category);
}

function isHighPriorityQualityItem(item) {
  return isHighPriorityCategory(item?.category)
    || HIGH_PRIORITY_QUALITY_GROUPS.has(item?.group);
}

module.exports = {
  HIGH_PRIORITY_CATEGORIES,
  LOW_PRIORITY_CATEGORIES,
  isHighPriorityCategory,
  isHighPriorityQualityItem,
  isLowPriorityCategory
};
