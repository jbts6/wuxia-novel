'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeEvidenceText,
  validateGroundedRecord
} = require('../scripts/lib/grounding');

function record(overrides = {}) {
  return {
    local_key: 'character:甲',
    name: '甲',
    source_refs: [{ chapter: 3, text: '甲拔剑。' }],
    ...overrides
  };
}

function validate(value, chapterText = '第三章\r\n甲拔剑。') {
  return validateGroundedRecord(value, {
    chapterNumber: 3,
    chapterText,
    label: 'characters[0]'
  });
}

test('normalizes BOM, line endings, Unicode form, and whitespace', () => {
  assert.equal(normalizeEvidenceText('\uFEFFＡ甲\r\n　拔剑。'), 'A甲 拔剑。');
});

test('accepts an exact normalized quote containing the candidate name', () => {
  const result = validate(record(), '第三章\n  甲拔剑。\n');

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.normalizedRefs, [{ chapter: 3, text: '甲拔剑。' }]);
});

test('a fake source quote is rejected', () => {
  const result = validate(record({ source_refs: [{ chapter: 3, text: '甲飞上云端。' }] }),
    '第三章，甲拔剑。');

  assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_QUOTE_NOT_FOUND']);
});

test('a quote from another chapter is rejected', () => {
  const result = validate(record({ source_refs: [{ chapter: 2, text: '甲拔剑。' }] }));

  assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_CHAPTER_MISMATCH']);
});

test('rejects an incomplete source line range', () => {
  const result = validate(record({
    source_refs: [{ chapter: 3, text: '甲拔剑。', line_start: 2 }]
  }));

  assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_LINE_RANGE_INVALID']);
});

test('rejects zero, reversed, and beyond-EOF source line ranges', () => {
  const ranges = [
    { line_start: 0, line_end: 1 },
    { line_start: 2, line_end: 1 },
    { line_start: 2, line_end: 3 }
  ];

  for (const range of ranges) {
    const result = validate(record({
      source_refs: [{ chapter: 3, text: '甲拔剑。', ...range }]
    }));

    assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_LINE_RANGE_INVALID']);
  }
});

test('rejects a source quote that exists only outside the declared line span', () => {
  const result = validate(record({
    source_refs: [{ chapter: 3, text: '甲拔剑。', line_start: 2, line_end: 2 }]
  }), '第三章\n乙旁观。\n甲拔剑。');

  assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_QUOTE_NOT_FOUND']);
});

