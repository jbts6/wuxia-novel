'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { checkCoverage, checkResolution } = require('../scripts/lib/gaps');
const { applyRecall, applySupplement } = require('../scripts/lib/supplements');
const { pathsFor } = require('../scripts/lib/paths');

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('coverage opens only the affected bounded unit', () => {
  const cases = [
    [{ item_candidates: 7, merged_items: 0, item_resolutions_incomplete: true }, ['supplement:items']],
    [{ item_candidates: 0, merged_items: 0, source_char_count: 150000 }, ['recall:items']],
    [{ quotable_event_count: 10, dialogue_covered: 6 }, ['recall:dialogues']],
    [{ quotable_event_chapters: [1, 2, 3, 4, 5, 6, 7, 8], dialogue_chapters: [1, 2] }, ['recall:dialogues']],
    [{ quantity_out_of_range: true }, []]
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(checkCoverage(input).recall_units, expected);
  }
});

test('grounded none_found closes a legitimate empty item category', () => {
  const result = checkCoverage({
    source_char_count: 120000,
    item_candidates: 0,
    none_found: {
      chapters: [1, 2, 3],
      conclusion: 'none_found',
      reason: '仅有普通日用品，无特殊作用。'
    }
  });
  assert.deepEqual(result.recall_units, []);
  assert.equal(result.empty_category_review.status, 'none_found');
});

test('resolution reports missing, duplicate, and dangling candidate references', () => {
  const result = checkResolution({
    candidate_rows: [
      { candidate_key: 'items:a', category: 'items', resolution: 'ambiguous' },
      { candidate_key: 'items:b', category: 'items', resolution: 'merged_to', merged_to: 'item:missing' },
      { candidate_key: 'items:c', category: 'items' }
    ],
    resolutions: [
      { candidate_key: 'items:a', category: 'items', resolution: 'rejected', reason: 'no_evidence', detail: '无证据。' },
      { candidate_key: 'items:a', category: 'items', resolution: 'rejected', reason: 'no_evidence', detail: '重复决策。' },
      { candidate_key: 'items:b', category: 'items', resolution: 'merged_to', merged_to: 'item:missing' }
    ],
    category_targets: { items: ['item:known'] }
  });

  assert.equal(result.supplement_units.includes('supplement:items'), true);
  assert.equal(result.blocking_gaps.some(gap => gap.reason === 'MULTIPLE_DECISIONS'), true);
  assert.equal(result.blocking_gaps.some(gap => gap.reason === 'DANGLING_REFERENCE'), true);
  assert.equal(result.blocking_gaps.some(gap => gap.reason === 'MISSING_DECISION'), true);
});

test('recall and supplement projections leave accepted artifacts unchanged', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-game-kb-recall-'));
  const paths = pathsFor(root, 'run-1');
  fs.mkdirSync(paths.chapters, { recursive: true });
  fs.mkdirSync(path.dirname(paths.merged), { recursive: true });
  fs.mkdirSync(paths.supplements, { recursive: true });

  const chapter = { chapter: 1, items: [{ local_key: 'item:old', name: '旧物', source_refs: [{ chapter: 1, text: '旧物' }] }] };
  const merged = { schema_version: 1, stage: 'merged', items: [{ local_key: 'item:old', canonical_name: '旧物' }] };
  const supplement = { items: [{ local_key: 'item:supp', canonical_name: '补充物' }] };
  const chapterFile = path.join(paths.chapters, 'ch_001.json');
  fs.writeFileSync(chapterFile, `${JSON.stringify(chapter)}\n`);
  fs.writeFileSync(paths.merged, `${JSON.stringify(merged)}\n`);
  const supplementFile = path.join(paths.supplements, 'items.json');
  fs.writeFileSync(supplementFile, `${JSON.stringify(supplement)}\n`);
  const before = { merged: hash(paths.merged), supplement: hash(supplementFile) };

  const recallPath = applyRecall(paths, 'items', { items: [{ local_key: 'item:new', name: '新物' }] });
  const projectionPath = applySupplement(paths, 'items', supplement);

  assert.equal(fs.existsSync(recallPath), true);
  assert.equal(fs.existsSync(projectionPath), true);
  assert.deepEqual({ merged: hash(paths.merged), supplement: hash(supplementFile) }, before);
  assert.equal(JSON.parse(fs.readFileSync(projectionPath, 'utf8')).items.length, 2);
});

