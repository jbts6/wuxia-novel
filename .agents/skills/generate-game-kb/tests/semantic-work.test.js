'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { semanticDecisionFile } = require('../scripts/lib/accept');
const { buildCandidateRegistry } = require('../scripts/lib/candidate-registry');
const {
  initializeArtifactManifest,
  recordAcceptedArtifact
} = require('../scripts/lib/candidate-ledger');
const { normalizeChapterDraft } = require('../scripts/lib/chapter-contract');
const { createDomainWorkPlan } = require('../scripts/lib/domain-work');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');
const { SEMANTIC_CONTRACT_VERSION } = require('../scripts/lib/semantic-contract');
const {
  readWorkItem,
  readWorkPlan,
  writeWorkItem,
  writeWorkPlan
} = require('../scripts/lib/semantic-work');
const { makeNovel, sourceRef, validChapterDraft } = require('./helpers');

function registryFixture() {
  const chapter = normalizeChapterDraft(validChapterDraft({
    items: [{
      local_key: 'item:铁盒',
      name: '铁盒',
      importance: '关键',
      source_refs: [sourceRef()]
    }],
    factions: [{ local_key: 'faction:胡家', name: '胡家', source_refs: [sourceRef()] }]
  }));
  return buildCandidateRegistry([chapter]);
}

function workFixture() {
  const novel = makeNovel('领域存储试书', '第一章 起始\n正文。\n');
  const run = createOrResumeRun(novel, { runId: 'run-domain-store' });
  const paths = pathsFor(novel, run.run_id);
  const plan = createDomainWorkPlan({
    registry: registryFixture(),
    accepted_hashes: { 'accepted/chapters/ch_001.yaml': 'sha256:chapter-one' }
  });
  return { novel, paths, plan };
}

test('domain work-plan writes are idempotent private and stale-safe', () => {
  const { paths, plan } = workFixture();

  assert.equal(writeWorkPlan(paths, plan).written, true);
  assert.equal(writeWorkPlan(paths, plan).written, false);
  const expectedInputs = plan.inputs.map(input => ({
    ...input,
    staging_path: path.join(
      paths.staging,
      `${input.unit.replaceAll(':', '_')}_attempt_01.yaml`
    ),
    attempt: 1
  }));
  assert.deepEqual(readWorkPlan(paths, 'domain'), { ...plan, inputs: expectedInputs });
  const stored = readWorkItem(paths, 'distill:characters');
  assert.deepEqual(stored.input, expectedInputs.find(input => input.unit === 'distill:characters'));
  assert.doesNotMatch(fs.readFileSync(path.join(paths.domainWork, 'plan.json'), 'utf8'), /registry:|candidate_key|local_key/);

  const changed = structuredClone(plan);
  changed.inputs[0].entries[0].canonical_name = '被修改';
  assert.throws(() => writeWorkPlan(paths, changed), { code: 'WORK_ITEM_STALE' });
});

test('stale domain work rotates bytes without overwriting its accepted decision', () => {
  const { paths } = workFixture();
  initializeArtifactManifest(paths);
  const unit = 'distill:characters';
  const oldHash = `sha256:${'a'.repeat(64)}`;
  const nextHash = `sha256:${'b'.repeat(64)}`;
  const oldInput = { schema_version: 1, semantic_contract_version: SEMANTIC_CONTRACT_VERSION, unit, input_hash: oldHash, entries: [] };
  const oldBindings = { schema_version: 1, semantic_contract_version: SEMANTIC_CONTRACT_VERSION, unit, input_hash: oldHash, bindings: [] };
  writeWorkItem(paths, 'domain', oldInput, oldBindings);

  const acceptedFile = semanticDecisionFile(paths, unit);
  const acceptedDecision = { schema_version: 1, semantic_contract_version: SEMANTIC_CONTRACT_VERSION, unit, input_hash: oldHash, decisions: [], notes: [] };
  recordAcceptedArtifact(paths, acceptedFile, oldHash, acceptedDecision);
  const acceptedBytes = fs.readFileSync(acceptedFile, 'utf8');

  const result = writeWorkItem(
    paths,
    'domain',
    { ...oldInput, input_hash: nextHash },
    { ...oldBindings, input_hash: nextHash },
    { rotateStale: true }
  );

  assert.equal(result.rotated.old_input_hash, oldHash);
  assert.equal(result.rotated.new_input_hash, nextHash);
  assert.deepEqual(readWorkItem(paths, unit).input, {
    ...oldInput,
    input_hash: nextHash,
    staging_path: path.join(paths.staging, 'distill_characters_attempt_01.yaml'),
    attempt: 1
  });
  assert.equal(fs.existsSync(path.join(result.rotated.archive_dir, 'input.json')), true);
  assert.equal(fs.readFileSync(acceptedFile, 'utf8'), acceptedBytes);
  assert.equal(semanticDecisionFile(paths, unit, oldHash), acceptedFile);
  assert.notEqual(semanticDecisionFile(paths, unit, nextHash), acceptedFile);
});

test('worker prompts require the controller-provided staging path and attempt', () => {
  for (const prompt of ['distill-domain.md', 'extract-chapters.md']) {
    const content = fs.readFileSync(path.join(__dirname, '..', 'prompts', prompt), 'utf8');
    assert.match(content, /staging_path/);
    assert.match(content, /attempt/);
    assert.match(content, /不得[^\n]*(?:自行推导|修改)[^\n]*(?:attempt|路径)/);
  }
});

test('stale domain rotation refuses changed bytes that reuse the same input hash', () => {
  const { paths } = workFixture();
  const unit = 'distill:characters';
  const inputHash = `sha256:${'a'.repeat(64)}`;
  const input = { schema_version: 1, semantic_contract_version: SEMANTIC_CONTRACT_VERSION, unit, input_hash: inputHash, entries: [] };
  const bindings = { schema_version: 1, semantic_contract_version: SEMANTIC_CONTRACT_VERSION, unit, input_hash: inputHash, bindings: [] };
  writeWorkItem(paths, 'domain', input, bindings);

  assert.throws(
    () => writeWorkItem(
      paths,
      'domain',
      { ...input, entries: [{ entry_ref: 'e001' }] },
      bindings,
      { rotateStale: true }
    ),
    { code: 'WORK_ITEM_STALE' }
  );
});
