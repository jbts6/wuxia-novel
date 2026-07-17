'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { sourceRef, validChapterDraft } = require('./helpers');
const { normalizeChapterDraft, validateChapterDraft } = require('../scripts/lib/chapter-contract');

const expected = { number: 1, title: '第一章 起始', inputHash: 'sha256:chapter' };

function codes(draft) {
  return validateChapterDraft(draft, expected).map(error => error.code);
}

test('accepts one chapter containing the four entity arrays and chapter_summary', () => {
  assert.deepEqual(validateChapterDraft(validChapterDraft(), expected), []);
});

test('accepts null or omitted uncertain enrichment without inventing normalized values', () => {
  const draft = validChapterDraft({
    characters: [{
      local_key: 'character:甲', name: '甲', level: null, rank: null,
      faction: null, biography: null, source_refs: [sourceRef()]
    }],
    skills: [{
      local_key: 'skill:内功', name: '玄门内功', rank: null, faction: null,
      techniques: [], source_refs: [sourceRef()]
    }],
    items: [{
      local_key: 'item:铁盒', name: '铁盒', description: null, source_refs: [sourceRef()]
    }],
    factions: [{
      local_key: 'faction:胡家', name: '胡家', description: null, source_refs: [sourceRef()]
    }]
  });

  assert.deepEqual(validateChapterDraft(draft, expected), []);

  const normalized = normalizeChapterDraft(draft);
  assert.equal(normalized.characters[0].rank, null);
  assert.equal(normalized.characters[0].level, null);
  assert.equal(Object.hasOwn(normalized.skills[0], 'description'), false);
  assert.equal(Object.hasOwn(normalized.items[0], 'inclusion_reason'), false);
});

test('rejects invalid non-null rank and level enrichment', () => {
  const invalid = validChapterDraft();
  invalid.characters[0].rank = '绝世高手';
  invalid.characters[0].level = '主角';
  invalid.skills[0].rank = '绝世神功';
  const invalidErrors = validateChapterDraft(invalid, expected);

  assert.ok(invalidErrors.some(error =>
    error.code === 'POWER_RANK_INVALID' && error.path === 'characters[0].rank'));
  assert.ok(invalidErrors.some(error =>
    error.code === 'CHARACTER_LEVEL_INVALID' && error.path === 'characters[0].level'));
  assert.ok(invalidErrors.some(error =>
    error.code === 'POWER_RANK_INVALID' && error.path === 'skills[0].rank'));
});

test('still rejects grounded candidates missing identity or source evidence', () => {
  const draft = validChapterDraft({
    characters: [{ local_key: 'character:甲', rank: null, level: null }]
  });
  const errors = validateChapterDraft(draft, expected);

  assert.ok(errors.some(error =>
    error.code === 'NAME_REQUIRED' && error.path === 'characters[0].name'));
  assert.ok(errors.some(error =>
    error.code === 'SOURCE_REFS_REQUIRED' && error.path === 'characters[0].source_refs'));
});

test('rejects wrong chapter number or source hash', () => {
  const errors = validateChapterDraft(validChapterDraft({
    chapter: 2,
    source_hash: 'sha256:wrong'
  }), expected);

  assert.deepEqual(errors.map(error => error.path), ['chapter', 'source_hash']);
});

test('rejects source refs to another chapter during chapter extraction', () => {
  const draft = validChapterDraft({
    characters: [{
      local_key: 'character:甲', name: '甲', level: '核心', rank: '初窥门径',
      source_refs: [sourceRef(2)]
    }]
  });

  assert.ok(codes(draft).includes('SOURCE_CHAPTER_MISMATCH'));
});

test('delegates exact source grounding when chapter text is available', () => {
  const draft = validChapterDraft({
    characters: [{
      local_key: 'character:甲', name: '甲', level: '核心', rank: '初窥门径',
      source_refs: [sourceRef(1, '甲拔剑。')]
    }],
    items: [], skills: [], factions: [],
    chapter_summary: {
      title: '第一章 起始', summary: '甲拔剑。', source_refs: [sourceRef(1, '甲拔剑。')]
    }
  });
  const groundedExpected = { ...expected, chapterText: '第一章 起始\n甲拔剑。\n' };

  assert.deepEqual(validateChapterDraft(draft, groundedExpected), []);

  draft.characters[0].source_refs[0].text = '甲飞上云端。';
  assert.ok(validateChapterDraft(draft, groundedExpected).some(error =>
    error.code === 'SOURCE_QUOTE_NOT_FOUND' && error.path === 'characters[0].source_refs[0].text'));
});

test('rejects a nested technique unless named_in_source is true and name is nonempty', () => {
  const draft = validChapterDraft({
    skills: [{
      local_key: 'skill:内功', name: '玄门内功', rank: '初窥门径', source_refs: [sourceRef()],
      techniques: [{ name: '', named_in_source: false }]
    }]
  });
  const errors = validateChapterDraft(draft, expected);

  assert.ok(errors.some(error => error.path === 'skills[0].techniques[0].name'));
  assert.ok(errors.some(error => error.path === 'skills[0].techniques[0].named_in_source'));
});

test('rejects unnamed ordinary actions represented as nested techniques', () => {
  const draft = validChapterDraft({
    skills: [{
      local_key: 'skill:内功', name: '玄门内功', rank: '初窥门径', source_refs: [sourceRef()],
      techniques: [{ name: '全力一挥', named_in_source: false }]
    }]
  });

  assert.ok(codes(draft).includes('TECHNIQUE_NOT_NAMED'));
});

test('rejects removed top-level categories and the stale summary field', () => {
  for (const field of ['events', 'locations', 'dialogues', 'techniques', 'summary']) {
    const draft = validChapterDraft({ [field]: [] });
    assert.ok(validateChapterDraft(draft, expected).some(error =>
      error.code === 'CHAPTER_FIELD_FORBIDDEN' && error.path === field));
  }
});

test('normalizes stable candidate keys without the removed coverage projection', () => {
  const accepted = normalizeChapterDraft(validChapterDraft());

  assert.equal(accepted.items.length, 0);
  assert.equal(accepted.skills[0].candidate_key, 'ch001:skills:skill:内功');
  assert.equal(Object.hasOwn(accepted, 'coverage'), false);
});

test('requires chapter_summary.summary and grounded source refs', () => {
  const missing = validChapterDraft({ chapter_summary: { title: '第一章 起始', summary: '' } });
  const errors = validateChapterDraft(missing, expected);
  assert.ok(errors.some(error => error.code === 'SUMMARY_TEXT_REQUIRED'
    && error.path === 'chapter_summary.summary'));
  assert.ok(errors.some(error => error.code === 'SOURCE_REFS_REQUIRED'
    && error.path === 'chapter_summary.source_refs'));
});

test('rejects formal ID fields in AI chapter drafts', () => {
  const draft = validChapterDraft({
    skills: [{
      id: 'skill_xuan_men', local_key: 'skill:内功', name: '玄门内功', rank: '初窥门径',
      techniques: [], source_refs: [sourceRef()]
    }]
  });

  assert.ok(codes(draft).includes('FORMAL_ID_FORBIDDEN'));
});
