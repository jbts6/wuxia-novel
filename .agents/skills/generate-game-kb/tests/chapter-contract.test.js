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
  assert.deepEqual(validateChapterDraft(validChapterDraft(), expected), []);
});

test('rejects wrong chapter number or source hash', () => {
  const errors = validateChapterDraft(validChapterDraft({ chapter: 2, source_hash: 'sha256:wrong' }), expected);

  assert.deepEqual(errors.map(error => error.path), ['chapter', 'source_hash']);
});

test('rejects source refs to another chapter during chapter extraction', () => {
  const draft = validChapterDraft({
    characters: [{ local_key: 'character:甲', name: '甲', source_refs: [sourceRef(2)] }]
  });

  assert.ok(codes(draft).includes('SOURCE_CHAPTER_MISMATCH'));
});

test('rejects a technique unless named_in_source is true and name is nonempty', () => {
  const draft = validChapterDraft({
    techniques: [{ local_key: 'technique:x', name: '', named_in_source: false, source_refs: [sourceRef()] }]
  });
  const errors = validateChapterDraft(draft, expected);

  assert.ok(errors.some(error => error.path === 'techniques[0].name'));
  assert.ok(errors.some(error => error.path === 'techniques[0].named_in_source'));
});

test('rejects unnamed ordinary actions represented as techniques', () => {
  const draft = validChapterDraft({
    techniques: [{ local_key: 'technique:挥', name: '全力一挥', named_in_source: false, source_refs: [sourceRef()] }]
  });

  assert.ok(codes(draft).includes('TECHNIQUE_NOT_NAMED'));
});

test('rejects a dialogue without event_local_key', () => {
  const draft = validChapterDraft({
    dialogues: [{ local_key: 'dialogue:x', speaker_name: '甲', text: '话。', source_refs: [sourceRef()] }]
  });

  assert.ok(codes(draft).includes('DIALOGUE_EVENT_REQUIRED'));
});

test('allows multiple chapter dialogue candidates for the same event_local_key', () => {
  const dialogue = { event_local_key: 'event:相逢', speaker_name: '甲', text: '话。', source_refs: [sourceRef()] };
  const draft = validChapterDraft({
    dialogues: [
      { ...dialogue, local_key: 'dialogue:a' },
      { ...dialogue, local_key: 'dialogue:b' }
    ]
  });

  assert.deepEqual(validateChapterDraft(draft, expected), []);
});

test('rejects duplicate dialogue local keys even when event candidates differ', () => {
  const draft = validChapterDraft({
    dialogues: [
      { local_key: 'dialogue:同键', event_local_key: 'event:相逢', speaker_name: '甲', text: '话一。', source_refs: [sourceRef()] },
      { local_key: 'dialogue:同键', event_local_key: 'event:相逢', speaker_name: '甲', text: '话二。', source_refs: [sourceRef()] }
    ]
  });

  assert.ok(codes(draft).includes('LOCAL_KEY_DUPLICATE'));
});

test('requires a dialogue candidate for a quotable important event', () => {
  const draft = validChapterDraft({ dialogues: [] });

  assert.ok(codes(draft).includes('QUOTABLE_EVENT_DIALOGUE_MISSING'));
});

test('requires a reason when an important event is not quotable', () => {
  const draft = validChapterDraft({
    events: [{
      local_key: 'event:相逢', name: '山中相逢', importance: '重要', quote_status: 'not_quotable',
      source_refs: [sourceRef()]
    }],
    dialogues: []
  });

  assert.ok(codes(draft).includes('NOT_QUOTABLE_REASON_REQUIRED'));
});

test('normalizes stable candidate keys and deterministic chapter coverage', () => {
  const accepted = normalizeChapterDraft(validChapterDraft());

  assert.equal(accepted.items.length, 0);
  assert.equal(accepted.events[0].candidate_key, 'ch001:events:event:相逢');
  assert.equal(accepted.dialogues[0].candidate_key, 'ch001:dialogues:dialogue:相逢');
  assert.equal(accepted.coverage.categories.events.candidate_count, 1);
  assert.equal(accepted.coverage.events.quotable_count, 1);
  assert.equal(accepted.coverage.dialogues.quotable_event_count_with_candidates, 1);
});

test('rejects formal ID fields in AI chapter drafts', () => {
  const draft = validChapterDraft({
    skills: [{ id: 'skill_xuan_men', local_key: 'skill:内功', name: '玄门内功', source_refs: [sourceRef()] }]
  });

  assert.ok(codes(draft).includes('FORMAL_ID_FORBIDDEN'));
});
