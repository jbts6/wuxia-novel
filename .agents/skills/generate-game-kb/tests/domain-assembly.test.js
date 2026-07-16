'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildCandidateRegistry } = require('../scripts/lib/candidate-registry');
const { normalizeChapterDraft } = require('../scripts/lib/chapter-contract');
const { validateCleanedBook, validateMergedBook } = require('../scripts/lib/book-contract');
const { assembleDomainCleanedBook, assembleDomainMergedBook } = require('../scripts/lib/domain-assembly');
const { createDomainWorkPlan } = require('../scripts/lib/domain-work');
const { SEMANTIC_CONTRACT_VERSION } = require('../scripts/lib/semantic-contract');
const { sourceRef, validChapterDraft } = require('./helpers');

function fixture() {
  const chapter = normalizeChapterDraft(validChapterDraft({
    characters: [
      {
        local_key: 'character:hu-a', name: '胡斐', identity: '胡家后人', level: '核心',
        power_rank: '登堂入室',
        biography: '胡斐追查父仇。', personality: { traits: ['侠义'], speech_style: '直率' },
        relationship_names: [], skill_names: ['胡家刀法'], item_names: [], source_refs: [sourceRef(1, '胡斐')]
      },
      {
        local_key: 'character:hu-b', name: '胡斐', identity: '飞狐传人', level: '核心',
        power_rank: '登堂入室',
        biography: '江湖人称雪山飞狐。', personality: { traits: ['果断'], speech_style: '简练' },
        relationship_names: [], skill_names: ['胡家刀法'], item_names: [], source_refs: [sourceRef(1, '雪山飞狐')]
      }
    ],
    events: [{
      local_key: 'event:meet', name: '雪山相逢', importance: '重要', quote_status: 'quotable',
      cause: '群雄寻宝', process: '胡斐现身阻止争斗', result: '众人暂时罢手',
      participant_names: ['胡斐'], location_names: ['雪山'], source_refs: [sourceRef(1, '雪山相逢')]
    }],
    items: [{
      local_key: 'item:铁盒', name: '铁盒', type: '信物', description: '藏有关键书信。',
      inclusion_reason: '剧情关键', source_refs: [sourceRef(1, '铁盒中的书信')]
    }],
    skills: [{
      local_key: 'skill:hu-dao', name: '胡家刀法', type: '刀法', description: '胡家家传刀法。',
      power_rank: '登堂入室',
      holder_names: ['胡斐'], technique_names: ['八方藏刀式'], source_refs: [sourceRef(1, '胡家刀法')]
    }],
    techniques: [{
      local_key: 'technique:ba-fang', name: '八方藏刀式', named_in_source: true,
      source_skill_local_key: 'skill:hu-dao', description: '刀势从八方回护。', source_refs: [sourceRef(1, '八方藏刀式')]
    }],
    factions: [],
    locations: [{
      local_key: 'location:snow', name: '雪山', region: '关外', description: '终年积雪的高山。',
      source_refs: [sourceRef(1, '雪山绝顶')]
    }],
    dialogues: [{
      local_key: 'dialogue:meet', event_local_key: 'event:meet', speaker_name: '胡斐',
      text: '且慢动手。', source_refs: [sourceRef(1, '且慢动手')]
    }],
    summary: {
      title: '模型摘要', summary: '这段文本不得进入机械章节摘要。',
      key_events: [], key_characters: [], source_refs: [sourceRef(1, '摘要')]
    }
  }));
  const registry = buildCandidateRegistry([chapter]);
  const plan = createDomainWorkPlan({ registry, accepted_hashes: {} });
  const decisions = plan.inputs.map(input => ({
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    unit: input.unit,
    input_hash: input.input_hash,
    decisions: input.entries.map(entry => ({
      entry_ref: entry.entry_ref,
      action: 'keep',
      patch: {
        canonical_name: entry.canonical_name,
        ...(['characters', 'skills'].includes(entry.category)
          ? { power_rank: '登堂入室' }
          : {})
      }
    })),
    notes: []
  }));
  const plotInput = plan.inputs.find(input => input.domain === 'plot');
  const plotDraft = decisions.find(draft => draft.unit === 'distill:plot');
  const huEntries = plotInput.entries.filter(entry => entry.category === 'characters');
  plotDraft.decisions.find(row => row.entry_ref === huEntries[1].entry_ref).action = 'merge';
  plotDraft.decisions.find(row => row.entry_ref === huEntries[1].entry_ref).target_ref = huEntries[0].entry_ref;
  return {
    chapter,
    registry,
    plan,
    decisions,
    manifest: { chapters: [{ number: 1, title: '第一章 雪山相逢' }] }
  };
}

