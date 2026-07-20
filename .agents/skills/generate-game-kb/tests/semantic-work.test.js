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
const { prepareNovel } = require('../scripts/lib/source');
const {
  readWorkItem,
  readWorkPlan,
  refreshWorkPlanUnit,
  semanticInputHash,
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
  const { paths, plan } = workFixture();
  initializeArtifactManifest(paths);
  const unit = 'distill:characters';
  writeWorkPlan(paths, plan);
  const oldWork = readWorkItem(paths, unit);
  const oldInput = oldWork.input;
  const oldBindings = oldWork.bindings;
  const oldHash = oldInput.input_hash;
  const nextEntries = oldInput.entries.map(entry => ({ ...entry, canonical_name: `${entry.canonical_name}新` }));
  const nextHash = semanticInputHash(
    { ...oldInput, entries: nextEntries },
    oldBindings.bindings,
    oldBindings.upstream_hashes
  );

  const acceptedFile = semanticDecisionFile(paths, unit);
  const acceptedDecision = { schema_version: 1, semantic_contract_version: SEMANTIC_CONTRACT_VERSION, unit, input_hash: oldHash, decisions: [], notes: [] };
  recordAcceptedArtifact(paths, acceptedFile, oldHash, acceptedDecision);
  const acceptedBytes = fs.readFileSync(acceptedFile, 'utf8');

  const result = writeWorkItem(
    paths,
    'domain',
    { ...oldInput, input_hash: nextHash, entries: nextEntries },
    { ...oldBindings, input_hash: nextHash },
    { rotateStale: true }
  );

  assert.equal(result.rotated.old_input_hash, oldHash);
  assert.equal(result.rotated.new_input_hash, nextHash);
  assert.deepEqual(readWorkItem(paths, unit).input, {
    ...oldInput,
    input_hash: nextHash,
    entries: nextEntries,
    staging_path: path.join(paths.staging, 'distill_characters_attempt_01.yaml'),
    attempt: 1
  });
  assert.equal(fs.existsSync(path.join(result.rotated.archive_dir, 'input.json')), true);
  assert.equal(fs.readFileSync(acceptedFile, 'utf8'), acceptedBytes);
  assert.equal(semanticDecisionFile(paths, unit, oldHash), acceptedFile);
  assert.notEqual(semanticDecisionFile(paths, unit, nextHash), acceptedFile);
});

