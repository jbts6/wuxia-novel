'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { assertDraftPath } = require('../scripts/lib/accept');
const { DATA_FILES } = require('../scripts/lib/install');
const { pathsFor } = require('../scripts/lib/paths');
const { resolveRun } = require('../scripts/lib/run');
const { DOMAIN_UNITS, FINAL_FILES, SEMANTIC_CONTRACT_VERSION } = require('../scripts/lib/semantic-contract');
const { INITIAL_CONCURRENCY_LIMIT } = require('../scripts/lib/worker-pool');
const { readWorkItem } = require('../scripts/lib/semantic-work');
const {
  acceptAllChapters,
  makeNovel,
  makeNovelDirectory,
  parseJsonLine,
  prepareAssembledRun,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft,
  validDomainDraft,
  writeStagingDraft
} = require('./helpers');

function activePaths(novel) {
  const run = resolveRun(novel);
  return pathsFor(novel, run.run_id);
}

function acceptDraft(novel, unit, draft, attempt) {
  const draftFile = writeStagingDraft(novel, unit, draft, attempt);
  return runFlow(['accept', novel, '--unit', unit, '--draft', draftFile, '--json']);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('prepare creates the single current contract in default mode and returns JSON', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const result = runFlow(['prepare', novel, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const metadata = readJson(activePaths(novel).runJson);
  assert.equal(output.chapter_count, 1);
  assert.equal(readJson(activePaths(novel).manifest).chapters.length, 1);
  assert.equal(metadata.semantic_contract_version, SEMANTIC_CONTRACT_VERSION);
  assert.equal(metadata.semantic_profile, 'domain-distill-v1');
  assert.equal(metadata.deep, false);
  assert.equal(metadata.profile, undefined);
});

test('prepare without --run resumes the unique current run instead of archiving it', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const first = runFlow(['prepare', novel, '--json']);
  assert.equal(first.status, 0, first.stderr);
  const firstOutput = JSON.parse(first.stdout);
  const firstPaths = activePaths(novel);
  const archivesBefore = fs.readdirSync(path.join(novel, '_archive')).sort();

  const second = runFlow(['prepare', novel, '--json']);

  assert.equal(second.status, 0, second.stderr);
  const secondOutput = JSON.parse(second.stdout);
  assert.equal(secondOutput.run_id, firstOutput.run_id);
  assert.equal(secondOutput.resumed, true);
  assert.equal(fs.existsSync(firstPaths.runJson), true);
  assert.deepEqual(fs.readdirSync(path.join(novel, '_archive')).sort(), archivesBefore);
});

test('prepare reports a stable error code and nonzero exit', () => {
  const novel = makeNovelDirectory({ '甲.txt': '甲', '乙.txt': '乙' });
  const result = runFlow(['prepare', novel, '--json']);

  assert.notEqual(result.status, 0);
  assert.equal(parseJsonLine(result.stderr).code, 'SOURCE_AMBIGUOUS');
});

test('unknown command is rejected without a stack trace', () => {
  const result = runFlow(['unknown']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /COMMAND_UNKNOWN/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test('reset-unit requires explicit confirmation', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const result = runFlow(['reset-unit', novel, '--unit', 'chapter:001', '--json']);

  assert.notEqual(result.status, 0);
  assert.equal(parseJsonLine(result.stderr).code, 'RESET_CONFIRM_REQUIRED');
});

test('retry-unit requires explicit confirmation', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const result = runFlow(['retry-unit', novel, '--unit', 'chapter:001', '--json']);

  assert.notEqual(result.status, 0);
  assert.equal(parseJsonLine(result.stderr).code, 'RESET_CONFIRM_REQUIRED');
});

test('accept records one invalid attempt and preserves its archived draft', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const manifest = readJson(paths.manifest);
  const draft = validChapterDraft({ source_hash: manifest.chapters[0].input_hash, chapter: 2 });

  const result = acceptDraft(novel, 'chapter:001', draft);

  assert.notEqual(result.status, 0);
  assert.equal(parseJsonLine(result.stderr).code, 'DRAFT_REJECTED');
  const progress = readJson(paths.progress).units['chapter:001'];
  assert.equal(progress.attempts, 1);
  assert.equal(progress.status, 'pending');
  const archived = fs.readdirSync(path.join(paths.drafts, 'chapter_001'));
  assert.equal(archived.filter(file => file.endsWith('.yaml')).length, 1);
  assert.equal(archived.filter(file => file.endsWith('.json')).length, 1);
  assert.equal(fs.existsSync(manifest.chapters[0].staging_paths[0]), true);
});

test('a consumed staging path is rejected before spending the remaining budget', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const manifest = readJson(paths.manifest);
  const invalid = validChapterDraft({ source_hash: manifest.chapters[0].input_hash, chapter: 2 });

  const first = acceptDraft(novel, 'chapter:001', invalid, 1);
  assert.notEqual(first.status, 0);
  assert.equal(parseJsonLine(first.stderr).code, 'DRAFT_REJECTED');
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 1);

  const replayFile = writeStagingDraft(novel, 'chapter:001', invalid, 1);
  const replay = runFlow(['accept', novel, '--unit', 'chapter:001', '--draft', replayFile, '--json']);
  assert.notEqual(replay.status, 0);
  assert.equal(parseJsonLine(replay.stderr).code, 'DRAFT_STAGING_MISMATCH');
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 1);

  const valid = validChapterDraft({ source_hash: manifest.chapters[0].input_hash });
  const second = acceptDraft(novel, 'chapter:001', valid, 2);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 2);
  assert.equal(readJson(paths.progress).units['chapter:001'].status, 'done');
});

