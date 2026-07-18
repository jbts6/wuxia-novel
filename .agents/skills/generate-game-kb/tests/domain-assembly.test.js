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
        local_key: 'character:hu-fei', name: '胡斐', identity: '胡家后人', level: '核心', rank: '登堂入室',
        source_refs: [sourceRef(1, '胡斐追查父仇')]
      },
      {
        local_key: 'character:miao', name: '苗人凤', identity: '金面佛', level: '重要', rank: '炉火纯青',
        source_refs: [sourceRef(1, '苗人凤现身')]
      }
    ],
    items: [{
      local_key: 'item:tie-he', name: '铁盒', type: '其他', inclusion_reason: '剧情关键',
      source_refs: [sourceRef(1, '铁盒藏有书信')]
    }],
    skills: [{
      local_key: 'skill:hu-dao', name: '胡家刀法', type: '刀法', rank: '登堂入室',
      techniques: [{ name: '八方藏刀式', named_in_source: true }],
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

  assert.equal(merged.skills[0].techniques.some(technique => technique.name === '挥手一击'), true);
});
