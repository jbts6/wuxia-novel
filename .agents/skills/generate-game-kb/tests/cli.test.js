'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { pathsFor } = require('../scripts/lib/paths');
const { resolveRun } = require('../scripts/lib/run');
const { readWorkItem } = require('../scripts/lib/semantic-work');

const {
  makeNovel,
  makeNovelDirectory,
  readJson,
  runFlow,
  sourceRef,
  writeStagingDraft,
  validChapterDraft,
  validCleanedBook,
  validMergedBook
} = require('./helpers');

function activePaths(novel) {
  const run = resolveRun(novel);
  return pathsFor(novel, run.run_id);
}

test('prepare command creates a manifest and returns JSON', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const result = runFlow(['prepare', novel, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.chapter_count, 1);
  assert.equal(readJson(activePaths(novel).manifest).chapters.length, 1);
});

test('prepare without --run resumes the unique v2 run instead of archiving it', () => {
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

test('prepare command reports a stable error code and nonzero exit', () => {
  const novel = makeNovelDirectory({ '甲.txt': '甲', '乙.txt': '乙' });
  const result = runFlow(['prepare', novel, '--json']);

  assert.notEqual(result.status, 0);
  assert.equal(JSON.parse(result.stderr).code, 'SOURCE_AMBIGUOUS');
});

test('unknown command is rejected without a stack trace', () => {
  const result = runFlow(['unknown']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /COMMAND_UNKNOWN/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test('status is observational and never returns an executable next action', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const before = fs.readFileSync(paths.runJson);
  const result = runFlow(['status', novel, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.counts, { pending: 1, done: 0, stale: 0, manual_review: 0 });
  assert.equal('next_action' in output, false);
  assert.equal('command' in output, false);
  assert.deepEqual(fs.readFileSync(paths.runJson), before);
  assert.ok(readJson(paths.runJson).phase_durations.script_ms > 0);
});

test('check-coverage persists a deterministic report and bounded recall unit', () => {
  const novel = makeNovel('长书', `第一章 起始\n${'甲持有回生丹。'.repeat(30000)}\n`);
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const result = runFlow(['check-coverage', novel, '--json']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.recall_units, ['recall:items']);
  assert.equal('next_action' in report, false);
  assert.equal(fs.existsSync(paths.coverage), true);
  assert.equal(readJson(paths.progress).units['recall:items'].semantic_attempts, 0);
});

test('accepting a targeted recall writes only its accepted and materialized projections', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const draftFile = writeStagingDraft(
    novel,
    'recall:items',
    { items: [{ local_key: 'item:丹', name: '回生丹' }] }
  );
  const result = runFlow(['accept', novel, '--unit', 'recall:items', '--draft', draftFile, '--json']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(paths.recalls, 'items.json')), true);
  assert.equal(fs.existsSync(paths.materializedCandidates), true);
  const progress = readJson(paths.progress).units['recall:items'];
  assert.equal(progress.semantic_attempts, 1);
  assert.equal(progress.status, 'done');
  assert.equal(fs.existsSync(paths.merged), false);
});

test('reset-unit requires explicit confirmation', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const result = runFlow(['reset-unit', novel, '--unit', 'chapter:001', '--json']);

  assert.notEqual(result.status, 0);
  assert.equal(JSON.parse(result.stderr).code, 'RESET_CONFIRM_REQUIRED');
});

test('accept chapter records an invalid attempt and preserves its draft', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const manifest = readJson(paths.manifest);
  const draft = validChapterDraft({ source_hash: manifest.chapters[0].input_hash, techniques: [] });
  draft.chapter = 2;
  const draftFile = writeStagingDraft(novel, 'chapter:001', draft);

  const result = runFlow(['accept', novel, '--unit', 'chapter:001', '--draft', draftFile, '--json']);

  assert.notEqual(result.status, 0);
  assert.equal(JSON.parse(result.stderr).code, 'DRAFT_REJECTED');
  const progress = readJson(paths.progress);
  assert.equal(progress.units['chapter:001'].attempts, 1);
  assert.equal(progress.units['chapter:001'].status, 'pending');
  assert.equal(fs.readdirSync(path.join(paths.drafts, 'chapter_001')).length, 1);
});

test('resume cannot resubmit a consumed staging attempt or spend its budget twice', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const manifest = readJson(paths.manifest);
  const invalid = validChapterDraft({ source_hash: manifest.chapters[0].input_hash, techniques: [] });
  invalid.chapter = 2;
  const firstAttempt = path.join(paths.staging, 'chapter_001_attempt_01.json');
  fs.writeFileSync(firstAttempt, JSON.stringify(invalid), 'utf8');

  const first = runFlow([
    'accept', novel, '--unit', 'chapter:001', '--draft', firstAttempt, '--json'
  ]);

  assert.notEqual(first.status, 0);
  assert.equal(JSON.parse(first.stderr).code, 'DRAFT_REJECTED');
  assert.equal(fs.existsSync(firstAttempt), false);
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 1);

  fs.writeFileSync(firstAttempt, JSON.stringify(invalid), 'utf8');
  const replay = runFlow([
    'accept', novel, '--unit', 'chapter:001', '--draft', firstAttempt, '--json'
  ]);

  assert.notEqual(replay.status, 0);
  assert.equal(JSON.parse(replay.stderr).code, 'DRAFT_STAGING_MISMATCH');
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 1);

  const valid = validChapterDraft({ source_hash: manifest.chapters[0].input_hash, techniques: [] });
  const secondAttempt = path.join(paths.staging, 'chapter_001_attempt_02.json');
  fs.writeFileSync(secondAttempt, JSON.stringify(valid), 'utf8');
  const second = runFlow([
    'accept', novel, '--unit', 'chapter:001', '--draft', secondAttempt, '--json'
  ]);

  assert.equal(second.status, 0, second.stderr);
  assert.equal(fs.existsSync(secondAttempt), false);
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 2);
  assert.equal(readJson(paths.progress).units['chapter:001'].status, 'done');
});

