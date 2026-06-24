#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sanitizeNovelFile } = require('./sanitizer');

function makeNovelDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wuxia-preclean-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function fileText(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(err.stack || err.message);
    process.exitCode = 1;
  }
}

test('no-change files still write preclean snapshot and reports', () => {
  const novelDir = makeNovelDir();
  const charactersPath = path.join(novelDir, 'characters.json');
  writeJson(charactersPath, [
    { id: 'duan_yu', name: '段誉', role: '核心', relationships: [] },
  ]);

  sanitizeNovelFile({ novelDir, fileName: 'characters.json', fileKind: 'characters' });

  const precleanPath = path.join(novelDir, 'archive/preclean/characters.json');
  const reportPath = path.join(novelDir, 'archive/reports/characters.sanitize-report.json');
  const pendingPath = path.join(novelDir, 'archive/reports/characters.pending.json');

  assert.equal(fileText(precleanPath), fileText(charactersPath));
  assert.equal(readJson(reportPath).summary.changed_records, 0);
  assert.deepEqual(readJson(pendingPath), []);
});

test('ambiguous dialogue speaker_name is pending instead of silently ignored', () => {
  const novelDir = makeNovelDir();
  const charactersPath = path.join(novelDir, 'characters.json');
  writeJson(charactersPath, [
    { id: 'duan_yu', name: '段誉', alias: ['段郎'] },
    { id: 'other_duan', name: '段郎' },
  ]);
  writeJson(path.join(novelDir, 'dialogues.json'), [
    { chapter: 1, line_start: 1, speaker_name: '段郎', text: '你来了。', tone: '陈述' },
  ]);

  sanitizeNovelFile({
    novelDir,
    fileName: 'dialogues.json',
    fileKind: 'dialogues',
    companionFiles: { characters: charactersPath },
  });

  const pending = readJson(path.join(novelDir, 'archive/reports/dialogues.pending.json'));
  assert.equal(pending.length, 1);
  assert.equal(pending[0].reason, 'speaker_name_ambiguous');
});

test('faction dedup rewrites exact old characters.faction references', () => {
  const novelDir = makeNovelDir();
  const charactersPath = path.join(novelDir, 'characters.json');
  writeJson(charactersPath, [
    { id: 'you_tanzhi', name: '游坦之', faction: ' 星宿派 ' },
  ]);
  writeJson(path.join(novelDir, 'factions.json'), [
    { id: 'f1', name: '星宿派', type: '武林门派', location: '西域', source_refs: [] },
    { id: 'f2', name: ' 星宿派 ', type: '武林门派', location: '西域', source_refs: [] },
  ]);

  sanitizeNovelFile({
    novelDir,
    fileName: 'factions.json',
    fileKind: 'factions',
    companionFiles: { characters: charactersPath },
  });

  const characters = readJson(charactersPath);
  assert.equal(characters[0].faction, '星宿派');
});

test('item owner IDs redirected from character merged_ids are repaired', () => {
  const novelDir = makeNovelDir();
  const charactersPath = path.join(novelDir, 'characters.json');
  writeJson(charactersPath, [
    { id: 'duan_yu', name: '段誉', merged_ids: ['old_duan_yu'] },
  ]);
  writeJson(path.join(novelDir, 'items.json'), [
    { id: 'item1', name: '折扇', type: 'weapon', owner: 'old_duan_yu', rarity_tier: '未知' },
  ]);

  sanitizeNovelFile({
    novelDir,
    fileName: 'items.json',
    fileKind: 'items',
    companionFiles: { characters: charactersPath },
  });

  const items = readJson(path.join(novelDir, 'items.json'));
  assert.equal(items[0].owner, 'duan_yu');
});

test('orphan technique attaches only to unique skill name and otherwise becomes pending', () => {
  const novelDir = makeNovelDir();
  const skillsPath = path.join(novelDir, 'skills.json');
  writeJson(skillsPath, [
    { id: 'skill_a', name: '六脉神剑' },
    { id: 'skill_b', name: '六脉神剑' },
  ]);
  writeJson(path.join(novelDir, 'techniques.json'), [
    { id: 't1', name: '六脉神剑', type: 'attack' },
    { id: 't2', name: '北冥神功', type: 'internal' },
  ]);

  sanitizeNovelFile({
    novelDir,
    fileName: 'techniques.json',
    fileKind: 'techniques',
    companionFiles: { skills: skillsPath },
  });

  const techniques = readJson(path.join(novelDir, 'techniques.json'));
  const pending = readJson(path.join(novelDir, 'archive/reports/techniques.pending.json'));

  assert.equal(techniques[0].source_skill, undefined);
  assert.deepEqual(pending.map((p) => p.reason), ['source_skill_name_ambiguous', 'orphan_source_skill_unmatched']);
});
