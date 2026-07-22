'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTypeArray, TYPE_TAXONOMIES, TYPE_ALIASES } = require('../scripts/lib/type-taxonomy');
const { validateWorkerChapterDraft, normalizeAcceptedChapterDraft } = require('../scripts/lib/chapter-contract');
const { v7WorkerDraft, expectedChapter } = require('./helpers');

describe('normalizeTypeArray', () => {
  it('normalizes only explicit one-to-one aliases', () => {
    const result = normalizeTypeArray('items', ['weapon', '暗器', 'weapon'], '$.items[0].types');
    assert.deepEqual(result.values, ['武器', '暗器']);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.normalizations, [{
      field_path: '$.items[0].types[0]',
      original_value: 'weapon',
      normalized_value: '武器',
      normalization_rule: 'items.weapon'
    }]);
  });

  it('rejects ambiguous or unknown English values', () => {
    assert.deepEqual(
      normalizeTypeArray('items', ['book'], '$.items[0].types').errors.map(issue => issue.code),
      ['TYPE_VALUE_UNKNOWN']
    );
    assert.deepEqual(
      normalizeTypeArray('items', ['random_xyz'], '$.items[0].types').errors.map(issue => issue.code),
      ['TYPE_VALUE_UNKNOWN']
    );
  });

  it('normalizes keys mechanically (case / underscore / hyphen / whitespace)', () => {
    const cases = [
      ['skills', 'Internal_Skill', '内功'],
      ['skills', 'sword-skill', '剑法'],
      ['skills', '  poison  ', '毒功'],
      ['items', 'WEAPON', '武器'],
      ['factions', 'Merchant Guild', '商会']
    ];
    for (const [category, input, expected] of cases) {
      const result = normalizeTypeArray(category, [input], `$.${category}[0].types`);
      assert.deepEqual(result.errors, [], `${input} should not error`);
      assert.deepEqual(result.values, [expected], `${input} -> ${expected}`);
    }
  });

  it('normalizes common Chinese synonym variants', () => {
    assert.deepEqual(normalizeTypeArray('skills', ['剑术'], '$.skills[0].types').values, ['剑法']);
    assert.deepEqual(normalizeTypeArray('items', ['兵器'], '$.items[0].types').values, ['武器']);
    assert.deepEqual(normalizeTypeArray('factions', ['宗派'], '$.factions[0].types').values, ['门派']);
  });

  it('preserves first-seen order and deduplicates after normalization', () => {
    const result = normalizeTypeArray('skills', ['内功', 'internal_skill', '剑法'], '$.skills[0].types');
    assert.deepEqual(result.values, ['内功', '剑法']);
    assert.equal(result.normalizations.length, 1);
    assert.equal(result.normalizations[0].original_value, 'internal_skill');
  });

  it('does not share alias maps across categories', () => {
    const result = normalizeTypeArray('factions', ['weapon'], '$.factions[0].types');
    assert.deepEqual(result.errors.map(issue => issue.code), ['TYPE_VALUE_UNKNOWN']);
  });

  it('accepts all whitelist values without normalization', () => {
    for (const [category, values] of Object.entries(TYPE_TAXONOMIES)) {
      const result = normalizeTypeArray(category, [...values], `$.${category}[0].types`);
      assert.deepEqual(result.errors, []);
      assert.deepEqual(result.normalizations, []);
      assert.deepEqual(result.values, [...values]);
    }
  });

  it('rejects non-string and empty values', () => {
    const result = normalizeTypeArray('skills', [null, '', 123], '$.skills[0].types');
    assert.equal(result.errors.length, 3);
    assert.ok(result.errors.every(issue => issue.code === 'TYPE_VALUE_INVALID'));
  });

  it('rejects unknown category', () => {
    const result = normalizeTypeArray('weapons', ['武器'], '$.weapons[0].types');
    assert.deepEqual(result.errors.map(issue => issue.code), ['TYPE_CATEGORY_UNKNOWN']);
  });

  it('rejects non-array input', () => {
    const result = normalizeTypeArray('skills', '内功', '$.skills[0].types');
    assert.deepEqual(result.errors.map(issue => issue.code), ['TYPE_ARRAY_INVALID']);
  });

  it('all aliases map to valid whitelist values', () => {
    for (const [category, aliases] of Object.entries(TYPE_ALIASES)) {
      const taxonomy = new Set(TYPE_TAXONOMIES[category]);
      for (const [alias, target] of Object.entries(aliases)) {
        assert.ok(taxonomy.has(target), `${category} alias "${alias}" -> "${target}" not in whitelist`);
      }
    }
  });
});

