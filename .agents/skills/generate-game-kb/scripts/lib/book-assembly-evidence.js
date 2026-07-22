'use strict';

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'zh-CN');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort(compareText).map(key => [key, stableValue(value[key])]));
}

function stableMarker(value) {
  return JSON.stringify(stableValue(value));
}

function uniqueInOrder(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const marker = stableMarker(value);
    if (seen.has(marker)) continue;
    seen.add(marker);
    result.push(structuredClone(value));
  }
  return result;
}

function compareSourceRefs(left, right) {
  return (Number(left?.chapter) - Number(right?.chapter))
    || ((Number.isInteger(left?.line_start) ? left.line_start : Number.MAX_SAFE_INTEGER)
      - (Number.isInteger(right?.line_start) ? right.line_start : Number.MAX_SAFE_INTEGER))
    || ((Number.isInteger(left?.line_end) ? left.line_end : Number.MAX_SAFE_INTEGER)
      - (Number.isInteger(right?.line_end) ? right.line_end : Number.MAX_SAFE_INTEGER))
    || compareText(left?.text, right?.text)
    || compareText(stableMarker(left), stableMarker(right));
}

function sortedSourceRefs(refs) {
  return uniqueInOrder(refs || []).sort(compareSourceRefs);
}

function memberRef(category, chapter, entity, index) {
  const local = entity?.candidate_key || entity?.registry_key || entity?.local_key || `${category}:${index}`;
  return `ch${String(chapter).padStart(3, '0')}:${local}`;
}

function orderedMembers(category, chapters) {
  const members = [];
  for (const chapter of chapters) {
    const entities = Array.isArray(chapter?.[category]) ? chapter[category] : [];
    entities.forEach((entity, index) => {
      members.push({
        category,
        chapter: Number(chapter.chapter),
        entity,
        index,
        member_ref: memberRef(category, chapter.chapter, entity, index),
        source_refs: sortedSourceRefs(entity?.source_refs || [])
      });
    });
  }
  return members;
}

function mergeRelations(members, ownerCategory, ownerName, field, targetCategory, provenance) {
  const values = [];
  for (const member of members) {
    for (const targetName of Array.isArray(member.entity?.[field]) ? member.entity[field] : []) {
      values.push(targetName);
      provenance.push({
        owner_category: ownerCategory,
        owner_name: ownerName,
        relation_field: field,
        target_category: targetCategory,
        target_name: targetName,
        member_ref: member.member_ref,
        chapter: member.chapter,
        source_refs: member.source_refs
      });
    }
  }
  return uniqueInOrder(values);
}

module.exports = {
  compareText,
  memberRef,
  mergeRelations,
  orderedMembers,
  sortedSourceRefs,
  stableMarker,
  uniqueInOrder
};
