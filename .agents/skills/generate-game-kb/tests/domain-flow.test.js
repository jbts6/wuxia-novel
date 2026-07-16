'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { semanticDecisionFile } = require('../scripts/lib/accept');
const { readWorkPlan } = require('../scripts/lib/semantic-work');
const { pathsFor } = require('../scripts/lib/paths');
const { SEMANTIC_CONTRACT_VERSION } = require('../scripts/lib/semantic-contract');
const { sha256 } = require('../scripts/lib/source');
const {
  makeNovel,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft,
  writeStagingDraft
} = require('./helpers');

function pass(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function domainDraft(input, actionForEntry = () => 'keep') {
  return {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    unit: input.unit,
    input_hash: input.input_hash,
    decisions: input.entries.map(entry => {
      const action = actionForEntry(entry);
      return action === 'pending'
        ? { entry_ref: entry.entry_ref, action, detail: '原文未说明所属武功。' }
        : {
          entry_ref: entry.entry_ref,
          action,
          patch: {
            canonical_name: entry.canonical_name,
            ...(['characters', 'skills'].includes(entry.category)
              ? { power_rank: '登堂入室' }
              : {})
          }
        };
    }),
    notes: []
  };
}

function prepareMartialDomainFixture(name, runId) {
  const novel = makeNovel(name, '第一章 雪山相逢\n胡斐使出八方藏刀式。\n');
  const prepared = pass(runFlow(['prepare', novel, '--run', runId, '--json']), 'prepare');
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);
  const chapter = validChapterDraft({
    chapter: 1,
    title: manifest.chapters[0].title,
    source_hash: manifest.chapters[0].input_hash,
    skills: [{
      local_key: 'skill:hu-dao', name: '胡家刀法', type: '刀法', description: '胡家家传刀法。',
      power_rank: '登堂入室',
      holder_names: ['胡斐'], technique_names: ['八方藏刀式'], source_refs: [sourceRef(1, '胡家刀法')]
    }],
    techniques: [{
      local_key: 'technique:ba-fang', name: '八方藏刀式', named_in_source: true,
      source_skill_local_key: 'skill:hu-dao', description: '刀势从八方回护。', source_refs: [sourceRef(1, '八方藏刀式')]
    }],
    dialogues: []
  });
  const chapterDraft = writeStagingDraft(novel, 'chapter:001', chapter);
  pass(runFlow(['accept', novel, '--run', prepared.run_id, '--unit', 'chapter:001', '--draft', chapterDraft, '--json']), 'accept chapter');
  pass(runFlow(['prepare-merge', novel, '--run', prepared.run_id, '--json']), 'prepare domains');
  const plan = readWorkPlan(paths, 'domain');
  return { novel, prepared, paths, plan, martial: plan.inputs.find(input => input.unit === 'distill:martial') };
}

function replaceAcceptedDecision(paths, input, draft) {
  const file = semanticDecisionFile(paths, input.unit, input.input_hash);
  replaceAcceptedArtifact(paths, file, draft);
}

function replaceAcceptedArtifact(paths, file, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(file, content);
  const manifest = readJson(paths.artifactManifest);
  const relativePath = path.relative(paths.run, file).split(path.sep).join('/');
  const entry = manifest.entries.find(value => value.relative_path === relativePath);
  entry.content_hash = sha256(content);
  fs.writeFileSync(paths.artifactManifest, `${JSON.stringify(manifest, null, 2)}\n`);
}

test('CLI routes accepted chapters through four domain decisions and zero AI clean units', () => {
  const novel = makeNovel('领域流程试书', '第一章 雪山相逢\n胡斐在雪山现身。\n');
  const prepared = pass(runFlow(['prepare', novel, '--run', 'run-domain-flow', '--json']), 'prepare');
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);
  const chapter = validChapterDraft({
    chapter: 1,
    title: manifest.chapters[0].title,
    source_hash: manifest.chapters[0].input_hash,
    characters: [{
      local_key: 'character:hu', name: '胡斐', identity: '胡家后人', level: '核心',
      power_rank: '登堂入室',
      biography: '胡斐追查父仇。', personality: { traits: ['侠义'], speech_style: '直率' },
      relationship_names: [], skill_names: ['胡家刀法'], item_names: [], source_refs: [sourceRef(1, '胡斐')]
    }],
    events: [{
      local_key: 'event:meet', name: '雪山相逢', importance: '重要', quote_status: 'quotable',
      cause: '寻宝', process: '胡斐现身', result: '众人停手', participant_names: ['胡斐'], location_names: ['雪山'],
      source_refs: [sourceRef(1, '雪山相逢')]
    }],
    items: [{
      local_key: 'item:铁盒', name: '铁盒', type: '信物', description: '藏有关键书信。',
      inclusion_reason: '剧情关键', source_refs: [sourceRef(1, '铁盒')]
    }],
    skills: [{
      local_key: 'skill:hu-dao', name: '胡家刀法', type: '刀法', description: '胡家家传刀法。',
      power_rank: '登堂入室',
      holder_names: ['胡斐'], technique_names: ['八方藏刀式'], source_refs: [sourceRef(1, '胡家刀法')]
    }],
    techniques: [{
      local_key: 'technique:ba-fang', name: '八方藏刀式', named_in_source: true,
      source_skill_local_key: 'skill:hu-dao', description: '刀势从八方回护。', source_refs: [sourceRef(1, '八方藏刀式')]
    }],
    factions: [],
    locations: [{
      local_key: 'location:snow', name: '雪山', region: '关外', description: '终年积雪。',
      source_refs: [sourceRef(1, '雪山')]
    }],
    dialogues: []
  });
  const chapterDraft = writeStagingDraft(novel, 'chapter:001', chapter);
  pass(runFlow(['accept', novel, '--run', prepared.run_id, '--unit', 'chapter:001', '--draft', chapterDraft, '--json']), 'accept chapter');

  const domains = pass(runFlow(['prepare-merge', novel, '--run', prepared.run_id, '--json']), 'prepare domains');
  assert.deepEqual(domains.units, ['distill:plot', 'distill:martial', 'distill:items', 'distill:world']);
  const plan = readWorkPlan(paths, 'domain');
  for (const input of plan.inputs) {
    const draft = domainDraft(input);
    const file = writeStagingDraft(novel, input.unit, draft);
    pass(runFlow(['accept', novel, '--run', prepared.run_id, '--unit', input.unit, '--draft', file, '--json']), `accept ${input.unit}`);
  }

  const merged = pass(runFlow(['assemble-merge', novel, '--run', prepared.run_id, '--json']), 'assemble merge');
  assert.equal(merged.unit, 'merge:book');
  assert.equal(merged.attempts, 0);
  const cleanPlan = pass(runFlow(['prepare-clean', novel, '--run', prepared.run_id, '--json']), 'prepare clean');
  assert.deepEqual(cleanPlan.units, []);
  const cleaned = pass(runFlow(['assemble-clean', novel, '--run', prepared.run_id, '--json']), 'assemble clean');
  assert.equal(cleaned.unit, 'clean:book');
  assert.equal(cleaned.attempts, 0);

  const progress = readJson(paths.progress).units;
  assert.equal(Object.keys(progress).filter(unit => /^merge:(?!book)|^clean:(?!book)/.test(unit)).length, 0);
  assert.equal(Object.keys(progress).filter(unit => unit.startsWith('distill:')).length, 4);
  assert.equal(readJson(paths.cleaned).chapter_summaries.length, 1);
  assert.equal(readJson(paths.cleaned).quantity_review.consumed, true);
});

