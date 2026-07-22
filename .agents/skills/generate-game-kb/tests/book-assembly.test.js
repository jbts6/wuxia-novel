'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { assembleDeterministicBook } = require('../scripts/lib/book-assembly');

const manifest = {
  chapters: [1, 2, 3, 4].map(number => ({ number, title: `第${number}章` }))
};

function makeChapter(number, entities = {}) {
  return {
    schema_version: 7,
    chapter: number,
    title: `第${number}章`,
    source_hash: `sha256:ch${number}`,
    characters: entities.characters || [],
    skills: entities.skills || [],
    items: entities.items || [],
    factions: entities.factions || [],
    chapter_summary: {
      summary: `第${number}章摘要。`,
      source_refs: [{ chapter: number, text: `第${number}章证据。` }]
    },
    normalizations: entities.normalizations || []
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

function makeTyped(category, name, types, overrides = {}) {
  return {
    local_key: `${category.slice(0, -1)}:${name}`,
    name,
    aliases: [],
    types,
    description: null,
    source_refs: [{ chapter: 1, text: `${name}出现。` }],
    ...(category === 'skills' ? {
      factions: [], rank: null, techniques: []
    } : {}),
    ...overrides
  };
}

function chaptersForNames(names) {
  return names.map((name, index) => makeChapter(index + 1, {
    characters: [makeCharacter(name, {
      source_refs: [{ chapter: index + 1, text: `${name}出现。` }]
    })]
  }));
}

function chaptersWithAliasOverlap() {
  return [
    makeChapter(1, { characters: [makeCharacter('甲', { aliases: ['乙'] })] }),
    makeChapter(2, { characters: [makeCharacter('乙', {
      aliases: ['甲'], source_refs: [{ chapter: 2, text: '乙出现。' }]
    })] })
  ];
}

describe('assembleDeterministicBook', () => {
  it('merges only category plus exact normalized name', () => {
    const result = assembleDeterministicBook({
      manifest,
      chapters: chaptersForNames(['陆小凤', ' 陆 小 凤 ', '小凤', '陆小鳳'])
    });
    assert.equal(result.book.characters.length, 3);
    assert.equal(result.book.characters.filter(entry => entry.name === '陆小凤').length, 1);
  });

  it('does not merge alias overlap, near names, or traditional variants', () => {
    const aliasResult = assembleDeterministicBook({ manifest, chapters: chaptersWithAliasOverlap() });
    assert.equal(aliasResult.book.characters.length, 2);
    const names = assembleDeterministicBook({
      manifest,
      chapters: chaptersForNames(['陆小凤', '小凤', '陆小鳳'])
    });
    assert.equal(names.book.characters.length, 3);
  });

  it('filters only confirmed generic names and preserves full warning evidence', () => {
    const result = assembleDeterministicBook({
      manifest,
      chapters: chaptersForNames(['表哥', '管家婆', '店小二', '老刀把子', '老实和尚'])
    });
    assert.deepEqual(result.book.characters.map(entry => entry.name), ['老刀把子', '老实和尚']);
    assert.equal(result.review_warnings.length, 3);
    assert.deepEqual(Object.keys(result.review_warnings[0]).sort(), [
      'category', 'chapter_numbers', 'code', 'member_refs', 'name',
      'reason', 'resolution', 'severity', 'source_refs'
    ]);
    assert.equal(result.review_warnings[0].code, 'GENERIC_CANDIDATE_FILTERED');
    assert.equal(result.review_warnings[0].resolution, 'filtered');
    assert.equal(result.review_warnings[0].source_refs.length, 1);
  });

  it('merges arrays in canonical chapter order', () => {
    const chapters = [
      makeChapter(2, { characters: [makeCharacter('甲', {
        aliases: ['丙', '丁'], identities: ['剑客'],
        source_refs: [{ chapter: 2, text: '甲二。' }]
      })] }),
      makeChapter(1, { characters: [makeCharacter('甲', {
        aliases: ['乙', '丙'], identities: ['侠客'],
        source_refs: [{ chapter: 1, text: '甲一。' }]
      })] })
    ];
    const result = assembleDeterministicBook({ manifest, chapters });
    assert.deepEqual(result.book.characters[0].aliases, ['乙', '丙', '丁']);
    assert.deepEqual(result.book.characters[0].identities, ['侠客', '剑客']);
  });

  it('resolves description by unicode length, earliest evidence, then text order', () => {
    const longest = assembleDeterministicBook({
      manifest,
      chapters: [
        makeChapter(1, { characters: [makeCharacter('甲', { description: '短' })] }),
        makeChapter(2, { characters: [makeCharacter('甲', {
          description: '这是一个很长的描述', source_refs: [{ chapter: 2, text: '甲。' }]
        })] })
      ]
    });
    assert.equal(longest.book.characters[0].description, '这是一个很长的描述');

    const lexical = assembleDeterministicBook({
      manifest,
      chapters: [
        makeChapter(1, { characters: [makeCharacter('甲', {
          description: '乙乙', source_refs: [{ chapter: 1, text: '甲一。' }]
        })] }),
        makeChapter(2, { characters: [makeCharacter('甲', {
          description: '甲甲', source_refs: [{ chapter: 1, text: '甲二。' }]
        })] })
      ]
    });
    assert.equal(lexical.book.characters[0].description, '甲甲');
  });

  it('resolves rank by votes, latest evidence, then lower rank index', () => {
    const majority = assembleDeterministicBook({
      manifest,
      chapters: [
        makeChapter(1, { characters: [makeCharacter('甲', { rank: '初窥门径' })] }),
        makeChapter(2, { characters: [makeCharacter('甲', { rank: '登堂入室', source_refs: [{ chapter: 2, text: '甲。' }] })] }),
        makeChapter(3, { characters: [makeCharacter('甲', { rank: '登堂入室', source_refs: [{ chapter: 3, text: '甲。' }] })] })
      ]
    });
    assert.equal(majority.book.characters[0].rank, '登堂入室');

    const lowerIndex = assembleDeterministicBook({
      manifest,
      chapters: [
        makeChapter(1, { characters: [makeCharacter('甲', {
          rank: '登堂入室', source_refs: [{ chapter: 3, text: '甲一。' }]
        })] }),
        makeChapter(2, { characters: [makeCharacter('甲', {
          rank: '初窥门径', source_refs: [{ chapter: 3, text: '甲二。' }]
        })] })
      ]
    });
    assert.equal(lowerIndex.book.characters[0].rank, '初窥门径');
  });

  it('resolves level by fixed story priority', () => {
    const result = assembleDeterministicBook({
      manifest,
      chapters: [
        makeChapter(1, { characters: [makeCharacter('甲', { level: '次要' })] }),
        makeChapter(2, { characters: [makeCharacter('甲', { level: '核心', source_refs: [{ chapter: 2, text: '甲。' }] })] })
      ]
    });
    assert.equal(result.book.characters[0].level, '核心');
  });

  it('merges types for skills, items, and factions', () => {
    const chapters = [
      makeChapter(1, {
        skills: [makeTyped('skills', '玄门内功', ['内功'])],
        items: [makeTyped('items', '飞刀', ['武器'])],
        factions: [makeTyped('factions', '玄门', ['门派'])]
      }),
      makeChapter(2, {
        skills: [makeTyped('skills', '玄门内功', ['心法'], { source_refs: [{ chapter: 2, text: '玄门内功。' }] })],
        items: [makeTyped('items', '飞刀', ['暗器'], { source_refs: [{ chapter: 2, text: '飞刀。' }] })],
        factions: [makeTyped('factions', '玄门', ['组织'], { source_refs: [{ chapter: 2, text: '玄门。' }] })]
      })
    ];
    const result = assembleDeterministicBook({ manifest, chapters });
    assert.deepEqual(result.book.skills[0].types, ['内功', '心法']);
    assert.deepEqual(result.book.items[0].types, ['武器', '暗器']);
    assert.deepEqual(result.book.factions[0].types, ['门派', '组织']);
  });

  it('merges techniques by exact normalized name and resolves descriptions', () => {
    const chapters = [
      makeChapter(1, { skills: [makeTyped('skills', '玄门内功', ['内功'], {
        techniques: [{ name: '飞 云 掌', description: '短' }]
      })] }),
      makeChapter(2, { skills: [makeTyped('skills', '玄门内功', ['内功'], {
        techniques: [{ name: '飞云掌', description: '更长的描述' }],
        source_refs: [{ chapter: 2, text: '玄门内功。' }]
      })] })
    ];
    const result = assembleDeterministicBook({ manifest, chapters });
    assert.deepEqual(result.book.skills[0].techniques, [{ name: '飞 云 掌', description: '更长的描述' }]);
  });

  it('emits one evidence-backed audit row for every governed field', () => {
    const result = assembleDeterministicBook({
      manifest,
      chapters: [makeChapter(1, {
        characters: [makeCharacter('甲')],
        items: [makeTyped('items', '飞刀', ['武器'])]
      })]
    });
    assert.deepEqual(
      result.deterministic_audit.field_decisions.map(row => `${row.category}.${row.field}`),
      [
        'characters.description', 'characters.rank', 'characters.level',
        'items.description', 'items.types'
      ]
    );
    for (const row of result.deterministic_audit.field_decisions) {
      assert.equal(typeof row.canonical_name, 'string');
      assert.ok(row.member_refs.length > 0);
      assert.ok(row.source_refs.length > 0);
      assert.ok(row.candidate_values.length > 0);
      assert.equal(Object.hasOwn(row, 'selected_value'), true);
      assert.equal(typeof row.selection_rule, 'string');
    }
  });

  it('blocks distinct same-name identities within one chapter', () => {
    const distinct = assembleDeterministicBook({
      manifest,
      chapters: [makeChapter(1, { characters: [
        makeCharacter('甲', { local_key: 'character:甲1' }),
        makeCharacter('甲', { local_key: 'character:甲2' })
      ] })]
    });
    assert.equal(distinct.manual_review[0].code, 'IDENTITY_COLLISION_REVIEW_REQUIRED');
    assert.equal(distinct.book.characters.length, 0);

    const replay = assembleDeterministicBook({
      manifest,
      chapters: [makeChapter(1, { characters: [
        makeCharacter('甲', { local_key: 'character:甲' }),
        makeCharacter('甲', { local_key: 'character:甲', aliases: ['阿甲'] })
      ] })]
    });
    assert.equal(replay.manual_review.length, 0);
    assert.equal(replay.book.characters.length, 1);
  });

  it('produces deeply identical output under reversed chapter input order', () => {
    const chapters = [
      makeChapter(1, {
        characters: [makeCharacter('乙'), makeCharacter('甲', { aliases: ['阿甲'], description: '短' })],
        items: [makeTyped('items', '飞刀', ['武器'])],
        normalizations: [{ field_path: '$.items[0].types[0]', original_value: 'weapon', normalized_value: '武器', normalization_rule: 'items.weapon' }]
      }),
      makeChapter(2, {
        characters: [makeCharacter('甲', { aliases: ['甲大侠'], description: '长描述', source_refs: [{ chapter: 2, text: '甲。' }] })],
        items: [makeTyped('items', '飞刀', ['暗器'], { source_refs: [{ chapter: 2, text: '飞刀。' }] })]
      })
    ];
    const forward = assembleDeterministicBook({ manifest, chapters });
    const backward = assembleDeterministicBook({ manifest, chapters: [...chapters].reverse() });
    assert.deepEqual(forward, backward);
    assert.deepEqual(forward.book.chapter_summaries.map(row => row.chapter), [1, 2]);
  });
});
