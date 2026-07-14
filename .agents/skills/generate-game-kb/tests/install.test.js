'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, runFlow, validCleanedBook } = require('./helpers');
const { buildFinalData } = require('../scripts/lib/finalize');
const { buildGameMaterials } = require('../scripts/lib/game-materials');
const {
  installVerifiedData,
  recoverInterruptedInstall,
  verifyInstalled
} = require('../scripts/lib/install');
const { atomicWriteJson } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { selectQualitySample, validateQualityReview } = require('../scripts/lib/quality');
const { hashFinalData } = require('../scripts/lib/verify');

const TARGET_FILES = [
  'chapter_summaries.json',
  'characters.json',
  'dialogues.json',
  'events.json',
  'factions.json',
  'items.json',
  'locations.json',
  'skills.json',
  'techniques.json'
];

function writeVerifiedFixture(name = '安装验收书') {
  const novel = makeNovel(name, '第一章 起始\n甲。\n第二章 转折\n乙。\n第三章 收束\n丙。\n');
  const paths = pathsFor(novel);
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
  atomicWriteJson(paths.quantityReport, {
    schema_version: 1,
    review_consumed: true,
    warnings: []
  });
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
  return { novel, paths, finalDataHash };
}

function writeOldData(novel) {
  const data = path.join(novel, 'data');
  fs.mkdirSync(path.join(data, 'legacy'), { recursive: true });
  fs.writeFileSync(path.join(data, 'characters.json'), '[{"id":"old"}]\n', 'utf8');
  fs.writeFileSync(path.join(data, 'notes.txt'), '旧资料\n', 'utf8');
  fs.writeFileSync(path.join(data, 'legacy', 'meta.json'), '{"old":true}\n', 'utf8');
  return data;
}

function directoryDigest(root) {
  const rows = [];
  function walk(current, relative = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const childRelative = path.join(relative, entry.name);
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        rows.push(`dir:${childRelative}`);
        walk(child, childRelative);
      } else {
        rows.push(`file:${childRelative}:${crypto.createHash('sha256').update(fs.readFileSync(child)).digest('hex')}`);
      }
    }
  }
  walk(root);
  return rows;
}

test('install refuses blocking verification failures', () => {
  const { novel, paths } = writeVerifiedFixture();
  atomicWriteJson(path.join(paths.finalData, 'characters.json'), {});

  assert.throws(() => installVerifiedData(novel), error => {
    assert.equal(error.code, 'INSTALL_VERIFICATION_FAILED');
    assert.ok(error.details.blocking_errors.some(issue => issue.code === 'FINAL_FILE_NOT_ARRAY'));
    return true;
  });
  assert.equal(fs.existsSync(path.join(novel, 'data')), false);
});

test('install refuses unresolved manual-review issues', () => {
  const { novel, paths } = writeVerifiedFixture();
  atomicWriteJson(paths.manualReview, [{ code: 'REFERENCE_UNRESOLVED', target: '甲' }]);

  assert.throws(() => installVerifiedData(novel), { code: 'INSTALL_VERIFICATION_FAILED' });
  assert.equal(fs.existsSync(path.join(novel, 'data')), false);
});

test('install preserves unknown non-target data files and directories', () => {
  const { novel } = writeVerifiedFixture();
  writeOldData(novel);

  const receipt = installVerifiedData(novel);

  assert.deepEqual(fs.readdirSync(path.join(novel, 'data')).sort(), [
    ...TARGET_FILES,
    'legacy',
    'notes.txt'
  ].sort());
  assert.equal(fs.readFileSync(path.join(novel, 'data', 'notes.txt'), 'utf8'), '旧资料\n');
  assert.equal(fs.readFileSync(path.join(novel, 'data', 'legacy', 'meta.json'), 'utf8'), '{"old":true}\n');
  assert.deepEqual(receipt.preserved_entries, ['legacy', 'notes.txt']);
});

test('install records but removes REBUILD_REQUIRED.md after success', () => {
  const { novel } = writeVerifiedFixture();
  const data = writeOldData(novel);
  fs.writeFileSync(path.join(data, 'REBUILD_REQUIRED.md'), '旧知识库需要重建\n', 'utf8');

  const receipt = installVerifiedData(novel);

  assert.equal(fs.existsSync(path.join(novel, 'data', 'REBUILD_REQUIRED.md')), false);
  assert.deepEqual(receipt.removed_stale_markers, ['REBUILD_REQUIRED.md']);
  assert.equal(fs.existsSync(path.join(receipt.archive_data, 'REBUILD_REQUIRED.md')), true);
});

