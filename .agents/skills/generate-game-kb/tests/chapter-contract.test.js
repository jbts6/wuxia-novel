'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { sourceRef } = require('./helpers');
const { normalizeChapterDraft, validateChapterDraft } = require('../scripts/lib/chapter-contract');

const expected = { number: 1, title: '第一章 起始', inputHash: 'sha256:chapter' };

function validChapterDraft(overrides = {}) {
  return {
    schema_version: 1,
    chapter: 1,
    title: '第一章 起始',
    source_hash: 'sha256:chapter',
    characters: [{
      local_key: 'character:甲',
      name: '甲',
      aliases: [],
      identities: ['侠客'],
      level: '核心',
      rank: '初窥门径',
      description: '甲追查旧事。',
      factions: ['faction:玄门'],
      skills: ['skill:内功'],
      source_refs: [sourceRef()]
    }],
    skills: [{
      local_key: 'skill:内功',
      name: '玄门内功',
      aliases: [],
      types: ['内功'],
      factions: ['faction:玄门'],
      rank: '初窥门径',
      description: '调息养气。',
      techniques: [{ name: '飞云掌', description: '掌势迅疾。' }],
      source_refs: [sourceRef(1, '甲修习玄门内功并使出飞云掌。')]
    }],
    items: [],
    factions: [{
      local_key: 'faction:玄门',
      name: '玄门',
      aliases: [],
      types: ['门派'],
      description: '隐居山中。',
      source_refs: [sourceRef()]
    }],
    chapter_summary: {
      title: '第一章 起始',
      summary: '甲在山谷中与故人相逢。',
      source_refs: [sourceRef()]
    },
    ...overrides
  };
}

function codes(draft) {
  return validateChapterDraft(draft, expected).map(error => error.code);
}

test('accepts one chapter containing the four entity arrays and chapter_summary', () => {
  assert.deepEqual(validateChapterDraft(validChapterDraft(), expected), []);
});

test('accepts null or omitted uncertain enrichment without inventing normalized values', () => {
  const draft = validChapterDraft({
    characters: [{
      local_key: 'character:甲', name: '甲', source_refs: [sourceRef()]
    }],
    skills: [{
      local_key: 'skill:内功', name: '玄门内功', source_refs: [sourceRef()]
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
  assert.deepEqual(normalized.characters[0].aliases, []);
  assert.deepEqual(normalized.characters[0].identities, []);
  assert.deepEqual(normalized.characters[0].factions, []);
  assert.deepEqual(normalized.characters[0].skills, []);
  assert.equal(normalized.characters[0].level, null);
  assert.equal(normalized.characters[0].rank, null);
  assert.equal(normalized.characters[0].description, null);
  assert.deepEqual(normalized.skills[0].aliases, []);
  assert.deepEqual(normalized.skills[0].types, []);
  assert.deepEqual(normalized.skills[0].factions, []);
  assert.deepEqual(normalized.skills[0].techniques, []);
  assert.equal(normalized.skills[0].rank, null);
  assert.equal(normalized.skills[0].description, null);
  assert.deepEqual(normalized.items[0].aliases, []);
  assert.deepEqual(normalized.items[0].types, []);
  assert.equal(normalized.items[0].description, null);
  assert.deepEqual(normalized.factions[0].aliases, []);
  assert.deepEqual(normalized.factions[0].types, []);
  assert.equal(normalized.factions[0].description, null);
  assert.equal(Object.hasOwn(normalized.items[0], 'inclusion_reason'), false);
});

test('rejects legacy, inverse, unknown, empty, and placeholder entity fields', () => {
  const forbiddenCases = [
    ['characters', 'identity', '侠客'],
    ['characters', 'biography', '旧传记'],
    ['characters', 'faction', '玄门'],
    ['characters', 'items', []],
    ['skills', 'type', '内功'],
    ['skills', 'holders', ['甲']],
    ['items', 'type', '武器'],
    ['items', 'owners', ['甲']],
    ['factions', 'type', '门派'],
    ['factions', 'members', ['甲']],
    ['characters', 'personality', { traits: ['坚毅'] }]
  ];
  for (const [category, field, value] of forbiddenCases) {
    const draft = validChapterDraft();
    if (category === 'items') {
      draft.items = [{ local_key: 'item:铁盒', name: '铁盒', source_refs: [sourceRef()] }];
    }
    draft[category][0][field] = value;
    assert.ok(validateChapterDraft(draft, expected).some(error =>
      error.code === 'ENTITY_FIELD_FORBIDDEN'
      && error.path === `${category}[0].${field}`));
  }

  for (const [field, value] of [['description', ''], ['description', '暂无描述'], ['name', '未知']]) {
    const draft = validChapterDraft();
    draft.characters[0][field] = value;
    assert.ok(validateChapterDraft(draft, expected).some(error =>
      ['ENTITY_VALUE_EMPTY', 'ENTITY_VALUE_PLACEHOLDER'].includes(error.code)
      && error.path === `characters[0].${field}`));
  }
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

test('accepts only name and nullable description on nested techniques', () => {
  const draft = validChapterDraft({
    skills: [{
      local_key: 'skill:内功', name: '玄门内功', rank: '初窥门径', source_refs: [sourceRef()],
      techniques: [{ name: '飞云掌', description: null }]
    }]
  });
  assert.deepEqual(validateChapterDraft(draft, expected), []);

  draft.skills[0].techniques[0].named_in_source = true;
  let errors = validateChapterDraft(draft, expected);
  assert.ok(errors.some(error => error.code === 'ENTITY_FIELD_FORBIDDEN'
    && error.path === 'skills[0].techniques[0].named_in_source'));

  delete draft.skills[0].techniques[0].named_in_source;
  draft.skills[0].techniques[0].name = '';
  errors = validateChapterDraft(draft, expected);
  assert.ok(errors.some(error => error.path === 'skills[0].techniques[0].name'));
});

test('rejects unnamed ordinary actions represented as nested techniques', () => {
  const draft = validChapterDraft({
    skills: [{
      local_key: 'skill:内功', name: '玄门内功', rank: '初窥门径', source_refs: [sourceRef()],
      techniques: [{ name: '全力一挥', description: null, named_in_source: false }]
    }]
  });

  assert.ok(codes(draft).includes('ENTITY_FIELD_FORBIDDEN'));
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