test('accept rejects a staging symlink that escapes the selected run', t => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const manifest = readJson(paths.manifest);
  const draft = validChapterDraft({ source_hash: manifest.chapters[0].input_hash, techniques: [] });
  const outside = path.join(novel, 'outside-draft.json');
  const staging = path.join(paths.staging, 'chapter_001_attempt_01.json');
  fs.writeFileSync(outside, JSON.stringify(draft), 'utf8');
  try {
    fs.symlinkSync(outside, staging, 'file');
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') {
      t.skip('Windows file symlinks require Developer Mode or elevated privileges');
      return;
    }
    throw error;
  }

  const result = runFlow([
    'accept', novel, '--unit', 'chapter:001', '--draft', staging, '--json'
  ]);

  assert.notEqual(result.status, 0);
  assert.equal(JSON.parse(result.stderr).code, 'DRAFT_STAGING_ESCAPE');
  assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 0);
  assert.equal(fs.existsSync(outside), true);
});

test('accept chapter writes normalized accepted data and marks the unit done', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const manifest = readJson(paths.manifest);
  const draft = validChapterDraft({ source_hash: manifest.chapters[0].input_hash, techniques: [] });
  const draftFile = writeStagingDraft(novel, 'chapter:001', draft);

  const result = runFlow(['accept', novel, '--unit', 'chapter:001', '--draft', draftFile, '--json']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'done');
  const accepted = readJson(path.join(paths.chapters, 'ch_001.json'));
  assert.equal(accepted.chapter, 1);
});

function acceptJsonDraft(novel, unit, draft) {
  const draftFile = writeStagingDraft(novel, unit, draft);
  return runFlow(['accept', novel, '--unit', unit, '--draft', draftFile, '--json']);
}

