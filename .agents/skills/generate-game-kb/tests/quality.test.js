'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, validCleanedBook } = require('./helpers');
const { buildFinalData } = require('../scripts/lib/finalize');
const { buildGameMaterials } = require('../scripts/lib/game-materials');
const { atomicWriteJson } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');
const { buildQualitySample, selectQualitySample, validateQualityReview } = require('../scripts/lib/quality');
const { ensureQualitySample, hashFinalData, verifyFinal } = require('../scripts/lib/verify');

function makeRecords(prefix, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}_${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`,
    name: `${prefix}-${index}`,
    source_refs: [{ chapter: 1, text: '原文锚点' }]
  }));
}

function sampleData(counts = {}) {
  return {
    'characters.json': makeRecords('char', counts.characters ?? 10),
    'events.json': makeRecords('event', counts.events ?? 20),
    'items.json': makeRecords('item', counts.items ?? 10),
    'skills.json': makeRecords('skill', counts.skills ?? 10),
    'techniques.json': makeRecords('tech', counts.techniques ?? 10),
    'factions.json': makeRecords('faction', counts.factions ?? 10),
    'locations.json': makeRecords('loc', counts.locations ?? 0),
    'dialogues.json': makeRecords('dialogue', counts.dialogues ?? 0),
    'chapter_summaries.json': []
  };
}

function reviewFor(sample, passing) {
  return {
    schema_version: 1,
    results: sample.map((item, index) => {
      const passed = index < passing;
      return {
        id: item.id,
        passed,
        checks: { name: passed, category: passed, key_facts: passed, chapter: passed },
        notes: passed ? '' : '关键事实与原文不符'
      };
    })
  };
}

test('game-material entries reference existing final IDs only', () => {
  const manifest = { chapters: [1, 2, 3].map(number => ({ number })) };
  const book = validCleanedBook();
  const finalData = buildFinalData(book, manifest).data;
  const valid = buildGameMaterials(finalData, book.game_material_candidates);
  assert.equal(valid.issues.length, 0);
  assert.equal(valid.entries[0].source_id, 'skill_xuan_men_nei_gong');

  const invalid = buildGameMaterials(finalData, [{
    material_type: '标志性物品', source_category: 'items', source_name: '不存在之物',
    relevance: '高', suggested_use: '物品彩蛋', reason: '测试'
  }]);
  assert.ok(invalid.issues.some(issue => issue.code === 'MATERIAL_SOURCE_UNRESOLVED'));
});

test('sample uses fixed category quotas and stable seed ordering', () => {
  const data = sampleData();
  const first = selectQualitySample(data, 'fixed-seed');
  const reversed = Object.fromEntries(Object.entries(data).map(([file, records]) => [file, [...records].reverse()]));
  const second = selectQualitySample(reversed, 'fixed-seed');
  const counts = first.reduce((result, item) => ({ ...result, [item.group]: (result[item.group] || 0) + 1 }), {});

  assert.deepEqual(first, second);
  assert.deepEqual(counts, { martial: 15, events: 10, characters: 5, items: 5, other: 5 });
});

test('non-reallocating quality sample keeps every category quota fixed', () => {
  const data = sampleData({ skills: 30, techniques: 30, events: 30, characters: 30, items: 0, dialogues: 0, factions: 30, locations: 30 });
  const sample = buildQualitySample(data, { seed: 'fixed' });
  assert.deepEqual(sample.quotas, {
    skills_techniques: 12,
    events: 8,
    characters: 5,
    items: 5,
    dialogues: 4,
    factions_locations: 4,
    chapter_summaries: 2
  });
  assert.equal(sample.categories.items.kind, 'empty-review-required');
  assert.equal(sample.categories.dialogues.kind, 'empty-review-required');
  assert.equal(sample.categories.items.count, 0);
  assert.equal(sample.total_checks, 40);
  assert.equal(sample.items.some(item => item.group === 'items'), false);
});

test('short category quota is redistributed deterministically', () => {
  const sample = selectQualitySample(sampleData({ skills: 1, techniques: 1, events: 30 }), 'fixed-seed');
  const counts = sample.reduce((result, item) => ({ ...result, [item.group]: (result[item.group] || 0) + 1 }), {});

  assert.equal(sample.length, 40);
  assert.equal(counts.martial, 2);
  assert.equal(counts.events, 23);
});

test('standard sample passes at 38 of 40 and fails at 37', () => {
  const sample = selectQualitySample(sampleData(), 'fixed-seed');
  assert.equal(validateQualityReview(reviewFor(sample, 38), sample).passed, true);
  const failed = validateQualityReview(reviewFor(sample, 37), sample);
  assert.equal(failed.passed, false);
  assert.equal(failed.threshold, 38);
});

test('small sample requires ceil(n * 0.95) passes', () => {
  const sample = selectQualitySample(sampleData({
    characters: 2, events: 1, items: 1, skills: 1, techniques: 1, factions: 1
  }), 'small-seed');
  assert.equal(sample.length, 7);
  assert.equal(validateQualityReview(reviewFor(sample, 7), sample).passed, true);
  assert.equal(validateQualityReview(reviewFor(sample, 6), sample).passed, false);
});

test('quality review rejects missing duplicate or inconsistent sample rows', () => {
  const sample = selectQualitySample(sampleData({
    characters: 1, events: 1, items: 1, skills: 1, techniques: 0, factions: 1
  }), 'small-seed');
  const review = reviewFor(sample, sample.length);
  review.results[1].id = review.results[0].id;
  review.results[0].checks.chapter = false;

  const result = validateQualityReview(review, sample);
  assert.ok(result.errors.some(issue => issue.code === 'QUALITY_RESULT_DUPLICATE'));
  assert.ok(result.errors.some(issue => issue.code === 'QUALITY_PASS_INCONSISTENT'));
});

function writeVerifiedFixture() {
  const novel = makeNovel('验收书', '第一章 起始\n甲。\n第二章 转折\n乙。\n第三章 收束\n丙。\n');
  const run = createOrResumeRun(novel, { runId: 'run-quality-test' });
  const paths = pathsFor(novel, run.run_id);
  const manifest = {
    schema_version: 1,
    source_hash: 'sha256:source',
    source_char_count: 3,
    chapters: [1, 2, 3].map(number => ({ number, title: `第${number}章`, input_hash: `sha256:${number}` }))
  };
  atomicWriteJson(paths.manifest, manifest);
  atomicWriteJson(paths.manualReview, []);
  const cleaned = validCleanedBook();
  const built = buildFinalData(cleaned, manifest);
  fs.mkdirSync(paths.finalData, { recursive: true });
  for (const [filename, records] of Object.entries(built.data)) {
    atomicWriteJson(path.join(paths.finalData, filename), records);
  }
  const materials = buildGameMaterials(built.data, cleaned.game_material_candidates);
  atomicWriteJson(paths.gameMaterials, { schema_version: 1, entries: materials.entries });
  atomicWriteJson(paths.quantityReport, {
    schema_version: 1,
    review_consumed: true,
    warnings: [{ code: 'QUANTITY_OUTSIDE_GUIDANCE' }]
  });
  const sample = selectQualitySample(built.data, manifest.source_hash);
  const finalDataHash = hashFinalData(built.data);
  atomicWriteJson(paths.qualitySample, { schema_version: 1, final_data_hash: finalDataHash, seed: manifest.source_hash, items: sample });
  const assessment = validateQualityReview(reviewFor(sample, sample.length), sample);
  atomicWriteJson(paths.qualityReport, { ...assessment.report, final_data_hash: finalDataHash });
  return { paths, built };
}

test('line precision and quantity warnings never block chapter-valid data', () => {
  const { paths } = writeVerifiedFixture();
  const result = verifyFinal(paths);

  assert.equal(result.passed, true, JSON.stringify(result.blocking_errors));
  assert.ok(result.warnings.some(issue => issue.code === 'SOURCE_LINE_APPROXIMATE'));
  assert.ok(result.warnings.some(issue => issue.code === 'QUANTITY_OUTSIDE_GUIDANCE'));
});

test('verify regenerates a manipulated fixed sample and invalidates its old review', () => {
  const { paths } = writeVerifiedFixture();
  const manifest = JSON.parse(fs.readFileSync(paths.manifest, 'utf8'));
  const manipulated = JSON.parse(fs.readFileSync(paths.qualitySample, 'utf8'));
  manipulated.items.reverse();
  atomicWriteJson(paths.qualitySample, manipulated);

  const repaired = ensureQualitySample(paths, manifest);
  assert.notDeepEqual(repaired.items, manipulated.items);
  assert.equal(fs.existsSync(paths.qualityReport), false);
});

test('verify rejects missing arrays IDs refs summaries and dialogue event links', () => {
  const { paths } = writeVerifiedFixture();
  const dialogues = JSON.parse(fs.readFileSync(path.join(paths.finalData, 'dialogues.json'), 'utf8'));
  dialogues[0].event_id = 'event_missing';
  dialogues[0].chapter = 2;
  dialogues.push({ ...structuredClone(dialogues[0]), id: 'dialogue_extra' });
  atomicWriteJson(path.join(paths.finalData, 'dialogues.json'), dialogues);
  const materials = JSON.parse(fs.readFileSync(paths.gameMaterials, 'utf8'));
  materials.entries[0].entity = { invented: true };
  atomicWriteJson(paths.gameMaterials, materials);

  const result = verifyFinal(paths);
  assert.equal(result.passed, false);
  assert.ok(result.blocking_errors.some(issue => issue.code === 'REFERENCE_UNRESOLVED'));
  assert.ok(result.blocking_errors.some(issue => issue.code === 'DIALOGUE_EVENT_DUPLICATE'));
  assert.ok(result.blocking_errors.some(issue => issue.code === 'DIALOGUE_SOURCE_CHAPTER_MISMATCH'));
  assert.ok(result.blocking_errors.some(issue => issue.code === 'MATERIAL_EMBEDDED_ENTITY_FORBIDDEN'));
  assert.ok(result.blocking_errors.some(issue => issue.code === 'QUALITY_REPORT_STALE'));
});
