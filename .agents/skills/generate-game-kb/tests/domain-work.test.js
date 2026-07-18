'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
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
const { DOMAIN_UNITS } = require('../scripts/lib/semantic-contract');
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

test('four-domain candidates route through the shared stable domain units', () => {
  assert.deepEqual(DOMAIN_DEFINITIONS, {
    factions: ['factions'],
    characters: ['characters'],
    skills: ['skills'],
    items: ['items']
  });
  const registry = fullRegistry();
  const acceptedHashes = { 'accepted/chapters/ch_001.yaml': 'sha256:chapter-one' };
  const first = createDomainWorkPlan({ registry, accepted_hashes: acceptedHashes });
  const second = createDomainWorkPlan({ registry, accepted_hashes: acceptedHashes });

  assert.deepEqual(first, second);
  assert.equal(first.stage, 'domain');
  assert.deepEqual(first.inputs.map(input => input.unit), DOMAIN_UNITS);
  assert.deepEqual(first.inputs.map(input => input.domain), ['factions', 'characters', 'skills', 'items']);
  assert.equal(first.inputs.every(input => serializedInputBytes(input) <= MAX_DOMAIN_WORK_ITEM_BYTES), true);
  assert.equal(first.inputs.every(input => /^sha256:[a-f0-9]{64}$/.test(input.input_hash)), true);
  assert.equal(first.bindings.length, registry.stats.registered_entries);

  const visible = JSON.stringify(first.inputs);
  assert.doesNotMatch(visible, /registry:/);
  assert.doesNotMatch(visible, /candidate_key|member_refs|local_key/);
  assert.match(JSON.stringify(first.bindings), /registry:/);

  assert.deepEqual(first.inputs.map(input => input.categories), [
    ['factions'], ['characters'], ['skills'], ['items']
  ]);
});

test('character and skill work inputs expose the bounded faction refs they may patch', () => {
  const plan = createDomainWorkPlan({ registry: fullRegistry(), accepted_hashes: {} });
  const inputByUnit = new Map(plan.inputs.map(input => [input.unit, input]));
  const factionRefs = inputByUnit.get('distill:factions').entries.map(entry => entry.entry_ref);

  assert.deepEqual(inputByUnit.get('distill:characters').allowed_faction_refs, factionRefs);
  assert.deepEqual(inputByUnit.get('distill:skills').allowed_faction_refs, factionRefs);
  assert.equal('allowed_faction_refs' in inputByUnit.get('distill:factions'), false);
  assert.equal('allowed_faction_refs' in inputByUnit.get('distill:items'), false);
});

test('domain work plans use the existing durable idempotent work-plan store', () => {
  const novel = makeNovel('领域工作试书', '第一章 起始\n正文。\n');
  const run = createOrResumeRun(novel, { runId: 'run-domain' });
  const paths = pathsFor(novel, run.run_id);
  const plan = createDomainWorkPlan({ registry: fullRegistry(), accepted_hashes: {} });
  const expectedInputs = plan.inputs.map(input => ({
    ...input,
    staging_path: path.join(
      paths.staging,
      `${input.unit.replaceAll(':', '_')}_attempt_01.yaml`
    ),
    attempt: 1
  }));

  assert.equal(writeWorkPlan(paths, plan).written, true);
  assert.equal(writeWorkPlan(paths, plan).written, false);
  assert.deepEqual(readWorkPlan(paths, 'domain'), { ...plan, inputs: expectedInputs });
});

test('an oversized domain fails explicitly instead of truncating or returning category shards', () => {
  const registry = fullRegistry();
  registry.categories.characters[0].record.biography = '长'.repeat(MAX_DOMAIN_WORK_ITEM_BYTES);

  assert.throws(
    () => createDomainWorkPlan({ registry, accepted_hashes: {} }),
    error => error.code === 'DOMAIN_INPUT_TOO_LARGE'
      && error.details?.unit === 'distill:characters'
  );
});
