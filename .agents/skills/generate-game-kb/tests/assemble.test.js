'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { semanticDecisionFile } = require('../scripts/lib/accept');
const { assembleDomainMergedBook } = require('../scripts/lib/domain-assembly');
const { readYaml } = require('../scripts/lib/io');
const { readWorkPlan } = require('../scripts/lib/semantic-work');
const { pathsFor } = require('../scripts/lib/paths');
const {
  DOMAIN_UNITS,
  FINAL_FILES,
  SEMANTIC_CONTRACT_VERSION
} = require('../scripts/lib/semantic-contract');
const {
  makeNovel,
  prepareAssembledRun,
  readJson,
  replaceAcceptedArtifact,
  runFlow,
  sourceRef,
  validChapterDraft,
  writeStagingDraft
} = require('./helpers');

function pass(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function errorPayload(result) {
  assert.notEqual(result.status, 0, 'command unexpectedly succeeded');
  return JSON.parse(result.stderr);
}

function domainDraft(input) {
  return {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    unit: input.unit,
    input_hash: input.input_hash,
    decisions: input.entries.map(entry => ({
      entry_ref: entry.entry_ref,
      action: 'keep',
      patch: {
        name: entry.canonical_name,
        aliases: [],
        ...(entry.category === 'characters' ? {
          identities: [], level: '核心', rank: '登堂入室', description: null, factions: [], skills: []
        } : {}),
        ...(entry.category === 'skills' ? {
          types: [], factions: [], rank: '登堂入室', description: null, techniques: []
        } : {}),
        ...(entry.category === 'items' ? {
          type: null, description: null, inclusion_reason: '其他稀有特殊'
        } : {}),
        ...(entry.category === 'factions' ? { type: null, description: null } : {})
      }
    })),
    notes: []
  };
}

function finalBytes(dataRoot) {
  return Object.fromEntries(
    Object.values(FINAL_FILES)
      .sort()
      .map(name => [name, fs.readFileSync(path.join(dataRoot, name), 'utf8')])
  );
}

test('assemble is a real command and fails closed until accepted inputs are complete', () => {
  const novel = makeNovel('组装命令试书', '第一章 起始\n甲初入江湖。\n');
  const prepared = runFlow(['prepare', novel, '--run', 'run-assemble-red', '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);

  const result = runFlow(['assemble', novel, '--run', 'run-assemble-red', '--json']);
  const error = errorPayload(result);

  assert.equal(error.code, 'BOOK_ASSEMBLY_INCOMPLETE');
  assert.deepEqual(error.details.units, [
    'chapter:001',
    'distill:factions',
    'distill:characters',
    'distill:skills',
    'distill:items'
  ]);
});

test('assemble projects exactly five deterministic YAML files from accepted chapters and four domains', () => {
  const novel = makeNovel(
    '确定性组装试书',
    '第一章 起始\n甲修习玄门内功并使出飞云掌。\n第二章 续行\n甲离开山谷。\n第三章 终局\n甲返回故里。\n'
  );
  const prepared = pass(runFlow(['prepare', novel, '--run', 'run-assemble-green', '--json']), 'prepare');
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);

  for (const chapter of manifest.chapters) {
    const number = chapter.number;
    const draft = validChapterDraft({
      chapter: number,
      title: chapter.title,
      source_hash: chapter.input_hash,
      ...(number === 1 ? {} : { characters: [], skills: [], items: [], factions: [] }),
      chapter_summary: {
        title: chapter.title,
        summary: `第${number}章的确定性摘要。`,
        source_refs: [{
          chapter: number,
          text: {
            1: '甲修习玄门内功并使出飞云掌。',
            2: '甲离开山谷。',
            3: '甲返回故里。'
          }[number]
        }]
      }
    });
    const unit = `chapter:${String(number).padStart(3, '0')}`;
    const file = writeStagingDraft(novel, unit, draft);
    pass(runFlow(['accept', novel, '--run', prepared.run_id, '--unit', unit, '--draft', file, '--json']), `accept ${unit}`);
  }

  pass(runFlow(['plan-domains', novel, '--run', prepared.run_id, '--json']), 'plan domains');
  const plan = readWorkPlan(paths, 'domain');
  assert.deepEqual(plan.inputs.map(input => input.unit), DOMAIN_UNITS);
  for (const input of plan.inputs) {
    const file = writeStagingDraft(novel, input.unit, domainDraft(input));
    pass(runFlow(['accept', novel, '--run', prepared.run_id, '--unit', input.unit, '--draft', file, '--json']), `accept ${input.unit}`);
  }

  const first = pass(runFlow(['assemble', novel, '--run', prepared.run_id, '--json']), 'first assemble');
  assert.deepEqual(fs.readdirSync(paths.finalData).sort(), Object.values(FINAL_FILES).sort());
  const bytes = finalBytes(paths.finalData);
  const report = readJson(path.join(paths.finalReports, 'assembly-report.json'));
  assert.equal(report.final_data_hash, first.final_data_hash);
  assert.equal(report.id_plan_hash, first.id_plan_hash);
  assert.match(report.id_plan_hash, /^sha256:[a-f0-9]{64}$/);

  const second = pass(runFlow(['assemble', novel, '--run', prepared.run_id, '--json']), 'second assemble');
  assert.deepEqual(finalBytes(paths.finalData), bytes);
  assert.equal(second.final_data_hash, first.final_data_hash);
});

test('assembly flow fails closed before publication when a local reference cannot be resolved', () => {
  assert.throws(() => prepareAssembledRun({
    name: '未解析引用试书',
    runId: 'run-unresolved-reference',
    chapterOverrides: {
      characters: [{
        local_key: 'character:jia',
        name: '甲',
        level: '核心',
        rank: '登堂入室',
        skills: ['skill:missing'],
        source_refs: [sourceRef(1, '甲')]
      }]
    }
  }), /REGISTRY_REFERENCE_MISSING/);
});

test('assemble rejects missing, pending, and cyclic domain decisions', () => {
  for (const mutation of ['missing', 'pending', 'cycle']) {
    assert.throws(() => prepareAssembledRun({
      name: `非法${mutation}决策试书`,
      runId: `run-invalid-${mutation}-decision`,
      source: '第一章 起始\n甲修习玄门内功并使出飞云掌。\n乙在旁观战。\n',
      chapterOverrides: {
        characters: [{
          local_key: 'character:jia',
          name: '甲',
          level: '核心',
          rank: '初窥门径',
          source_refs: [sourceRef(1, '甲修习玄门内功并使出飞云掌。')]
        }, {
          local_key: 'character:yi',
          name: '乙',
          level: '重要',
          rank: '初窥门径',
          source_refs: [sourceRef(1, '乙在旁观战。')]
        }]
      },
      beforeAssemble: ({ paths, plan }) => {
        const input = plan.inputs.find(item => item.unit === 'distill:characters');
        const file = semanticDecisionFile(paths, input.unit, input.input_hash);
        const decision = readYaml(file);
        if (mutation === 'missing') decision.decisions.shift();
        if (mutation === 'pending') {
          decision.decisions[0] = {
            entry_ref: decision.decisions[0].entry_ref,
            action: 'pending',
            detail: '需要人工消歧。'
          };
        }
        if (mutation === 'cycle') {
          const [first, second] = decision.decisions;
          decision.decisions[0] = {
            entry_ref: first.entry_ref,
            action: 'merge',
            target_ref: second.entry_ref
          };
          decision.decisions[1] = {
            entry_ref: second.entry_ref,
            action: 'merge',
            target_ref: first.entry_ref
          };
        }
        replaceAcceptedArtifact(paths, file, decision);
      }
    }), /DOMAIN_ASSEMBLY_INCOMPLETE/, mutation);
  }
});

test('assemble rejects a mutated accepted chapter', () => {
  assert.throws(() => prepareAssembledRun({
    name: '章节证据变更试书',
    runId: 'run-mutated-accepted-chapter',
    beforeAssemble: ({ paths }) => {
      fs.appendFileSync(path.join(paths.chapters, 'ch_001.yaml'), '\n# mutated\n');
    }
  }), /ACCEPTED_ARTIFACT_MUTATED/);
});

test('the assembled intermediate keeps chapter summaries to consumer fields only', () => {
  const { manifest, paths } = prepareAssembledRun({
    name: '章节摘要中间结构试书',
    runId: 'run-summary-shape'
  });
  const plan = readWorkPlan(paths, 'domain');
  const chapters = manifest.chapters.map(chapter => readYaml(
    path.join(paths.chapters, `ch_${String(chapter.number).padStart(3, '0')}.yaml`)
  ));
  const decisions = plan.inputs.map(input => readYaml(
    semanticDecisionFile(paths, input.unit, input.input_hash)
  ));
  const book = assembleDomainMergedBook({
    manifest,
    chapters,
    registry: readJson(paths.candidateRegistry),
    work_plan: plan,
    decisions
  });

  assert.deepEqual(Object.keys(book.chapter_summaries[0]).sort(), ['chapter', 'source_refs', 'summary', 'title']);
});

test('assembly blocks a missing chapter summary instead of synthesizing placeholder text', () => {
  const { manifest, paths } = prepareAssembledRun({
    name: '缺失章节摘要试书',
    runId: 'run-missing-summary'
  });
  const plan = readWorkPlan(paths, 'domain');
  const chapters = manifest.chapters.map(chapter => readYaml(
    path.join(paths.chapters, `ch_${String(chapter.number).padStart(3, '0')}.yaml`)
  ));
  delete chapters[0].chapter_summary;
  const decisions = plan.inputs.map(input => readYaml(
    semanticDecisionFile(paths, input.unit, input.input_hash)
  ));

  assert.throws(() => assembleDomainMergedBook({
    manifest,
    chapters,
    registry: readJson(paths.candidateRegistry),
    work_plan: plan,
    decisions
  }), { code: 'CHAPTER_SUMMARY_MISSING' });
});
