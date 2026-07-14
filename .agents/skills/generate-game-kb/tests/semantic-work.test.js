'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, validMergedBook } = require('./helpers');
const { scaleCandidates } = require('./fixtures/merge-clean-scale');
const { pathsFor } = require('../scripts/lib/paths');
const { prepareNovel } = require('../scripts/lib/source');
const {
  MAX_WORK_ITEM_BYTES,
  MAX_WORK_ITEM_CANDIDATES,
  createCleanWorkPlan,
  createMergeWorkPlan,
  readWorkItem,
  serializedInputBytes,
  writeWorkPlan
} = require('../scripts/lib/semantic-work');

function chaptersWith(candidates, category = 'characters') {
  const chapters = Array.from({ length: 20 }, (_, index) => ({ chapter: index + 1, [category]: [] }));
  for (const candidate of candidates) {
    const chapter = Number(candidate.candidate_key.slice(2, 5));
    chapters[chapter - 1][category].push(candidate);
  }
  return chapters;
}

function acceptedHashes() {
  return Object.fromEntries(Array.from({ length: 20 }, (_, index) => [
    `accepted/chapters/ch_${String(index + 1).padStart(3, '0')}.json`,
    `sha256:${String(index + 1).padStart(64, '0')}`
  ]));
}

test('1,089 candidates receive stable short refs without leaking controller keys', () => {
  const input = { chapters: chaptersWith(scaleCandidates()), accepted_hashes: acceptedHashes() };
  const first = createMergeWorkPlan(input);
  const second = createMergeWorkPlan(input);

  assert.deepEqual(first, second);
  assert.equal(first.bindings.length, 1089);
  assert.equal(new Set(first.bindings.map(row => row.candidate_ref)).size, 1089);
  assert.equal(JSON.stringify(first.inputs).includes('candidate_key'), false);
  assert.equal(JSON.stringify(first.inputs).includes('local_key'), false);
  assert.equal(first.inputs.every(item => /^sha256:[a-f0-9]{64}$/.test(item.input_hash)), true);
});

test('merge shards obey both actual serialized-byte and member limits', () => {
  const plan = createMergeWorkPlan({
    chapters: chaptersWith(scaleCandidates()),
    accepted_hashes: acceptedHashes()
  });

  for (const item of plan.inputs) {
    assert.ok(item.candidates.length <= MAX_WORK_ITEM_CANDIDATES);
    assert.ok(serializedInputBytes(item) <= MAX_WORK_ITEM_BYTES);
    assert.ok(Buffer.byteLength(JSON.stringify(item)) <= MAX_WORK_ITEM_BYTES);
  }
});

test('multi-shard categories and split same-name groups require consolidation', () => {
  const candidates = scaleCandidates(121).map(candidate => ({ ...candidate, name: '同名人物' }));
  const plan = createMergeWorkPlan({
    chapters: chaptersWith(candidates),
    accepted_hashes: acceptedHashes()
  });

  assert.equal(plan.inputs.length, 2);
  assert.equal(plan.inputs.every(item => item.requires_consolidation === true), true);
  assert.deepEqual(plan.consolidations.map(item => item.unit), ['merge:characters:consolidate']);
});

test('a single oversize candidate fails instead of truncating semantic facts', () => {
  const [candidate] = scaleCandidates(1);
  candidate.biography = '甲'.repeat(MAX_WORK_ITEM_BYTES);

  assert.throws(
    () => createMergeWorkPlan({ chapters: chaptersWith([candidate]), accepted_hashes: acceptedHashes() }),
    { code: 'WORK_ITEM_TOO_LARGE' }
  );
});

test('upstream accepted hashes participate in stable work-item hashes', () => {
  const candidates = scaleCandidates(2);
  const first = createMergeWorkPlan({ chapters: chaptersWith(candidates), accepted_hashes: acceptedHashes() });
  const changedHashes = acceptedHashes();
  changedHashes['accepted/chapters/ch_001.json'] = `sha256:${'f'.repeat(64)}`;
  const second = createMergeWorkPlan({ chapters: chaptersWith(candidates), accepted_hashes: changedHashes });

  assert.notEqual(first.inputs[0].input_hash, second.inputs[0].input_hash);
});

test('clean plans expose short entity refs while local keys and candidate keys stay private', () => {
  const merged = validMergedBook({
    candidate_resolutions: [{
      candidate_key: 'ch001:characters:candidate:0001',
      resolution: 'merged_to',
      merged_to: 'character:甲'
    }]
  });
  const plan = createCleanWorkPlan({
    merged,
    merged_hash: `sha256:${'a'.repeat(64)}`,
    obligations: [{
      obligation_ref: 'o0001',
      code: 'DETAILED_CHARACTER_BIOGRAPHY_REQUIRED',
      category: 'characters',
      entity_key: 'character:甲',
      path: 'characters[0].biography'
    }]
  });

  assert.equal(JSON.stringify(plan.inputs).includes('local_key'), false);
  assert.equal(JSON.stringify(plan.inputs).includes('candidate_key'), false);
  assert.ok(plan.inputs.find(item => item.category === 'characters').entities[0].entity_ref);
  assert.equal(plan.bindings.find(row => row.category === 'characters').local_key, 'character:甲');
  assert.deepEqual(plan.inputs.find(item => item.category === 'characters').obligations.map(row => row.obligation_ref), ['o0001']);
});

test('work-plan writes are idempotent, private, and stale-safe', () => {
  const novel = makeNovel('试书', '第一章 起始\n正文。\n');
  const manifest = prepareNovel(novel, { runId: 'run-a' });
  const paths = pathsFor(novel, manifest.run_id);
  const candidate = scaleCandidates(1)[0];
  const plan = createMergeWorkPlan({
    chapters: chaptersWith([candidate]),
    accepted_hashes: acceptedHashes()
  });

  assert.equal(writeWorkPlan(paths, plan).written, true);
  assert.equal(writeWorkPlan(paths, plan).written, false);
  const stored = readWorkItem(paths, plan.inputs[0].unit);
  assert.deepEqual(stored.input, plan.inputs[0]);
  assert.equal(stored.bindings.bindings[0].candidate_key, candidate.candidate_key);
  assert.equal(fs.readFileSync(path.join(paths.mergeWork, 'plan.json'), 'utf8').includes(candidate.candidate_key), false);

  const changed = structuredClone(plan);
  changed.inputs[0].candidates[0].name = '被修改';
  assert.throws(() => writeWorkPlan(paths, changed), { code: 'WORK_ITEM_STALE' });
});