test('draft staging containment rejects an escaping junction before spending budget', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const manifest = readJson(paths.manifest);
  const draft = validChapterDraft({ source_hash: manifest.chapters[0].input_hash });
  const outside = path.join(novel, 'outside-staging');
  fs.mkdirSync(outside);
  const unit = path.join('escape', 'chapter_001');
  const fileName = 'chapter_001_attempt_01.yaml';
  fs.writeFileSync(
    path.join(outside, fileName),
    yaml.dump(draft, { noRefs: true, lineWidth: -1 }),
    'utf8'
  );
  const junction = path.join(paths.staging, 'escape');
  const staging = path.join(junction, fileName);
  fs.symlinkSync(outside, junction, 'junction');

  assert.throws(
    () => assertDraftPath(paths, staging, unit, 1),
    error => error.code === 'DRAFT_STAGING_ESCAPE'
  );
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 0);
  assert.equal(fs.existsSync(path.join(outside, fileName)), true);
});

test('accept persists normalized current chapter YAML and marks the unit done', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const manifest = readJson(paths.manifest);
  const draft = validChapterDraft({ source_hash: manifest.chapters[0].input_hash });

  const result = acceptDraft(novel, 'chapter:001', draft);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'done');
  const acceptedFile = path.join(paths.chapters, 'ch_001.yaml');
  const accepted = yaml.load(fs.readFileSync(acceptedFile, 'utf8'));
  assert.equal(accepted.chapter, 1);
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 1);
  assert.equal(readJson(paths.progress).units['chapter:001'].status, 'done');
  assert.equal(
    readJson(paths.artifactManifest).entries.some(entry => entry.relative_path === 'accepted/chapters/ch_001.yaml'),
    true
  );
});

