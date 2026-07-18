'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const { semanticDecisionFile } = require('../scripts/lib/accept');
const { acceptedArtifactHash } = require('../scripts/lib/candidate-ledger');
const { createDomainWorkPlan } = require('../scripts/lib/domain-work');
const { refreshDomainWork } = require('../scripts/flow');
const { readWorkPlan, writeWorkPlan } = require('../scripts/lib/semantic-work');
const { pathsFor } = require('../scripts/lib/paths');
const { DOMAIN_UNITS, FINAL_FILES } = require('../scripts/lib/semantic-contract');
const {
  makeNovel,
  parseJsonLine,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft,
  validDomainDraft,
  writeStagingDraft
} = require('./helpers');

function pass(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function prepareAcceptedChapter(name, runId, overrides = {}) {
  const novel = makeNovel(name, '第一章 起始\n甲在山谷中与故人相逢。\n');
  const prepared = pass(runFlow(['prepare', novel, '--run', runId, '--json']), 'prepare');
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);
  const chapter = validChapterDraft({
    chapter: 1,
    title: manifest.chapters[0].title,
    source_hash: manifest.chapters[0].input_hash,
    chapter_summary: {
      title: manifest.chapters[0].title,
      summary: '甲在山谷中与故人相逢。',
      source_refs: [sourceRef(1, '甲在山谷中与故人相逢')]
    },
    ...overrides
  });
  const draft = writeStagingDraft(novel, 'chapter:001', chapter);
  pass(runFlow([
    'accept', novel, '--run', prepared.run_id, '--unit', 'chapter:001', '--draft', draft, '--json'
  ]), 'accept chapter');
  return { manifest, novel, paths, prepared };
}

function snapshotTree(root) {
  if (!fs.existsSync(root)) return null;
  const entries = [];
  function visit(directory, relative = '') {
    entries.push({ path: relative, type: 'directory' });
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const child = `${directory}/${entry.name}`;
      if (entry.isDirectory()) visit(child, childRelative);
      else entries.push({ path: childRelative, type: 'file', bytes: fs.readFileSync(child) });
    }
  }
  visit(root);
  return entries;
}

