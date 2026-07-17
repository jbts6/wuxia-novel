'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { validateChapterDraft } = require('../scripts/lib/chapter-contract');
const {
  groupCandidates,
  normalizeName,
  validateCandidateResolutions,
  validateMergedBook
} = require('../scripts/lib/book-contract');
const { validateDomainDecisionDraft } = require('../scripts/lib/domain-contract');
const { buildFinalData } = require('../scripts/lib/finalize');
const { SEMANTIC_CONTRACT_VERSION } = require('../scripts/lib/semantic-contract');
const { sourceRef, validChapterDraft, validMergedBook } = require('./helpers');

const manifest = {
  chapters: [1, 2, 3].map(number => ({ number, title: `第${number}章`, input_hash: `sha256:${number}` }))
};

test('groups exact normalized names but marks distinct identities ambiguous', () => {
  const chapters = [{
    characters: [
      { local_key: 'a', name: ' 平四 ', identity: '商人', source_refs: [sourceRef(1)] },
      { local_key: 'b', name: '平 四', identity: '镖师', source_refs: [sourceRef(2)] }
    ]
  }];
  const groups = groupCandidates(chapters).characters;

  assert.equal(normalizeName(' 平 四 '), '平四');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].ambiguous, true);
  assert.equal(groups[0].candidates.length, 2);
});

test('merged book validates the retained four entity categories and chapter summaries', () => {
  assert.deepEqual(validateMergedBook(validMergedBook(), manifest), []);
});

test('merged books require valid character and skill ranks', () => {
  const missing = validMergedBook();
  delete missing.characters[0].rank;
  delete missing.skills[0].rank;
  const missingErrors = validateMergedBook(missing, manifest);
  assert.ok(missingErrors.some(error =>
    error.code === 'POWER_RANK_REQUIRED' && error.path === 'characters[0].rank'));
  assert.ok(missingErrors.some(error =>
    error.code === 'POWER_RANK_REQUIRED' && error.path === 'skills[0].rank'));

  const invalid = validMergedBook();
  invalid.characters[0].rank = '绝顶';
  invalid.skills[0].rank = '绝学';
  const invalidErrors = validateMergedBook(invalid, manifest);
  assert.ok(invalidErrors.some(error =>
    error.code === 'POWER_RANK_INVALID' && error.path === 'characters[0].rank'));
  assert.ok(invalidErrors.some(error =>
    error.code === 'POWER_RANK_INVALID' && error.path === 'skills[0].rank'));
});

test('merge candidate resolutions use one finite destination per candidate', () => {
  const chapters = [{
    chapter: 1,
    items: [{
      candidate_key: 'ch001:items:item:回生丹',
      local_key: 'item:回生丹',
      name: '回生丹',
      source_refs: [sourceRef(1)]
    }]
  }];
  const book = validMergedBook({
    candidate_resolutions: [{
      candidate_key: 'ch001:items:item:回生丹',
      resolution: 'merged_to',
      merged_to: 'item:灵丹'
    }]
  });

  assert.deepEqual(validateCandidateResolutions(book, chapters), []);

  book.candidate_resolutions[0] = {
    candidate_key: 'ch001:items:item:回生丹',
    resolution: 'rejected',
    reason: '随便删掉',
    detail: '自由文本不能替代有限原因。'
  };
  assert.ok(validateCandidateResolutions(book, chapters)
    .some(error => error.code === 'CANDIDATE_RESOLUTION_INVALID'));
});

test('merge candidate resolutions reject missing and duplicate decisions', () => {
  const chapters = [{
    chapter: 1,
    items: [{
      candidate_key: 'ch001:items:item:回生丹',
      local_key: 'item:回生丹',
      name: '回生丹',
      source_refs: [sourceRef(1)]
    }]
  }];
  const missing = validMergedBook({ candidate_resolutions: [] });
  assert.ok(validateCandidateResolutions(missing, chapters)
    .some(error => error.code === 'CANDIDATE_RESOLUTION_MISSING'));

  const decision = {
    candidate_key: 'ch001:items:item:回生丹',
    resolution: 'merged_to',
    merged_to: 'item:灵丹'
  };
  const duplicate = validMergedBook({ candidate_resolutions: [decision, { ...decision }] });
  assert.ok(validateCandidateResolutions(duplicate, chapters)
    .some(error => error.code === 'CANDIDATE_RESOLUTION_DUPLICATE'));
});