test('plan-domains creates four current units and a rejected domain leaves its accepted sibling unchanged', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲取得铁盒并拜入胡家。\n');
  assert.equal(runFlow(['prepare', novel, '--deep', '--json']).status, 0);
  const paths = activePaths(novel);
  const chapter = readJson(paths.manifest).chapters[0];
  const chapterDraft = validChapterDraft({
    title: chapter.title,
    source_hash: chapter.input_hash,
    items: [{
      local_key: 'item:铁盒',
      name: '铁盒',
      source_refs: [sourceRef(1, '甲取得铁盒并拜入胡家。')]
    }],
    factions: [{
      local_key: 'faction:胡家', name: '胡家',
      source_refs: [sourceRef(1, '甲取得铁盒并拜入胡家。')]
    }],
    chapter_summary: {
      title: chapter.title,
      summary: '甲取得铁盒并拜入胡家。',
      source_refs: [sourceRef(1, '甲取得铁盒并拜入胡家。')]
    }
  });
  assert.equal(acceptDraft(novel, 'chapter:001', chapterDraft).status, 0);

  const planned = runFlow(['plan-domains', novel, '--json']);
  assert.equal(planned.status, 0, planned.stderr);
  assert.deepEqual(JSON.parse(planned.stdout).units, DOMAIN_UNITS);
  for (const unit of DOMAIN_UNITS) {
    assert.equal(readJson(paths.progress).units[unit].attempts, 0);
  }

  const characterWork = readWorkItem(paths, 'distill:characters').input;
  const accepted = acceptDraft(novel, characterWork.unit, validDomainDraft(characterWork));
  assert.equal(accepted.status, 0, accepted.stderr);
  const characterDecision = path.join(paths.domainDecisions, 'distill_characters.yaml');
  const characterBytes = fs.readFileSync(characterDecision, 'utf8');

  const itemWork = readWorkItem(paths, 'distill:items').input;
  const rejected = acceptDraft(novel, itemWork.unit, {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    unit: itemWork.unit,
    input_hash: itemWork.input_hash,
    decisions: [],
    notes: []
  });
  assert.notEqual(rejected.status, 0);
  assert.equal(parseJsonLine(rejected.stderr).code, 'DRAFT_REJECTED');
  assert.equal(fs.readFileSync(characterDecision, 'utf8'), characterBytes);

  const progress = readJson(paths.progress).units;
  assert.equal(progress['distill:characters'].status, 'done');
  assert.equal(progress['distill:characters'].attempts, 1);
  assert.equal(progress['distill:items'].status, 'pending');
  assert.equal(progress['distill:items'].attempts, 1);
});

test('plan-domains rejects a standard run without --deep', () => {
  const novel = makeNovel('默认模式', '第一章 起始\n甲。\n');
  const runId = 'run-standard-domains';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  acceptAllChapters(novel, runId);

  const result = runFlow(['plan-domains', novel, '--run', runId, '--json']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEEP_MODE_REQUIRED/);
  const paths = pathsFor(novel, runId);
  assert.deepEqual(
    Object.keys(readJson(paths.progress).units).filter(unit => unit.startsWith('distill:')),
    []
  );
});

