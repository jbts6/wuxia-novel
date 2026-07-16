'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { validateCleanedBook, validateMergedBook } = require('../scripts/lib/book-contract');
const { validateChapterDraft } = require('../scripts/lib/chapter-contract');
const { buildFinalData } = require('../scripts/lib/finalize');
const { buildGameMaterials } = require('../scripts/lib/game-materials');
const { atomicWriteJson } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { buildQualitySample, validateQualityReview } = require('../scripts/lib/quality');
const { readWorkItem, readWorkPlan } = require('../scripts/lib/semantic-work');

const {
  makeNovel,
  readJson,
  runFlow,
  sourceRef,
  writeStagingDraft,
  validChapterDraft,
  validCleanedBook,
  validMergedBook
} = require('./helpers');

const SKILL_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(SKILL_ROOT, '..', '..', '..');
const TARGET_FILES = [
  'chapter_summaries.json', 'characters.json', 'dialogues.json', 'events.json', 'factions.json',
  'items.json', 'locations.json', 'skills.json', 'techniques.json'
];

function acceptJsonDraft(novel, unit, draft) {
  const file = writeStagingDraft(novel, unit, draft);
  return runFlow(['accept', novel, '--unit', unit, '--draft', file, '--json']);
}

function assertFlowPassed(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

const MERGE_FIELD_NAMES = Object.freeze({
  characters: ['level', 'identity', 'biography', 'personality', 'relationship_names', 'skill_names', 'item_names'],
  events: ['cause', 'process', 'result', 'participant_names', 'location_names', 'importance'],
  items: ['inclusion_reason', 'type', 'description'],
  skills: ['type', 'description', 'holder_names', 'technique_names'],
  techniques: ['named_in_source', 'source_skill_name', 'description'],
  factions: ['type', 'description'],
  locations: ['region', 'description'],
  dialogues: ['event_ref', 'speaker_name', 'chapter', 'text']
});

function pickedFields(record, names) {
  return Object.fromEntries(names
    .filter(name => record?.[name] !== undefined)
    .map(name => [name, record[name]]));
}

function mergeDecisionFromBook(input, book) {
  const groups = new Map();
  for (const candidate of input.candidates) {
    const key = candidate.name || candidate.facts?.text || candidate.candidate_ref;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  const decisions = [...groups.entries()].map(([name, candidates], index) => {
    const record = input.category === 'dialogues'
      ? book.dialogues.find(value => value.text === candidates[0].facts?.text)
      : book[input.category].find(value => value.canonical_name === name);
    assert.ok(record, `missing merge blueprint for ${input.category}:${name}`);
    const fields = pickedFields(record, MERGE_FIELD_NAMES[input.category]);
    if (input.category === 'dialogues') fields.event_ref = candidates[0].facts.event_ref;
    const decision = {
      entity_ref: `e${String(index + 1).padStart(3, '0')}`,
      member_refs: candidates.map(candidate => candidate.candidate_ref),
      action: 'merge',
      fields
    };
    if (input.category !== 'dialogues') {
      decision.canonical_name = record.canonical_name;
      decision.aliases = [];
    }
    return decision;
  });
  return {
    schema_version: 1,
    stage: 'merge_decision',
    unit: input.unit,
    decisions,
    ambiguities: []
  };
}

function cleanDecision(input) {
  return {
    schema_version: 1,
    stage: 'clean_decision',
    unit: input.unit,
    decisions: input.entities.map(entity => entity.canonical_name === '普通小匕首'
      ? {
          entity_ref: entity.entity_ref,
          action: 'drop',
          reason: 'ordinary_item',
          detail: '普通随身物，无特殊能力且不推动剧情。',
          resolves: entity.obligation_refs
        }
      : {
          entity_ref: entity.entity_ref,
          action: 'keep',
          resolves: []
        }),
    quantity_explanation: input.category === 'items'
      ? '普通小匕首无特殊能力且不推动剧情，已删除；未按数量凑条目。'
      : null
  };
}

function jsonExample(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^#{2,3} ${escaped}\\n\\n` + '```json\\n([\\s\\S]*?)\\n```', 'm'));
  assert.ok(match, `missing JSON example: ${heading}`);
  return JSON.parse(match[1]);
}

function assertNoFormalIds(value, label = '$') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoFormalIds(entry, `${label}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    assert.equal(key === 'id' || key.endsWith('_id') || key.endsWith('_ids'), false, `${label}.${key}`);
    assertNoFormalIds(entry, `${label}.${key}`);
  }
}

test('Skill documents the bounded fast workflow without template placeholders', () => {
  const skill = fs.readFileSync(path.join(SKILL_ROOT, 'SKILL.md'), 'utf8');
  const schemas = fs.readFileSync(path.join(SKILL_ROOT, 'schemas.md'), 'utf8');

  assert.doesNotMatch(skill, /\[TODO|Structuring This Skill|Resources \(optional\)/);
  assert.match(skill, /^description: Use when/m);
  for (const command of ['prepare', 'status', 'accept', 'build-final', 'verify', 'install']) {
    assert.match(skill, new RegExp(`\\b${command.replace('-', '\\-')}\\b`));
  }
  assert.match(skill, /--installed/);
  assert.match(skill, /原生子代理/);
  assert.match(skill, /每个子代理只处理一个章节/);
  assert.match(skill, /run-id.*unit.*attempt/);
  assert.match(skill, /串行执行 `accept`/);
  assert.match(skill, /manual_review/);
  assert.match(skill, /最多\s*3\s*次/);
  assert.match(skill, /不得自动.*reset-unit|不得.*自动重置/);
  assert.match(skill, /不得.*循环.*status|status.*不得.*循环/);
  assert.match(skill, /45.*目标.*60.*硬上限/);
  for (const heading of ['人物', '事件', '物品', '功法', '招式', '门派', '地点', '对白', '章节摘要', '游戏素材索引']) {
    assert.match(schemas, new RegExp(`##+ .*${heading}`));
  }

  const chapter = jsonExample(schemas, '章节草稿示例');
  assert.deepEqual(validateChapterDraft(chapter, { number: chapter.chapter, inputHash: chapter.source_hash }), []);
  assertNoFormalIds(chapter);

  const merged = jsonExample(schemas, '确定性合并产物示例');
  const manifest = { chapters: merged.chapter_summaries.map(summary => ({ number: summary.chapter })) };
  assert.deepEqual(validateMergedBook(merged, manifest), []);
  assertNoFormalIds(merged);

  const cleaned = jsonExample(schemas, '确定性清理产物示例');
  assert.deepEqual(validateCleanedBook(cleaned, manifest), []);
  assertNoFormalIds(cleaned);

  const projected = buildFinalData(cleaned, manifest);
  assert.deepEqual(projected.issues, []);
  const finalHeadings = {
    'characters.json': '人物 / characters.json 示例',
    'events.json': '事件 / events.json 示例',
    'items.json': '物品 / items.json 示例',
    'skills.json': '功法 / skills.json 示例',
    'techniques.json': '招式 / techniques.json 示例',
    'factions.json': '门派与势力 / factions.json 示例',
    'locations.json': '地点 / locations.json 示例',
    'dialogues.json': '对白 / dialogues.json 示例',
    'chapter_summaries.json': '章节摘要 / chapter_summaries.json 示例'
  };
  for (const filename of TARGET_FILES) {
    const serializable = JSON.parse(JSON.stringify(projected.data[filename]));
    assert.deepEqual(jsonExample(schemas, finalHeadings[filename]), serializable);
  }
  const materials = buildGameMaterials(projected.data, cleaned.game_material_candidates);
  assert.deepEqual(materials.issues, []);
  assert.deepEqual(jsonExample(schemas, '游戏素材索引示例'), {
    schema_version: 1,
    entries: materials.entries
  });

  const quality = jsonExample(schemas, '固定质量复核示例');
  const sample = quality.results.map(result => ({ id: result.id }));
  assert.equal(validateQualityReview(quality, sample).passed, true);
  const manual = jsonExample(schemas, 'manual_review.json 示例');
  assert.deepEqual(Object.keys(manual).sort(), [
    'attempts', 'errors', 'input_hash', 'stop_reason', 'suggested_action', 'unit'
  ]);
});

