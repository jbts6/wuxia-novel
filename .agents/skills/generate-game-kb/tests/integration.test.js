'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { validateCleanedBook, validateMergedBook } = require('../scripts/lib/book-contract');
const { validateChapterDraft } = require('../scripts/lib/chapter-contract');
const { buildFinalData } = require('../scripts/lib/finalize');
const { buildGameMaterials } = require('../scripts/lib/game-materials');
const { validateQualityReview } = require('../scripts/lib/quality');

const {
  makeNovel,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft,
  validCleanedBook,
  validMergedBook
} = require('./helpers');

const SKILL_ROOT = path.resolve(__dirname, '..');
const TARGET_FILES = [
  'chapter_summaries.json', 'characters.json', 'dialogues.json', 'events.json', 'factions.json',
  'items.json', 'locations.json', 'skills.json', 'techniques.json'
];

function acceptJsonDraft(novel, unit, draft) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-integration-draft-'));
  const file = path.join(directory, `${unit.replace(':', '_')}.json`);
  fs.writeFileSync(file, JSON.stringify(draft), 'utf8');
  return runFlow(['accept', novel, '--unit', unit, '--draft', file, '--json']);
}

function assertFlowPassed(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return JSON.parse(result.stdout);
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
  assert.match(skill, /2[–-]3\s*章/);
  assert.match(skill, /manual_review/);
  assert.match(skill, /最多\s*3\s*次/);
  assert.match(skill, /不得自动.*reset-unit|不得.*自动重置/);
  assert.match(skill, /不得.*循环.*status|status.*不得.*循环/);
  assert.match(skill, /60.*90.*基准/);
  for (const heading of ['人物', '事件', '物品', '功法', '招式', '门派', '地点', '对白', '章节摘要', '游戏素材索引']) {
    assert.match(schemas, new RegExp(`##+ .*${heading}`));
  }

  const chapter = jsonExample(schemas, '章节草稿示例');
  assert.deepEqual(validateChapterDraft(chapter, { number: chapter.chapter, inputHash: chapter.source_hash }), []);
  assertNoFormalIds(chapter);

  const merged = jsonExample(schemas, '合并草稿示例');
  const manifest = { chapters: merged.chapter_summaries.map(summary => ({ number: summary.chapter })) };
  assert.deepEqual(validateMergedBook(merged, manifest), []);
  assertNoFormalIds(merged);

  const cleaned = jsonExample(schemas, '清理草稿示例');
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
  const prepared = assertFlowPassed(runFlow(['prepare', novel, '--json']), 'prepare');
  assert.equal(prepared.chapter_count, 3);
  const manifest = readJson(path.join(novel, '.game-kb-work', 'manifest.json'));

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
      events: first ? [{
        local_key: 'event:山谷相逢', name: '山谷相逢', importance: '重要',
        source_refs: [sourceRef(number, '甲在无名山谷遇见乙')]
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
      dialogues: first ? [{
        local_key: 'dialogue:山谷相逢', event_local_key: 'event:山谷相逢', speaker_name: '甲',
        text: '你终于来了。', source_refs: [sourceRef(number, '甲在无名山谷遇见乙')]
      }] : [],
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
    location_names: ['无名山谷'], importance: '重要',
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
    dialogues: [{
      local_key: 'dialogue:山谷相逢', event_key: 'event:山谷相逢', speaker_name: '甲', listener_name: '乙',
      chapter: 1, text: '你终于来了。', source_refs: [sourceRef(1, '甲在无名山谷遇见乙')]
    }],
    chapter_summaries: summaries,
    ambiguities: []
  };

  const merged = validMergedBook({ ...common, items: [importantItem, ordinaryItem] });
  assertFlowPassed(acceptJsonDraft(novel, 'merge:book', merged), 'accept merge');

  const cleaned = validCleanedBook({
    ...common,
    items: [importantItem],
    quantity_review: { consumed: true, explanations: ['普通小匕首无特殊能力且不推动剧情，已删除；未按数量凑条目。'] },
    game_material_candidates: [
      { material_type: '战斗系统原型', source_category: 'skills', source_name: '玄门内功', relevance: '高', suggested_use: '内功原型', reason: '原著明确命名。' },
      { material_type: '经典剧情桥段', source_category: 'events', source_name: '山谷相逢', relevance: '高', suggested_use: '相逢桥段', reason: '事件跨章收束。' },
      { material_type: '角色原型/彩蛋', source_category: 'characters', source_name: '乙', relevance: '中', suggested_use: '同行者彩蛋', reason: '次要人物行为鲜明。' },
      { material_type: '标志性物品', source_category: 'items', source_name: '回生丹', relevance: '高', suggested_use: '丹药彩蛋', reason: '重要丹药。' },
      { material_type: '门派与世界观素材', source_category: 'factions', source_name: '玄门', relevance: '高', suggested_use: '门派原型', reason: '原著势力。' }
    ]
  });
  assertFlowPassed(acceptJsonDraft(novel, 'clean:book', cleaned), 'accept clean');
  assertFlowPassed(runFlow(['build-final', novel, '--json']), 'build final');

  const sampleFile = path.join(novel, '.game-kb-work', 'final', 'reports', 'quality_sample.json');
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
  const eventIds = new Set(finalData['events.json'].map(record => record.id));
  assert.ok(finalData['dialogues.json'].every(record => eventIds.has(record.event_id)));
  assert.deepEqual(readJson(path.join(novel, '.game-kb-work', 'manual_review.json')), []);

  const materials = readJson(path.join(novel, 'reports', 'game_materials.json'));
  assert.deepEqual(new Set(materials.entries.map(entry => entry.material_type)), new Set([
    '战斗系统原型', '经典剧情桥段', '角色原型/彩蛋', '标志性物品', '门派与世界观素材'
  ]));
  const receipt = readJson(path.join(novel, 'reports', 'generate_game_kb_install.json'));
  assert.equal(receipt.installer, 'generate-game-kb');
  assert.equal(receipt.manual_review_count, 0);
});