test('assemble CLI projects the exact five deterministic YAML files', () => {
  const fixture = prepareAssembledRun({ name: 'CLI组装试书', runId: 'run-cli-assemble' });

  assert.deepEqual(fixture.commands, [
    'prepare',
    'accept',
    'plan-domains',
    'accept',
    'accept',
    'accept',
    'accept',
    'assemble'
  ]);
  assert.match(fixture.assembled.final_data_hash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(fs.readdirSync(fixture.paths.finalData).sort(), [...DATA_FILES].sort());
});

// ---------------------------------------------------------------------------
// Simplified command surface (no batch / no guard / flat units)
// ---------------------------------------------------------------------------

test('extract-plan returns flat chapter units at five-wide concurrency with no batch form', () => {
  const novel = makeNovel('提取计划书', '第一章 起始\n甲。\n第二章 续\n乙。\n第三章 终\n丙。\n');
  const runId = 'run-extract-plan';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  const result = runFlow(['extract-plan', novel, '--run', runId, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.stage, 'extract');
  assert.equal(plan.concurrency, INITIAL_CONCURRENCY_LIMIT);
  assert.equal(plan.concurrency, 5);
  assert.equal(plan.count, 3);
  assert.equal(plan.chapters.length, 3);
  // The simplified contract has no batch concept.
  assert.equal(plan.batch, undefined);
  assert.equal(plan.batches, undefined);
  assert.equal(plan.batch_id, undefined);
  for (const item of plan.chapters) {
    assert.match(item.unit, /^chapter:\d{3}$/);
    assert.equal(typeof item.number, 'number');
    assert.equal(typeof item.title, 'string');
    assert.equal(typeof item.input_hash, 'string');
    assert.equal(item.attempt, 1);
  }
  assert.deepEqual(plan.incomplete, plan.chapters.map(chapter => chapter.unit));
});

test('submit rejects empty stdin without writing staging, accepted, or progress', () => {
  const novel = makeNovel('提交空输入', '第一章 起始\n甲。\n');
  const runId = 'run-submit-empty';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  const paths = pathsFor(novel, runId);

  const result = runFlow(
    ['submit', novel, '--run', runId, '--unit', 'chapter:001', '--attempt', '1', '--json'],
    { input: '' }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SUBMISSION_INPUT_EMPTY/);
  assert.equal(fs.readdirSync(paths.staging).length, 0, 'staging must stay empty');
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 0);
  assert.equal(fs.existsSync(path.join(paths.chapters, 'ch_001.yaml')), false);
});

test('submit rejects a non-object envelope without side effects', () => {
  const novel = makeNovel('提交坏信封', '第一章 起始\n甲。\n');
  const runId = 'run-submit-bad';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  const paths = pathsFor(novel, runId);

  const result = runFlow(
    ['submit', novel, '--run', runId, '--unit', 'chapter:001', '--attempt', '1', '--json'],
    { input: 'this is not json {' }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SUBMISSION_ENVELOPE_INVALID/);
  assert.equal(fs.readdirSync(paths.staging).length, 0);
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 0);
});

test('submit rejects an identity-mismatched envelope without side effects', () => {
  const novel = makeNovel('提交错身份', '第一章 起始\n甲。\n');
  const runId = 'run-submit-identity';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  const paths = pathsFor(novel, runId);
  const manifest = readJson(paths.manifest);
  const envelope = {
    schema_version: 1,
    unit: 'chapter:001',
    attempt: 1,
    input_hash: `${manifest.chapters[0].input_hash}X`,
    draft: validChapterDraft({ source_hash: manifest.chapters[0].input_hash })
  };

  const result = runFlow(
    ['submit', novel, '--run', runId, '--unit', 'chapter:001', '--attempt', '1', '--json'],
    { input: JSON.stringify(envelope) }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SUBMISSION_IDENTITY_MISMATCH/);
  assert.equal(fs.readdirSync(paths.staging).length, 0);
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 0);
  assert.equal(fs.existsSync(path.join(paths.chapters, 'ch_001.yaml')), false);
});

test('submit accepts a well-formed envelope and records the chapter as done', () => {
  const novel = makeNovel('提交成功', '第一章 起始\n甲。\n');
  const runId = 'run-submit-ok';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  const paths = pathsFor(novel, runId);
  const manifest = readJson(paths.manifest);
  const envelope = {
    schema_version: 1,
    unit: 'chapter:001',
    attempt: 1,
    input_hash: manifest.chapters[0].input_hash,
    draft: validChapterDraft({ source_hash: manifest.chapters[0].input_hash })
  };

  const result = runFlow(
    ['submit', novel, '--run', runId, '--unit', 'chapter:001', '--attempt', '1', '--json'],
    { input: JSON.stringify(envelope) }
  );

  assert.equal(result.status, 0, result.stderr);
  const progress = readJson(paths.progress).units['chapter:001'];
  assert.equal(progress.status, 'done');
  assert.equal(progress.attempts, 1);
  assert.equal(fs.existsSync(path.join(paths.chapters, 'ch_001.yaml')), true);
});