function validDomainDecision(input) {
  return {
    schema_version: 1,
    semantic_contract_version: 2,
    unit: input.unit,
    input_hash: input.input_hash,
    decisions: input.entries.map(entry => ({
      entry_ref: entry.entry_ref,
      action: 'keep',
      patch: {
        canonical_name: entry.canonical_name,
        ...(entry.category === 'items' && !entry.facts?.inclusion_reason
          ? { inclusion_reason: '剧情关键' }
          : {})
      }
    })),
    notes: []
  };
}

test('whole-book merge and clean drafts are not AI submission units', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);

  for (const [unit, draft] of [
    ['merge:book', validMergedBook()],
    ['clean:book', validCleanedBook()]
  ]) {
    const result = acceptJsonDraft(novel, unit, draft);
    assert.notEqual(result.status, 0);
    assert.equal(JSON.parse(result.stderr).code, 'WHOLE_BOOK_AI_UNIT_FORBIDDEN');
  }
});

test('prepare-merge creates four domain units and a rejected domain leaves an accepted sibling unchanged', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲取得回生丹。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const manifest = readJson(paths.manifest);
  const chapter = manifest.chapters[0];
  const chapterDraft = validChapterDraft({
    title: chapter.title,
    source_hash: chapter.input_hash,
    characters: [{ local_key: 'character:甲', name: '甲', level: '核心', source_refs: [sourceRef()] }],
    events: [],
    items: [{ local_key: 'item:回生丹', name: '回生丹', source_refs: [sourceRef()] }],
    skills: [],
    techniques: [],
    factions: [],
    locations: [],
    dialogues: [],
    summary: {
      title: chapter.title,
      summary: '甲取得回生丹。',
      key_events: [],
      key_characters: ['甲'],
      source_refs: [sourceRef()]
    }
  });
  assert.equal(acceptJsonDraft(novel, 'chapter:001', chapterDraft).status, 0);

  const prepared = runFlow(['prepare-merge', novel, '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);
  assert.deepEqual(JSON.parse(prepared.stdout).units, [
    'distill:plot', 'distill:martial', 'distill:items', 'distill:world'
  ]);

  const characterWork = readWorkItem(paths, 'distill:plot').input;
  assert.equal(JSON.stringify(characterWork).includes('candidate_key'), false);
  const accepted = acceptJsonDraft(novel, characterWork.unit, validDomainDecision(characterWork));
  assert.equal(accepted.status, 0, accepted.stderr);

  const itemWork = readWorkItem(paths, 'distill:items').input;
  const rejected = acceptJsonDraft(novel, itemWork.unit, {
    schema_version: 1,
    semantic_contract_version: 2,
    unit: itemWork.unit,
    input_hash: itemWork.input_hash,
    decisions: [],
    notes: []
  });
  assert.notEqual(rejected.status, 0);
  assert.equal(JSON.parse(rejected.stderr).code, 'DRAFT_REJECTED');

  const progress = readJson(paths.progress).units;
  assert.equal(progress['distill:plot'].status, 'done');
  assert.equal(progress['distill:plot'].attempts, 1);
  assert.equal(progress['distill:items'].status, 'pending');
  assert.equal(progress['distill:items'].attempts, 1);
});

test('prepare-merge stops without truncation when a plot domain input exceeds the controller bound', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲连续讲述往事。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const chapter = readJson(paths.manifest).chapters[0];
  const events = Array.from({ length: 1000 }, (_, index) => ({
    local_key: `event:事件${index}`,
    name: `事件${index}`,
    importance: '次要',
    quote_status: 'quotable',
    source_refs: [sourceRef(1, `事件${index}`)]
  }));
  const chapterDraft = validChapterDraft({
    title: chapter.title,
    source_hash: chapter.input_hash,
    characters: [],
    events,
    items: [],
    skills: [],
    techniques: [],
    factions: [],
    locations: [],
    dialogues: [],
    summary: {
      title: chapter.title,
      summary: '甲连续讲述往事。',
      key_events: [],
      key_characters: ['甲'],
      source_refs: [sourceRef()]
    }
  });
  const chapterAccepted = acceptJsonDraft(novel, 'chapter:001', chapterDraft);
  assert.equal(chapterAccepted.status, 0, chapterAccepted.stderr);

  const initial = runFlow(['prepare-merge', novel, '--json']);
  assert.notEqual(initial.status, 0);
  const error = JSON.parse(initial.stderr);
  assert.equal(error.code, 'DOMAIN_INPUT_TOO_LARGE');
  assert.equal(error.details.unit, 'distill:plot');
  assert.ok(error.details.input_bytes > error.details.max_bytes);
  assert.equal(readJson(paths.progress).units['distill:plot'], undefined);
});

