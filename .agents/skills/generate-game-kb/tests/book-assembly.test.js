'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { validateMergedBook } = require('../scripts/lib/book-contract');
const {
  applyMergeDecision,
  assembleMergedBook,
  createMergeConsolidationWorkItem
} = require('../scripts/lib/book-assembly');
const { createMergeWorkPlan } = require('../scripts/lib/semantic-work');
const { scaleCandidates } = require('./fixtures/merge-clean-scale');

function manifest20() {
  return {
    schema_version: 1,
    run_id: 'run-scale',
    chapters: Array.from({ length: 20 }, (_, index) => ({
      number: index + 1,
      title: `第${index + 1}章`
    }))
  };
}

function acceptedHashes() {
  return Object.fromEntries(Array.from({ length: 20 }, (_, index) => [
    `accepted/chapters/ch_${String(index + 1).padStart(3, '0')}.json`,
    `sha256:${String(index + 1).padStart(64, '0')}`
  ]));
}

function chapters20(candidates = []) {
  const chapters = Array.from({ length: 20 }, (_, index) => ({
    chapter: index + 1,
    characters: [],
    events: [],
    items: [],
    skills: [],
    techniques: [],
    factions: [],
    locations: [],
    dialogues: [],
    summary: {
      title: `第${index + 1}章`,
      summary: `第${index + 1}章摘要。`,
      key_events: [],
      key_characters: [],
      source_refs: [{ chapter: index + 1, text: `第${index + 1}章证据` }]
    }
  }));
  for (const candidate of candidates) {
    const chapter = Number(candidate.candidate_key.slice(2, 5));
    chapters[chapter - 1].characters.push(candidate);
  }
  return chapters;
}

function mergeDraft(input, options = {}) {
  return {
    schema_version: 1,
    stage: 'merge_decision',
    unit: input.unit,
    decisions: input.candidates.map((candidate, index) => ({
      entity_ref: `e${String(index + 1).padStart(4, '0')}`,
      member_refs: [candidate.candidate_ref],
      action: 'merge',
      canonical_name: candidate.name,
      aliases: [],
      fields: { level: options.level || '背景' }
    })),
    ambiguities: []
  };
}

function buildScaleAssembly(count = 1089) {
  const candidates = scaleCandidates(count);
  const chapters = chapters20(candidates);
  const plan = createMergeWorkPlan({ chapters, accepted_hashes: acceptedHashes() });
  const decisions = {};
  const shardProjections = [];
  for (const input of plan.inputs) {
    const bindings = plan.bindings.filter(binding => binding.unit === input.unit);
    const draft = mergeDraft(input);
    decisions[input.unit] = draft;
    shardProjections.push(applyMergeDecision(input, bindings, draft));
  }

  const consolidationWorkItems = {};
  for (const descriptor of plan.consolidations) {
    const relevant = shardProjections.filter(projection => projection.category === descriptor.category);
    const work = createMergeConsolidationWorkItem(relevant, descriptor, plan.upstream_hashes);
    consolidationWorkItems[descriptor.unit] = work;
    decisions[descriptor.unit] = {
      schema_version: 1,
      stage: 'merge_decision',
      unit: descriptor.unit,
      decisions: work.input.entities.map((entity, index) => ({
        entity_ref: `e${String(index + 1).padStart(4, '0')}`,
        member_refs: [entity.entity_ref],
        action: 'merge',
        canonical_name: entity.canonical_name,
        aliases: entity.aliases,
        fields: {}
      })),
      ambiguities: []
    };
  }
  return {
    plan,
    decisions,
    consolidation_work_items: consolidationWorkItems,
    chapters,
    manifest: manifest20()
  };
}

test('short refs expand to all 1,089 exact candidate keys once', () => {
  const input = buildScaleAssembly();
  const result = assembleMergedBook(input);

  assert.equal(result.candidate_resolutions.length, 1089);
  assert.equal(new Set(result.candidate_resolutions.map(row => row.candidate_key)).size, 1089);
  assert.equal(result.characters.length, 1089);
  assert.deepEqual(validateMergedBook(result, input.manifest, input.chapters), []);
});

test('local keys are controller generated and stable for same-name people', () => {
  const candidates = scaleCandidates(2).map((candidate, index) => ({
    ...candidate,
    name: '同名客',
    identity: index === 0 ? '北地刀客' : '南疆剑客'
  }));
  const chapters = chapters20(candidates);
  const plan = createMergeWorkPlan({ chapters, accepted_hashes: acceptedHashes() });
  const input = plan.inputs[0];
  const draft = {
    schema_version: 1,
    stage: 'merge_decision',
    unit: input.unit,
    decisions: input.candidates.map((candidate, index) => ({
      entity_ref: `e000${index + 1}`,
      member_refs: [candidate.candidate_ref],
      action: 'merge',
      canonical_name: '同名客',
      aliases: [],
      fields: { level: '背景', identity: candidate.facts.identity }
    })),
    ambiguities: []
  };
  const assembly = {
    plan,
    decisions: { [input.unit]: draft },
    consolidation_work_items: {},
    chapters,
    manifest: manifest20()
  };
  const first = assembleMergedBook(assembly);
  const second = assembleMergedBook(assembly);

  assert.deepEqual(first.characters.map(row => row.local_key), second.characters.map(row => row.local_key));
  assert.equal(new Set(first.characters.map(row => row.local_key)).size, 2);
  assert.ok(first.characters.every(row => /^character:同名客#[a-f0-9]{8}$/.test(row.local_key)));
});

test('chapter summaries are projected from accepted chapters in manifest order', () => {
  const input = buildScaleAssembly(2);
  input.chapters.reverse();
  const result = assembleMergedBook(input);

  assert.deepEqual(result.chapter_summaries.map(summary => summary.chapter), Array.from({ length: 20 }, (_, index) => index + 1));
  assert.equal(result.chapter_summaries[0].summary, '第1章摘要。');
});

test('missing category decisions block assembly without mutating the plan', () => {
  const input = buildScaleAssembly(121);
  const snapshot = structuredClone(input.plan);
  delete input.decisions[input.plan.inputs[0].unit];

  assert.throws(() => assembleMergedBook(input), { code: 'BOOK_ASSEMBLY_INCOMPLETE' });
  assert.deepEqual(input.plan, snapshot);
});

test('an accepted ambiguity blocks deterministic merge assembly', () => {
  const input = buildScaleAssembly(1);
  const unit = input.plan.inputs[0].unit;
  const ref = input.plan.inputs[0].candidates[0].candidate_ref;
  input.decisions[unit] = {
    schema_version: 1,
    stage: 'merge_decision',
    unit,
    decisions: [{ member_refs: [ref], action: 'ambiguous', detail: '同名异人，证据不足。' }],
    ambiguities: []
  };

  assert.throws(() => assembleMergedBook(input), { code: 'MERGE_AMBIGUITY_UNRESOLVED' });
});