test('project quality spec keeps the fast profile separate from managed G1-G5 runs', () => {
  const spec = fs.readFileSync(
    path.join(PROJECT_ROOT, '.trellis', 'spec', 'backend', 'quality-guidelines.md'),
    'utf8'
  );

  assert.match(spec, /## Scenario: Fast Game-Material Knowledge Base Profile/);
  assert.match(spec, /\.agents\/skills\/generate-kb.*scripts\/pipeline\.js|scripts\/pipeline\.js.*\.agents\/skills\/generate-kb/s);
  assert.doesNotMatch(spec, /^- `scripts\/pipeline\.js` is the only supported write entry\./m);
  assert.match(spec, /chapter-level.*95%|95%.*chapter-level/i);
  assert.match(spec, /cannot claim G1–G5|must not claim G1–G5/i);
  assert.match(spec, /recall completeness/);
  assert.match(spec, /exact evidence/);
  assert.match(spec, /three.*attempt|3.*attempt/i);
  assert.match(spec, /quantity.*advisory/i);
  assert.match(spec, /ordinary actions.*excluded/i);
  assert.match(spec, /backup.*swap|swap.*backup/i);
  assert.match(spec, /eight.*browseability.*events\.json|events\.json.*eight.*browseability/is);
});

test('three-chapter workflow installs nine game-oriented arrays and passing evidence', () => {
  const source = [
    '第一章 山谷相逢',
    '甲在无名山谷遇见乙。甲以玄门内功催动飞云掌，又全力一挥。乙取出回生丹，也带着一把普通小匕首。',
    '第二章 同行',
    '二人同赴玄门，继续追查山谷相逢之事。',
    '第三章 收束',
    '甲与乙在无名山谷查明真相，山谷相逢一事至此结束。'
  ].join('\n') + '\n';
  const novel = makeNovel('三章游戏书', source);
  fs.mkdirSync(path.join(novel, 'data'), { recursive: true });
  fs.mkdirSync(path.join(novel, 'build'), { recursive: true });
  fs.mkdirSync(path.join(novel, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(novel, 'data', 'characters.json'), '[]\n', 'utf8');
  fs.writeFileSync(path.join(novel, 'build', 'old-report.json'), '{}\n', 'utf8');
  fs.writeFileSync(path.join(novel, 'reports', 'old-quality.json'), '{}\n', 'utf8');
  const archivedBaseline = assertFlowPassed(runFlow(['archive-existing', novel, '--json']), 'archive existing');
  assert.equal(archivedBaseline.status, 'archived');
  assert.equal(fs.existsSync(path.join(novel, 'data')), false);
  assert.equal(fs.existsSync(path.join(novel, 'build')), false);
  assert.equal(fs.existsSync(path.join(novel, 'reports')), false);
  const prepared = assertFlowPassed(runFlow(['prepare', novel, '--json']), 'prepare');
  assert.equal(prepared.chapter_count, 3);
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);
  assert.equal(readJson(paths.runJson).semantic_contract_version, 2);

  for (const chapter of manifest.chapters) {
    const number = chapter.number;
    const first = number === 1;
    const draft = validChapterDraft({
      chapter: number,
      title: chapter.title,
      source_hash: chapter.input_hash,
      characters: first ? [
        { local_key: 'character:甲', name: '甲', level: '核心', source_refs: [sourceRef(number, '甲在无名山谷遇见乙')] },
        { local_key: 'character:乙', name: '乙', level: '次要', source_refs: [sourceRef(number, '甲在无名山谷遇见乙')] }
      ] : [],
      events: [1, 3].includes(number) ? [{
        local_key: 'event:山谷相逢', name: '山谷相逢', importance: '重要',
        quote_status: first ? 'quotable' : 'not_quotable',
        ...(first ? {} : { quote_reason: '本章仅为事件收束叙述。' }),
        source_refs: [sourceRef(number, first ? '甲在无名山谷遇见乙' : '山谷相逢一事至此结束')]
      }] : [],
      items: first ? [
        { local_key: 'item:回生丹', name: '回生丹', source_refs: [sourceRef(number, '乙取出回生丹')] },
        { local_key: 'item:小匕首', name: '普通小匕首', source_refs: [sourceRef(number, '一把普通小匕首')] }
      ] : [],
      skills: first ? [{
        local_key: 'skill:玄门内功', name: '玄门内功', source_refs: [sourceRef(number, '玄门内功')]
      }] : [],
      techniques: first ? [{
        local_key: 'technique:飞云掌', name: '飞云掌', named_in_source: true,
        source_skill_name: '玄门内功', source_refs: [sourceRef(number, '飞云掌')]
      }] : [],
      factions: first ? [{ local_key: 'faction:玄门', name: '玄门', source_refs: [sourceRef(number, '玄门内功')] }] : [],
      locations: first ? [{ local_key: 'location:无名山谷', name: '无名山谷', source_refs: [sourceRef(number, '无名山谷')] }] : [],
      dialogues: [],
      summary: {
        title: chapter.title,
        summary: number === 1 ? '甲与乙在山谷相逢。' : number === 2 ? '二人同行追查旧事。' : '二人查明真相。',
        key_events: first ? ['event:山谷相逢'] : [],
        key_characters: first ? ['甲', '乙'] : [],
        source_refs: [sourceRef(number, number === 1 ? '山谷相逢' : number === 2 ? '二人同赴玄门' : '查明真相')]
      }
    });
    assertFlowPassed(
      acceptJsonDraft(novel, `chapter:${String(number).padStart(3, '0')}`, draft),
      `accept chapter ${number}`
    );
  }

  const coverage = assertFlowPassed(runFlow(['check-coverage', novel, '--json']), 'check coverage');
  assert.deepEqual(coverage.recall_units, []);

  const summaries = manifest.chapters.map(chapter => ({
    chapter: chapter.number,
    title: chapter.title,
    summary: chapter.number === 1 ? '甲与乙在山谷相逢。' : chapter.number === 2 ? '二人同行追查旧事。' : '二人查明真相。',
    key_events: [1, 3].includes(chapter.number) ? ['山谷相逢'] : [],
    key_characters: ['甲', '乙'],
    source_refs: [sourceRef(chapter.number, chapter.number === 1 ? '山谷相逢' : chapter.number === 2 ? '二人同赴玄门' : '查明真相')]
  }));
  const characters = [
    {
      local_key: 'character:甲', canonical_name: '甲', aliases: [], level: '核心', identity: '侠客',
      biography: '甲追查旧事并与乙查明真相。', personality: { traits: ['坚毅'], speech_style: '简练' },
      relationship_names: [{ target: '乙', type: '同伴' }], skill_names: ['玄门内功'], item_names: [],
      source_refs: [sourceRef(1, '甲在无名山谷遇见乙'), sourceRef(3, '甲与乙在无名山谷查明真相')]
    },
    {
      local_key: 'character:乙', canonical_name: '乙', aliases: [], level: '次要', identity: '同行者',
      biography: '携回生丹同行。', personality: { traits: ['机敏'], speech_style: '' },
      relationship_names: [{ target: '甲', type: '同伴' }], skill_names: [], item_names: ['回生丹'],
      source_refs: [sourceRef(1, '乙取出回生丹')]
    }
  ];
  const event = {
    local_key: 'event:山谷相逢', canonical_name: '山谷相逢', cause: '甲追查旧事',
    process: '甲乙相逢并同行', result: '二人查明真相', participant_names: ['甲', '乙'],
    location_names: ['无名山谷'], importance: '重要', quote_status: 'quotable',
    source_refs: [sourceRef(1, '甲在无名山谷遇见乙'), sourceRef(3, '山谷相逢一事至此结束')]
  };
  const importantItem = {
    local_key: 'item:回生丹', canonical_name: '回生丹', inclusion_reason: '高级药毒', type: '丹药',
    description: '用于救治重伤。', owner_name: '乙', source_refs: [sourceRef(1, '乙取出回生丹')]
  };
  const ordinaryItem = {
    local_key: 'item:小匕首', canonical_name: '普通小匕首', inclusion_reason: '普通随身', type: '武器',
    description: '普通随身物。', owner_name: '乙', source_refs: [sourceRef(1, '一把普通小匕首')]
  };
  const common = {
    characters,
    events: [event],
    skills: [{
      local_key: 'skill:玄门内功', canonical_name: '玄门内功', type: '内功', description: '调息运气。',
      holder_names: ['甲'], technique_names: ['飞云掌'], source_refs: [sourceRef(1, '玄门内功')]
    }],
    techniques: [{
      local_key: 'technique:飞云掌', canonical_name: '飞云掌', named_in_source: true,
      source_skill_name: '玄门内功', description: '掌势迅疾。', source_refs: [sourceRef(1, '飞云掌')]
    }],
    factions: [{
      local_key: 'faction:玄门', canonical_name: '玄门', type: '门派', description: '山中门派。',
      member_names: ['甲'], location_name: '无名山谷', source_refs: [sourceRef(2, '二人同赴玄门')]
    }],
    locations: [{
      local_key: 'location:无名山谷', canonical_name: '无名山谷', region: '北地', description: '相逢之地。',
      faction_names: ['玄门'], character_names: ['甲', '乙'], source_refs: [sourceRef(1, '无名山谷')]
    }],
    dialogues: [],
    chapter_summaries: summaries,
    candidate_resolutions: ['characters', 'events', 'items', 'skills', 'techniques', 'factions', 'locations', 'dialogues']
      .flatMap(category => readJson(path.join(paths.chapters, 'ch_001.json'))[category].map(candidate => ({
        candidate_key: candidate.candidate_key,
        resolution: 'merged_to',
        merged_to: candidate.local_key
      }))),
    ambiguities: []
  };

  const merged = validMergedBook({ ...common, items: [importantItem, ordinaryItem] });
  const mergePrepared = assertFlowPassed(runFlow(['prepare-merge', novel, '--json']), 'prepare domains');
  assert.deepEqual(mergePrepared.units, ['distill:plot', 'distill:martial', 'distill:items', 'distill:world']);
  const domainPlan = readWorkPlan(paths, 'domain');
  for (const input of domainPlan.inputs) {
    const decisions = input.entries.map(entry => {
      if (entry.category === 'items' && entry.canonical_name === '普通小匕首') {
        return {
          entry_ref: entry.entry_ref,
          action: 'reject',
          reason: 'ordinary_item',
          detail: '普通随身物，无特殊能力且不推动剧情。'
        };
      }
      const source = (merged[entry.category] || []).find(record => entry.category === 'dialogues'
        ? record.text === entry.facts?.text
        : record.canonical_name === entry.canonical_name) || {};
      const patch = { canonical_name: entry.canonical_name };
      for (const field of input.allowed_patch_fields) {
        if (field !== 'canonical_name' && source[field] !== undefined) patch[field] = source[field];
      }
      return { entry_ref: entry.entry_ref, action: 'keep', patch };
    });
    const draft = {
      schema_version: 1,
      semantic_contract_version: 2,
      unit: input.unit,
      input_hash: input.input_hash,
      decisions,
      notes: []
    };
    assertFlowPassed(acceptJsonDraft(novel, input.unit, draft), `accept ${input.unit}`);
  }
  assertFlowPassed(runFlow(['assemble-merge', novel, '--json']), 'assemble merge');
  assert.equal(readJson(paths.progress).units['merge:book'].attempts, 0);
  assert.equal(fs.existsSync(path.join(paths.drafts, 'merge_book')), false);
  const resolution = assertFlowPassed(runFlow(['check-resolution', novel, '--json']), 'check resolution');
  assert.deepEqual(resolution.supplement_units, []);
  const cleanPrepared = assertFlowPassed(runFlow(['prepare-clean', novel, '--json']), 'prepare clean');
  assert.deepEqual(cleanPrepared.units, []);
  assertFlowPassed(runFlow(['assemble-clean', novel, '--json']), 'assemble clean');
  assert.equal(readJson(paths.progress).units['clean:book'].attempts, 0);
  assert.equal(fs.existsSync(path.join(paths.drafts, 'clean_book')), false);
  assertFlowPassed(runFlow(['build-final', novel, '--json']), 'build final');

  const sampleFile = paths.qualitySample;
  const pending = runFlow(['verify', novel, '--json']);
  assert.notEqual(pending.status, 0);
  assert.equal(fs.existsSync(sampleFile), true);
  const sample = readJson(sampleFile);
  const review = {
    schema_version: 1,
    results: sample.items.map(item => ({
      id: item.id,
      passed: true,
      checks: { name: true, category: true, key_facts: true, chapter: true },
      notes: ''
    }))
  };
  assertFlowPassed(acceptJsonDraft(novel, 'quality:sample', review), 'accept quality');
  assertFlowPassed(runFlow(['verify', novel, '--json']), 'verify workspace');
  assertFlowPassed(runFlow(['install', novel, '--json']), 'install');
  const installed = assertFlowPassed(runFlow(['verify', novel, '--installed', '--json']), 'verify installed');
  assert.equal(installed.passed, true);

  const dataRoot = path.join(novel, 'data');
  assert.deepEqual(fs.readdirSync(dataRoot).sort(), [...TARGET_FILES].sort());
  const finalData = Object.fromEntries(TARGET_FILES.map(filename => [filename, readJson(path.join(dataRoot, filename))]));
  assert.equal(finalData['techniques.json'].some(record => record.name === '全力一挥'), false);
  assert.equal(finalData['items.json'].some(record => record.name === '普通小匕首'), false);
  assert.equal(finalData['items.json'].some(record => record.name === '回生丹'), true);
  const minor = finalData['characters.json'].find(record => record.name === '乙');
  assert.ok(minor);
  assert.ok([...minor.biography].length < 50);
  assert.ok(minor.personality.traits.length <= 2);
  const finalEvent = finalData['events.json'][0];
  assert.deepEqual(finalEvent.source_refs.map(ref => ref.chapter), [1, 3]);
  assert.deepEqual(finalData['dialogues.json'], []);
  assert.deepEqual(readJson(paths.manualReview), []);

  const materials = readJson(path.join(novel, 'reports', 'game_materials.json'));
  assert.deepEqual(new Set(materials.entries.map(entry => entry.material_type)), new Set([
    '角色原型/彩蛋', '经典剧情桥段', '标志性物品', '战斗系统原型'
  ]));
  const receipt = readJson(path.join(novel, 'reports', 'generate_game_kb_install.json'));
  assert.equal(receipt.installer, 'generate-game-kb');
  assert.equal(receipt.manual_review_count, 0);
  assert.equal(receipt.semantic_contract_version, 2);

  const archivedRun = assertFlowPassed(
    runFlow(['archive-run', novel, '--run', prepared.run_id, '--json']),
    'archive run'
  );
  assert.equal(archivedRun.status, 'archived');
  assert.equal(fs.existsSync(paths.run), false);
  assert.equal(fs.existsSync(path.join(archivedRun.archive_dir, 'progress.json')), true);
  assert.match(archivedRun.artifact_manifest_hash, /^sha256:/);
});

test('seven explicitly rejected item candidates close the ledger without a whole-book retry', () => {
  const novel = makeNovel('物品归零书', '第一章 起始\n甲发现七件异物。\n');
  const prepared = assertFlowPassed(runFlow(['prepare', novel, '--json']), 'prepare item regression');
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);
  const chapter = manifest.chapters[0];
  const itemDrafts = Array.from({ length: 7 }, (_, index) => ({
    local_key: `item:异物${index + 1}`,
    name: `异物${index + 1}`,
    source_refs: [sourceRef(1, '七件异物')]
  }));
  const chapterDraft = validChapterDraft({
    chapter: 1,
    title: chapter.title,
    source_hash: chapter.input_hash,
    characters: [],
    events: [],
    items: itemDrafts,
    skills: [],
    techniques: [],
    factions: [],
    locations: [],
    dialogues: [],
    summary: {
      title: chapter.title,
      summary: '甲发现七件异物。',
      key_events: [],
      key_characters: [],
      source_refs: [sourceRef(1, '七件异物')]
    }
  });
  assertFlowPassed(acceptJsonDraft(novel, 'chapter:001', chapterDraft), 'accept item chapter');
  assertFlowPassed(runFlow(['prepare-merge', novel, '--json']), 'prepare item domains');
  const domainPlan = readWorkPlan(paths, 'domain');
  for (const input of domainPlan.inputs) {
    const itemDecision = {
      schema_version: 1,
      semantic_contract_version: 2,
      unit: input.unit,
      input_hash: input.input_hash,
      decisions: input.entries.map(entry => ({
        entry_ref: entry.entry_ref,
        action: 'reject',
        reason: 'ordinary_item',
        detail: '尚无证据证明该物品具有特殊性或剧情关键作用。'
      })),
      notes: []
    };
    assertFlowPassed(acceptJsonDraft(novel, input.unit, itemDecision), `accept ${input.unit}`);
  }
  assertFlowPassed(runFlow(['assemble-merge', novel, '--json']), 'assemble item merge');
  assertFlowPassed(runFlow(['check-coverage', novel, '--json']), 'check item coverage');

  assert.deepEqual(readJson(paths.coverage).recall_units, []);
  const units = readJson(paths.progress).units;
  assert.equal(units['supplement:items'], undefined);
  assert.equal(units['merge:book'].attempts, 0);
  assert.equal(Object.keys(units).includes('book:full-retry'), false);
  const resolutions = readJson(paths.merged).candidate_resolutions;
  assert.equal(resolutions.length, 7);
  assert.ok(resolutions.every(row => row.resolution === 'rejected' && row.reason === 'ordinary_item'));
});

