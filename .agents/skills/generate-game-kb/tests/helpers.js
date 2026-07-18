'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const { pathsFor } = require('../scripts/lib/paths');
const { resolveRun } = require('../scripts/lib/run');
const { DOMAIN_UNITS, SEMANTIC_CONTRACT_VERSION } = require('../scripts/lib/semantic-contract');
const { readWorkPlan } = require('../scripts/lib/semantic-work');
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseJsonLine(text) {
  const line = String(text).split(/\r?\n/).find(value => value.trim() !== '');
  return JSON.parse(line);
}

function writeStagingDraft(novel, unit, value, attempt) {
  const run = resolveRun(novel);
  const paths = pathsFor(novel, run.run_id);
  const progress = readJson(paths.progress);
  const number = attempt ?? ((progress.units[unit]?.attempts ?? 0) + 1);
  const file = path.join(
    paths.staging,
    `${unit.replaceAll(':', '_')}_attempt_${String(number).padStart(2, '0')}.yaml`
  );
  fs.writeFileSync(file, yaml.dump(value, { noRefs: true, lineWidth: -1 }), 'utf8');
  return file;
}

function runFlow(args, options = {}) {
  return spawnSync(process.execPath, [FLOW, ...args], {
    cwd: options.cwd || SKILL_ROOT,
    encoding: 'utf8'
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

function validDomainDraft(input, actionForEntry = () => 'keep') {
  return {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    unit: input.unit,
    input_hash: input.input_hash,
    decisions: input.entries.map(entry => {
      const action = actionForEntry(entry);
      return {
        entry_ref: entry.entry_ref,
        action,
        ...(action === 'keep' ? {
          patch: {
            name: entry.canonical_name,
            aliases: [],
            ...(entry.category === 'characters' ? {
              identities: [], level: null, rank: null, description: null, factions: [], skills: []
            } : {}),
            ...(entry.category === 'skills' ? {
              types: [], factions: [], rank: null, description: null, techniques: []
            } : {}),
            ...(entry.category === 'items' ? {
              type: null, description: null, inclusion_reason: '其他稀有特殊'
            } : {}),
            ...(entry.category === 'factions' ? { type: null, description: null } : {})
          }
        } : {})
      };
    }),
    notes: []
  };
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

function requireFlowSuccess(result, label) {
  if (result.status !== 0) throw new Error(`${label}: ${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function prepareAssembledRun({
  name = '已组装试书',
  runId = 'run-assembled',
  source = '第一章 起始\n甲修习玄门内功并使出飞云掌。\n',
  chapterOverrides = {},
  domainDraftForInput = validDomainDraft,
  beforeAssemble = null
} = {}) {
  const novel = makeNovel(name, source);
  const commands = [];
  const invoke = (args, label) => {
    commands.push(args[0]);
    return requireFlowSuccess(runFlow(args), label);
  };
  const prepared = invoke(['prepare', novel, '--run', runId, '--json'], 'prepare');
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);
  for (const chapter of manifest.chapters) {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const override = typeof chapterOverrides === 'function'
      ? chapterOverrides(chapter)
      : chapterOverrides;
    const chapterText = fs.readFileSync(chapter.file, 'utf8');
    const evidenceText = chapterText.split(/\r?\n/).slice(1).find(line => line.trim() !== '')
      || chapter.title;
    const draft = validChapterDraft({
      chapter: chapter.number,
      title: chapter.title,
      source_hash: chapter.input_hash,
      chapter_summary: {
        title: chapter.title,
        summary: `第${chapter.number}章摘要。`,
        source_refs: [sourceRef(chapter.number, evidenceText)]
      },
      ...override
    });
    const file = writeStagingDraft(novel, unit, draft);
    invoke([
      'accept', novel, '--run', prepared.run_id, '--unit', unit, '--draft', file, '--json'
    ], `accept ${unit}`);
  }
  invoke(['plan-domains', novel, '--run', prepared.run_id, '--json'], 'plan domains');
  const plan = readWorkPlan(paths, 'domain');
  if (JSON.stringify(plan.inputs.map(input => input.unit)) !== JSON.stringify(DOMAIN_UNITS)) {
    throw new Error('Unexpected domain plan');
  }
  for (const input of plan.inputs) {
    const file = writeStagingDraft(novel, input.unit, domainDraftForInput(input));
    invoke([
      'accept', novel, '--run', prepared.run_id, '--unit', input.unit, '--draft', file, '--json'
    ], `accept ${input.unit}`);
  }
  if (beforeAssemble) beforeAssemble({ manifest, novel, paths, plan, prepared });
  const assembled = invoke(['assemble', novel, '--run', prepared.run_id, '--json'], 'assemble');
  return { assembled, commands, manifest, novel, paths, prepared };
}

function validMergedBook(overrides = {}) {
  return {
    schema_version: 1,
    stage: 'merged',
    characters: [{
      local_key: 'character:甲', canonical_name: '甲', aliases: [], level: '核心', identity: '侠客',
      rank: '初窥门径', faction: '玄门',
      biography: '甲在江湖中追查旧事。', personality: { traits: ['坚毅'], speech_style: '简练' },
      relationship_names: [], skill_names: ['玄门内功'], item_names: ['回生丹'], source_refs: [sourceRef(1)]
    }],
    items: [{
      local_key: 'item:灵丹', canonical_name: '回生丹', inclusion_reason: '高级药毒', type: '丹药',
      description: '用于救治重伤。', source_refs: [sourceRef(2)]
    }],
    skills: [{
      local_key: 'skill:内功', canonical_name: '玄门内功', type: '内功', rank: '初窥门径',
      faction: '玄门', description: '调息养气。',
      techniques: [{ name: '飞云掌', named_in_source: true, description: '掌势迅疾。' }],
      source_refs: [sourceRef(1)]
    }],
    factions: [{
      local_key: 'faction:玄门', canonical_name: '玄门', type: '门派', description: '隐居山中。', source_refs: [sourceRef(1)]
    }],
    chapter_summaries: [1, 2, 3].map(chapter => ({
      chapter,
      title: `第${chapter}章`,
      summary: `第${chapter}章摘要。`,
      key_characters: ['甲'],
      key_skills: chapter === 1 ? ['玄门内功'] : [],
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
  parseJsonLine,
  prepareAssembledRun,
  readJson,
  replaceAcceptedArtifact,
  runFlow,
  sourceRef,
  writeStagingDraft,
  validChapterDraft,
  validDomainDraft,
  validCleanedBook,
  validMergedBook
};