test('install backs up the entire previous data directory', () => {
  const { novel } = writeVerifiedFixture();
  const oldData = writeOldData(novel);
  const before = directoryDigest(oldData);

  const receipt = installVerifiedData(novel);

  assert.ok(receipt.archive_data);
  assert.deepEqual(directoryDigest(receipt.archive_data), before);
  assert.equal(fs.readFileSync(path.join(receipt.archive_data, 'characters.json'), 'utf8'), '[{"id":"old"}]\n');
});

test('failure before old-data move leaves data unchanged', () => {
  const { novel } = writeVerifiedFixture();
  const data = writeOldData(novel);
  const before = directoryDigest(data);

  assert.throws(() => installVerifiedData(novel, { faultAt: 'before-old-move' }), {
    code: 'INSTALL_FAULT_INJECTED'
  });

  assert.deepEqual(directoryDigest(data), before);
  assert.equal(fs.existsSync(path.join(novel, 'reports', 'generate_game_kb_install.json')), false);
  assert.equal(fs.readdirSync(novel).some(name => name.startsWith('data.next-generate-game-kb-')), false);
});

test('failure after old-data move restores the archive automatically', () => {
  const { novel } = writeVerifiedFixture();
  const data = writeOldData(novel);
  const before = directoryDigest(data);

  assert.throws(() => installVerifiedData(novel, { faultAt: 'after-old-move' }), {
    code: 'INSTALL_FAULT_INJECTED'
  });

  assert.deepEqual(directoryDigest(data), before);
  assert.equal(fs.existsSync(path.join(novel, 'reports', 'generate_game_kb_install.json')), false);
});

test('recovery fails closed when pending data and archive both exist', () => {
  const { novel } = writeVerifiedFixture();
  const data = writeOldData(novel);
  const archiveData = path.join(novel, '_archive', 'pending-pre-generate-game-kb', 'data');
  fs.mkdirSync(archiveData, { recursive: true });
  fs.writeFileSync(path.join(archiveData, 'old.txt'), 'archive\n', 'utf8');
  const nextData = path.join(novel, 'data.next-generate-game-kb-pending');
  fs.mkdirSync(nextData, { recursive: true });
  const reports = path.join(novel, 'reports');
  fs.mkdirSync(reports, { recursive: true });
  atomicWriteJson(path.join(reports, 'generate_game_kb_install.pending.json'), {
    schema_version: 1,
    phase: 'old_moved',
    data_path: data,
    archive_data: archiveData,
    next_data: nextData,
    original_data_state: 'nonempty'
  });

  assert.throws(() => recoverInterruptedInstall(novel), { code: 'INSTALL_RECOVERY_AMBIGUOUS' });
  assert.equal(fs.existsSync(data), true);
  assert.equal(fs.existsSync(archiveData), true);
});

test('reinstalling the same verified result is idempotent', () => {
  const { novel } = writeVerifiedFixture();
  writeOldData(novel);
  const first = installVerifiedData(novel);
  const receiptFile = path.join(novel, 'reports', 'generate_game_kb_install.json');
  const receiptBefore = fs.readFileSync(receiptFile, 'utf8');
  const archivesBefore = fs.readdirSync(path.join(novel, '_archive')).sort();

  const second = installVerifiedData(novel);

  assert.equal(second.idempotent, true);
  assert.equal(second.installed_at, first.installed_at);
  assert.equal(fs.readFileSync(receiptFile, 'utf8'), receiptBefore);
  assert.deepEqual(fs.readdirSync(path.join(novel, '_archive')).sort(), archivesBefore);
});

test('verify --installed never falls back to complete workspace final artifacts', () => {
  const { novel, paths } = writeVerifiedFixture();
  const installed = runFlow(['install', novel, '--json']);
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(verifyInstalled(novel).passed, true);

  fs.rmSync(path.join(novel, 'data', 'characters.json'));
  assert.equal(fs.existsSync(path.join(paths.finalData, 'characters.json')), true);

  const result = verifyInstalled(novel);
  assert.equal(result.passed, false);
  assert.ok(result.blocking_errors.some(issue => issue.code === 'FINAL_FILE_MISSING'));
  const cli = runFlow(['verify', novel, '--installed', '--json']);
  assert.notEqual(cli.status, 0);
  assert.equal(JSON.parse(cli.stderr).code, 'INSTALLED_VERIFICATION_FAILED');
});
