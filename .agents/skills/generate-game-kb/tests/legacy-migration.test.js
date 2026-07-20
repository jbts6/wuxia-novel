'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { deferredPathsFor, pathsFor } = require('../scripts/lib/paths');
const { verifyFinal } = require('../scripts/lib/verify');
const {
  buildLegacyCandidate,
  planLegacyMigration
} = require('../scripts/lib/legacy-migration');

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
  const chapters = path.join(novel, '.game-kb-work', 'runs', 'legacy-source', 'source', 'chapters');
  writeChapter(chapters, 1, '第一章 快剑\n阿飞拔剑出手。\n快剑出鞘。\n江湖会声名远播。\n');
  writeChapter(chapters, 2, '第二章 铁剑\n铁剑在手。\n独行客握剑。\n');
  writeLegacyFixture(novel);
  return novel;
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