test('domain accept rejects pending decisions without writing an accepted artifact', () => {
  const { novel, prepared, paths, martial } = prepareMartialDomainFixture(
    '领域待定拒绝试书',
    'run-domain-pending-reject'
  );
  const pending = domainDraft(martial, entry => entry.category === 'techniques' ? 'pending' : 'keep');
  const draft = writeStagingDraft(novel, martial.unit, pending);

  const result = runFlow(['accept', novel, '--run', prepared.run_id, '--unit', martial.unit, '--draft', draft, '--json']);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).code, 'DOMAIN_PENDING_UNRESOLVED');
  const state = readJson(paths.progress).units[martial.unit];
  assert.equal(state.status, 'pending');
  assert.equal(state.attempts, 1);
  assert.equal(fs.existsSync(semanticDecisionFile(paths, martial.unit, martial.input_hash)), false);
});

test('assemble merge reopens a historical accepted pending domain for attempt 02', () => {
  const { novel, prepared, paths, plan, martial } = prepareMartialDomainFixture(
    '领域待定恢复试书',
    'run-domain-pending-recovery'
  );
  for (const input of plan.inputs) {
    const file = writeStagingDraft(novel, input.unit, domainDraft(input));
    pass(runFlow(['accept', novel, '--run', prepared.run_id, '--unit', input.unit, '--draft', file, '--json']), `accept ${input.unit}`);
  }
  const before = readJson(paths.progress).units[martial.unit];
  const pending = domainDraft(martial, entry => entry.category === 'techniques' ? 'pending' : 'keep');
  replaceAcceptedDecision(paths, martial, pending);

  const recovery = runFlow(['assemble-merge', novel, '--run', prepared.run_id, '--json']);
  assert.equal(recovery.status, 1);
  assert.equal(JSON.parse(recovery.stderr).code, 'DOMAIN_PENDING_UNRESOLVED');
  const reopened = readJson(paths.progress).units[martial.unit];
  assert.equal(reopened.status, 'pending');
  assert.equal(reopened.attempts, 1);
  assert.deepEqual(reopened.output_hashes, before.output_hashes);
  assert.equal(fs.existsSync(semanticDecisionFile(paths, martial.unit, martial.input_hash)), false);

  const attempt02 = writeStagingDraft(novel, martial.unit, domainDraft(martial));
  assert.match(attempt02, /distill_martial_attempt_02\.json$/);
  pass(runFlow(['accept', novel, '--run', prepared.run_id, '--unit', martial.unit, '--draft', attempt02, '--json']), 'accept recovered martial');
  assert.equal(readJson(paths.progress).units[martial.unit].attempts, 2);
});

test('assemble clean repairs only an invalid deterministic cleaned artifact', () => {
  const { novel, prepared, paths, plan } = prepareMartialDomainFixture(
    '领域清理恢复试书',
    'run-domain-clean-recovery'
  );
  for (const input of plan.inputs) {
    const file = writeStagingDraft(novel, input.unit, domainDraft(input));
    pass(runFlow(['accept', novel, '--run', prepared.run_id, '--unit', input.unit, '--draft', file, '--json']), `accept ${input.unit}`);
  }
  pass(runFlow(['assemble-merge', novel, '--run', prepared.run_id, '--json']), 'assemble merge');
  pass(runFlow(['assemble-clean', novel, '--run', prepared.run_id, '--json']), 'assemble clean');
  const invalid = readJson(paths.cleaned);
  invalid.quantity_review.consumed = false;
  replaceAcceptedArtifact(paths, paths.cleaned, invalid);

  const repaired = pass(runFlow(['assemble-clean', novel, '--run', prepared.run_id, '--json']), 'repair clean');

  assert.equal(repaired.repaired, true);
  assert.equal(readJson(paths.cleaned).quantity_review.consumed, true);
  assert.equal(readJson(paths.progress).units['clean:book'].attempts, 0);
});
