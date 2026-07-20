'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildCandidateRegistry } = require('../scripts/lib/candidate-registry');
const { normalizeChapterDraft } = require('../scripts/lib/chapter-contract');
const {
  createDomainWorkPlan,
  DOMAIN_DEFINITIONS,
  DOMAIN_PATCH_FIELDS,
  MAX_DOMAIN_WORK_ITEM_BYTES
} = require('../scripts/lib/domain-work');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');
const { DOMAIN_UNITS } = require('../scripts/lib/semantic-contract');
const {
  readWorkPlan,
  serializedInputBytes,
  domainWorkerJob,
  workerInputPath,
  writeWorkPlan
} = require('../scripts/lib/semantic-work');
const { makeNovel, readJson, sourceRef, validChapterDraft } = require('./helpers');

function fullRegistry() {
  const chapter = normalizeChapterDraft(validChapterDraft({
    characters: [{
      local_key: 'character:甲', name: '甲', aliases: [], identities: ['侠客'],
      level: '核心', rank: null, description: null,
      factions: ['faction:胡家'], skills: ['skill:内功'], source_refs: [sourceRef()]
    }],
    skills: [{
      local_key: 'skill:内功', name: '玄门内功', aliases: [], types: ['内功'],
      factions: ['faction:胡家'], rank: null, description: null,
      techniques: [{ name: '飞云掌', description: null }], source_refs: [sourceRef()]
    }],
    items: [{
      local_key: 'item:铁盒', name: '铁盒', aliases: [], type: null,
      description: null, source_refs: [sourceRef()]
    }],
    factions: [{
      local_key: 'faction:胡家', name: '胡家', aliases: [], type: null,
      description: null, source_refs: [sourceRef()]
    }]
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

test('domain patch allowlists expose exactly the version-6 semantic fields', () => {
  assert.deepEqual(DOMAIN_PATCH_FIELDS, {
    characters: ['name', 'aliases', 'identities', 'level', 'rank', 'description', 'factions', 'skills'],
    skills: ['name', 'aliases', 'types', 'factions', 'rank', 'description', 'techniques'],
    items: ['name', 'aliases', 'type', 'description', 'inclusion_reason'],
    factions: ['name', 'aliases', 'type', 'description']
  });
  assert.doesNotMatch(JSON.stringify(DOMAIN_PATCH_FIELDS),
    /canonical_name|identity|biography|holder|owner|member|personality|relationships/);
});

test('character and skill work inputs expose the bounded faction refs they may patch', () => {
  const plan = createDomainWorkPlan({ registry: fullRegistry(), accepted_hashes: {} });
  const inputByUnit = new Map(plan.inputs.map(input => [input.unit, input]));
  const factionRefs = inputByUnit.get('distill:factions').entries.map(entry => entry.entry_ref);
  const skillRefs = inputByUnit.get('distill:skills').entries.map(entry => entry.entry_ref);

  assert.deepEqual(inputByUnit.get('distill:characters').allowed_faction_refs, factionRefs);
  assert.deepEqual(inputByUnit.get('distill:skills').allowed_faction_refs, factionRefs);
  assert.deepEqual(inputByUnit.get('distill:characters').allowed_skill_refs, skillRefs);
  assert.equal('allowed_faction_refs' in inputByUnit.get('distill:factions'), false);
  assert.equal('allowed_faction_refs' in inputByUnit.get('distill:items'), false);
  assert.equal('allowed_skill_refs' in inputByUnit.get('distill:skills'), false);
});

test('character and skill work inputs bind every ordered source chapter into their hashes', () => {
  const sourceFiles = Array.from({ length: 20 }, (_, index) => ({
    chapter: index + 1,
    title: `第${index + 1}章`,
    source_file: path.join('C:\\git\\wuxia-novel', '古龙', '剑神一笑', '.game-kb-work', 'runs', 'run-real', 'source', 'chapters', `ch_${String(index + 1).padStart(3, '0')}.txt`),
    input_hash: `sha256:${String(index + 1).padStart(64, '0')}`
  }));
  const plan = createDomainWorkPlan({
    registry: fullRegistry(),
    accepted_hashes: { 'chapter:001': 'sha256:chapter-one' },
    source_files: sourceFiles
  });
  const inputs = new Map(plan.inputs.map(input => [input.unit, input]));

  for (const unit of ['distill:characters', 'distill:skills']) {
    assert.deepEqual(inputs.get(unit).source_files, sourceFiles);
    assert.equal(inputs.get(unit).source_files.every(file => path.isAbsolute(file.source_file)), true);
    assert.equal(inputs.get(unit).source_files.every(file => file.source_file.includes(path.join('古龙', '剑神一笑'))), true);
    assert.equal(inputs.get(unit).rank_contract.scope, 'complete_book_timeline');
  }
  assert.equal('source_files' in inputs.get('distill:factions'), false);
  assert.equal('source_files' in inputs.get('distill:items'), false);

  const changedSources = structuredClone(sourceFiles);
  changedSources[19].input_hash = `sha256:${'f'.repeat(64)}`;
  const changed = createDomainWorkPlan({
    registry: fullRegistry(),
    accepted_hashes: { 'chapter:001': 'sha256:chapter-one' },
    source_files: changedSources
  });
  const changedInputs = new Map(changed.inputs.map(input => [input.unit, input]));
  assert.notEqual(
    inputs.get('distill:characters').input_hash,
    changedInputs.get('distill:characters').input_hash
  );
  assert.notEqual(inputs.get('distill:skills').input_hash, changedInputs.get('distill:skills').input_hash);
  assert.equal(inputs.get('distill:factions').input_hash, changedInputs.get('distill:factions').input_hash);
  assert.equal(inputs.get('distill:items').input_hash, changedInputs.get('distill:items').input_hash);
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

test('domain workers receive controller-authored read-only input without output paths', () => {
  const novel = makeNovel('领域零写入试书', '第一章 起始\n正文。\n');
  const run = createOrResumeRun(novel, { runId: 'run-domain-zero-write' });
  const paths = pathsFor(novel, run.run_id);
  const plan = createDomainWorkPlan({ registry: fullRegistry(), accepted_hashes: {} });
  writeWorkPlan(paths, plan);

  assert.equal(typeof workerInputPath, 'function');
  for (const input of plan.inputs) {
    const file = workerInputPath(paths, input.unit);
    assert.equal(fs.existsSync(file), true);
    const visible = readJson(file);
    assert.equal(visible.unit, input.unit);
    assert.equal(visible.input_hash, input.input_hash);
    assert.equal(visible.attempt, 1);
    assert.deepEqual(visible.worker_write_paths, []);
    assert.equal(JSON.stringify(visible).includes('staging_path'), false);
    assert.equal(JSON.stringify(visible).includes('output_path'), false);
  }

  assert.equal(typeof domainWorkerJob, 'function');
  const job = domainWorkerJob(paths, 'distill:factions');
  assert.equal(job.unit, 'distill:factions');
  assert.equal(job.attempt, 1);
  assert.equal(job.worker_write_paths.length, 0);
  assert.equal(job.input_file.endsWith('worker-input.json'), true);
  assert.deepEqual(job.submissions, [{
    unit: 'distill:factions',
    attempt: 1,
    input_hash: plan.inputs[0].input_hash
  }]);
});

test('an oversized domain fails explicitly instead of truncating or returning category shards', () => {
  const registry = fullRegistry();
  registry.categories.characters[0].record.description = '长'.repeat(MAX_DOMAIN_WORK_ITEM_BYTES);

  assert.throws(
    () => createDomainWorkPlan({ registry, accepted_hashes: {} }),
    error => error.code === 'DOMAIN_INPUT_TOO_LARGE'
      && error.details?.unit === 'distill:characters'
  );
});
