'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { validateMergedBook } = require('../scripts/lib/book-contract');
const { buildCandidateRegistry } = require('../scripts/lib/candidate-registry');
const { normalizeChapterDraft } = require('../scripts/lib/chapter-contract');
const { assembleDomainMergedBook } = require('../scripts/lib/domain-assembly');
const { createDomainWorkPlan } = require('../scripts/lib/domain-work');
const { DOMAIN_UNITS } = require('../scripts/lib/semantic-contract');
const { sourceRef, validChapterDraft, validDomainDraft } = require('./helpers');

function fixture() {
  const chapter = normalizeChapterDraft(validChapterDraft({
    characters: [
      {
        local_key: 'character:hu-fei', name: '胡斐', identities: ['胡家后人'], level: '核心', rank: '登堂入室',
        source_refs: [sourceRef(1, '胡斐追查父仇')]
      },
      {
        local_key: 'character:miao', name: '苗人凤', identities: ['金面佛'], level: '重要', rank: '炉火纯青',
        source_refs: [sourceRef(1, '苗人凤现身')]
      }
    ],
    items: [{
      local_key: 'item:tie-he', name: '铁盒', type: '其他', inclusion_reason: '剧情关键',
      source_refs: [sourceRef(1, '铁盒藏有书信')]
    }],
    skills: [{
      local_key: 'skill:hu-dao', name: '胡家刀法', types: ['刀法'], rank: '登堂入室',
      techniques: [{ name: '八方藏刀式', description: null }],
      source_refs: [sourceRef(1, '胡家刀法')]
    }],
    factions: [{
      local_key: 'faction:hu-jia', name: '胡家', type: '家族',
      source_refs: [sourceRef(1, '胡家传人')]
    }]
  }));
  const registry = buildCandidateRegistry([chapter]);
  const plan = createDomainWorkPlan({ registry, accepted_hashes: {} });
  const decisions = plan.inputs.map(input => validDomainDraft(input));
  const skillDraft = decisions.find(draft => draft.unit === 'distill:skills');
  skillDraft.decisions[0].patch.techniques = [{ name: '八方藏刀式', description: null }];
  return {
    chapter,
    registry,
    plan,
    decisions,
    manifest: { chapters: [{ number: 1, title: '第一章 起始' }] }
  };
}

function assemble(value, decisions = value.decisions) {
  return assembleDomainMergedBook({
    manifest: value.manifest,
    chapters: [value.chapter],
    registry: value.registry,
    work_plan: value.plan,
    decisions
  });
}

function twoChapterMergeFixture(category, firstRecord, secondRecord) {
  const chapters = [firstRecord, secondRecord].map((record, index) => {
    const number = index + 1;
    return normalizeChapterDraft(validChapterDraft({
      chapter: number,
      characters: category === 'characters' ? [record] : [],
      items: category === 'items' ? [record] : [],
      skills: category === 'skills' ? [record] : [],
      factions: category === 'factions' ? [record] : [],
      chapter_summary: {
        summary: `第${number}章摘要`,
        source_refs: [sourceRef(number, `第${number}章摘要`)]
      }
    }));
  });
  const registry = buildCandidateRegistry(chapters);
  const plan = createDomainWorkPlan({ registry, accepted_hashes: {} });
  const decisions = plan.inputs.map(input => validDomainDraft(input));
  const unit = `distill:${category}`;
  const draft = decisions.find(value => value.unit === unit);
  const entries = registry.categories[category];
  const firstEntry = entries.find(entry => entry.source_chapters.includes(1));
  const secondEntry = entries.find(entry => entry.source_chapters.includes(2));
  const bindingFor = entry => plan.bindings.find(binding => binding.registry_key === entry.registry_key);
  const decisionFor = entry => draft.decisions.find(decision => decision.entry_ref === bindingFor(entry).entry_ref);
  const firstDecision = decisionFor(firstEntry);
  const secondDecision = decisionFor(secondEntry);
  secondDecision.action = 'merge';
  secondDecision.target_ref = firstDecision.entry_ref;
  delete secondDecision.patch;
  return {
    chapters,
    registry,
    plan,
    decisions,
    firstDecision,
    manifest: {
      chapters: [1, 2].map(number => ({ number, title: `第${number}章` }))
    }
  };
}

function assembleTwoChapterMerge(value) {
  return assembleDomainMergedBook({
    manifest: value.manifest,
    chapters: value.chapters,
    registry: value.registry,
    work_plan: value.plan,
    decisions: value.decisions
  });
}

test('four domain decisions assemble one valid merged five-category book', () => {
  const value = fixture();
  assert.deepEqual(value.plan.inputs.map(input => input.unit), DOMAIN_UNITS);

  const merged = assemble(value);

  assert.deepEqual(validateMergedBook(merged, value.manifest, [value.chapter]), []);
  assert.deepEqual(
    Object.keys(merged).filter(key => ['characters', 'items', 'skills', 'factions', 'chapter_summaries'].includes(key)).sort(),
    ['characters', 'items', 'skills', 'factions', 'chapter_summaries'].sort()
  );
  assert.equal('events' in merged, false);
  assert.equal('quantity_review' in merged, false);
  assert.equal(merged.characters.length, 2);
  assert.equal(merged.skills[0].techniques[0].name, '八方藏刀式');
  assert.equal(merged.candidate_resolutions.length, value.registry.stats.input_candidates);
  assert.equal(merged.candidate_resolutions.every(row => row.merged_to || row.resolution === 'rejected'), true);
});