function prepareChangedDomainRefresh(name, runId) {
  const fixture = prepareAcceptedChapter(name, runId);
  pass(runFlow([
    'plan-domains', fixture.novel, '--run', fixture.prepared.run_id, '--json'
  ]), 'plan domains');
  const registry = readJson(fixture.paths.candidateRegistry);
  const acceptedHashes = Object.fromEntries(fixture.manifest.chapters.map(chapter => {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const file = `${fixture.paths.chapters}/ch_${String(chapter.number).padStart(3, '0')}.yaml`;
    return [unit, acceptedArtifactHash(fixture.paths, file)];
  }));
  const oldPlan = createDomainWorkPlan({
    registry,
    source_hash: fixture.manifest.source_hash,
    accepted_hashes: acceptedHashes
  });
  fs.rmSync(fixture.paths.domainWork, { recursive: true, force: true });
  writeWorkPlan(fixture.paths, oldPlan);
  const progress = readJson(fixture.paths.progress);
  for (const input of oldPlan.inputs) progress.units[input.unit].input_hash = input.input_hash;
  fs.writeFileSync(fixture.paths.progress, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
  const characterInput = readWorkPlan(fixture.paths, 'domain').inputs
    .find(input => input.unit === 'distill:characters');
  fs.writeFileSync(characterInput.staging_path, 'draft-before-refresh\n', 'utf8');
  return { ...fixture, characterInput };
}

test('plan-domains reads accepted chapter YAML and creates the exact four domain units', () => {
  const fixture = prepareAcceptedChapter('四域计划试书', 'run-four-domain-plan');
  const accepted = fs.readFileSync(`${fixture.paths.chapters}/ch_001.yaml`, 'utf8');
  assert.match(accepted, /["']?chapter_summary["']?\s*:/);

  const planned = pass(runFlow([
    'plan-domains', fixture.novel, '--run', fixture.prepared.run_id, '--json'
  ]), 'plan domains');
  const plan = readWorkPlan(fixture.paths, 'domain');

  assert.deepEqual(planned.units, DOMAIN_UNITS);
  assert.deepEqual(plan.inputs.map(input => input.unit), DOMAIN_UNITS);
  assert.deepEqual(plan.inputs.map(input => input.domain), ['factions', 'characters', 'skills', 'items']);
  for (const unit of ['distill:characters', 'distill:skills']) {
    const input = plan.inputs.find(candidate => candidate.unit === unit);
    assert.deepEqual(input.source_files, fixture.manifest.chapters.map(chapter => ({
      chapter: chapter.number,
      title: chapter.title,
      source_file: chapter.file,
      input_hash: chapter.input_hash
    })));
  }
});

test('confirmed domain refresh rotates only an unattempted pending unit', () => {
  const fixture = prepareAcceptedChapter('领域安全刷新试书', 'run-domain-refresh');
  pass(runFlow([
    'plan-domains', fixture.novel, '--run', fixture.prepared.run_id, '--json'
  ]), 'plan domains');
  const beforePlan = readWorkPlan(fixture.paths, 'domain');
  const beforeInputs = new Map(beforePlan.inputs.map(input => [input.unit, input]));

  const factionInput = beforeInputs.get('distill:factions');
  const factionDraft = writeStagingDraft(fixture.novel, factionInput.unit, validDomainDraft(factionInput));
  pass(runFlow([
    'accept', fixture.novel, '--run', fixture.prepared.run_id,
    '--unit', factionInput.unit, '--draft', factionDraft, '--json'
  ]), 'accept faction');
  const acceptedFaction = semanticDecisionFile(fixture.paths, factionInput.unit, factionInput.input_hash);
  const acceptedFactionBytes = fs.readFileSync(acceptedFaction);

  const itemInput = beforeInputs.get('distill:items');
  const itemDraft = writeStagingDraft(fixture.novel, itemInput.unit, validDomainDraft(itemInput));
  const itemDraftBytes = fs.readFileSync(itemDraft);

  const unconfirmed = runFlow([
    'refresh-domain-work', fixture.novel, '--run', fixture.prepared.run_id,
    '--unit', 'distill:characters', '--json'
  ]);
  assert.notEqual(unconfirmed.status, 0);
  assert.equal(parseJsonLine(unconfirmed.stderr).code, 'DOMAIN_REFRESH_CONFIRM_REQUIRED');

  const refreshed = pass(runFlow([
    'refresh-domain-work', fixture.novel, '--run', fixture.prepared.run_id,
    '--unit', 'distill:characters', '--confirm', '--json'
  ]), 'refresh character work');
  const afterPlan = readWorkPlan(fixture.paths, 'domain');
  const afterInputs = new Map(afterPlan.inputs.map(input => [input.unit, input]));

  assert.equal(refreshed.unit, 'distill:characters');
  assert.equal(refreshed.old_input_hash, beforeInputs.get('distill:characters').input_hash);
  assert.equal(refreshed.new_input_hash, afterInputs.get('distill:characters').input_hash);
  assert.equal(refreshed.old_input_hash, refreshed.new_input_hash);
  assert.equal(refreshed.written, false);
  assert.deepEqual(fs.readFileSync(acceptedFaction), acceptedFactionBytes);
  assert.deepEqual(fs.readFileSync(itemDraft), itemDraftBytes);
  assert.equal(afterInputs.get('distill:factions').input_hash, factionInput.input_hash);
  assert.equal(afterInputs.get('distill:items').input_hash, itemInput.input_hash);

  const acceptedDenied = runFlow([
    'refresh-domain-work', fixture.novel, '--run', fixture.prepared.run_id,
    '--unit', 'distill:factions', '--confirm', '--json'
  ]);
  assert.notEqual(acceptedDenied.status, 0);
  assert.equal(parseJsonLine(acceptedDenied.stderr).code, 'DOMAIN_REFRESH_INVALID');
});

test('domain refresh rejects progress whose input hash differs from the work plan', () => {
  const fixture = prepareAcceptedChapter('领域刷新进度错配试书', 'run-domain-refresh-progress-mismatch');
  pass(runFlow([
    'plan-domains', fixture.novel, '--run', fixture.prepared.run_id, '--json'
  ]), 'plan domains');
  const progress = readJson(fixture.paths.progress);
  progress.units['distill:characters'].input_hash = `sha256:${'f'.repeat(64)}`;
  fs.writeFileSync(fixture.paths.progress, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');

  const result = runFlow([
    'refresh-domain-work', fixture.novel, '--run', fixture.prepared.run_id,
    '--unit', 'distill:characters', '--confirm', '--json'
  ]);

  assert.notEqual(result.status, 0);
  assert.equal(parseJsonLine(result.stderr).code, 'WORK_ITEM_STALE');
});

test('domain refresh restores every prior byte after an injected transaction failure', () => {
  assert.equal(typeof refreshDomainWork, 'function');
  for (const faultAt of ['after-work-write', 'after-plan-write', 'during-progress-save']) {
    const fixture = prepareChangedDomainRefresh(
      `领域刷新事务${faultAt}`,
      `run-domain-refresh-${faultAt}`
    );
    const before = {
      domainWork: snapshotTree(fixture.paths.domainWork),
      progress: fs.readFileSync(fixture.paths.progress),
      staging: snapshotTree(fixture.paths.staging)
    };

    assert.throws(
      () => refreshDomainWork(
        fixture.paths,
        fixture.manifest,
        'distill:characters',
        true,
        { faultAt }
      ),
      { code: 'DOMAIN_REFRESH_FAULT_INJECTED' }
    );
    assert.deepEqual(snapshotTree(fixture.paths.domainWork), before.domainWork, faultAt);
    assert.deepEqual(fs.readFileSync(fixture.paths.progress), before.progress, faultAt);
    assert.deepEqual(snapshotTree(fixture.paths.staging), before.staging, faultAt);
  }
});

test('plan-domains, four accepts, and assemble preserve accepted decisions and use no legacy stage', () => {
  const fixture = prepareAcceptedChapter('四域组装试书', 'run-four-domain-assemble');
  pass(runFlow([
    'plan-domains', fixture.novel, '--run', fixture.prepared.run_id, '--json'
  ]), 'plan domains');
  const plan = readWorkPlan(fixture.paths, 'domain');

  for (const input of plan.inputs) {
    const file = writeStagingDraft(fixture.novel, input.unit, validDomainDraft(input));
    pass(runFlow([
      'accept', fixture.novel, '--run', fixture.prepared.run_id,
      '--unit', input.unit, '--draft', file, '--json'
    ]), `accept ${input.unit}`);
  }
  const protectedInput = plan.inputs.find(input => input.unit === 'distill:characters');
  const acceptedFile = semanticDecisionFile(fixture.paths, protectedInput.unit, protectedInput.input_hash);
  const before = fs.readFileSync(acceptedFile);
  const replay = writeStagingDraft(fixture.novel, protectedInput.unit, validDomainDraft(protectedInput), 2);
  const denied = runFlow([
    'accept', fixture.novel, '--run', fixture.prepared.run_id,
    '--unit', protectedInput.unit, '--draft', replay, '--json'
  ]);

  assert.notEqual(denied.status, 0);
  assert.equal(parseJsonLine(denied.stderr).code, 'UNIT_ALREADY_DONE');
  assert.deepEqual(fs.readFileSync(acceptedFile), before);

  const assembled = pass(runFlow([
    'assemble', fixture.novel, '--run', fixture.prepared.run_id, '--json'
  ]), 'assemble');
  assert.deepEqual(Object.keys(assembled.counts).sort(), [
    'chapter_summaries.yaml',
    'characters.yaml',
    'factions.yaml',
    'items.yaml',
    'skills.yaml'
  ]);
  assert.equal(fs.existsSync(fixture.paths.assemblyReport), true);
  assert.equal('mergeWork' in fixture.paths, false);
  assert.equal('cleanWork' in fixture.paths, false);
});

test('domain completion order cannot change status order or final YAML bytes', () => {
  function runCompletionOrder(runId, units) {
    const fixture = prepareAcceptedChapter('四域完成顺序试书', runId);
    pass(runFlow([
      'plan-domains', fixture.novel, '--run', fixture.prepared.run_id, '--json'
    ]), `plan domains ${runId}`);
    const inputs = new Map(readWorkPlan(fixture.paths, 'domain').inputs
      .map(input => [input.unit, input]));
    const completed = new Set();

    for (const unit of units) {
      const file = writeStagingDraft(fixture.novel, unit, validDomainDraft(inputs.get(unit)));
      pass(runFlow([
        'accept', fixture.novel, '--run', fixture.prepared.run_id,
        '--unit', unit, '--draft', file, '--json'
      ]), `accept ${unit} ${runId}`);
      completed.add(unit);

      const status = pass(runFlow([
        'status', fixture.novel, '--run', fixture.prepared.run_id, '--json'
      ]), `status after ${unit} ${runId}`);
      const remaining = DOMAIN_UNITS.filter(value => !completed.has(value));
      assert.deepEqual(
        { next_action: status.next_action, next_units: status.next_units },
        remaining.length > 0
          ? { next_action: 'accept-domains', next_units: remaining }
          : { next_action: 'assemble', next_units: [] }
      );
    }

    return {
      assembled: pass(runFlow([
        'assemble', fixture.novel, '--run', fixture.prepared.run_id, '--json'
      ]), `assemble ${runId}`),
      paths: fixture.paths
    };
  }

  const canonical = runCompletionOrder('run-domain-order-canonical', DOMAIN_UNITS);
  const reverse = runCompletionOrder('run-domain-order-reverse', [...DOMAIN_UNITS].reverse());
  const filenames = Object.values(FINAL_FILES).sort();

  assert.deepEqual(fs.readdirSync(canonical.paths.finalData).sort(), filenames);
  assert.deepEqual(fs.readdirSync(reverse.paths.finalData).sort(), filenames);
  for (const filename of filenames) {
    assert.deepEqual(
      fs.readFileSync(reverse.paths.finalData + `/${filename}`),
      fs.readFileSync(canonical.paths.finalData + `/${filename}`),
      filename
    );
  }
  assert.equal(reverse.assembled.final_data_hash, canonical.assembled.final_data_hash);
});

test('domain accept rejects pending decisions without writing an accepted artifact', () => {
  const fixture = prepareAcceptedChapter('四域待定拒绝试书', 'run-domain-pending');
  pass(runFlow([
    'plan-domains', fixture.novel, '--run', fixture.prepared.run_id, '--json'
  ]), 'plan domains');
  const input = readWorkPlan(fixture.paths, 'domain').inputs.find(value => value.unit === 'distill:characters');
  const pending = validDomainDraft(input, entry => entry.category === 'characters' ? 'pending' : 'keep');
  pending.decisions.filter(row => row.action === 'pending').forEach(row => {
    row.detail = '原文不足以完成确定性判断。';
  });
  const draft = writeStagingDraft(fixture.novel, input.unit, pending);

  const result = runFlow([
    'accept', fixture.novel, '--run', fixture.prepared.run_id,
    '--unit', input.unit, '--draft', draft, '--json'
  ]);

  assert.notEqual(result.status, 0);
  assert.equal(parseJsonLine(result.stderr).code, 'DOMAIN_PENDING_UNRESOLVED');
  assert.equal(readJson(fixture.paths.progress).units[input.unit].attempts, 1);
  assert.equal(fs.existsSync(semanticDecisionFile(fixture.paths, input.unit, input.input_hash)), false);
});

test('domain accept rejects unknown and unauthorized faction refs before writing accepted evidence', () => {
  for (const [suffix, factionRef, expectedCode] of [
    ['unknown', 'r999999', 'DOMAIN_REFERENCE_UNKNOWN'],
    ['unauthorized', null, 'DOMAIN_REFERENCE_UNAUTHORIZED']
  ]) {
    const fixture = prepareAcceptedChapter(`四域势力引用拒绝试书-${suffix}`, `run-domain-faction-${suffix}`);
    pass(runFlow([
      'plan-domains', fixture.novel, '--run', fixture.prepared.run_id, '--json'
    ]), `plan domains ${suffix}`);
    const input = readWorkPlan(fixture.paths, 'domain').inputs
      .find(value => value.unit === 'distill:characters');
    const draftValue = validDomainDraft(input);
    draftValue.decisions[0].patch.faction = factionRef || input.entries[0].entry_ref;
    const draft = writeStagingDraft(fixture.novel, input.unit, draftValue);

    const result = runFlow([
      'accept', fixture.novel, '--run', fixture.prepared.run_id,
      '--unit', input.unit, '--draft', draft, '--json'
    ]);

    assert.notEqual(result.status, 0);
    const error = parseJsonLine(result.stderr);
    assert.equal(error.code, 'DRAFT_REJECTED');
    assert.equal(error.details.errors.some(issue => issue.code === expectedCode), true);
    assert.equal(fs.existsSync(semanticDecisionFile(fixture.paths, input.unit, input.input_hash)), false);
  }
});

test('plan-domains preserves every accepted item without truncation', () => {
  const items = Array.from({ length: 250 }, (_, index) => ({
    local_key: `item:item-${String(index).padStart(3, '0')}`,
    name: `剧情物件${String(index).padStart(3, '0')}`,
    type: '其他',
    description: `第${index + 1}件剧情物件。`,
    inclusion_reason: '剧情关键',
    source_refs: [sourceRef(1, `剧情物件${String(index).padStart(3, '0')}`)]
  }));
  const source = `第一章 起始\n${items.map(item => item.name).join('、')}。\n`;
  const novel = makeNovel('四域无截断试书', source);
  const prepared = pass(runFlow(['prepare', novel, '--run', 'run-domain-no-truncation', '--json']), 'prepare');
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);
  const chapter = validChapterDraft({
    chapter: 1,
    title: manifest.chapters[0].title,
    source_hash: manifest.chapters[0].input_hash,
    characters: [],
    skills: [],
    factions: [],
    items,
    chapter_summary: {
      title: manifest.chapters[0].title,
      summary: '本章列出全部剧情物件。',
      source_refs: [sourceRef(1, items[0].name)]
    }
  });
  const draft = writeStagingDraft(novel, 'chapter:001', chapter);
  pass(runFlow([
    'accept', novel, '--run', prepared.run_id, '--unit', 'chapter:001', '--draft', draft, '--json'
  ]), 'accept chapter');

  pass(runFlow([
    'plan-domains', novel, '--run', prepared.run_id, '--json'
  ]), 'plan domains');
  const input = readWorkPlan(paths, 'domain').inputs.find(value => value.unit === 'distill:items');

  assert.equal(input.entries.length, items.length);
  assert.equal(new Set(input.entries.map(entry => entry.entry_ref)).size, items.length);
});
