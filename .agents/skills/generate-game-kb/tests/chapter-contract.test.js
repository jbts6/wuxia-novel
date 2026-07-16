'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { sourceRef, validChapterDraft } = require('./helpers');
const { normalizeChapterDraft, validateChapterDraft } = require('../scripts/lib/chapter-contract');

const expected = { number: 1, title: '第一章 起始', inputHash: 'sha256:chapter' };

function codes(draft) {
  return validateChapterDraft(draft, expected).map(error => error.code);
}

test('accepts one chapter containing all candidate arrays and one summary', () => {
  assert.deepEqual(validateChapterDraft(validChapterDraft({ dialogues: [] }), expected), []);
});

test('requires a valid power_rank for every character and skill candidate', () => {
  const missing = validChapterDraft();
  delete missing.characters[0].power_rank;
  delete missing.skills[0].power_rank;
  const missingErrors = validateChapterDraft(missing, expected);

  assert.ok(missingErrors.some(error =>
    error.code === 'POWER_RANK_REQUIRED' && error.path === 'characters[0].power_rank'));
  assert.ok(missingErrors.some(error =>
    error.code === 'POWER_RANK_REQUIRED' && error.path === 'skills[0].power_rank'));

  const invalid = validChapterDraft();
  invalid.characters[0].power_rank = '绝世高手';
  invalid.skills[0].power_rank = '绝世神功';
  const invalidErrors = validateChapterDraft(invalid, expected);

  assert.ok(invalidErrors.some(error =>
    error.code === 'POWER_RANK_INVALID' && error.path === 'characters[0].power_rank'));
  assert.ok(invalidErrors.some(error =>
    error.code === 'POWER_RANK_INVALID' && error.path === 'skills[0].power_rank'));
});

test('rejects wrong chapter number or source hash', () => {
  const errors = validateChapterDraft(validChapterDraft({
    chapter: 2,
    source_hash: 'sha256:wrong',
    dialogues: []
  }), expected);

  assert.deepEqual(errors.map(error => error.path), ['chapter', 'source_hash']);
});

test('rejects source refs to another chapter during chapter extraction', () => {
  const draft = validChapterDraft({
    characters: [{ local_key: 'character:甲', name: '甲', source_refs: [sourceRef(2)] }],
    dialogues: []
  });

  assert.ok(codes(draft).includes('SOURCE_CHAPTER_MISMATCH'));
});

test('rejects a technique unless named_in_source is true and name is nonempty', () => {
  const draft = validChapterDraft({
    techniques: [{ local_key: 'technique:x', name: '', named_in_source: false, source_refs: [sourceRef()] }],
    dialogues: []
  });
  const errors = validateChapterDraft(draft, expected);

  assert.ok(errors.some(error => error.path === 'techniques[0].name'));
  assert.ok(errors.some(error => error.path === 'techniques[0].named_in_source'));
});

test('rejects unnamed ordinary actions represented as techniques', () => {
  const draft = validChapterDraft({
    techniques: [{ local_key: 'technique:挥', name: '全力一挥', named_in_source: false, source_refs: [sourceRef()] }],
    dialogues: []
  });

  assert.ok(codes(draft).includes('TECHNIQUE_NOT_NAMED'));
});

test('chapter extraction disables dialogue candidates and accepts an empty compatibility array', () => {
  const withDialogue = validChapterDraft({
    dialogues: [{
      local_key: 'dialogue:相逢',
      event_local_key: 'event:相逢',
      speaker_name: '甲',
      text: '你来了。',
      source_refs: [sourceRef()]
    }]
  });
  assert.ok(codes(withDialogue).includes('DIALOGUE_EXTRACTION_DISABLED'));

  const draft = validChapterDraft({ dialogues: [] });
  assert.deepEqual(validateChapterDraft(draft, expected), []);
});

test('normalizes stable candidate keys and deterministic chapter coverage', () => {
  const accepted = normalizeChapterDraft(validChapterDraft({ dialogues: [] }));

  assert.equal(accepted.items.length, 0);
  assert.equal(accepted.events[0].candidate_key, 'ch001:events:event:相逢');
  assert.deepEqual(accepted.dialogues, []);
  assert.equal(accepted.coverage.categories.events.candidate_count, 1);
  assert.equal(accepted.coverage.events.quotable_count, 1);
  assert.equal(accepted.coverage.dialogues.quotable_event_count_with_candidates, 0);
});

test('rejects formal ID fields in AI chapter drafts', () => {
  const draft = validChapterDraft({
    skills: [{ id: 'skill_xuan_men', local_key: 'skill:内功', name: '玄门内功', source_refs: [sourceRef()] }],
    dialogues: []
  });

  assert.ok(codes(draft).includes('FORMAL_ID_FORBIDDEN'));
});