test('worker prompts require controller identity while exposing no staging path', () => {
  for (const prompt of ['distill-domain.md', 'extract-chapters.md']) {
    const content = fs.readFileSync(path.join(__dirname, '..', 'prompts', prompt), 'utf8');
    assert.doesNotMatch(content, /staging_path/);
    assert.match(content, /WORKER_WRITE_PATHS\s*=\s*\[\]/);
    assert.match(content, /JSON envelope/);
    assert.match(content, /attempt/);
    assert.match(content, /不得[^\n]*(?:推导|修改)[^\n]*(?:attempt|路径)/);
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

test('reading signed whole-book work rejects a tampered source path or chapter hash', () => {
  const mutations = [
    sourceFiles => { sourceFiles[0].source_file = path.join(path.dirname(sourceFiles[0].source_file), 'ch_999.txt'); },
    sourceFiles => { sourceFiles[0].input_hash = `sha256:${'f'.repeat(64)}`; }
  ];
  for (const [index, mutate] of mutations.entries()) {
    const novel = makeNovel('中文领域签名试书', '第一章 起始\n完整原文。\n');
    const run = createOrResumeRun(novel, { runId: `run-domain-tamper-${index + 1}` });
    const manifest = prepareNovel(novel, { runId: run.run_id });
    const paths = pathsFor(novel, run.run_id);
    const sourceFiles = manifest.chapters.map(chapter => ({
      chapter: chapter.number,
      title: chapter.title,
      source_file: chapter.file,
      input_hash: chapter.input_hash
    }));
    const plan = createDomainWorkPlan({
      registry: registryFixture(),
      accepted_hashes: { 'chapter:001': 'sha256:chapter-one' },
      source_files: sourceFiles
    });
    writeWorkPlan(paths, plan);

    const inputFile = path.join(paths.domainWork, 'distill_characters', 'input.json');
    const stored = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    mutate(stored.source_files);
    fs.writeFileSync(inputFile, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');

    assert.throws(() => readWorkItem(paths, 'distill:characters'), { code: 'WORK_ITEM_STALE' });
  }
});

test('signed work rejects missing or unknown hash contracts', () => {
  const mutations = [
    bindings => { delete bindings.hash_contract; },
    bindings => { bindings.hash_contract = 'domain-input-unknown'; }
  ];
  for (const mutate of mutations) {
    const { paths, plan } = workFixture();
    writeWorkPlan(paths, plan);
    const bindingsFile = path.join(paths.domainWork, 'distill_characters', 'bindings.json');
    const bindings = JSON.parse(fs.readFileSync(bindingsFile, 'utf8'));
    mutate(bindings);
    fs.writeFileSync(bindingsFile, `${JSON.stringify(bindings, null, 2)}\n`, 'utf8');

    assert.throws(() => readWorkItem(paths, 'distill:characters'), { code: 'WORK_ITEM_STALE' });
  }
});

test('equal-hash refresh validates the existing work item before returning', () => {
  const mutations = [
    {
      expected: 'WORK_ITEM_MISSING',
      apply: paths => fs.rmSync(path.join(paths.domainWork, 'distill_characters', 'input.json'))
    },
    {
      expected: 'WORK_ITEM_MISSING',
      apply: paths => fs.rmSync(path.join(paths.domainWork, 'distill_characters', 'bindings.json'))
    },
    {
      expected: 'WORK_ITEM_STALE',
      apply: paths => {
        const inputFile = path.join(paths.domainWork, 'distill_characters', 'input.json');
        const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
        input.unit = 'distill:skills';
        fs.writeFileSync(inputFile, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
      }
    }
  ];

  for (const mutation of mutations) {
    const { paths, plan } = workFixture();
    writeWorkPlan(paths, plan);
    mutation.apply(paths);
    assert.throws(
      () => refreshWorkPlanUnit(paths, plan, 'distill:characters'),
      { code: mutation.expected }
    );
  }
});

test('changed-hash refresh requires the old work item to rotate', () => {
  const novel = makeNovel('领域刷新缺失旧项试书', '第一章 起始\n完整原文。\n');
  const run = createOrResumeRun(novel, { runId: 'run-domain-refresh-missing-old' });
  const manifest = prepareNovel(novel, { runId: run.run_id });
  const paths = pathsFor(novel, run.run_id);
  const acceptedHashes = { 'chapter:001': 'sha256:chapter-one' };
  const oldPlan = createDomainWorkPlan({ registry: registryFixture(), accepted_hashes: acceptedHashes });
  const nextPlan = createDomainWorkPlan({
    registry: registryFixture(),
    accepted_hashes: acceptedHashes,
    source_files: manifest.chapters.map(chapter => ({
      chapter: chapter.number,
      title: chapter.title,
      source_file: chapter.file,
      input_hash: chapter.input_hash
    }))
  });
  writeWorkPlan(paths, oldPlan);
  fs.rmSync(path.join(paths.domainWork, 'distill_characters'), { recursive: true });

  assert.throws(
    () => refreshWorkPlanUnit(paths, nextPlan, 'distill:characters'),
    { code: 'WORK_ITEM_MISSING' }
  );
});

test('refreshing one work-plan unit rotates only that signed input', () => {
  const novel = makeNovel('领域计划刷新试书', '第一章 起始\n完整原文。\n');
  const run = createOrResumeRun(novel, { runId: 'run-domain-plan-refresh' });
  const manifest = prepareNovel(novel, { runId: run.run_id });
  const paths = pathsFor(novel, run.run_id);
  const acceptedHashes = { 'chapter:001': 'sha256:chapter-one' };
  const oldPlan = createDomainWorkPlan({ registry: registryFixture(), accepted_hashes: acceptedHashes });
  const sourceFiles = manifest.chapters.map(chapter => ({
    chapter: chapter.number,
    title: chapter.title,
    source_file: chapter.file,
    input_hash: chapter.input_hash
  }));
  const nextPlan = createDomainWorkPlan({
    registry: registryFixture(),
    accepted_hashes: acceptedHashes,
    source_files: sourceFiles
  });
  writeWorkPlan(paths, oldPlan);

  const before = readWorkPlan(paths, 'domain');
  const result = refreshWorkPlanUnit(paths, nextPlan, 'distill:characters');
  const after = readWorkPlan(paths, 'domain');
  const beforeHashes = new Map(before.inputs.map(input => [input.unit, input.input_hash]));
  const afterHashes = new Map(after.inputs.map(input => [input.unit, input.input_hash]));

  assert.equal(result.written, true);
  assert.equal(result.old_input_hash, beforeHashes.get('distill:characters'));
  assert.equal(result.new_input_hash, afterHashes.get('distill:characters'));
  assert.notEqual(result.old_input_hash, result.new_input_hash);
  assert.equal(fs.existsSync(path.join(result.archive_dir, 'input.json')), true);
  for (const unit of ['distill:factions', 'distill:skills', 'distill:items']) {
    assert.equal(afterHashes.get(unit), beforeHashes.get(unit));
  }
});
