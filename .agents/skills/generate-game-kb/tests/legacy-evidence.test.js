'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { rebuildLegacyEvidence } = require('../scripts/lib/legacy-evidence');

function chapter(number, title, text) {
  return {
    number,
    title,
    text,
    hash: `sha256:chapter-${number}`
  };
}

function mappedBook(overrides = {}) {
  return {
    book: {
      schema_version: 1,
      stage: 'merged',
      characters: [{
        registry_key: 'legacy:characters:fei',
        local_key: 'legacy:characters:fei',
        name: '阿飞',
        aliases: [],
        identities: [],
        level: null,
        rank: null,
        description: null,
        factions: [],
        skills: [],
        source_refs: [{ chapter: 1, text: '阿飞拔剑。' }]
      }],
      skills: [{
        registry_key: 'legacy:skills:kuai',
        local_key: 'legacy:skills:kuai',
        name: '快剑',
        aliases: [],
        types: ['剑法'],
        factions: [],
        rank: null,
        description: null,
        techniques: [],
        source_refs: [{
          chapter: 1,
          line_start: 3,
          line_end: 3,
          text: '快剑出鞘。'
        }]
      }],
      items: [{
        registry_key: 'legacy:items:iron',
        local_key: 'legacy:items:iron',
        name: '铁剑',
        aliases: [],
        type: '武器',
        description: null,
        source_refs: [{ chapter: 2, anchor: '兵器', text: '铁剑在手。' }]
      }],
      factions: [],
      chapter_summaries: [
        { chapter: 1, title: '第一章', summary: '第一章摘要。', source_refs: [] },
        { chapter: 2, title: '第二章', summary: '第二章摘要。', source_refs: [] }
      ],
      ...overrides
    }
  };
}

test('rebuilds grounded candidates and binds ref-less summaries to chapter hashes', () => {
  const result = rebuildLegacyEvidence(mappedBook(), [
    chapter(1, '第一章', '第一章\n阿飞拔剑。\n快剑出鞘。\n'),
    chapter(2, '第二章', '第二章\n铁剑在手。\n')
  ]);

  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.unresolved, []);
  assert.equal(result.candidateRegistry.stats.input_candidates, 3);
  assert.equal(result.acceptedChapters.length, 2);
  assert.equal(result.acceptedChapters[1].chapter_summary.source_refs[0].content_hash, 'sha256:chapter-2');
  assert.equal(result.acceptedChapters[0].skills[0].source_refs[0].line_start, 3);
  assert.equal(result.acceptedChapters[1].items[0].source_refs[0].anchor, '兵器');
});

test('rejects an entity whose evidence is entirely invalid without inventing evidence', () => {
  const mapped = mappedBook({
    characters: [{
      registry_key: 'legacy:characters:missing',
      local_key: 'legacy:characters:missing',
      name: '无证据者',
      aliases: [],
      identities: [],
      level: null,
      rank: null,
      description: null,
      factions: [],
      skills: [],
      source_refs: [{ chapter: 1, text: '原文不存在这句话。' }]
    }],
    chapter_summaries: [
      { chapter: 1, title: '第一章', summary: '摘要。', source_refs: [] }
    ],
    skills: [],
    items: [],
    factions: []
  });

  const result = rebuildLegacyEvidence(mapped, [chapter(1, '第一章', '第一章\n阿飞拔剑。\n')]);

  assert.equal(result.acceptedChapters[0].characters.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].code, 'LEGACY_ENTITY_EVIDENCE_INVALID');
  assert.equal(result.unresolved[0].code, 'SOURCE_QUOTE_NOT_FOUND');
});

test('fails chapter summary coverage on missing, duplicate, and out-of-range chapters', () => {
  const mapped = mappedBook({
    characters: [],
    skills: [],
    items: [],
    factions: [],
    chapter_summaries: [
      { chapter: 1, title: '第一章', summary: '摘要。', source_refs: [] },
      { chapter: 1, title: '重复', summary: '摘要。', source_refs: [] },
      { chapter: 3, title: '越界', summary: '摘要。', source_refs: [] }
    ]
  });

  const result = rebuildLegacyEvidence(mapped, [
    chapter(1, '第一章', '第一章\n阿飞拔剑。\n'),
    chapter(2, '第二章', '第二章\n铁剑在手。\n')
  ]);

  assert.equal(result.rejected.filter(item => item.code === 'LEGACY_SUMMARY_COVERAGE_INVALID').length, 3);
  assert.equal(result.unresolved.some(item => item.code === 'LEGACY_SUMMARY_COVERAGE_INVALID'), true);
});
