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
const { sourceRef, validChapterDraft } = require('./helpers');

const manifest = {
  chapters: [1, 2, 3].map(number => ({ number, title: `第${number}章`, input_hash: `sha256:${number}` }))
};

function validMergedBook(overrides = {}) {
  return {
    schema_version: 1,
    stage: 'merged',
    characters: [{
      local_key: 'character:甲', name: '甲', aliases: [], identities: ['侠客'],
      level: '核心', rank: null, description: '甲在江湖中追查旧事。',
      factions: ['faction:玄门'], skills: ['skill:内功'], source_refs: [sourceRef(1)]
    }],
    skills: [{
      local_key: 'skill:内功', name: '玄门内功', aliases: [], types: ['内功'],
      factions: ['faction:玄门'], rank: null, description: '调息养气。',
      techniques: [{ name: '飞云掌', description: '掌势迅疾。' }], source_refs: [sourceRef(1)]
    }],
    items: [{
      local_key: 'item:灵丹', name: '回生丹', aliases: [], types: ['丹药'],
      description: '用于救治重伤。', source_refs: [sourceRef(2)]
    }],
    factions: [{
      local_key: 'faction:玄门', name: '玄门', aliases: [], types: ['门派'],
      description: '隐居山中。', source_refs: [sourceRef(1)]
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

test('groups exact normalized names but marks distinct identities ambiguous', () => {
  const chapters = [{
    characters: [
      { local_key: 'a', name: ' 平四 ', identities: ['商人'], source_refs: [sourceRef(1)] },
      { local_key: 'b', name: '平 四', identities: ['镖师'], source_refs: [sourceRef(2)] }
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

test('merged books preserve nullable character and skill ranks', () => {
  const missing = validMergedBook();
  delete missing.characters[0].rank;
  delete missing.skills[0].rank;
  const missingErrors = validateMergedBook(missing, manifest);
  assert.equal(missingErrors.some(error => error.path === 'characters[0].rank'), false);
  assert.equal(missingErrors.some(error => error.path === 'skills[0].rank'), false);

  const unresolved = validMergedBook();
  unresolved.characters[0].rank = null;
  unresolved.skills[0].rank = null;
  assert.deepEqual(validateMergedBook(unresolved, manifest), []);

  const invalid = validMergedBook();
  invalid.characters[0].rank = '绝顶';
  invalid.skills[0].rank = '绝学';
  const invalidErrors = validateMergedBook(invalid, manifest);
  assert.ok(invalidErrors.some(error =>
    error.code === 'POWER_RANK_INVALID' && error.path === 'characters[0].rank'));
  assert.ok(invalidErrors.some(error =>
    error.code === 'POWER_RANK_INVALID' && error.path === 'skills[0].rank'));
});

test('merged books reject legacy, inverse, unknown, empty, and placeholder entity fields', () => {
  const cases = [
    ['characters', 'identity', '侠客'],
    ['characters', 'biography', '旧传记'],
    ['characters', 'faction', '玄门'],
    ['characters', 'items', []],
    ['skills', 'type', '内功'],
    ['skills', 'holders', ['甲']],
    ['items', 'type', '丹药'],
    ['items', 'owners', ['甲']],
    ['factions', 'type', '门派'],
    ['factions', 'members', ['甲']],
    ['characters', 'personality', { traits: ['坚毅'] }]
  ];
  for (const [category, field, value] of cases) {
    const book = validMergedBook();
    book[category][0][field] = value;
    assert.ok(validateMergedBook(book, manifest).some(error =>
      error.code === 'ENTITY_FIELD_FORBIDDEN'
      && error.path === `${category}[0].${field}`));
  }

  for (const [field, value] of [['description', ''], ['description', '暂无描述'], ['name', '未知']]) {
    const book = validMergedBook();
    book.characters[0][field] = value;
    assert.ok(validateMergedBook(book, manifest).some(error =>
      ['ENTITY_VALUE_EMPTY', 'ENTITY_VALUE_PLACEHOLDER'].includes(error.code)
      && error.path === `characters[0].${field}`));
  }
});

test('merged techniques and summaries expose only their v7 semantic fields', () => {
  const technique = validMergedBook();
  technique.skills[0].techniques[0].named_in_source = true;
  assert.ok(validateMergedBook(technique, manifest).some(error =>
    error.code === 'ENTITY_FIELD_FORBIDDEN'
    && error.path === 'skills[0].techniques[0].named_in_source'));

  const summary = validMergedBook();
  summary.chapter_summaries[0].key_characters = ['甲'];
  assert.ok(validateMergedBook(summary, manifest).some(error =>
    error.code === 'SUMMARY_FIELD_FORBIDDEN'
    && error.path === 'chapter_summaries[0].key_characters'));
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

test('keeps named low-frequency techniques and rejects unnamed actions', () => {
  const expected = { number: 1, inputHash: 'sha256:chapter' };
  const named = validChapterDraft();
  delete named.skills[0].techniques[0].named_in_source;
  named.skills[0].techniques[0].description = null;
  assert.deepEqual(validateChapterDraft(named, expected), []);

  const action = validChapterDraft();
  action.skills[0].techniques = [{ name: '全力一挥', description: null, named_in_source: false }];
  assert.ok(validateChapterDraft(action, expected)
    .some(error => error.code === 'ENTITY_FIELD_FORBIDDEN'));
});

test('merged source evidence fails closed', () => {
  const missingSource = validMergedBook();
  missingSource.items[0].source_refs = [];
  assert.ok(validateMergedBook(missingSource, manifest)
    .some(error => error.code === 'SOURCE_REFS_REQUIRED'));

  const unknownSource = validMergedBook();
  unknownSource.factions[0].source_refs = [sourceRef(99)];
  assert.ok(validateMergedBook(unknownSource, manifest)
    .some(error => error.code === 'SOURCE_CHAPTER_UNKNOWN'));

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