test('sparse dialogue coverage warns without opening recall or a book retry', () => {
  const novel = makeNovel('对白稀疏书', '第一章 起始\n群雄议事。\n');
  const prepared = assertFlowPassed(runFlow(['prepare', novel, '--json']), 'prepare dialogue regression');
  const paths = pathsFor(novel, prepared.run_id);
  fs.mkdirSync(paths.chapters, { recursive: true });
  atomicWriteJson(path.join(paths.chapters, 'ch_001.json'), {
    chapter: 1,
    events: Array.from({ length: 10 }, (_, index) => ({
      local_key: `event:议事${index + 1}`,
      importance: '重要',
      quote_status: 'quotable'
    })),
    items: [],
    dialogues: [1, 2].map(index => ({ event_local_key: `event:议事${index}` }))
  });
  assertFlowPassed(runFlow(['check-coverage', novel, '--json']), 'check dialogue coverage');

  const coverage = readJson(paths.coverage);
  assert.deepEqual(coverage.recall_units, []);
  assert.ok(coverage.warnings.some(issue => issue.category === 'dialogues'));
  const units = readJson(paths.progress).units;
  assert.equal(units['recall:dialogues'], undefined);
  assert.equal(Object.keys(units).includes('book:full-retry'), false);
});

test('fixed quality quotas never replace missing item or dialogue checks with martial records', () => {
  const records = prefix => Array.from({ length: 30 }, (_, index) => ({ id: `${prefix}_${index}` }));
  const sample = buildQualitySample({
    'skills.json': records('skill'),
    'techniques.json': records('tech'),
    'events.json': records('event'),
    'characters.json': records('char'),
    'items.json': [],
    'dialogues.json': [],
    'factions.json': records('faction'),
    'locations.json': records('loc'),
    'chapter_summaries.json': [{ chapter: 1 }, { chapter: 2 }]
  }, { seed: 'integration-fixed' });

  assert.equal(sample.categories.items.kind, 'empty-review-required');
  assert.equal(sample.categories.dialogues.kind, 'empty-review-required');
  assert.equal(sample.items.filter(item => item.group === 'skills_techniques').length, 12);
  assert.equal(sample.total_checks, 40);
});
