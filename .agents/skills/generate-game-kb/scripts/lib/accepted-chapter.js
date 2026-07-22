'use strict';

const { deriveSourceRefs } = require('./grounding');
const { normalizeTypeArray } = require('./type-taxonomy');

function acceptedSourceRefs(refs, expected) {
  return deriveSourceRefs(refs, {
    chapterNumber: expected.number,
    chapterText: expected.chapterText
  });
}

function normalizeAcceptedEntity(category, record, index, expected, typeCategories, normalizations) {
  const entity = {
    ...record,
    local_key: `${category.slice(0, -1)}:${record.name}`
  };
  if (Array.isArray(entity.source_refs)) {
    entity.source_refs = acceptedSourceRefs(entity.source_refs, expected);
  }
  if (typeCategories.has(category) && Array.isArray(entity.types)) {
    const result = normalizeTypeArray(category, entity.types, `$.${category}[${index}].types`);
    entity.types = result.values;
    normalizations.push(...result.normalizations);
  }
  return entity;
}

function buildAcceptedChapter(draft, expected, { candidateArrays, typeCategories }) {
  const normalizations = [];
  const chapter = {
    schema_version: 7,
    chapter: expected.number,
    title: expected.title,
    source_hash: expected.inputHash
  };
  for (const category of candidateArrays) {
    chapter[category] = (Array.isArray(draft[category]) ? draft[category] : [])
      .map((record, index) => normalizeAcceptedEntity(
        category, record, index, expected, typeCategories, normalizations
      ));
  }
  chapter.chapter_summary = {
    ...draft.chapter_summary,
    ...(Array.isArray(draft.chapter_summary?.source_refs)
      ? { source_refs: acceptedSourceRefs(draft.chapter_summary.source_refs, expected) }
      : {})
  };
  chapter.normalizations = normalizations;
  return { chapter, normalizations };
}

module.exports = { buildAcceptedChapter };
