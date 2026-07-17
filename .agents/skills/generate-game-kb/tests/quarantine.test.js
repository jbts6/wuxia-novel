'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { pathsFor } = require('../scripts/lib/paths');
const { quarantineRecord } = require('../scripts/lib/quarantine');
const { resolveRun } = require('../scripts/lib/run');
const {
  makeNovel,
  parseJsonLine,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft,
  writeStagingDraft
} = require('./helpers');

test('writes immutable run-scoped YAML quarantine records', () => {
  const novel = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-quarantine-'));
  const paths = pathsFor(novel, 'run-grounded');
  const input = {
    unit: 'chapter:003',
    category: 'characters',
    record: { local_key: 'character:乙', name: '乙', source_refs: [sourceRef(3, '甲拔剑。')] },
    errors: [{ code: 'SOURCE_NAME_NOT_FOUND', path: 'characters[1].name', target: '乙' }],
    inputHash: 'sha256:chapter-three'
  };

  const file = quarantineRecord(paths, input);
  const firstBytes = fs.readFileSync(file, 'utf8');
  const repeated = quarantineRecord(paths, input);

  assert.equal(file, repeated);
  assert.equal(fs.readFileSync(file, 'utf8'), firstBytes);
  assert.equal(path.relative(paths.quarantine, file).startsWith('..'), false);
  const value = yaml.load(firstBytes);
  assert.equal(value.unit, input.unit);
  assert.equal(value.category, input.category);
  assert.equal(value.record.name, '乙');
  assert.deepEqual(value.errors, input.errors);
});

test('accepts valid chapter records while quarantining ungrounded siblings', () => {
  const novel = makeNovel('证据试书', '第一章 起始\n甲拔剑。\n');
  assert.equal(runFlow(['prepare', novel, '--run', 'run-grounded', '--json']).status, 0);
  const run = resolveRun(novel, 'run-grounded');
  const paths = pathsFor(novel, run.run_id);
  const chapter = readJson(paths.manifest).chapters[0];
  const draft = validChapterDraft({
    title: chapter.title,
    source_hash: chapter.input_hash,
    characters: [
      {
        local_key: 'character:甲', name: '甲', level: '核心', rank: '初窥门径',
        source_refs: [sourceRef(1, '甲拔剑。')]
      },
      {
        local_key: 'character:乙', name: '乙', level: '次要', rank: '平平无奇',
        source_refs: [sourceRef(1, '甲拔剑。')]
      }
    ],
    items: [],
    skills: [],
    factions: [],
    chapter_summary: {
      title: chapter.title,
      summary: '甲在本章拔剑。',
      source_refs: [sourceRef(1, '甲拔剑。')]
    }
  });
  const draftFile = writeStagingDraft(novel, 'chapter:001', draft);

  const result = runFlow([
    'accept', novel, '--run', run.run_id, '--unit', 'chapter:001', '--draft', draftFile, '--json'
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, 'done');
  assert.equal(output.quarantine_files.length, 1);
  const accepted = yaml.load(fs.readFileSync(path.join(paths.chapters, 'ch_001.yaml'), 'utf8'));
  assert.deepEqual(accepted.characters.map(entry => entry.name), ['甲']);
  const quarantine = yaml.load(fs.readFileSync(output.quarantine_files[0], 'utf8'));
  assert.equal(quarantine.record.name, '乙');
  assert.deepEqual(quarantine.errors.map(error => error.code), ['SOURCE_NAME_NOT_FOUND']);
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 1);
});

test('document-level chapter identity errors do not create quarantine files', () => {
  const novel = makeNovel('错误章节试书', '第一章 起始\n甲拔剑。\n');
  assert.equal(runFlow(['prepare', novel, '--run', 'run-document-error', '--json']).status, 0);
  const paths = pathsFor(novel, 'run-document-error');
  const chapter = readJson(paths.manifest).chapters[0];
  const draft = validChapterDraft({
    chapter: 2,
    source_hash: chapter.input_hash,
    characters: [{
      local_key: 'character:乙', name: '乙', level: '次要', rank: '平平无奇',
      source_refs: [sourceRef(1, '甲拔剑。')]
    }],
    items: [], skills: [], factions: [],
    chapter_summary: {
      title: chapter.title, summary: '摘要。', source_refs: [sourceRef(1, '甲拔剑。')]
    }
  });
  const draftFile = writeStagingDraft(novel, 'chapter:001', draft);

  const result = runFlow([
    'accept', novel, '--run', 'run-document-error', '--unit', 'chapter:001', '--draft', draftFile, '--json'
  ]);

  assert.notEqual(result.status, 0);
  assert.equal(parseJsonLine(result.stderr).code, 'DRAFT_REJECTED');
  assert.equal(fs.existsSync(paths.quarantine), false);
});
