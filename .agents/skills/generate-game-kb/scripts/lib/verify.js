'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { CATEGORY_FILES } = require('./finalize');
const { MATERIAL_TYPES } = require('./game-materials');
const { atomicWriteJson, readJson } = require('./io');
const { buildQualitySample, selectQualitySample, validateQualityReview } = require('./quality');

const ID_PATTERN = /^(char|event|item|skill|tech|faction|loc|dialogue)_[a-z]+(?:_[a-z]+)*$/;
const FILE_PREFIX = Object.freeze({
  'characters.json': 'char_',
  'events.json': 'event_',
  'items.json': 'item_',
  'skills.json': 'skill_',
  'techniques.json': 'tech_',
  'factions.json': 'faction_',
  'locations.json': 'loc_',
  'dialogues.json': 'dialogue_'
});

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

function hashFinalData(finalData) {
  const ordered = Object.fromEntries(Object.values(CATEGORY_FILES).sort()
    .map(filename => [filename, finalData[filename] || []]));
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(stableValue(ordered))).digest('hex')}`;
}

function loadData(dataRoot) {
  const data = {};
  const errors = [];
  for (const filename of Object.values(CATEGORY_FILES)) {
    const file = path.join(dataRoot, filename);
    if (!fs.existsSync(file)) {
      errors.push({ code: 'FINAL_FILE_MISSING', path: filename, target: '' });
      data[filename] = [];
      continue;
    }
    try {
      const records = readJson(file);
      if (!Array.isArray(records)) {
        errors.push({ code: 'FINAL_FILE_NOT_ARRAY', path: filename, target: '' });
        data[filename] = [];
      } else {
        data[filename] = records;
      }
    } catch (error) {
      errors.push({ code: 'FINAL_FILE_JSON_INVALID', path: filename, target: error.message });
      data[filename] = [];
    }
  }
  return { data, errors };
}

function readReport(file, missingCode, invalidCode, blockingErrors) {
  if (file && typeof file === 'object') return file;
  if (!fs.existsSync(file)) {
    blockingErrors.push({ code: missingCode, path: file, target: '' });
    return null;
  }
  try {
    return readJson(file);
  } catch (error) {
    blockingErrors.push({ code: invalidCode, path: file, target: error.message });
    return null;
  }
}

function verifyFinal(paths) {
  const blockingErrors = [];
  const warnings = [];
  let manifest;
  try {
    manifest = readJson(paths.manifest);
  } catch (error) {
    blockingErrors.push({ code: 'MANIFEST_INVALID', path: paths.manifest, target: error.message });
    manifest = { chapters: [] };
  }
  const chapterNumbers = new Set((Array.isArray(manifest.chapters) ? manifest.chapters : [])
    .map(chapter => chapter.number));
  const loaded = loadData(paths.finalData);
  blockingErrors.push(...loaded.errors);
  const finalData = loaded.data;
  const finalDataHash = hashFinalData(finalData);

  if (paths.candidateResolution && typeof paths.candidateResolution === 'object') {
    if (paths.candidateResolution.passed !== true) {
      blockingErrors.push({ code: 'CANDIDATE_RESOLUTION_INCOMPLETE', path: 'candidate-resolution.json', target: '' });
    }
  } else if (typeof paths.candidateResolution === 'string' && fs.existsSync(paths.candidateResolution)) {
    const resolution = readReport(
      paths.candidateResolution,
      'CANDIDATE_RESOLUTION_MISSING',
      'CANDIDATE_RESOLUTION_INVALID',
      blockingErrors
    );
    if (resolution && resolution.passed !== true) {
      blockingErrors.push({ code: 'CANDIDATE_RESOLUTION_INCOMPLETE', path: paths.candidateResolution, target: '' });
    }
  }
  if (paths.acceptedHashes && typeof paths.acceptedHashes === 'object' && paths.acceptedHashes.stale === true) {
    blockingErrors.push({ code: 'ACCEPTED_ARTIFACT_MUTATED', path: 'artifact-manifest.json', target: '' });
  }
  const ids = new Map();
  let approximateLines = 0;

  function validateSourceRefs(record, label) {
    if (!Array.isArray(record?.source_refs) || record.source_refs.length === 0) {
      blockingErrors.push({ code: 'SOURCE_REFS_REQUIRED', path: `${label}.source_refs`, target: '' });
      return;
    }
    record.source_refs.forEach((ref, index) => {
      const refPath = `${label}.source_refs[${index}]`;
      if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
        blockingErrors.push({ code: 'SOURCE_REF_INVALID', path: refPath, target: '' });
        return;
      }
      if (!chapterNumbers.has(ref.chapter)) {
        blockingErrors.push({ code: 'SOURCE_CHAPTER_UNKNOWN', path: `${refPath}.chapter`, target: ref.chapter });
      }
      if (typeof ref.text !== 'string' || ref.text.trim() === '') {
        blockingErrors.push({ code: 'SOURCE_TEXT_REQUIRED', path: `${refPath}.text`, target: '' });
      }
      if (!Number.isInteger(ref.line_start) || !Number.isInteger(ref.line_end)) approximateLines += 1;
    });
  }

  for (const [filename, prefix] of Object.entries(FILE_PREFIX)) {
    finalData[filename].forEach((record, index) => {
      const label = `${filename}[${index}]`;
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        blockingErrors.push({ code: 'FINAL_RECORD_INVALID', path: label, target: '' });
        return;
      }
      if (typeof record.id !== 'string' || !ID_PATTERN.test(record.id) || !record.id.startsWith(prefix)) {
        blockingErrors.push({ code: 'FINAL_ID_INVALID', path: `${label}.id`, target: record.id });
      } else if (ids.has(record.id)) {
        blockingErrors.push({ code: 'FINAL_ID_DUPLICATE', path: `${label}.id`, target: record.id });
      } else {
        ids.set(record.id, filename);
      }
      if (filename !== 'dialogues.json' && (typeof record.name !== 'string' || record.name.trim() === '')) {
        blockingErrors.push({ code: 'FINAL_NAME_REQUIRED', path: `${label}.name`, target: record.id });
      }
      if (filename === 'dialogues.json' && (typeof record.text !== 'string' || record.text.trim() === '')) {
        blockingErrors.push({ code: 'DIALOGUE_TEXT_REQUIRED', path: `${label}.text`, target: record.id });
      }
      validateSourceRefs(record, label);
    });
  }

  const idSets = Object.fromEntries(Object.keys(FILE_PREFIX).map(filename => [
    filename,
    new Set(finalData[filename].map(record => record?.id).filter(Boolean))
  ]));
  function reference(filename, target, refPath, optional = false) {
    if ((target === null || target === undefined || target === '') && optional) return;
    if (typeof target !== 'string' || !idSets[filename].has(target)) {
      blockingErrors.push({ code: 'REFERENCE_UNRESOLVED', path: refPath, target });
    }
  }
  function references(filename, values, refPath) {
    if (!Array.isArray(values)) return;
    values.forEach((target, index) => reference(filename, target, `${refPath}[${index}]`));
  }

  finalData['characters.json'].forEach((record, index) => {
    reference('factions.json', record.faction, `characters[${index}].faction`, true);
    for (const [relationIndex, relation] of (record.relationships || []).entries()) {
      reference('characters.json', relation?.target, `characters[${index}].relationships[${relationIndex}].target`);
    }
    references('skills.json', record.known_skills || record.skills, `characters[${index}].known_skills`);
    references('items.json', record.items, `characters[${index}].items`);
  });
  finalData['events.json'].forEach((record, index) => {
    references('characters.json', record.participants, `events[${index}].participants`);
    references('locations.json', record.locations, `events[${index}].locations`);
  });
  finalData['items.json'].forEach((record, index) => {
    if (record.owner) {
      const valid = idSets['characters.json'].has(record.owner) || idSets['factions.json'].has(record.owner);
      if (!valid) blockingErrors.push({ code: 'REFERENCE_UNRESOLVED', path: `items[${index}].owner`, target: record.owner });
    }
    references('characters.json', record.related_characters, `items[${index}].related_characters`);
    references('skills.json', record.related_skills, `items[${index}].related_skills`);
  });
  finalData['skills.json'].forEach((record, index) => {
    reference('factions.json', record.faction, `skills[${index}].faction`, true);
    references('characters.json', record.holders, `skills[${index}].holders`);
    references('techniques.json', record.techniques, `skills[${index}].techniques`);
  });
  finalData['techniques.json'].forEach((record, index) => {
    reference('skills.json', record.source_skill || record.skill, `techniques[${index}].source_skill`, true);
  });
  finalData['factions.json'].forEach((record, index) => {
    reference('locations.json', record.location, `factions[${index}].location`, true);
    reference('characters.json', record.leader, `factions[${index}].leader`, true);
    references('characters.json', record.members, `factions[${index}].members`);
  });
  finalData['locations.json'].forEach((record, index) => {
    references('factions.json', record.factions, `locations[${index}].factions`);
    references('characters.json', record.characters, `locations[${index}].characters`);
  });
  const dialogueEvents = new Set();
  finalData['dialogues.json'].forEach((record, index) => {
    reference('events.json', record.event_id, `dialogues[${index}].event_id`);
    if (typeof record.event_id === 'string') {
      if (dialogueEvents.has(record.event_id)) {
        blockingErrors.push({
          code: 'DIALOGUE_EVENT_DUPLICATE',
          path: `dialogues[${index}].event_id`,
          target: record.event_id
        });
      }
      dialogueEvents.add(record.event_id);
    }
    reference('characters.json', record.speaker, `dialogues[${index}].speaker`);
    reference('characters.json', record.listener, `dialogues[${index}].listener`, true);
    if (!chapterNumbers.has(record.chapter)) {
      blockingErrors.push({ code: 'DIALOGUE_CHAPTER_UNKNOWN', path: `dialogues[${index}].chapter`, target: record.chapter });
    }
    if (Array.isArray(record.source_refs)
      && !record.source_refs.some(ref => ref?.chapter === record.chapter)) {
      blockingErrors.push({
        code: 'DIALOGUE_SOURCE_CHAPTER_MISMATCH',
        path: `dialogues[${index}].source_refs`,
        target: record.chapter
      });
    }
  });

  const summaries = finalData['chapter_summaries.json'];
  const summaryChapters = new Set();
  summaries.forEach((summary, index) => {
    const label = `chapter_summaries[${index}]`;
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
      blockingErrors.push({ code: 'CHAPTER_SUMMARY_INVALID', path: label, target: '' });
      return;
    }
    if (!chapterNumbers.has(summary.chapter)) {
      blockingErrors.push({ code: 'SUMMARY_CHAPTER_UNKNOWN', path: `${label}.chapter`, target: summary.chapter });
    } else if (summaryChapters.has(summary.chapter)) {
      blockingErrors.push({ code: 'SUMMARY_CHAPTER_DUPLICATE', path: `${label}.chapter`, target: summary.chapter });
    } else {
      summaryChapters.add(summary.chapter);
    }
    if (typeof summary.summary !== 'string' || summary.summary.trim() === '') {
      blockingErrors.push({ code: 'SUMMARY_TEXT_REQUIRED', path: `${label}.summary`, target: summary.chapter });
    }
    references('events.json', summary.key_events, `${label}.key_events`);
    references('characters.json', summary.key_characters, `${label}.key_characters`);
    validateSourceRefs(summary, label);
  });
  for (const chapter of chapterNumbers) {
    if (!summaryChapters.has(chapter)) {
      blockingErrors.push({ code: 'SUMMARY_CHAPTER_MISSING', path: 'chapter_summaries.json', target: chapter });
    }
  }

  const materials = readReport(
    paths.gameMaterials, 'GAME_MATERIALS_MISSING', 'GAME_MATERIALS_INVALID', blockingErrors
  );
  if (materials) {
    if (!Array.isArray(materials.entries)) {
      blockingErrors.push({ code: 'GAME_MATERIALS_ENTRIES_REQUIRED', path: paths.gameMaterials, target: '' });
    } else {
      materials.entries.forEach((entry, index) => {
        const label = `game_materials.entries[${index}]`;
        if (entry && typeof entry === 'object' && ('entity' in entry || 'record' in entry)) {
          blockingErrors.push({
            code: 'MATERIAL_EMBEDDED_ENTITY_FORBIDDEN',
            path: label,
            target: entry.source_id
          });
        }
        if (!MATERIAL_TYPES.has(entry?.material_type)) {
          blockingErrors.push({ code: 'MATERIAL_TYPE_INVALID', path: `${label}.material_type`, target: entry?.material_type });
        }
        if (!ids.has(entry?.source_id)) {
          blockingErrors.push({ code: 'MATERIAL_SOURCE_UNRESOLVED', path: `${label}.source_id`, target: entry?.source_id });
        }
        for (const field of ['relevance', 'suggested_use', 'reason']) {
          if (typeof entry?.[field] !== 'string' || entry[field].trim() === '') {
            blockingErrors.push({ code: 'MATERIAL_FIELD_REQUIRED', path: `${label}.${field}`, target: entry?.source_id });
          }
        }
      });
    }
  }

  const quantity = readReport(
    paths.quantityReport, 'QUANTITY_REPORT_MISSING', 'QUANTITY_REPORT_INVALID', blockingErrors
  );
  if (quantity) {
    if (quantity.review_consumed !== true) {
      blockingErrors.push({ code: 'QUANTITY_REVIEW_NOT_CONSUMED', path: 'quantity_report.review_consumed', target: '' });
    }
    if (Array.isArray(quantity.warnings)) warnings.push(...quantity.warnings);
  }

  const sample = readReport(paths.qualitySample, 'QUALITY_SAMPLE_MISSING', 'QUALITY_SAMPLE_INVALID', blockingErrors);
  if (sample && sample.final_data_hash !== finalDataHash) {
    blockingErrors.push({ code: 'QUALITY_SAMPLE_STALE', path: 'quality_sample.final_data_hash', target: sample.final_data_hash });
  }
  if (sample && Array.isArray(sample.items)) {
    const expectedSample = sample?.quotas
      ? buildQualitySample(finalData, {}, { seed: manifest.source_hash }).items
      : selectQualitySample(finalData, manifest.source_hash);
    if (JSON.stringify(sample.items) !== JSON.stringify(expectedSample)) {
      blockingErrors.push({ code: 'QUALITY_SAMPLE_INVALID_SELECTION', path: 'quality_sample.items', target: '' });
    }
    if (sample.categories && typeof sample.categories === 'object') {
      for (const [category, details] of Object.entries(sample.categories)) {
        if (details?.kind !== 'empty-review-required') continue;
        const review = details.review;
        const valid = review?.status === 'none_found' || review?.conclusion === 'none_found';
        if (!valid) {
          blockingErrors.push({ code: 'EMPTY_CATEGORY_REVIEW_REQUIRED', path: `quality_sample.categories.${category}`, target: category });
        }
      }
    }
  }
  const quality = readReport(
    paths.qualityReport, 'QUALITY_REVIEW_REQUIRED', 'QUALITY_REPORT_INVALID', blockingErrors
  );
  if (quality) {
    if (quality.final_data_hash !== finalDataHash) {
      blockingErrors.push({ code: 'QUALITY_REPORT_STALE', path: 'quality_report.final_data_hash', target: quality.final_data_hash });
    }
    if (sample && Array.isArray(sample.items)) {
      const assessment = validateQualityReview({ schema_version: 1, results: quality.results }, sample.items);
      if (assessment.errors.length > 0) {
        blockingErrors.push({ code: 'QUALITY_REPORT_INVALID', path: paths.qualityReport, target: assessment.errors });
      } else if (!assessment.passed || quality.passed !== true) {
        blockingErrors.push({ code: 'QUALITY_SAMPLE_FAILED', path: paths.qualityReport, target: quality.pass_count });
      }
    }
  }

  const manual = readReport(paths.manualReview, 'MANUAL_REVIEW_MISSING', 'MANUAL_REVIEW_INVALID', blockingErrors);
  if (manual && (!Array.isArray(manual) || manual.length > 0)) {
    blockingErrors.push({ code: 'MANUAL_REVIEW_BLOCKS_FINAL', path: paths.manualReview, target: Array.isArray(manual) ? manual.length : '' });
  }
  if (approximateLines > 0) warnings.push({ code: 'SOURCE_LINE_APPROXIMATE', count: approximateLines });

  return {
    passed: blockingErrors.length === 0,
    final_data_hash: finalDataHash,
    counts: Object.fromEntries(Object.entries(finalData).map(([filename, records]) => [filename, records.length])),
    blocking_errors: blockingErrors,
    warnings
  };
}

function ensureQualitySample(paths, manifest) {
  const loaded = loadData(paths.finalData);
  if (loaded.errors.length > 0) return null;
  const finalDataHash = hashFinalData(loaded.data);
  let expectedSample = null;
  const reviews = {};
  const itemReview = path.join(paths.recalls || '', 'items.json');
  if (paths.recalls && fs.existsSync(itemReview)) {
    try {
      const review = readJson(itemReview);
      reviews.items = review.none_found || review;
    } catch {
      // Invalid category review remains a verification error on the generated sample.
    }
  }
  if (fs.existsSync(paths.qualitySample)) {
    try {
      const existing = readJson(paths.qualitySample);
      expectedSample = existing?.quotas
        ? buildQualitySample(loaded.data, existing.categories || reviews, { seed: manifest.source_hash })
        : { items: selectQualitySample(loaded.data, manifest.source_hash) };
      if (existing.final_data_hash === finalDataHash
        && existing.seed === manifest.source_hash
        && JSON.stringify(existing.items) === JSON.stringify(expectedSample.items)) {
        return existing;
      }
    } catch {
      // A malformed sample is replaced from deterministic final data.
    }
  }
  expectedSample ||= buildQualitySample(loaded.data, reviews, { seed: manifest.source_hash });
  const sample = {
    schema_version: 1,
    final_data_hash: finalDataHash,
    seed: manifest.source_hash,
    ...(expectedSample.quotas ? expectedSample : { items: expectedSample.items })
  };
  atomicWriteJson(paths.qualitySample, sample);
  fs.rmSync(paths.qualityReport, { force: true });
  return sample;
}

module.exports = { ID_PATTERN, ensureQualitySample, hashFinalData, loadData, verifyFinal };
