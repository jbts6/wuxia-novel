'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const { semanticDecisionFile } = require('../scripts/lib/accept');
const { readWorkPlan } = require('../scripts/lib/semantic-work');
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
  const input = readWorkPlan(fixture.paths, 'domain').inputs.find(value => value.unit === 'distill:skills');
  const pending = validDomainDraft(input, entry => entry.category === 'skills' ? 'pending' : 'keep');
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
    source_refs: [sourceRef(1, `剧情物件${index}`)]
  }));
  const fixture = prepareAcceptedChapter('四域无截断试书', 'run-domain-no-truncation', {
    characters: [],
    skills: [],
    factions: [],
    items
  });

  pass(runFlow([
    'plan-domains', fixture.novel, '--run', fixture.prepared.run_id, '--json'
  ]), 'plan domains');
  const input = readWorkPlan(fixture.paths, 'domain').inputs.find(value => value.unit === 'distill:items');

  assert.equal(input.entries.length, items.length);
  assert.equal(new Set(input.entries.map(entry => entry.entry_ref)).size, items.length);
});
