'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { pathsFor } = require('../scripts/lib/paths');
const { runFlow, readJson } = require('./helpers');

const SOURCE_RUN = 'run-jian-shen-yi-xiao-v4-real-20260718';
const SOURCE_NOVEL = path.resolve(__dirname, '..', '..', '..', '..', '古龙', '剑神一笑');

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    } else {
      throw new Error(`Unsupported fixture entry: ${sourcePath}`);
    }
  }
}

function copyLegacyNovel() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-import-'));
  const novel = path.join(root, '古龙', '剑神一笑');
  fs.mkdirSync(path.dirname(novel), { recursive: true });
  copyDirectory(SOURCE_NOVEL, novel);
  return novel;
}

function pass(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

function prepareTarget(novel) {
  return pass(runFlow(['prepare', novel, '--run', 'run-v6-import-target', '--json']), 'prepare target');
}

function directoryHashes(root) {
  const hashes = {};
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      const relative = path.relative(root, file).split(path.sep).join('/');
      if (entry.isDirectory()) {
        visit(file);
      } else if (entry.isFile()) {
        hashes[relative] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      } else {
        throw new Error(`Unsupported fixture entry: ${file}`);
      }
    }
  }
  visit(root);
  return hashes;
}

test('import-chapters converts the real 20-chapter v5 run into a fresh v6 run', () => {
  const novel = copyLegacyNovel();
  const target = prepareTarget(novel);
  const sourcePaths = pathsFor(novel, SOURCE_RUN);
  const sourceBefore = directoryHashes(sourcePaths.run);

  const imported = pass(runFlow([
    'import-chapters', novel,
    '--from-run', SOURCE_RUN,
    '--run', target.run_id,
    '--confirm', '--json'
  ]), 'import');

  assert.equal(imported.chapter_count, 20);
  assert.equal(imported.semantic_contract_version, 6);
  assert.match(imported.source_run_id, /run-jian-shen-yi-xiao-v4-real/);
  const targetPaths = pathsFor(novel, target.run_id);
  const migrationReceipt = path.join(targetPaths.reports, 'chapter-import-receipt.json');
  const progress = readJson(targetPaths.progress);
  assert.equal(Object.values(progress.units).filter(unit => unit.status === 'done').length, 20);
  assert.equal(fs.existsSync(migrationReceipt), true);
  const receipt = readJson(migrationReceipt);
  assert.equal(receipt.source_run_id, SOURCE_RUN);
  assert.equal(receipt.chapters.length, 20);
  assert.equal(receipt.chapters.every(chapter => (
    chapter.source_content_hash.startsWith('sha256:')
      && chapter.target_content_hash.startsWith('sha256:')
  )), true);
  assert.deepEqual(directoryHashes(sourcePaths.run), sourceBefore);

  const chapterOne = yaml.load(fs.readFileSync(path.join(targetPaths.chapters, 'ch_001.yaml'), 'utf8'));
  assert.deepEqual(chapterOne.characters[0].aliases, []);
  assert.deepEqual(chapterOne.characters[0].identities, []);
  assert.deepEqual(chapterOne.characters[0].factions, []);
  assert.deepEqual(chapterOne.characters[0].skills, []);
  assert.equal(chapterOne.characters[0].description, null);
  assert.equal(Object.hasOwn(chapterOne.characters[0], 'biography'), false);
  assert.deepEqual(chapterOne.skills[0].types, ['剑法']);
  assert.deepEqual(chapterOne.skills[0].factions, ['faction:巴山']);
  assert.equal(Object.hasOwn(chapterOne.skills[0], 'type'), false);
  assert.equal(Object.hasOwn(chapterOne.skills[0], 'faction'), false);

  const chapterThree = yaml.load(fs.readFileSync(path.join(targetPaths.chapters, 'ch_003.yaml'), 'utf8'));
  assert.equal(Object.hasOwn(chapterThree.items[0], 'inclusion_reason'), false);
  assert.deepEqual(chapterThree.items[0].aliases, []);
  const chapterThirteen = yaml.load(fs.readFileSync(path.join(targetPaths.chapters, 'ch_013.yaml'), 'utf8'));
  assert.deepEqual(chapterThirteen.skills[0].techniques, [{ name: '天外飞仙', description: null }]);
  assert.equal(readJson(targetPaths.artifactManifest).entries.length, 20);
  assert.equal(fs.existsSync(targetPaths.candidateRegistry), false);
  assert.deepEqual(fs.readdirSync(targetPaths.domainDecisions), []);
  assert.equal(fs.existsSync(targetPaths.finalData), false);

  const planned = pass(runFlow(['plan-domains', novel, '--run', target.run_id, '--json']), 'plan domains');
  assert.deepEqual(planned.units, [
    'distill:factions', 'distill:characters', 'distill:skills', 'distill:items'
  ]);
  assert.equal(planned.units.length, 4);
});

test('import-chapters requires explicit confirmation before changing the target run', () => {
  const novel = copyLegacyNovel();
  const target = prepareTarget(novel);
  const result = runFlow([
    'import-chapters', novel,
    '--from-run', SOURCE_RUN,
    '--run', target.run_id,
    '--json'
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /IMPORT_CONFIRM_REQUIRED/);
  assert.equal(fs.existsSync(path.join(pathsFor(novel, target.run_id).reports, 'chapter-import-receipt.json')), false);
});

test('import-chapters rolls back all target bytes after an injected write failure', () => {
  const novel = copyLegacyNovel();
  const target = prepareTarget(novel);
  const targetPaths = pathsFor(novel, target.run_id);
  const before = directoryHashes(targetPaths.run);

  const result = runFlow([
    'import-chapters', novel,
    '--from-run', SOURCE_RUN,
    '--run', target.run_id,
    '--confirm', '--fault-at', 'after-chapter-10', '--json'
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /IMPORT_FAULT_INJECTED/);
  assert.deepEqual(directoryHashes(targetPaths.run), before);
  assert.equal(fs.existsSync(path.join(targetPaths.reports, 'chapter-import-receipt.json')), false);
  assert.equal(fs.existsSync(targetPaths.chapters), false);
});

test('import-chapters rejects malformed target progress without repairing target bytes', () => {
  const novel = copyLegacyNovel();
  const target = prepareTarget(novel);
  const targetPaths = pathsFor(novel, target.run_id);
  const progress = readJson(targetPaths.progress);
  delete progress.units['chapter:001'];
  fs.writeFileSync(targetPaths.progress, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
  const before = directoryHashes(targetPaths.run);

  const result = runFlow([
    'import-chapters', novel,
    '--from-run', SOURCE_RUN,
    '--run', target.run_id,
    '--confirm', '--json'
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CHAPTER_IMPORT_TARGET_NOT_FRESH/);
  assert.deepEqual(directoryHashes(targetPaths.run), before);
  assert.equal(fs.existsSync(targetPaths.chapters), false);
});
