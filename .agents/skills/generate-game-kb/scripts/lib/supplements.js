'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson } = require('./io');
const { assertAcceptedArtifacts } = require('./candidate-ledger');

function assertCategory(category) {
  if (typeof category !== 'string' || !/^[a-z][a-z_]*$/.test(category)) {
    throw new GameKbError('CATEGORY_INVALID', 'A valid category is required', { category });
  }
}

function draftRecords(draft, category) {
  const records = draft && Array.isArray(draft[category]) ? draft[category] : [];
  return records.filter(record => record && typeof record === 'object' && !Array.isArray(record));
}

function recordKey(record) {
  return record.local_key || record.candidate_key || record.canonical_name || record.name || null;
}

function mergeRecords(existing, additions) {
  const result = Array.isArray(existing) ? existing.map(record => ({ ...record })) : [];
  const keys = new Set(result.map(recordKey).filter(Boolean));
  for (const record of additions) {
    const key = recordKey(record);
    if (key && keys.has(key)) continue;
    result.push({ ...record });
    if (key) keys.add(key);
  }
  return result;
}

function acceptedChapterFiles(paths) {
  if (!fs.existsSync(paths.chapters)) return [];
  return fs.readdirSync(paths.chapters)
    .filter(name => /^ch_\d+\.json$/.test(name))
    .sort()
    .map(name => path.join(paths.chapters, name));
}

function applyRecall(paths, category, acceptedDraft) {
  assertCategory(category);
  if (fs.existsSync(paths.artifactManifest)) assertAcceptedArtifacts(paths);
  const candidates = [];
  for (const file of acceptedChapterFiles(paths)) {
    const chapter = readJson(file);
    for (const record of Array.isArray(chapter?.[category]) ? chapter[category] : []) {
      candidates.push({ ...record, chapter: record.chapter ?? chapter.chapter });
    }
  }
  for (const record of draftRecords(acceptedDraft, category)) candidates.push({ ...record });

  const payload = {
    schema_version: 1,
    projection: 'recall',
    category,
    candidates,
    generated_from: {
      accepted_chapters: acceptedChapterFiles(paths).map(file => path.relative(paths.run, file).split(path.sep).join('/')),
      accepted_recall: true
    }
  };
  atomicWriteJson(paths.materializedCandidates, payload);
  return paths.materializedCandidates;
}

function applySupplement(paths, category, acceptedDraft) {
  assertCategory(category);
  if (fs.existsSync(paths.artifactManifest)) assertAcceptedArtifacts(paths);
  if (!fs.existsSync(paths.merged)) {
    throw new GameKbError('MERGED_BOOK_REQUIRED', 'An accepted merged book is required before supplements');
  }
  const merged = readJson(paths.merged);
  const projection = mergeRecords(merged[category], draftRecords(acceptedDraft, category));
  const payload = {
    ...merged,
    [category]: projection,
    supplement: category
  };
  atomicWriteJson(paths.materializedMerged, payload);
  return paths.materializedMerged;
}

module.exports = { applyRecall, applySupplement, mergeRecords };
