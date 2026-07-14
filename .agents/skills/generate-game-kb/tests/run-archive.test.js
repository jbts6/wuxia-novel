'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { archiveRun } = require('../scripts/lib/archive');
const { buildFinalData } = require('../scripts/lib/finalize');
const { buildGameMaterials } = require('../scripts/lib/game-materials');
const { installVerifiedData } = require('../scripts/lib/install');
const { atomicWriteJson, readJson } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { selectQualitySample, validateQualityReview } = require('../scripts/lib/quality');
const { createOrResumeRun } = require('../scripts/lib/run');
const { hashFinalData } = require('../scripts/lib/verify');
const { makeNovel, runFlow, validCleanedBook } = require('./helpers');

function installedFixture() {
  const novel = makeNovel('归档验收书', '第一章 起始\n甲。\n第二章 转折\n乙。\n第三章 收束\n丙。\n');
  const run = createOrResumeRun(novel, { runId: 'run-a' });
  const paths = pathsFor(novel, run.run_id);
  const manifest = {
    schema_version: 1,
    source_hash: 'sha256:source',
    source_char_count: 3,
    chapters: [1, 2, 3].map(number => ({
      number,
      title: `第${number}章`,
      input_hash: `sha256:${number}`
    }))
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
  atomicWriteJson(paths.quantityReport, { schema_version: 1, review_consumed: true, warnings: [] });
  const sample = selectQualitySample(built.data, manifest.source_hash);
  const finalDataHash = hashFinalData(built.data);
  atomicWriteJson(paths.qualitySample, {
    schema_version: 1,
    final_data_hash: finalDataHash,
    seed: manifest.source_hash,
    items: sample
  });
  const review = {
    schema_version: 1,
    results: sample.map(item => ({
      id: item.id,
      passed: true,
      checks: { name: true, category: true, key_facts: true, chapter: true },
      notes: ''
    }))
  };
  const assessment = validateQualityReview(review, sample);
  atomicWriteJson(paths.qualityReport, { ...assessment.report, final_data_hash: finalDataHash });
  installVerifiedData(novel, { runId: run.run_id });
  return { novel, paths, runId: run.run_id };
}

function abandonedLegacyFixture() {
  const novel = makeNovel('旧约归档书', '第一章 起始\n甲。\n');
  const run = createOrResumeRun(novel, { runId: 'run-legacy' });
  const paths = pathsFor(novel, run.run_id);
  const metadata = readJson(paths.runJson);
  delete metadata.semantic_contract_version;
  atomicWriteJson(paths.runJson, metadata);
  fs.mkdirSync(paths.drafts, { recursive: true });
  fs.writeFileSync(path.join(paths.drafts, 'failed-merge.json'), '{"failed":true}\n', 'utf8');
  return { novel, paths, runId: run.run_id };
}

test('legacy evidence archival requires confirmation and preserves the complete run', () => {
  const { novel, paths, runId } = abandonedLegacyFixture();
  const denied = runFlow(['archive-abandoned', novel, '--run', runId, '--json']);
  assert.equal(denied.status, 1);
  assert.equal(JSON.parse(denied.stderr).code, 'ABANDON_CONFIRM_REQUIRED');
  assert.equal(fs.existsSync(paths.run), true);

  const confirmed = runFlow(['archive-abandoned', novel, '--run', runId, '--confirm', '--json']);
  assert.equal(confirmed.status, 0, confirmed.stderr);
  const receipt = JSON.parse(confirmed.stdout);
  assert.equal(receipt.status, 'abandoned');
  assert.equal(fs.existsSync(paths.run), false);
  assert.equal(fs.existsSync(path.join(receipt.archive_dir, 'drafts', 'failed-merge.json')), true);
  const abandonment = readJson(path.join(receipt.archive_dir, 'abandonment.json'));
  assert.equal(abandonment.run_id, runId);
  assert.equal(abandonment.semantic_contract_version, null);
  assert.match(abandonment.artifact_manifest_hash, /^sha256:/);
});

test('archive-run moves the complete verified run and keeps installed consumers', () => {
  const { novel, paths, runId } = installedFixture();
  const receipt = archiveRun(novel, runId);
  const archive = path.join(novel, '_archive', 'generate-game-kb', runId);

  assert.equal(receipt.status, 'archived');
  assert.equal(fs.existsSync(paths.run), false);
  assert.equal(fs.existsSync(path.join(archive, 'artifact-manifest.json')), true);
  assert.equal(fs.existsSync(path.join(novel, 'data', 'characters.json')), true);
  assert.equal(fs.existsSync(path.join(novel, 'reports', 'generate_game_kb_install.json')), true);
  assert.equal(readJson(path.join(archive, 'run.json')).archived_at !== undefined, true);
  assert.equal(fs.existsSync(path.join(novel, '.game-kb-work')), false);
});

test('archive-run derives phase durations from persisted unit timestamps', () => {
  const { novel, paths, runId } = installedFixture();
  const metadata = readJson(paths.runJson);
  atomicWriteJson(paths.runJson, {
    ...metadata,
    started_at: '2026-01-01T00:00:00.000Z'
  });
  atomicWriteJson(paths.progress, {
    schema_version: 1,
    units: {
      'chapter:001': { status: 'done', updated_at: '2026-01-01T00:10:00.000Z' },
      'chapter:002': { status: 'done', updated_at: '2026-01-01T00:20:00.000Z' },
      'recall:dialogues': { status: 'done', updated_at: '2026-01-01T00:23:00.000Z' },
      'merge:book': { status: 'done', updated_at: '2026-01-01T00:30:00.000Z' },
      'supplement:items': { status: 'done', updated_at: '2026-01-01T00:32:00.000Z' },
      'clean:book': { status: 'done', updated_at: '2026-01-01T00:40:00.000Z' },
      'quality:sample': { status: 'done', updated_at: '2026-01-01T00:45:00.000Z' }
    },
    history: [],
    updated_at: '2026-01-01T00:45:00.000Z'
  });

  const receipt = archiveRun(novel, runId);
  const archived = readJson(path.join(receipt.archive_dir, 'run.json'));

  assert.equal(archived.phase_durations.chapter_extraction_ms, 20 * 60 * 1000);
  assert.equal(archived.phase_durations.targeted_recall_ms, 5 * 60 * 1000);
  assert.equal(archived.phase_durations.merge_ms, 7 * 60 * 1000);
  assert.equal(archived.phase_durations.clean_ms, 8 * 60 * 1000);
  assert.ok(archived.phase_durations.total_ms >= 45 * 60 * 1000);
});

test('archive-run CLI records its own script duration in the archived run', () => {
  const { novel, paths, runId } = installedFixture();
  const beforeVerify = fs.readFileSync(paths.runJson);
  const preArchiveVerification = runFlow(['verify', novel, '--installed', '--json']);
  assert.equal(preArchiveVerification.status, 0, preArchiveVerification.stderr);
  assert.deepEqual(fs.readFileSync(paths.runJson), beforeVerify);

  const result = runFlow(['archive-run', novel, '--run', runId, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  const archived = readJson(path.join(receipt.archive_dir, 'run.json'));
  assert.ok(archived.phase_durations.script_ms > 0);

  const installed = runFlow(['verify', novel, '--installed', '--json']);
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(JSON.parse(installed.stdout).passed, true);
});
