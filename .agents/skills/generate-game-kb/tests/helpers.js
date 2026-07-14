'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SKILL_ROOT = path.resolve(__dirname, '..');
const FLOW = path.join(SKILL_ROOT, 'scripts', 'flow.js');

function makeNovel(name, source) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-game-kb-'));
  const novel = path.join(parent, name);
  fs.mkdirSync(novel, { recursive: true });
  fs.writeFileSync(path.join(novel, `${name}.txt`), source, 'utf8');
  return novel;
}

function makeNovelDirectory(files) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-game-kb-'));
  const novel = path.join(parent, '试书');
  fs.mkdirSync(novel, { recursive: true });
  for (const [name, content = `${name}\n`] of Object.entries(files)) {
    fs.writeFileSync(path.join(novel, name), content, 'utf8');
  }
  return novel;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function runFlow(args, options = {}) {
  return spawnSync(process.execPath, [FLOW, ...args], {
    cwd: options.cwd || SKILL_ROOT,
    encoding: 'utf8'
  });
}

function sourceRef(chapter = 1, text = '原文锚点') {
  return { chapter, text };
}

function validChapterDraft(overrides = {}) {
  const draft = {
    schema_version: 1,
    chapter: 1,
    title: '第一章 起始',
    source_hash: 'sha256:chapter',
    characters: [{ local_key: 'character:甲', name: '甲', level: '核心', source_refs: [sourceRef()] }],
    events: [{ local_key: 'event:相逢', name: '山中相逢', importance: '重要', source_refs: [sourceRef()] }],
    items: [],
    skills: [{ local_key: 'skill:内功', name: '玄门内功', source_refs: [sourceRef()] }],
    techniques: [{ local_key: 'technique:飞掌', name: '飞云掌', named_in_source: true, source_refs: [sourceRef()] }],
    factions: [],
    locations: [{ local_key: 'location:山谷', name: '无名山谷', source_refs: [sourceRef()] }],
    dialogues: [{ local_key: 'dialogue:相逢', event_local_key: 'event:相逢', speaker_name: '甲', text: '你来了。', source_refs: [sourceRef()] }],
    summary: {
      title: '第一章 起始',
      summary: '甲在山谷中与故人相逢。',
      key_events: ['event:相逢'],
      key_characters: ['甲'],
      source_refs: [sourceRef()]
    }
  };
  return { ...draft, ...overrides };
}

module.exports = {
  FLOW,
  makeNovel,
  makeNovelDirectory,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft
};
