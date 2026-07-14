'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { sourceRef, validChapterDraft } = require('./helpers');
const { validateChapterDraft } = require('../scripts/lib/chapter-contract');

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

test('rejects two dialogues for the same event_local_key', () => {
  const dialogue = { event_local_key: 'event:相逢', speaker_name: '甲', text: '话。', source_refs: [sourceRef()] };
  const draft = validChapterDraft({
    dialogues: [
      { ...dialogue, local_key: 'dialogue:a' },
      { ...dialogue, local_key: 'dialogue:b' }
    ]
  });

  assert.ok(codes(draft).includes('DIALOGUE_EVENT_DUPLICATE'));
});

test('rejects formal ID fields in AI chapter drafts', () => {
  const draft = validChapterDraft({
    skills: [{ id: 'skill_xuan_men', local_key: 'skill:内功', name: '玄门内功', source_refs: [sourceRef()] }]
  });

  assert.ok(codes(draft).includes('FORMAL_ID_FORBIDDEN'));
});
