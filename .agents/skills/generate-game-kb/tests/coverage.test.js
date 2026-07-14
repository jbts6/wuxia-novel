'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildCandidateLedger } = require('../scripts/lib/candidate-ledger');
const { buildChapterCoverage } = require('../scripts/lib/coverage');
const { sourceRef } = require('./helpers');

test('candidate loss without a reason is a blocking resolution error', () => {
  const chapters = [{
    chapter: 1,
    items: Array.from({ length: 7 }, (_, index) => ({
      candidate_key: `ch001:items:item:${index + 1}`,
      local_key: `item:${index + 1}`,
      name: `重要物品${index + 1}`,
      importance: '重要',
      source_refs: [sourceRef(1)]
    }))
  }];

  const ledger = buildCandidateLedger(chapters, { items: [], candidate_resolutions: [] }, { items: [] });

  assert.equal(ledger.passed, false);
  assert.deepEqual(ledger.missing_resolution.map(row => row.candidate_key), [
    'ch001:items:item:1',
    'ch001:items:item:2',
    'ch001:items:item:3',
    'ch001:items:item:4',
    'ch001:items:item:5',
    'ch001:items:item:6',
    'ch001:items:item:7'
  ]);
});

test('each chapter candidate has exactly one finite resolution', () => {
  const chapters = [{
    chapter: 1,
    items: ['甲', '乙', '丙'].map(name => ({
      candidate_key: `ch001:items:item:${name}`,
      local_key: `item:${name}`,
      name,
      source_refs: [sourceRef(1)]
    }))
  }];
  const merged = {
    items: [{ local_key: 'item:甲乙', canonical_name: '甲乙', source_refs: [sourceRef(1)] }],
    candidate_resolutions: [
      { candidate_key: 'ch001:items:item:甲', resolution: 'merged_to', merged_to: 'item:甲乙' },
      {
        candidate_key: 'ch001:items:item:乙',
        resolution: 'rejected',
        reason: 'ordinary_item',
        detail: '原文仅为普通随身物。'
      },
      {
        candidate_key: 'ch001:items:item:丙',
        resolution: 'ambiguous',
        detail: '同名对象无法仅凭当前章节区分。'
      }
    ]
  };

  const ledger = buildCandidateLedger(chapters, merged);

  assert.deepEqual(ledger.rows.map(row => row.resolution), ['merged_to', 'rejected', 'ambiguous']);
  assert.deepEqual(ledger.missing_resolution, []);
  assert.equal(ledger.rows.every(row => ['merged_to', 'rejected', 'ambiguous'].includes(row.resolution)), true);
});

test('coverage reports category counts and quotable-event dialogue distribution', () => {
  const chapters = [{
    chapter: 3,
    items: [{ candidate_key: 'ch003:items:item:剑谱', local_key: 'item:剑谱', name: '剑谱' }],
    events: [
      { candidate_key: 'ch003:events:event:决战', local_key: 'event:决战', importance: '核心', quote_status: 'quotable' },
      { candidate_key: 'ch003:events:event:赶路', local_key: 'event:赶路', importance: '次要', quote_status: 'not_quotable', quote_reason: '没有直接对白。' }
    ],
    dialogues: [
      { candidate_key: 'ch003:dialogues:dialogue:a', local_key: 'dialogue:a', event_local_key: 'event:决战' },
      { candidate_key: 'ch003:dialogues:dialogue:b', local_key: 'dialogue:b', event_local_key: 'event:决战' }
    ]
  }];

  const coverage = buildChapterCoverage(chapters);

  assert.equal(coverage.categories.items.candidate_count, 1);
  assert.deepEqual(coverage.categories.dialogues.chapters, [3]);
  assert.equal(coverage.events.important_count, 1);
  assert.equal(coverage.events.quotable_count, 1);
  assert.equal(coverage.dialogues.candidate_count, 2);
  assert.equal(coverage.dialogues.quotable_event_count_with_candidates, 1);
});
