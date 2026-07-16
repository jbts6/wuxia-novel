'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildCandidateRegistry } = require('../scripts/lib/candidate-registry');
const { normalizeChapterDraft } = require('../scripts/lib/chapter-contract');
const {
  createDomainWorkPlan,
  DOMAIN_DEFINITIONS,
  MAX_DOMAIN_WORK_ITEM_BYTES
} = require('../scripts/lib/domain-work');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');
const {
  readWorkPlan,
  serializedInputBytes,
  writeWorkPlan
} = require('../scripts/lib/semantic-work');
const { makeNovel, sourceRef, validChapterDraft } = require('./helpers');

function fullRegistry() {
  const chapter = normalizeChapterDraft(validChapterDraft({
    items: [{ local_key: 'item:铁盒', name: '铁盒', importance: '关键', source_refs: [sourceRef()] }],
    factions: [{ local_key: 'faction:胡家', name: '胡家', source_refs: [sourceRef()] }]
  }));
  return buildCandidateRegistry([chapter]);
}

test('nine-file candidates route into exactly four stable domain work items', () => {
  assert.deepEqual(DOMAIN_DEFINITIONS, {
    plot: ['characters', 'events', 'dialogues'],
    martial: ['skills', 'techniques'],
    items: ['items'],
    world: ['factions', 'locations']
  });
  const registry = fullRegistry();
  const acceptedHashes = { 'accepted/chapters/ch_001.json': 'sha256:chapter-one' };
  const first = createDomainWorkPlan({ registry, accepted_hashes: acceptedHashes });
  const second = createDomainWorkPlan({ registry, accepted_hashes: acceptedHashes });

  assert.deepEqual(first, second);
  assert.equal(first.stage, 'domain');
  assert.deepEqual(first.inputs.map(input => input.unit), [
    'distill:plot', 'distill:martial', 'distill:items', 'distill:world'
  ]);
  assert.deepEqual(first.inputs.map(input => input.domain), ['plot', 'martial', 'items', 'world']);
  assert.equal(first.inputs.every(input => serializedInputBytes(input) <= MAX_DOMAIN_WORK_ITEM_BYTES), true);
  assert.equal(first.inputs.every(input => /^sha256:[a-f0-9]{64}$/.test(input.input_hash)), true);
  assert.equal(first.bindings.length, registry.stats.registered_entries);

  const visible = JSON.stringify(first.inputs);
  assert.doesNotMatch(visible, /registry:/);
  assert.doesNotMatch(visible, /candidate_key|member_refs|local_key/);
  assert.match(JSON.stringify(first.bindings), /registry:/);

  const plot = first.inputs.find(input => input.domain === 'plot');
  const martial = first.inputs.find(input => input.domain === 'martial');
  assert.deepEqual([...new Set(plot.entries.map(entry => entry.category))].sort(), ['characters', 'events']);
  assert.deepEqual([...new Set(martial.entries.map(entry => entry.category))].sort(), ['skills', 'techniques']);
});

test('domain work plans use the existing durable idempotent work-plan store', () => {
  const novel = makeNovel('领域工作试书', '第一章 起始\n正文。\n');
  const run = createOrResumeRun(novel, { runId: 'run-domain' });
  const paths = pathsFor(novel, run.run_id);
  const plan = createDomainWorkPlan({ registry: fullRegistry(), accepted_hashes: {} });

  assert.equal(writeWorkPlan(paths, plan).written, true);
  assert.equal(writeWorkPlan(paths, plan).written, false);
  assert.deepEqual(readWorkPlan(paths, 'domain'), plan);
});

test('an oversized domain fails explicitly instead of truncating or returning category shards', () => {
  const registry = fullRegistry();
  registry.categories.characters[0].record.biography = '长'.repeat(MAX_DOMAIN_WORK_ITEM_BYTES);

  assert.throws(
    () => createDomainWorkPlan({ registry, accepted_hashes: {} }),
    error => error.code === 'DOMAIN_INPUT_TOO_LARGE'
      && error.details?.unit === 'distill:plot'
  );
});
