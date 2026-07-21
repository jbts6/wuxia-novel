'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { assembleDeterministicBook } = require('../scripts/lib/book-assembly');

const manifest = { chapters: [{ number: 1, title: '第一章' }, { number: 2, title: '第二章' }] };

function makeChapter(number, entities) {
  return {
    schema_version: 7,
    chapter: number,
    title: `第${number}章`,
    source_hash: `sha256:ch${number}`,
    characters: entities.characters || [],
    skills: entities.skills || [],
    items: entities.items || [],
    factions: entities.factions || [],
    chapter_summary: { summary: `第${number}章摘要。`, source_refs: [{ chapter: number, text: '证据' }] },
    normalizations: []
  };
}

function makeCharacter(name, overrides = {}) {
  return {
    local_key: `character:${name}`,
    name,
    aliases: [],
    identities: [],
    level: '重要',
    rank: '初窥门径',
    description: null,
    factions: [],
    skills: [],
    source_refs: [{ chapter: 1, text: `${name}出现。` }],
    ...overrides
  };
}

function chaptersForNames(names) {
  return names.map((name, i) => makeChapter(i + 1, {
    characters: [makeCharacter(name, { source_refs: [{ chapter: i + 1, text: `${name}出现。` }] })]
  }));
}

function chaptersWithAliasOverlap() {
  return [
    makeChapter(1, { characters: [makeCharacter('甲', { aliases: ['乙'] })] }),
    makeChapter(2, { characters: [makeCharacter('乙', { aliases: ['甲'] })] })
  ];
}

