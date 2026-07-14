'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { pathsFor } = require('../scripts/lib/paths');
const { resolveRun } = require('../scripts/lib/run');

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

function writeStagingDraft(novel, unit, value, attempt) {
  const run = resolveRun(novel);
  const paths = pathsFor(novel, run.run_id);
  const progress = readJson(paths.progress);
  const number = attempt ?? ((progress.units[unit]?.attempts ?? 0) + 1);
  const file = path.join(
    paths.staging,
    `${unit.replaceAll(':', '_')}_attempt_${String(number).padStart(2, '0')}.json`
  );
  fs.writeFileSync(file, JSON.stringify(value), 'utf8');
  return file;
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
    events: [{
      local_key: 'event:相逢', name: '山中相逢', importance: '重要', quote_status: 'quotable',
      source_refs: [sourceRef()]
    }],
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
    },
    coverage: {}
  };
  return { ...draft, ...overrides };
}

function validMergedBook(overrides = {}) {
  return {
    schema_version: 1,
    stage: 'merged',
    characters: [{
      local_key: 'character:甲', canonical_name: '甲', aliases: [], level: '核心', identity: '侠客',
      biography: '甲在江湖中追查旧事。', personality: { traits: ['坚毅'], speech_style: '简练' },
      relationship_names: [], skill_names: ['玄门内功'], item_names: [], source_refs: [sourceRef(1)]
    }],
    events: [{
      local_key: 'event:相逢', canonical_name: '山中相逢', cause: '追查线索', process: '山谷会面', result: '交换消息',
      participant_names: ['甲'], location_names: ['无名山谷'], importance: '重要', source_refs: [sourceRef(1), sourceRef(3)]
    }],
    items: [{
      local_key: 'item:灵丹', canonical_name: '回生丹', inclusion_reason: '高级药毒', type: '丹药',
      description: '用于救治重伤。', source_refs: [sourceRef(2)]
    }],
    skills: [{
      local_key: 'skill:内功', canonical_name: '玄门内功', type: '内功', description: '调息养气。',
      holder_names: ['甲'], technique_names: ['飞云掌'], source_refs: [sourceRef(1)]
    }],
    techniques: [{
      local_key: 'technique:飞掌', canonical_name: '飞云掌', named_in_source: true,
      source_skill_name: '玄门内功', description: '掌势迅疾。', source_refs: [sourceRef(1)]
    }],
    factions: [{
      local_key: 'faction:玄门', canonical_name: '玄门', type: '门派', description: '隐居山中。', source_refs: [sourceRef(1)]
    }],
    locations: [{
      local_key: 'location:山谷', canonical_name: '无名山谷', region: '北地', description: '群山环抱。', source_refs: [sourceRef(1)]
    }],
    dialogues: [{
      local_key: 'dialogue:相逢', event_key: 'event:相逢', speaker_name: '甲', chapter: 1,
      text: '你终于来了。', source_refs: [sourceRef(1)]
    }],
    chapter_summaries: [1, 2, 3].map(chapter => ({
      chapter,
      title: `第${chapter}章`,
      summary: `第${chapter}章摘要。`,
      key_events: chapter === 1 ? ['山中相逢'] : [],
      key_characters: ['甲'],
      source_refs: [sourceRef(chapter)]
    })),
    candidate_resolutions: [],
    ambiguities: [],
    ...overrides
  };
}

function validCleanedBook(overrides = {}) {
  return validMergedBook({
    stage: 'cleaned',
    quantity_review: { consumed: true, explanations: ['数量只作一次提醒，未为凑数新增条目。'] },
    game_material_candidates: [
      { material_type: '战斗系统原型', source_category: 'skills', source_name: '玄门内功', relevance: '高', suggested_use: '内功原型', reason: '原著明确命名。' }
    ],
    ...overrides
  });
}

module.exports = {
  FLOW,
  makeNovel,
  makeNovelDirectory,
  readJson,
  runFlow,
  sourceRef,
  writeStagingDraft,
  validChapterDraft,
  validCleanedBook,
  validMergedBook
};
