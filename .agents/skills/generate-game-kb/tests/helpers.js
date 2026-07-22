'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const { sha256 } = require('../scripts/lib/source');

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

function makeTemporaryNovel(chapterCount, options = {}) {
  const name = options.name || `端到端测试书${chapterCount}章`;
  const source = Array.from({ length: chapterCount }, (_, index) => {
    const chapter = index + 1;
    return [
      `第${chapter}章 试炼${chapter}`,
      `侠客${chapter}修习玄门心法${chapter}并使出飞云掌${chapter}。`,
      `侠客${chapter}服下回生丹${chapter}。`,
      `玄门${chapter}隐居山中。`
    ].join('\n');
  }).join('\n');
  return makeNovel(name, `${source}\n`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseJsonLine(text) {
  const line = String(text).split(/\r?\n/).find(value => value.trim() !== '');
  return JSON.parse(line);
}

function runFlow(args, options = {}) {
  return spawnSync(process.execPath, [FLOW, ...args], {
    cwd: options.cwd || SKILL_ROOT,
    encoding: 'utf8',
    input: options.input
  });
}

function sourceRef(chapter = 1, text = '甲') {
  return { chapter, text };
}

function validChapterDraft(overrides = {}) {
  const draft = {
    schema_version: 1,
    chapter: 1,
    title: '第一章 起始',
    source_hash: 'sha256:chapter',
    characters: [{
      local_key: 'character:甲', name: '甲', level: '核心', rank: '初窥门径',
      aliases: [], identities: [], description: null, factions: [], skills: [],
      source_refs: [sourceRef()]
    }],
    items: [],
    skills: [{
      local_key: 'skill:内功', name: '玄门内功', rank: '初窥门径',
      aliases: [], types: [], factions: [], description: null,
      techniques: [{ name: '飞云掌', description: null }],
      source_refs: [sourceRef(1, '甲修习玄门内功并使出飞云掌。')]
    }],
    factions: [],
    chapter_summary: {
      title: '第一章 起始',
      summary: '甲在山谷中与故人相逢。',
      source_refs: [sourceRef()]
    }
  };
  return { ...draft, ...overrides };
}

function replaceAcceptedArtifact(paths, file, value) {
  const content = file.endsWith('.yaml')
    ? yaml.dump(value, { noRefs: true, lineWidth: -1 })
    : `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(file, content, 'utf8');
  const manifest = readJson(paths.artifactManifest);
  const relativePath = path.relative(paths.run, file).split(path.sep).join('/');
  const entry = manifest.entries.find(item => item.relative_path === relativePath);
  if (!entry) throw new Error(`Accepted artifact is not registered: ${relativePath}`);
  entry.content_hash = sha256(content);
  fs.writeFileSync(paths.artifactManifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function validMergedBook(overrides = {}) {
  return {
    schema_version: 1,
    stage: 'merged',
    characters: [{
      registry_key: 'registry:characters:0001', local_key: 'character:甲', name: '甲', aliases: [],
      identities: ['侠客'], level: '核心', rank: '初窥门径', description: '甲在江湖中追查旧事。',
      factions: ['registry:factions:0001'], skills: ['registry:skills:0001'], source_refs: [sourceRef(1)]
    }],
    items: [{
      registry_key: 'registry:items:0001', local_key: 'item:灵丹', name: '回生丹', aliases: [], type: '丹药',
      description: '用于救治重伤。', source_refs: [sourceRef(2)]
    }],
    skills: [{
      registry_key: 'registry:skills:0001', local_key: 'skill:内功', name: '玄门内功', aliases: [],
      types: ['内功'], factions: ['registry:factions:0001'], rank: '初窥门径', description: '调息养气。',
      techniques: [{ name: '飞云掌', description: '掌势迅疾。' }],
      source_refs: [sourceRef(1)]
    }],
    factions: [{
      registry_key: 'registry:factions:0001', local_key: 'faction:玄门', name: '玄门', aliases: [],
      type: '门派', description: '隐居山中。', source_refs: [sourceRef(1)]
    }],
    chapter_summaries: [1, 2, 3].map(chapter => ({
      chapter,
      title: `第${chapter}章`,
      summary: `第${chapter}章摘要。`,
      source_refs: [sourceRef(chapter)]
    })),
    candidate_resolutions: [],
    ambiguities: [],
    ...overrides
  };
}

function v7WorkerDraft(overrides = {}) {
  return {
    characters: [{
      name: '甲', level: '核心', rank: '初窥门径',
      aliases: [], identities: [], description: null, factions: [], skills: [],
      source_refs: [{ text: '甲修习玄门内功并使出飞云掌。', line_start: 1, line_end: 1 }]
    }],
    skills: [{
      name: '玄门内功', rank: '初窥门径',
      aliases: [], types: ['内功'], factions: [], description: null,
      techniques: [{ name: '飞云掌', description: null }],
      source_refs: [{ text: '甲修习玄门内功并使出飞云掌。', line_start: 1, line_end: 1 }]
    }],
    items: [{
      name: '回生丹', aliases: [], types: ['丹药'], description: null,
      source_refs: [{ text: '甲服下回生丹。', line_start: 2, line_end: 2 }]
    }],
    factions: [{
      name: '玄门', aliases: [], types: ['门派'], description: null,
      source_refs: [{ text: '玄门隐居山中。', line_start: 3, line_end: 3 }]
    }],
    chapter_summary: {
      summary: '第一章摘要。',
      source_refs: [{ text: '甲修习玄门内功并使出飞云掌。', line_start: 1, line_end: 1 }]
    },
    ...overrides
  };
}

function writeWorkerOutput(job) {
  const input = readJson(job.input_file);
  const chapter = input.chapter;
  const firstEvidence = `侠客${chapter}修习玄门心法${chapter}并使出飞云掌${chapter}。`;
  const itemEvidence = `侠客${chapter}服下回生丹${chapter}。`;
  const factionEvidence = `玄门${chapter}隐居山中。`;
  const draft = v7WorkerDraft({
    characters: [{
      name: `侠客${chapter}`, level: '核心', rank: '初窥门径',
      aliases: [], identities: [], description: null, factions: [], skills: [],
      source_refs: [{ text: firstEvidence, line_start: 2, line_end: 2 }]
    }],
    skills: [{
      name: `玄门心法${chapter}`, rank: '初窥门径',
      aliases: [], types: ['内功'], factions: [], description: null,
      techniques: [{ name: `飞云掌${chapter}`, description: null }],
      source_refs: [{ text: firstEvidence, line_start: 2, line_end: 2 }]
    }],
    items: [{
      name: `回生丹${chapter}`, aliases: [], types: ['丹药'], description: null,
      source_refs: [{ text: itemEvidence, line_start: 3, line_end: 3 }]
    }],
    factions: [{
      name: `玄门${chapter}`, aliases: [], types: ['门派'], description: null,
      source_refs: [{ text: factionEvidence, line_start: 4, line_end: 4 }]
    }],
    chapter_summary: {
      summary: `第${chapter}章摘要。`,
      source_refs: [{ text: firstEvidence, line_start: 2, line_end: 2 }]
    }
  });
  fs.writeFileSync(job.output_file, yaml.dump(draft, { lineWidth: -1, noRefs: true }), 'utf8');
  return job.output_file;
}

function writeAllWorkerOutputs(jobs) {
  return jobs.map(writeWorkerOutput);
}

function expectedChapter(overrides = {}) {
  return {
    number: 1,
    title: '第一章 起始',
    inputHash: 'abc123',
    ...overrides
  };
}

module.exports = {
  FLOW,
  expectedChapter,
  makeNovel,
  makeNovelDirectory,
  makeTemporaryNovel,
  parseJsonLine,
  readJson,
  replaceAcceptedArtifact,
  runFlow,
  sourceRef,
  v7WorkerDraft,
  validChapterDraft,
  validMergedBook,
  writeAllWorkerOutputs,
  writeWorkerOutput
};