test('derive mode ignores a worker line span and locates the quote from chapter text', () => {
  const result = validateGroundedRecord(record({
    source_refs: [{ chapter: 3, text: '甲拔剑。', line_start: 2, line_end: 2 }]
  }), {
    chapterNumber: 3,
    chapterText: '第三章\n乙旁观。\n甲拔剑。',
    label: 'characters[0]',
    lineRangeMode: 'derive'
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.normalizedRefs, [{
    chapter: 3,
    text: '甲拔剑。',
    line_start: 3,
    line_end: 3
  }]);
});

test('derive mode maps normalized multiline evidence back to source lines', () => {
  const result = validateGroundedRecord(record({
    source_refs: [{ chapter: 3, text: 'A甲 拔剑。' }]
  }), {
    chapterNumber: 3,
    chapterText: '第三章\r\nＡ甲\r\n　拔剑。',
    label: 'characters[0]',
    lineRangeMode: 'derive'
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.normalizedRefs[0], {
    chapter: 3,
    text: 'A甲 拔剑。',
    line_start: 2,
    line_end: 3
  });
});

test('derive mode recovers a unique ideographic full stop and preserves source typography', () => {
  const result = validateGroundedRecord(record({
    source_refs: [{ chapter: 3, text: '甲拔剑.' }]
  }), {
    chapterNumber: 3,
    chapterText: '第三章\n甲拔剑。',
    label: 'characters[0]',
    lineRangeMode: 'derive'
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.normalizedRefs, [{
    chapter: 3,
    text: '甲拔剑。',
    line_start: 2,
    line_end: 2
  }]);
});

test('derive mode recovers allowlisted Chinese quote typography', () => {
  for (const sourceQuote of ['甲道:“好。”', '甲道:「好。」', '甲道:『好。』']) {
    const result = validateGroundedRecord(record({
      source_refs: [{ chapter: 3, text: '甲道:"好."' }]
    }), {
      chapterNumber: 3,
      chapterText: `第三章\n${sourceQuote}`,
      label: 'characters[0]',
      lineRangeMode: 'derive'
    });

    assert.deepEqual(result.errors, [], sourceQuote);
    assert.equal(result.normalizedRefs[0].text, sourceQuote);
  }
});

test('derive mode rejects an ambiguous typography-folded quote', () => {
  const result = validateGroundedRecord(record({
    source_refs: [{ chapter: 3, text: '甲拔剑.' }]
  }), {
    chapterNumber: 3,
    chapterText: '第三章\n甲拔剑。\n甲拔剑。',
    label: 'characters[0]',
    lineRangeMode: 'derive'
  });

  assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_QUOTE_NOT_FOUND']);
});

test('does not fold punctuation outside the explicit typography allowlist', () => {
  const cases = [
    { worker: '甲,乙', source: '甲、乙' },
    { worker: '甲-乙', source: '甲—乙' },
    { worker: '甲...', source: '甲……' }
  ];

  for (const fixture of cases) {
    const result = validate(record({
      source_refs: [{ chapter: 3, text: fixture.worker }]
    }), `第三章\n${fixture.source}`);

    assert.deepEqual(
      result.errors.map(error => error.code),
      ['SOURCE_QUOTE_NOT_FOUND'],
      fixture
    );
  }
});

test('typography folding does not accept the chapter 015 rewritten quote', () => {
  const rewritten = '楚留香微一沉吟,道:"令尊入关前所接的那封书信,不知你是否瞧见过?不知那信上写着的究竟是什么?"';
  const source = [
    '楚留香靠着屋脊坐了下来,能坐着的时候,他是绝不站着的,他伸展了四肢,',
    '带着笑道:"那么,现在我只求你快些说出那封信上写的究竟是什么?"'
  ].join('');
  const result = validateGroundedRecord(record({
    name: '楚留香',
    source_refs: [{ chapter: 3, text: rewritten }]
  }), {
    chapterNumber: 3,
    chapterText: source,
    label: 'items[6]',
    lineRangeMode: 'derive'
  });

  assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_QUOTE_NOT_FOUND']);
});

test('candidate name must occur in located evidence', () => {
  const result = validate(record({ name: '乙' }));

  assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_NAME_NOT_FOUND']);
  assert.equal(result.errors[0].target, '乙');
});

test('candidate name must occur in the submitted quote, not only its declared line span', () => {
  const result = validate(record({
    source_refs: [{ chapter: 3, text: '拔剑。', line_start: 2, line_end: 2 }]
  }));

  assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_NAME_NOT_FOUND']);
  assert.equal(result.errors[0].target, '甲');
});

test('every technique name must occur in located evidence', () => {
  const skill = record({
    local_key: 'skill:玄门内功',
    name: '玄门内功',
    source_refs: [{ chapter: 3, text: '甲运转玄门内功。' }],
    techniques: [{ name: '飞云掌', named_in_source: true }]
  });
  const result = validateGroundedRecord(skill, {
    chapterNumber: 3,
    chapterText: '第三章\n甲运转玄门内功。',
    label: 'skills[0]'
  });

  assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_NAME_NOT_FOUND']);
  assert.equal(result.errors[0].path, 'skills[0].techniques[0].name');
  assert.equal(result.errors[0].target, '飞云掌');
});

test('technique name must occur in the submitted quote, not only its declared line span', () => {
  const skill = record({
    local_key: 'skill:玄门内功',
    name: '玄门内功',
    source_refs: [{ chapter: 3, text: '玄门内功', line_start: 2, line_end: 2 }],
    techniques: [{ name: '飞云掌', named_in_source: true }]
  });
  const result = validateGroundedRecord(skill, {
    chapterNumber: 3,
    chapterText: '第三章\n甲运转玄门内功，施展飞云掌。',
    label: 'skills[0]'
  });

  assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_NAME_NOT_FOUND']);
  assert.equal(result.errors[0].path, 'skills[0].techniques[0].name');
  assert.equal(result.errors[0].target, '飞云掌');
});
