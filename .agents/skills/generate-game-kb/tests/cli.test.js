'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  makeNovel,
  makeNovelDirectory,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft,
  validCleanedBook,
  validMergedBook
} = require('./helpers');

test('prepare command creates a manifest and returns JSON', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const result = runFlow(['prepare', novel, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.chapter_count, 1);
  assert.equal(readJson(path.join(novel, '.game-kb-work', 'manifest.json')).chapters.length, 1);
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
  const result = runFlow(['status', novel, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.counts, { pending: 1, done: 0, stale: 0, manual_review: 0 });
  assert.equal('next_action' in output, false);
  assert.equal('command' in output, false);
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
  const manifest = readJson(path.join(novel, '.game-kb-work', 'manifest.json'));
  const draft = validChapterDraft({ source_hash: manifest.chapters[0].input_hash, techniques: [] });
  draft.dialogues[0].event_local_key = 'event:missing';
  const draftFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-draft-')), 'chapter.json');
  fs.writeFileSync(draftFile, JSON.stringify(draft), 'utf8');

  const result = runFlow(['accept', novel, '--unit', 'chapter:001', '--draft', draftFile, '--json']);

  assert.notEqual(result.status, 0);
  assert.equal(JSON.parse(result.stderr).code, 'DRAFT_REJECTED');
  const progress = readJson(path.join(novel, '.game-kb-work', 'progress.json'));
  assert.equal(progress.units['chapter:001'].attempts, 1);
  assert.equal(progress.units['chapter:001'].status, 'pending');
  assert.equal(fs.readdirSync(path.join(novel, '.game-kb-work', 'drafts', 'chapter_001')).length, 1);
});

test('accept chapter writes normalized accepted data and marks the unit done', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const manifest = readJson(path.join(novel, '.game-kb-work', 'manifest.json'));
  const draft = validChapterDraft({ source_hash: manifest.chapters[0].input_hash, techniques: [] });
  const draftFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-draft-')), 'chapter.json');
  fs.writeFileSync(draftFile, JSON.stringify(draft), 'utf8');

  const result = runFlow(['accept', novel, '--unit', 'chapter:001', '--draft', draftFile, '--json']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'done');
  const accepted = readJson(path.join(novel, '.game-kb-work', 'chapters', 'ch_001.json'));
  assert.equal(accepted.chapter, 1);
});

function acceptJsonDraft(novel, unit, draft) {
  const draftFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-draft-')), `${unit.replace(':', '_')}.json`);
  fs.writeFileSync(draftFile, JSON.stringify(draft), 'utf8');
  return runFlow(['accept', novel, '--unit', unit, '--draft', draftFile, '--json']);
}

test('merge waits for every chapter and clean can complete only once', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n第二章 转折\n乙。\n');
  assert.equal(runFlow(['prepare', novel, '--json']).status, 0);
  const manifest = readJson(path.join(novel, '.game-kb-work', 'manifest.json'));

  const premature = acceptJsonDraft(novel, 'merge:book', validMergedBook());
  assert.notEqual(premature.status, 0);
  assert.equal(JSON.parse(premature.stderr).code, 'MERGE_CHAPTERS_INCOMPLETE');
  assert.equal(readJson(path.join(novel, '.game-kb-work', 'progress.json')).units['merge:book'], undefined);

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

  const summaries = manifest.chapters.map(chapter => ({
    chapter: chapter.number, title: chapter.title, summary: `第${chapter.number}章摘要。`,
    key_events: [], key_characters: [], source_refs: [sourceRef(chapter.number)]
  }));
  const merged = validMergedBook({
    characters: [], events: [], items: [], skills: [], techniques: [], factions: [], locations: [], dialogues: [],
    chapter_summaries: summaries
  });
  const mergeResult = acceptJsonDraft(novel, 'merge:book', merged);
  assert.equal(mergeResult.status, 0, mergeResult.stderr);
  const preCleanQuantity = readJson(path.join(novel, '.game-kb-work', 'merged', 'pre_clean_quantity.json'));
  assert.equal(preCleanQuantity.review_consumed, false);
  assert.equal(preCleanQuantity.chapter_count, 2);

  const cleaned = validCleanedBook({
    characters: [], events: [], items: [], skills: [], techniques: [], factions: [], locations: [], dialogues: [],
    chapter_summaries: summaries, game_material_candidates: []
  });
  const cleanResult = acceptJsonDraft(novel, 'clean:book', cleaned);
  assert.equal(cleanResult.status, 0, cleanResult.stderr);
  const second = acceptJsonDraft(novel, 'clean:book', cleaned);
  assert.notEqual(second.status, 0);
  assert.equal(JSON.parse(second.stderr).code, 'UNIT_ALREADY_DONE');
  assert.equal(readJson(path.join(novel, '.game-kb-work', 'progress.json')).units['clean:book'].attempts, 1);
  assert.equal(readJson(path.join(novel, '.game-kb-work', 'cleaned', 'book.json')).quantity_review.consumed, true);
});