test('four domain decisions deterministically assemble a valid merged and cleaned nine-file book', () => {
  const value = fixture();
  const merged = assembleDomainMergedBook({
    manifest: value.manifest,
    chapters: [value.chapter],
    registry: value.registry,
    work_plan: value.plan,
    decisions: value.decisions
  });
  const cleaned = assembleDomainCleanedBook(merged);

  assert.deepEqual(validateMergedBook(merged, value.manifest, [value.chapter]), []);
  assert.deepEqual(validateCleanedBook(cleaned, value.manifest, [value.chapter]), []);
  assert.equal(merged.characters.length, 1);
  assert.equal(merged.candidate_resolutions.length, value.registry.stats.input_candidates);
  assert.equal(merged.candidate_resolutions.every(row => row.merged_to || row.resolution === 'rejected'), true);
  assert.equal(merged.techniques[0].source_skill_name, '胡家刀法');
  assert.equal(merged.dialogues[0].event_key, merged.events[0].local_key);
  assert.equal(merged.chapter_summaries[0].key_events.includes('雪山相逢'), true);
  assert.match(merged.chapter_summaries[0].summary, /雪山相逢/);
  assert.doesNotMatch(merged.chapter_summaries[0].summary, /不得进入/);
  assert.equal(cleaned.stage, 'cleaned');
  assert.equal(cleaned.quantity_review.consumed, true);
});

test('pending, missing, duplicate, and merge-cycle decisions block assembly', () => {
  for (const mutation of ['pending', 'missing', 'duplicate', 'cycle']) {
    const value = fixture();
    const plot = value.decisions.find(draft => draft.unit === 'distill:plot');
    const characterRows = plot.decisions.filter(row => {
      const input = value.plan.inputs.find(item => item.unit === plot.unit);
      return input.entries.find(entry => entry.entry_ref === row.entry_ref)?.category === 'characters';
    });
    if (mutation === 'pending') characterRows[0].action = 'pending';
    if (mutation === 'missing') plot.decisions = plot.decisions.filter(row => row !== characterRows[0]);
    if (mutation === 'duplicate') plot.decisions.push(structuredClone(characterRows[0]));
    if (mutation === 'cycle') {
      characterRows[0].action = 'merge';
      characterRows[0].target_ref = characterRows[1].entry_ref;
      characterRows[1].action = 'merge';
      characterRows[1].target_ref = characterRows[0].entry_ref;
    }
    assert.throws(
      () => assembleDomainMergedBook({
        manifest: value.manifest,
        chapters: [value.chapter],
        registry: value.registry,
        work_plan: value.plan,
        decisions: value.decisions
      }),
      error => error.code === 'DOMAIN_ASSEMBLY_INCOMPLETE',
      mutation
    );
  }
});

test('domain assembly is byte-stable when decision documents arrive out of order', () => {
  const value = fixture();
  const first = assembleDomainMergedBook({
    manifest: value.manifest,
    chapters: [value.chapter],
    registry: value.registry,
    work_plan: value.plan,
    decisions: value.decisions
  });
  const second = assembleDomainMergedBook({
    manifest: value.manifest,
    chapters: [value.chapter],
    registry: value.registry,
    work_plan: value.plan,
    decisions: [...value.decisions].reverse()
  });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test('domain clean deterministically normalizes detailed and minor character fields', () => {
  const value = fixture();
  const merged = assembleDomainMergedBook({
    manifest: value.manifest,
    chapters: [value.chapter],
    registry: value.registry,
    work_plan: value.plan,
    decisions: value.decisions
  });
  const detailed = { ...structuredClone(merged.characters[0]) };
  delete detailed.personality;
  const minor = {
    ...structuredClone(merged.characters[0]),
    local_key: 'character:minor',
    canonical_name: '次要人物',
    level: '次要',
    biography: '冗'.repeat(205),
    personality: { traits: ['一', '二', '三'], speech_style: '简短' }
  };

  const cleaned = assembleDomainCleanedBook({ ...merged, characters: [detailed, minor] });

  assert.deepEqual(cleaned.characters[0].personality, { traits: [], speech_style: '' });
  assert.equal([...cleaned.characters[1].biography].length, 200);
  assert.deepEqual(cleaned.characters[1].personality.traits, ['一', '二']);
  assert.deepEqual(validateCleanedBook(cleaned, value.manifest, [value.chapter]), []);
});