test('merge candidate resolutions accept finite domain-specific rejection reasons', () => {
  const chapters = [{
    chapter: 1,
    items: [{
      candidate_key: 'ch001:items:item:随身匕首',
      local_key: 'item:随身匕首',
      name: '随身匕首',
      source_refs: [sourceRef(1)]
    }]
  }];
  const book = validMergedBook({
    candidate_resolutions: [{
      candidate_key: 'ch001:items:item:随身匕首',
      resolution: 'rejected',
      reason: 'ordinary_item',
      detail: '普通随身物品不进入最终资料。'
    }]
  });

  assert.deepEqual(validateCandidateResolutions(book, chapters), []);
});

test('merged books retain explicit identity ambiguities for deterministic resolution', () => {
  const ambiguity = { category: 'characters', name: '平四', candidates: ['character:甲', 'character:乙'] };

  assert.deepEqual(validateMergedBook(validMergedBook({ ambiguities: [ambiguity] }), manifest), []);
});

test('ordinary items require an approved inclusion reason before a keep decision', () => {
  const entryRef = 'registry:item:随身匕首';
  const input = {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    unit: 'distill:items',
    input_hash: 'sha256:items',
    allowed_patch_fields: ['canonical_name', 'inclusion_reason'],
    entries: [{
      entry_ref: entryRef,
      category: 'items',
      canonical_name: '随身匕首',
      facts: { importance: '普通' }
    }]
  };
  const draft = {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    unit: input.unit,
    input_hash: input.input_hash,
    decisions: [{
      entry_ref: entryRef,
      action: 'keep',
      patch: { canonical_name: '随身匕首' }
    }],
    notes: []
  };

  assert.ok(validateDomainDecisionDraft(draft, input)
    .some(error => error.code === 'ITEM_INCLUSION_REASON_REQUIRED'));
  draft.decisions[0].patch.inclusion_reason = '剧情关键';
  assert.deepEqual(validateDomainDecisionDraft(draft, input), []);
});

test('keeps named low-frequency techniques and rejects unnamed actions', () => {
  const expected = { number: 1, inputHash: 'sha256:chapter' };
  const named = validChapterDraft();
  assert.deepEqual(validateChapterDraft(named, expected), []);

  const action = validChapterDraft();
  action.skills[0].techniques = [{ name: '全力一挥', named_in_source: false }];
  assert.ok(validateChapterDraft(action, expected)
    .some(error => error.code === 'TECHNIQUE_NOT_NAMED'));
});

test('merged source evidence and projected references fail closed', () => {
  const missingSource = validMergedBook();
  missingSource.items[0].source_refs = [];
  assert.ok(validateMergedBook(missingSource, manifest)
    .some(error => error.code === 'SOURCE_REFS_REQUIRED'));

  const unknownSource = validMergedBook();
  unknownSource.factions[0].source_refs = [sourceRef(99)];
  assert.ok(validateMergedBook(unknownSource, manifest)
    .some(error => error.code === 'SOURCE_CHAPTER_UNKNOWN'));

  const missingReference = validMergedBook();
  missingReference.characters[0].skill_names = ['失踪武功'];
  assert.ok(buildFinalData(missingReference, manifest).issues
    .some(error => error.code === 'REFERENCE_UNRESOLVED' && error.target === '失踪武功'));
});

test('book drafts reject final IDs and every removed top-level category', () => {
  const withId = validMergedBook();
  withId.characters[0].id = 'char_jia';
  assert.ok(validateMergedBook(withId, manifest).some(error => error.code === 'FORMAL_ID_FORBIDDEN'));

  for (const category of ['events', 'locations', 'techniques', 'dialogues']) {
    const withRemoved = validMergedBook({ [category]: [] });
    assert.ok(validateMergedBook(withRemoved, manifest)
      .some(error => error.code === 'TOP_LEVEL_FIELD_UNKNOWN' && error.path === category));
  }
});