test('submit rejects a replayed attempt without spending a second budget', () => {
  const novel = makeNovel('提交重放', '第一章 起始\n甲。\n');
  const runId = 'run-submit-replay';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  const paths = pathsFor(novel, runId);
  const manifest = readJson(paths.manifest);
  const envelope = {
    schema_version: 1,
    unit: 'chapter:001',
    attempt: 1,
    input_hash: manifest.chapters[0].input_hash,
    draft: validChapterDraft({ source_hash: manifest.chapters[0].input_hash })
  };
  const input = JSON.stringify(envelope);

  assert.equal(
    runFlow(
      ['submit', novel, '--run', runId, '--unit', 'chapter:001', '--attempt', '1', '--json'],
      { input }
    ).status,
    0
  );

  const replay = runFlow(
    ['submit', novel, '--run', runId, '--unit', 'chapter:001', '--attempt', '1', '--json'],
    { input }
  );
  assert.notEqual(replay.status, 0);
  assert.match(replay.stderr, /SUBMISSION_ATTEMPT_CONFLICT/);
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 1);
});

test('run returns a flat extract plan before any chapter is accepted', () => {
  const novel = makeNovel('运行前提取', '第一章 起始\n甲。\n第二章 续\n乙。\n');
  const runId = 'run-progressive';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);

  const result = runFlow(['run', novel, '--run', runId, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.stage, 'extract');
  assert.equal(plan.concurrency, 5);
  assert.equal(plan.count, 2);
  assert.deepEqual(plan.incomplete, ['chapter:001', 'chapter:002']);
});

test('lite assemble creates the candidate registry without planning domain units', () => {
  const novel = makeNovel('直接组装', '第一章 起始\n甲。\n');
  const runId = 'run-direct-assemble';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  acceptAllChapters(novel, runId);

  const result = runFlow(['assemble', novel, '--run', runId, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const paths = pathsFor(novel, runId);
  assert.equal(fs.existsSync(paths.candidateRegistry), true);
  const domainUnits = Object.keys(readJson(paths.progress).units)
    .filter(unit => unit.startsWith('distill:'));
  assert.deepEqual(domainUnits, []);
});

test('run drives the lite pipeline end-to-end and archives five installed YAML files', () => {
  const novel = makeNovel('运行端到端', '第一章 起始\n甲。\n第二章 续\n乙。\n第三章 终\n丙。\n');
  const runId = 'run-e2e-lite';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  acceptAllChapters(novel, runId);

  const result = runFlow(['run', novel, '--run', runId, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.stage, 'archived');
  const installed = fs.readdirSync(path.join(novel, 'data')).sort();
  assert.deepEqual(installed, [...Object.values(FINAL_FILES)].sort());
  assert.equal(installed.length, 5);
});

test('source_hash is a hard gate: a changed source blocks re-prepare', () => {
  const novel = makeNovel('哈希源', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--run', 'run-source', '--json']).status, 0);

  fs.writeFileSync(path.join(novel, '哈希源.txt'), '第一章 起始\n乙完全不同的内容。\n');

  const result = runFlow(['prepare', novel, '--run', 'run-source', '--json']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RUN_SOURCE_CHANGED/);
});

test('final_data_hash is a hard gate: tampering assembled data fails verification', () => {
  const novel = makeNovel('数据哈希', '第一章 起始\n甲。\n第二章 续\n乙。\n');
  const runId = 'run-data-hash';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  acceptAllChapters(novel, runId);
  assert.equal(runFlow(['assemble', novel, '--run', runId, '--json']).status, 0);

  const paths = pathsFor(novel, runId);
  const charFile = path.join(paths.finalData, 'characters.yaml');
  const chars = yaml.load(fs.readFileSync(charFile, 'utf8')) || [];
  chars.push({
    id: 'char_tamper', name: '篡改者', level: '核心', rank: '初窥门径',
    aliases: [], identities: [], description: null, factions: [], skills: [],
    source_refs: [{ chapter: 1, text: '篡改' }]
  });
  fs.writeFileSync(charFile, yaml.dump(chars, { noRefs: true, lineWidth: -1 }), 'utf8');

  const verified = runFlow(['verify', novel, '--run', runId, '--json']);
  assert.notEqual(verified.status, 0);
  assert.match(verified.stderr, /FINAL_VERIFICATION_FAILED|ASSEMBLY_FINAL_HASH_STALE/);
});