describe('assembleDeterministicBook', () => {
  it('merges only category plus exact normalized name', () => {
    const result = assembleDeterministicBook({ manifest, chapters: chaptersForNames(['陆小凤', '陆小凤', '小凤', '陆小鳳']) });
    assert.equal(result.book.characters.length, 3);
    assert.equal(result.book.characters.filter(entry => entry.name === '陆小凤').length, 1);
  });

  it('alias overlap does not merge records', () => {
    const result = assembleDeterministicBook({ manifest, chapters: chaptersWithAliasOverlap() });
    assert.equal(result.book.characters.length, 2);
  });

  it('filters confirmed generic names into warnings', () => {
    const result = assembleDeterministicBook({ manifest, chapters: chaptersForNames(['店小二', '老刀把子']) });
    assert.deepEqual(result.book.characters.map(entry => entry.name), ['老刀把子']);
    assert.equal(result.review_warnings[0].code, 'GENERIC_CANDIDATE_FILTERED');
    assert.equal(result.review_warnings[0].name, '店小二');
  });

  it('exact special titles survive generic filtering', () => {
    const result = assembleDeterministicBook({ manifest, chapters: chaptersForNames(['老刀把子', '老实和尚']) });
    assert.equal(result.book.characters.length, 2);
    assert.equal(result.review_warnings.length, 0);
  });

  it('merges aliases as stable first-seen union', () => {
    const chapters = [
      makeChapter(1, { characters: [makeCharacter('甲', { aliases: ['乙', '丙'] })] }),
      makeChapter(2, { characters: [makeCharacter('甲', { aliases: ['丙', '丁'], source_refs: [{ chapter: 2, text: '甲。' }] })] })
    ];
    const result = assembleDeterministicBook({ manifest, chapters });
    assert.deepEqual(result.book.characters[0].aliases, ['乙', '丙', '丁']);
  });

  it('resolves description by longest unicode length', () => {
    const chapters = [
      makeChapter(1, { characters: [makeCharacter('甲', { description: '短' })] }),
      makeChapter(2, { characters: [makeCharacter('甲', { description: '这是一个很长的描述', source_refs: [{ chapter: 2, text: '甲。' }] })] })
    ];
    const result = assembleDeterministicBook({ manifest, chapters });
    assert.equal(result.book.characters[0].description, '这是一个很长的描述');
  });

  it('resolves rank by majority vote', () => {
    const chapters = [
      makeChapter(1, { characters: [makeCharacter('甲', { rank: '初窥门径' })] }),
      makeChapter(2, { characters: [makeCharacter('甲', { rank: '登堂入室', source_refs: [{ chapter: 2, text: '甲。' }] })] }),
      makeChapter(3, { characters: [makeCharacter('甲', { rank: '登堂入室', source_refs: [{ chapter: 3, text: '甲。' }] })] })
    ];
    const result = assembleDeterministicBook({ manifest, chapters });
    assert.equal(result.book.characters[0].rank, '登堂入室');
  });

  it('resolves level by priority (核心 > 重要 > 次要)', () => {
    const chapters = [
      makeChapter(1, { characters: [makeCharacter('甲', { level: '次要' })] }),
      makeChapter(2, { characters: [makeCharacter('甲', { level: '核心', source_refs: [{ chapter: 2, text: '甲。' }] })] })
    ];
    const result = assembleDeterministicBook({ manifest, chapters });
    assert.equal(result.book.characters[0].level, '核心');
  });

  it('merges types as union for skills', () => {
    const chapters = [
      makeChapter(1, { skills: [{ local_key: 'skill:内功', name: '玄门内功', aliases: [], types: ['内功'], factions: [], rank: null, description: null, techniques: [], source_refs: [{ chapter: 1, text: '内功。' }] }] }),
      makeChapter(2, { skills: [{ local_key: 'skill:内功', name: '玄门内功', aliases: [], types: ['心法'], factions: [], rank: null, description: null, techniques: [], source_refs: [{ chapter: 2, text: '心法。' }] }] })
    ];
    const result = assembleDeterministicBook({ manifest, chapters });
    assert.deepEqual(result.book.skills[0].types, ['内功', '心法']);
  });

  it('emits field decisions for every entity', () => {
    const chapters = [makeChapter(1, { characters: [makeCharacter('甲')] })];
    const result = assembleDeterministicBook({ manifest, chapters });
    assert.equal(result.deterministic_audit.field_decisions.length, 1);
    const decision = result.deterministic_audit.field_decisions[0];
    assert.equal(decision.category, 'characters');
    assert.equal(decision.name, '甲');
    assert.ok(decision.fields.description);
    assert.ok(decision.fields.rank);
    assert.ok(decision.fields.level);
  });

  it('detects identity collision within same chapter', () => {
    const chapters = [makeChapter(1, {
      characters: [
        makeCharacter('甲', { local_key: 'character:甲1' }),
        makeCharacter('甲', { local_key: 'character:甲2' })
      ]
    })];
    const result = assembleDeterministicBook({ manifest, chapters });
    assert.equal(result.manual_review.length, 1);
    assert.equal(result.manual_review[0].code, 'IDENTITY_COLLISION_REVIEW_REQUIRED');
  });

  it('produces identical results under reversed chapter order', () => {
    const chapters = [
      makeChapter(1, { characters: [makeCharacter('甲', { description: '短', rank: '初窥门径' })] }),
      makeChapter(2, { characters: [makeCharacter('甲', { description: '长描述文本', rank: '登堂入室', source_refs: [{ chapter: 2, text: '甲。' }] })] })
    ];
    const forward = assembleDeterministicBook({ manifest, chapters });
    const backward = assembleDeterministicBook({ manifest, chapters: [...chapters].reverse() });
    assert.equal(forward.book.characters[0].description, backward.book.characters[0].description);
    assert.equal(forward.book.characters[0].rank, backward.book.characters[0].rank);
  });

  it('collects chapter summaries', () => {
    const chapters = [makeChapter(1, {}), makeChapter(2, {})];
    const result = assembleDeterministicBook({ manifest, chapters });
    assert.equal(result.book.chapter_summaries.length, 2);
    assert.equal(result.book.chapter_summaries[0].chapter, 1);
  });
});
