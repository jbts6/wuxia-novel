'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { deferredPathsFor, pathsFor } = require('../scripts/lib/paths');
const { verifyFinal } = require('../scripts/lib/verify');
const {
  buildLegacyCandidate,
  executeLegacyMigration,
  planLegacyMigration
} = require('../scripts/lib/legacy-migration');
const { verifyInstalled } = require('../scripts/lib/install');

function temporaryNovel() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-migration-'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function writeChapter(root, number, text) {
  const file = path.join(root, `ch_${String(number).padStart(3, '0')}.txt`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function sourceRef(chapter, text) {
  return { chapter, text };
}

function writeLegacyFixture(novel) {
  const data = path.join(novel, 'data');
  writeJson(path.join(data, 'characters.json'), [
    {
      id: 'char_a_fei',
      name: '阿飞',
      faction: '江湖会',
      skills: ['快剑'],
      source_refs: [sourceRef(1, '阿飞拔剑出手。')]
    },
    {
      id: 'char_no_evidence',
      name: '无证据人物',
      source_refs: [sourceRef(1, '原文不存在这句话。')]
    },
    {
      id: 'char_unresolved',
      name: '独行客',
      faction: '不存在的门派',
      source_refs: [sourceRef(2, '独行客握剑。')]
    }
  ]);
  writeJson(path.join(data, 'skills.json'), [{
    id: 'skill_kuai_jian',
    name: '快剑',
    types: ['剑法'],
    source_refs: [sourceRef(1, '快剑出鞘。')]
  }]);
  writeJson(path.join(data, 'items.json'), [{
    id: 'item_tie_jian',
    name: '铁剑',
    type: '武器',
    inclusion_reason: '剧情关键',
    source_refs: [sourceRef(2, '铁剑在手。')]
  }]);
  writeJson(path.join(data, 'factions.json'), [{
    id: 'faction_jiang_hu',
    name: '江湖会',
    type: '帮派',
    source_refs: [sourceRef(1, '江湖会声名远播。')]
  }]);
  writeJson(path.join(data, 'chapter_summaries.json'), [
    { chapter: 1, title: '第一章 快剑', summary: '阿飞拔剑，江湖会现身。', source_refs: [] },
    { chapter: 2, title: '第二章 铁剑', summary: '铁剑在手，独行客上路。', source_refs: [] }
  ]);
}

function writeNovelFixture() {
  const novel = temporaryNovel();
  fs.writeFileSync(path.join(novel, 'fixture-source.txt'), '第一章 快剑\n阿飞拔剑出手。\n第二章 铁剑\n铁剑在手。\n', 'utf8');
  const chapters = path.join(novel, '.game-kb-work', 'runs', 'legacy-source', 'source', 'chapters');
  writeChapter(chapters, 1, '第一章 快剑\n阿飞拔剑出手。\n快剑出鞘。\n江湖会声名远播。\n');
  writeChapter(chapters, 2, '第二章 铁剑\n铁剑在手。\n独行客握剑。\n');
  writeLegacyFixture(novel);
  return novel;
}

function archiveManifest(novel, archiveId) {
  return path.join(novel, '_archive', archiveId, 'archive-manifest.json');
}

test('pathsFor keeps novel identity while placing migration runs under an isolated work root', () => {
  const novel = path.resolve('C:/repo/金庸/书剑恩仇录');
  const workRoot = path.resolve('C:/repo/.game-kb-migration-staging/金庸/书剑恩仇录');
  const paths = pathsFor(novel, 'migration-1', { workRoot });

  assert.equal(paths.novel, novel);
  assert.equal(paths.work, workRoot);
  assert.equal(paths.run, path.join(workRoot, 'runs', 'migration-1'));
  assert.equal(paths.migrationReceipt, path.join(paths.run, 'reports', 'migration-receipt.json'));
});

test('default and deferred paths expose the generic migration receipt without moving existing roots', () => {
  const novel = path.resolve('C:/repo/古龙/陆小凤传奇');
  const active = pathsFor(novel, 'run-active');
  const deferred = deferredPathsFor(novel, 'run-archived');

  assert.equal(active.work, path.join(novel, '.game-kb-work'));
  assert.equal(active.migrationReceipt, path.join(active.run, 'reports', 'migration-receipt.json'));
  assert.equal(deferred.run, path.join(novel, '_archive', 'generate-game-kb', 'run-archived'));
  assert.equal(deferred.migrationReceipt, path.join(deferred.run, 'reports', 'migration-receipt.json'));
});

test('builds and verifies a deterministic isolated V6 candidate from legacy JSON', () => {
  const novel = writeNovelFixture();
  const firstRoot = path.join(novel, '..', `${path.basename(novel)}-staging-a`);
  const secondRoot = path.join(novel, '..', `${path.basename(novel)}-staging-b`);
  try {
    const plan = planLegacyMigration(novel);
    const first = buildLegacyCandidate(plan, {
      stagingRoot: firstRoot,
      runId: 'migration-v6-a'
    });
    const second = buildLegacyCandidate(plan, {
      stagingRoot: secondRoot,
      runId: 'migration-v6-b'
    });

    assert.deepEqual(fs.readdirSync(first.paths.finalData).sort(), [
      'chapter_summaries.yaml',
      'characters.yaml',
      'factions.yaml',
      'items.yaml',
      'skills.yaml'
    ]);
    assert.equal(verifyFinal(first.paths, { profile: 'v4' }).passed, true);
    assert.equal(first.receipt.counts.rejected.characters, 1);
    assert.equal(first.receipt.unresolved_references.length, 1);
    assert.deepEqual(first.hashes.final_data, second.hashes.final_data);
    assert.deepEqual(first.hashes.id_plan, second.hashes.id_plan);
    assert.deepEqual(first.receipt.rejected, second.receipt.rejected);
    assert.deepEqual(first.receipt.unresolved_references, second.receipt.unresolved_references);
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  }
});

test('merges multi-chapter candidates from the same legacy record without guessing identity', () => {
  const novel = writeNovelFixture();
  const stagingRoot = path.join(novel, '..', `${path.basename(novel)}-duplicate-staging`);
  try {
    const chapterTwo = path.join(
      novel, '.game-kb-work', 'runs', 'legacy-source', 'source', 'chapters', 'ch_002.txt'
    );
    fs.appendFileSync(chapterTwo, '阿飞再度拔剑。\n江湖会再度现身。\n', 'utf8');
    const charactersFile = path.join(novel, 'data', 'characters.json');
    const characters = JSON.parse(fs.readFileSync(charactersFile, 'utf8'));
    characters[0].source_refs.push(sourceRef(2, '阿飞再度拔剑。'));
    writeJson(charactersFile, characters);
    const factionsFile = path.join(novel, 'data', 'factions.json');
    const factions = JSON.parse(fs.readFileSync(factionsFile, 'utf8'));
    factions[0].source_refs.push(sourceRef(2, '江湖会再度现身。'));
    writeJson(factionsFile, factions);

    const candidate = buildLegacyCandidate(planLegacyMigration(novel), {
      stagingRoot,
      runId: 'migration-duplicate-legacy-record'
    });
    const finalCharacters = yaml.load(fs.readFileSync(
      path.join(candidate.paths.finalData, 'characters.yaml'), 'utf8'
    ));
    const finalFactions = yaml.load(fs.readFileSync(
      path.join(candidate.paths.finalData, 'factions.yaml'), 'utf8'
    ));
    const aFei = finalCharacters.filter(record => record.name === '阿飞');
    const jiangHu = finalFactions.filter(record => record.name === '江湖会');
    const characterDecisions = yaml.load(fs.readFileSync(
      path.join(candidate.paths.domainDecisions, 'distill_characters.yaml'), 'utf8'
    ));

    assert.equal(aFei.length, 1, JSON.stringify(characterDecisions.decisions));
    assert.equal(jiangHu.length, 1);
    assert.deepEqual(aFei[0].factions, [jiangHu[0].id]);
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
});

test('requires explicit confirmation and leaves the legacy tree untouched in plan mode', () => {
  const novel = writeNovelFixture();
  try {
    const plan = planLegacyMigration(novel);
    assert.throws(
      () => executeLegacyMigration(plan, {
        confirm: false,
        stagingRoot: path.join(novel, '..', `${path.basename(novel)}-staging`),
        runId: 'migration-confirm-required'
      }),
      error => error?.code === 'MIGRATION_CONFIRM_REQUIRED'
    );
    assert.equal(fs.existsSync(path.join(novel, 'data')), true);
    assert.equal(fs.existsSync(path.join(novel, '_archive')), false);
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
  }
});

for (const faultAt of ['after-candidate-write', 'after-archive', 'after-run-promote', 'after-install']) {
  test(`archives the legacy payload after ${faultAt}`, () => {
    const novel = writeNovelFixture();
    const runId = `migration-${faultAt}`;
    const stagingRoot = path.join(novel, '..', `${path.basename(novel)}-${faultAt}-staging`);
    const plan = planLegacyMigration(novel);
    try {
      const result = executeLegacyMigration(plan, {
        confirm: true,
        faultAt,
        runId,
        stagingRoot
      });
      assert.equal(result.report.status, 'archived_after_migration_failure');
      assert.equal(fs.existsSync(path.join(novel, 'data')), false);
      const manifest = JSON.parse(fs.readFileSync(archiveManifest(novel, `${runId}-legacy`), 'utf8'));
      assert.equal(manifest.status, 'archived');
      assert.equal(result.report.archive_manifest, archiveManifest(novel, `${runId}-legacy`));
    } finally {
      fs.rmSync(novel, { recursive: true, force: true });
      fs.rmSync(stagingRoot, { recursive: true, force: true });
    }
  });
}

test('installs and verifies a successful migration after archiving the legacy payload', () => {
  const novel = writeNovelFixture();
  const runId = 'migration-success';
  const stagingRoot = path.join(novel, '..', `${path.basename(novel)}-success-staging`);
  try {
    const result = executeLegacyMigration(planLegacyMigration(novel), {
      confirm: true,
      runId,
      stagingRoot
    });
    assert.equal(result.report.status, 'verified');
    assert.equal(verifyInstalled(novel).passed, true);
    assert.equal(fs.existsSync(path.join(novel, 'data', 'characters.yaml')), true);
    assert.equal(fs.existsSync(archiveManifest(novel, `${runId}-legacy`)), true);
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
});

test('reports archive_failed and preserves legacy data when archive movement rolls back', () => {
  const novel = writeNovelFixture();
  const runId = 'migration-archive-failed';
  const stagingRoot = path.join(novel, '..', `${path.basename(novel)}-archive-failed-staging`);
  try {
    const result = executeLegacyMigration(planLegacyMigration(novel), {
      confirm: true,
      archiveFailAfterMoves: 0,
      runId,
      stagingRoot
    });
    assert.equal(result.report.status, 'archive_failed');
    assert.equal(fs.existsSync(path.join(novel, 'data')), true);
    assert.equal(fs.existsSync(path.join(novel, '_archive', `${runId}-legacy`)), false);
    assert.equal(result.report.archive_manifest, null);
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
});

test('retries from the preserved legacy archive with the same stable run id', () => {
  const novel = writeNovelFixture();
  const runId = 'migration-retry-stable';
  const stagingRoot = path.join(novel, '..', `${path.basename(novel)}-retry-staging`);
  try {
    const failed = executeLegacyMigration(planLegacyMigration(novel), {
      confirm: true,
      faultAt: 'after-run-promote',
      runId,
      stagingRoot
    });
    assert.equal(failed.report.status, 'archived_after_migration_failure');
    const archivedData = path.join(novel, '_archive', `${runId}-legacy`, 'data');

    const retried = executeLegacyMigration(planLegacyMigration(novel, {
      explicitDataRoot: archivedData
    }), {
      confirm: true,
      runId,
      stagingRoot
    });

    assert.equal(retried.report.status, 'verified');
    assert.equal(verifyInstalled(novel).passed, true);
    assert.equal(retried.report.archive_manifest, archiveManifest(novel, `${runId}-legacy`));
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
});