test('deterministic merge and clean aggregates use zero attempts and preserve downstream output', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n第二章 转折\n乙。\n第三章 收束\n丙。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const paths = activePaths(novel);
  const manifest = readJson(paths.manifest);

  const premature = runFlow(['prepare-merge', novel, '--json']);
  assert.notEqual(premature.status, 0);
  assert.equal(JSON.parse(premature.stderr).code, 'MERGE_CHAPTERS_INCOMPLETE');
  assert.equal(readJson(paths.progress).units['merge:book'], undefined);

  for (const chapter of manifest.chapters) {
    const emptyDraft = validChapterDraft({
      chapter: chapter.number,
      title: chapter.title,
      source_hash: chapter.input_hash,
      characters: [], events: [], items: [], skills: [], techniques: [], factions: [], locations: [], dialogues: [],
      summary: {
        title: chapter.title,
        summary: `第${chapter.number}章摘要。`,
        key_events: [], key_characters: [], source_refs: [sourceRef(chapter.number)]
      }
    });
    const result = acceptJsonDraft(novel, `chapter:${String(chapter.number).padStart(3, '0')}`, emptyDraft);
    assert.equal(result.status, 0, result.stderr);
  }

  const mergePlan = runFlow(['prepare-merge', novel, '--json']);
  assert.equal(mergePlan.status, 0, mergePlan.stderr);
  assert.deepEqual(JSON.parse(mergePlan.stdout).units, [
    'distill:plot', 'distill:martial', 'distill:items', 'distill:world'
  ]);
  for (const unit of JSON.parse(mergePlan.stdout).units) {
    const input = readWorkItem(paths, unit).input;
    const accepted = acceptJsonDraft(novel, unit, validDomainDecision(input));
    assert.equal(accepted.status, 0, `${unit}: ${accepted.stderr}`);
  }
  const mergeResult = runFlow(['assemble-merge', novel, '--json']);
  assert.equal(mergeResult.status, 0, mergeResult.stderr);
  assert.equal(readJson(paths.progress).units['merge:book'].attempts, 0);
  const preCleanQuantity = readJson(paths.preCleanQuantity);
  assert.equal(preCleanQuantity.review_consumed, false);
  assert.equal(preCleanQuantity.chapter_count, 3);

  const cleanPlan = runFlow(['prepare-clean', novel, '--json']);
  assert.equal(cleanPlan.status, 0, cleanPlan.stderr);
  assert.deepEqual(JSON.parse(cleanPlan.stdout).units, []);
  const cleanResult = runFlow(['assemble-clean', novel, '--json']);
  assert.equal(cleanResult.status, 0, cleanResult.stderr);
  assert.equal(readJson(paths.progress).units['clean:book'].attempts, 0);
  const buildResult = runFlow(['build-final', novel, '--json']);
  assert.equal(buildResult.status, 0, buildResult.stderr);
  assert.equal(JSON.parse(buildResult.stdout).file_count, 9);
  assert.deepEqual(fs.readdirSync(paths.finalData).sort(), [
    'chapter_summaries.json', 'characters.json', 'dialogues.json', 'events.json', 'factions.json',
    'items.json', 'locations.json', 'skills.json', 'techniques.json'
  ]);
  assert.equal(readJson(paths.cleaned).quantity_review.consumed, true);
  assert.equal(readJson(paths.progress).units['clean:book'].attempts, 0);
});
