'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { sourceRef, validCleanedBook, validMergedBook } = require('./helpers');
const {
  groupCandidates,
  normalizeName,
  validateCleanedBook,
  validateMergedBook
} = require('../scripts/lib/book-contract');
const { buildQuantityReport } = require('../scripts/lib/quantity');

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

test('merged book keeps one event across non-contiguous source chapters', () => {
  const book = validMergedBook();
  const errors = validateMergedBook(book, manifest);

  assert.deepEqual(errors, []);
  assert.deepEqual(book.events[0].source_refs.map(ref => ref.chapter), [1, 3]);
});

test('merged ambiguities are explicit and cleaned books must resolve them', () => {
  const ambiguity = { category: 'characters', name: '平四', candidates: ['character:甲', 'character:乙'] };

  assert.deepEqual(validateMergedBook(validMergedBook({ ambiguities: [ambiguity] }), manifest), []);
  assert.ok(validateCleanedBook(validCleanedBook({ ambiguities: [ambiguity] }), manifest)
    .some(error => error.code === 'AMBIGUITY_UNRESOLVED'));
});

test('cleaned book keeps detailed fields only for core and important characters', () => {
  const minor = {
    local_key: 'character:乙', canonical_name: '乙', aliases: [], level: '次要', identity: '店主',
    biography: '简短定位。', personality: { traits: ['谨慎'], speech_style: '' },
    relationship_names: [], skill_names: [], item_names: [], source_refs: [sourceRef(2)]
  };
  assert.deepEqual(validateCleanedBook(validCleanedBook({ characters: [validCleanedBook().characters[0], minor] }), manifest), []);

  minor.biography = '冗'.repeat(201);
  assert.ok(validateCleanedBook(validCleanedBook({ characters: [minor] }), manifest)
    .some(error => error.code === 'MINOR_CHARACTER_TOO_DETAILED'));
});

test('rejects ordinary items without an approved inclusion reason', () => {
  const item = { ...validCleanedBook().items[0], canonical_name: '随身匕首', inclusion_reason: '普通随身物' };

  assert.ok(validateCleanedBook(validCleanedBook({ items: [item] }), manifest)
    .some(error => error.code === 'ITEM_NOT_IMPORTANT'));
});

test('keeps named low-frequency techniques and rejects unnamed actions', () => {
  const named = { ...validCleanedBook().techniques[0], importance: '低' };
  assert.deepEqual(validateCleanedBook(validCleanedBook({ techniques: [named] }), manifest), []);

  const action = { ...named, canonical_name: '全力一挥', named_in_source: false };
  assert.ok(validateCleanedBook(validCleanedBook({ techniques: [action] }), manifest)
    .some(error => error.code === 'TECHNIQUE_NOT_NAMED'));
});

test('allows at most one dialogue per merged event', () => {
  const first = validCleanedBook().dialogues[0];
  const duplicate = { ...first, local_key: 'dialogue:重复', text: '又一句。' };

  assert.ok(validateCleanedBook(validCleanedBook({ dialogues: [first, duplicate] }), manifest)
    .some(error => error.code === 'DIALOGUE_EVENT_DUPLICATE'));
});

test('quantity report chooses short medium and long ranges by Han character count', () => {
  const book = validCleanedBook();
  const short = buildQuantityReport(book, 100_000, 10);
  const medium = buildQuantityReport(book, 382_000, 20);
  const long = buildQuantityReport(book, 800_000, 50);

  assert.deepEqual(short.categories.characters.target_range, [10, 35]);
  assert.deepEqual(medium.categories.events.target_range, [60, 220]);
  assert.deepEqual(long.categories.dialogues.target_range, [40, 100]);
  assert.equal(medium.review_consumed, false);
  assert.equal(typeof medium.categories.skills.per_chapter_density, 'number');
  assert.equal('passed' in medium, false);
});

test('cleaned book requires a consumed one-time quantity review', () => {
  const book = validCleanedBook({ quantity_review: { consumed: false, explanations: [] } });

  assert.ok(validateCleanedBook(book, manifest).some(error => error.code === 'QUANTITY_REVIEW_REQUIRED'));
});

test('book drafts reject final IDs and a tenth entity category', () => {
  const withId = validMergedBook();
  withId.characters[0].id = 'char_jia';
  assert.ok(validateMergedBook(withId, manifest).some(error => error.code === 'FORMAL_ID_FORBIDDEN'));

  const withActions = validCleanedBook({ actions: [] });
  assert.ok(validateCleanedBook(withActions, manifest).some(error => error.code === 'TOP_LEVEL_FIELD_UNKNOWN'));
});
