'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { assertDraftPath } = require('../scripts/lib/accept');
const { MAX_DOMAIN_WORK_ITEM_BYTES } = require('../scripts/lib/domain-work');
const { DATA_FILES } = require('../scripts/lib/install');
const { pathsFor } = require('../scripts/lib/paths');
const { resolveRun } = require('../scripts/lib/run');
const { DOMAIN_UNITS, SEMANTIC_CONTRACT_VERSION } = require('../scripts/lib/semantic-contract');
const { readWorkItem } = require('../scripts/lib/semantic-work');
const {
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

test('prepare creates a current v4 manifest and returns JSON', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const result = runFlow(['prepare', novel, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const metadata = readJson(activePaths(novel).runJson);
  assert.equal(output.chapter_count, 1);
  assert.equal(readJson(activePaths(novel).manifest).chapters.length, 1);
  assert.equal(metadata.semantic_contract_version, SEMANTIC_CONTRACT_VERSION);
  assert.equal(metadata.semantic_profile, 'domain-distill-v1');
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
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const chapter = readJson(paths.manifest).chapters[0];
  const chapterDraft = validChapterDraft({
    title: chapter.title,
    source_hash: chapter.input_hash,
    items: [{
      local_key: 'item:铁盒',
      name: '铁盒',
      importance: '关键',
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

test('plan-domains fails explicitly instead of truncating an oversized current domain', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲连续讲述往事。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const chapter = readJson(paths.manifest).chapters[0];
  const base = validChapterDraft();
  const chapterDraft = validChapterDraft({
    title: chapter.title,
    source_hash: chapter.input_hash,
    characters: [{
      ...base.characters[0],
      biography: '长'.repeat(MAX_DOMAIN_WORK_ITEM_BYTES),
      source_refs: [sourceRef(1, '甲连续讲述往事。')]
    }],
    skills: [],
    chapter_summary: {
      title: chapter.title,
      summary: '甲连续讲述往事。',
      source_refs: [sourceRef(1, '甲连续讲述往事。')]
    }
  });
  const accepted = acceptDraft(novel, 'chapter:001', chapterDraft);
  assert.equal(accepted.status, 0, accepted.stderr);

  const result = runFlow(['plan-domains', novel, '--json']);
  assert.notEqual(result.status, 0);
  const error = parseJsonLine(result.stderr);
  assert.equal(error.code, 'DOMAIN_INPUT_TOO_LARGE');
  assert.equal(error.details.unit, 'distill:characters');
  assert.ok(error.details.input_bytes > error.details.max_bytes);
  assert.equal(readJson(paths.progress).units['distill:characters'], undefined);
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