describe('validateWorkerChapterDraft', () => {
  it('accepts a valid v7 worker draft', () => {
    const draft = v7WorkerDraft();
    const errors = validateWorkerChapterDraft(draft, expectedChapter());
    assert.deepEqual(errors, []);
  });

  it('worker output rejects envelope and single type fields', () => {
    const draft = v7WorkerDraft();
    const wrapped = { unit: 'chapter:001', ...draft };
    assert.deepEqual(
      validateWorkerChapterDraft(wrapped, expectedChapter()).map(issue => issue.code),
      ['WORKER_TOP_LEVEL_FIELDS_INVALID']
    );
    const withType = v7WorkerDraft();
    withType.items[0].type = '武器';
    assert.ok(validateWorkerChapterDraft(withType, expectedChapter()).some(issue => issue.code === 'LEGACY_TYPE_FIELD'));
  });

  it('rejects transport fields on entities', () => {
    const draft = v7WorkerDraft();
    draft.characters[0].id = 'char:001';
    const errors = validateWorkerChapterDraft(draft, expectedChapter());
    assert.ok(errors.some(issue => issue.code === 'WORKER_FIELD_FORBIDDEN'));
  });

  it('rejects unknown type values in worker output', () => {
    const draft = v7WorkerDraft();
    draft.skills[0].types = ['magic'];
    const errors = validateWorkerChapterDraft(draft, expectedChapter());
    assert.ok(errors.some(issue => issue.code === 'TYPE_VALUE_UNKNOWN'));
  });
});

describe('normalizeAcceptedChapterDraft', () => {
  it('injects controller-owned fields and normalizes types', () => {
    const draft = v7WorkerDraft();
    draft.items[0].types = ['weapon', '暗器'];
    const expected = expectedChapter();
    const { chapter, normalizations, errors } = normalizeAcceptedChapterDraft(draft, expected);
    assert.deepEqual(errors, []);
    assert.equal(chapter.schema_version, 7);
    assert.equal(chapter.chapter, 1);
    assert.equal(chapter.title, '第一章 起始');
    assert.equal(chapter.source_hash, 'abc123');
    assert.equal(chapter.characters[0].local_key, 'character:甲');
    assert.deepEqual(chapter.items[0].types, ['武器', '暗器']);
    assert.equal(normalizations.length, 1);
    assert.equal(normalizations[0].original_value, 'weapon');
  });

  it('rejects worker-authored identity fields', () => {
    const draft = v7WorkerDraft();
    draft.characters[0].local_key = 'custom:key';
    const { errors } = normalizeAcceptedChapterDraft(draft, expectedChapter());
    assert.ok(errors.some(issue => issue.code === 'WORKER_FIELD_FORBIDDEN'));
  });

  it('rejects top-level transport fields', () => {
    const draft = v7WorkerDraft({ schema_version: 7 });
    const { errors } = normalizeAcceptedChapterDraft(draft, expectedChapter());
    assert.ok(errors.some(issue => issue.code === 'WORKER_TOP_LEVEL_FIELDS_INVALID'));
  });

  it('injects chapter number into source_refs', () => {
    const draft = v7WorkerDraft();
    const { chapter } = normalizeAcceptedChapterDraft(draft, expectedChapter({ number: 5 }));
    assert.equal(chapter.characters[0].source_refs[0].chapter, 5);
    assert.equal(chapter.chapter_summary.source_refs[0].chapter, 5);
  });
});