test('domain assembly preserves non-empty semantic scalar patches', () => {
  const value = fixture();
  const characterDraft = value.decisions.find(draft => draft.unit === 'distill:characters');
  const huFei = characterDraft.decisions.find(decision => (
    value.plan.bindings.find(binding => binding.entry_ref === decision.entry_ref)?.registry_key
    === value.registry.categories.characters.find(entry => entry.canonical_name === '胡斐').registry_key
  ));
  huFei.patch.rank = '炉火纯青';
  huFei.patch.description = '胡斐在全书证据中展现出炉火纯青的刀法修为。';

  const merged = assemble(value);
  const character = merged.characters.find(entry => entry.name === '胡斐');

  assert.equal(character.rank, '炉火纯青');
  assert.equal(character.description, '胡斐在全书证据中展现出炉火纯青的刀法修为。');
});

test('accepted full-book scalar patches override conflicting chapter values', () => {
  const value = twoChapterMergeFixture('characters', {
    local_key: 'character:first', name: '同名客', aliases: [], identities: [], factions: [], skills: [],
    level: '重要', rank: '初窥门径', description: '早期判断。', source_refs: [sourceRef(1, '早期判断。')]
  }, {
    local_key: 'character:second', name: '同名客', aliases: [], identities: [], factions: [], skills: [],
    level: '核心', rank: '登堂入室', description: '后期判断。', source_refs: [sourceRef(2, '后期判断。')]
  });
  value.firstDecision.patch.rank = '炉火纯青';
  value.firstDecision.patch.description = '全书证据确认其武学境界与经历。';

  const character = assembleTwoChapterMerge(value).characters[0];

  assert.equal(character.rank, '炉火纯青');
  assert.equal(character.description, '全书证据确认其武学境界与经历。');
});

test('accepted alias order is preserved through domain assembly', () => {
  const value = twoChapterMergeFixture('characters', {
    local_key: 'character:first', name: '同名客', aliases: [], identities: [], factions: [], skills: [],
    level: null, rank: null, description: null, source_refs: [sourceRef(1, '初见同名客')]
  }, {
    local_key: 'character:second', name: '同名客', aliases: [], identities: [], factions: [], skills: [],
    level: null, rank: null, description: null, source_refs: [sourceRef(2, '再见同名客')]
  });
  value.firstDecision.patch.aliases = ['Zulu后称', 'Alpha早称'];

  const character = assembleTwoChapterMerge(value).characters[0];

  assert.deepEqual(character.aliases, ['Zulu后称', 'Alpha早称']);
});

test('accepted techniques patch closes repeated-technique description conflicts', () => {
  const value = twoChapterMergeFixture('skills', {
    local_key: 'skill:first', name: '同名剑法', aliases: [], types: ['剑法'], factions: [], rank: null,
    description: null, techniques: [{ name: '起手式', description: '初见。' }],
    source_refs: [sourceRef(1, '初见起手式')]
  }, {
    local_key: 'skill:second', name: '同名剑法', aliases: [], types: ['剑法'], factions: [], rank: null,
    description: null, techniques: [{ name: '起手式', description: '后证。' }],
    source_refs: [sourceRef(2, '后证起手式')]
  });
  value.firstDecision.patch.techniques = [{ name: '起手式', description: '全书证据综合描述。' }];

  const skill = assembleTwoChapterMerge(value).skills[0];

  assert.deepEqual(skill.techniques, [{ name: '起手式', description: '全书证据综合描述。' }]);
});

test('pending, missing, duplicate, and cyclic domain decisions fail closed', () => {
  for (const mutation of ['pending', 'missing', 'duplicate', 'cycle']) {
    const value = fixture();
    const characters = value.plan.inputs.find(input => input.unit === 'distill:characters');
    const draft = value.decisions.find(item => item.unit === characters.unit);
    const rows = draft.decisions.filter(row => characters.entries.some(entry => entry.entry_ref === row.entry_ref));
    if (mutation === 'pending') rows[0].action = 'pending';
    if (mutation === 'missing') draft.decisions = draft.decisions.filter(row => row !== rows[0]);
    if (mutation === 'duplicate') draft.decisions.push(structuredClone(rows[0]));
    if (mutation === 'cycle') {
      rows[0].action = 'merge';
      rows[0].target_ref = rows[1].entry_ref;
      delete rows[0].patch;
      rows[1].action = 'merge';
      rows[1].target_ref = rows[0].entry_ref;
      delete rows[1].patch;
    }

    assert.throws(
      () => assemble(value),
      error => error.code === 'DOMAIN_ASSEMBLY_INCOMPLETE',
      mutation
    );
  }
});

test('domain assembly bytes are stable when accepted decision documents arrive out of order', () => {
  const value = fixture();
  const first = assemble(value);
  const repeated = assemble(value);
  const reversed = assemble(value, [...value.decisions].reverse());

  assert.equal(JSON.stringify(first), JSON.stringify(repeated));
  assert.equal(JSON.stringify(first), JSON.stringify(reversed));
});

test('domain assembly preserves unquarantined generic techniques for review', () => {
  const value = fixture();
  value.registry.categories.skills[0].record.techniques.push({
    name: '挥手一击',
    named_in_source: true,
    description: '尚未经过 basic registry quarantine 的动作记录。'
  });

  const merged = assemble(value);

  assert.equal(merged.skills[0].techniques.some(technique => technique.name === '挥手一击'), false);
});
