'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { assertAcceptedArtifacts } = require('../scripts/lib/candidate-ledger');
const { pathsFor } = require('../scripts/lib/paths');
const {
  makeNovel,
  readJson,
  runFlow,
  sourceRef,
  writeStagingDraft,
  validChapterDraft,
  validCleanedBook,
  validMergedBook
} = require('./helpers');

function flowJson(args) {
  return runFlow([...args, '--json']);
}

function assertPassed(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

function assertMutation(result, relativePath) {
  assert.equal(result.status, 1, result.stdout);
  const error = JSON.parse(result.stderr);
  assert.equal(error.code, 'ACCEPTED_ARTIFACT_MUTATED');
  assert.equal(error.details.relative_path, relativePath);
}

function prepareAcceptedChapters() {
  const source = [
    '第一章 起始', '甲在山中与故人相逢。',
    '第二章 经过', '甲继续赶路。',
    '第三章 收束', '甲查明真相。'
  ].join('\n') + '\n';
  const novel = makeNovel('不可变测试书', source);
  const prepared = assertPassed(flowJson(['prepare', novel]), 'prepare');
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);

  for (const chapter of manifest.chapters) {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const first = chapter.number === 1;
    const draft = validChapterDraft({
      chapter: chapter.number,
      title: chapter.title,
      source_hash: chapter.input_hash,
      characters: first ? validChapterDraft().characters : [],
      events: first ? validChapterDraft().events : [],
      items: [],
      skills: first ? validChapterDraft().skills : [],
      techniques: first ? validChapterDraft().techniques : [],
      factions: [],
      locations: first ? validChapterDraft().locations : [],
      dialogues: first ? validChapterDraft().dialogues : [],
      summary: {
        title: chapter.title,
        summary: `第${chapter.number}章摘要。`,
        key_events: first ? ['event:相逢'] : [],
        key_characters: first ? ['甲'] : [],
        source_refs: [sourceRef(chapter.number)]
      }
    });
    assertPassed(flowJson([
      'accept', novel,
      '--unit', unit,
      '--draft', writeStagingDraft(novel, unit, draft)
    ]), `accept chapter ${chapter.number}`);
  }
  return { novel, paths, manifest };
}

function mergedDraft(paths) {
  const firstChapter = readJson(path.join(paths.chapters, 'ch_001.json'));
  const candidateResolutions = [
    'characters', 'events', 'items', 'skills', 'techniques', 'factions', 'locations', 'dialogues'
  ].flatMap(category => firstChapter[category].map(candidate => ({
    candidate_key: candidate.candidate_key,
    resolution: 'merged_to',
    merged_to: candidate.local_key
  })));
  return validMergedBook({ candidate_resolutions: candidateResolutions });
}

test('accepted artifact mutation is rejected instead of refreshing the expected hash', () => {
  const expected = { 'accepted/chapters/ch_001.json': 'sha256:original' };
  const actual = { 'accepted/chapters/ch_001.json': 'sha256:changed' };

  assert.throws(
    () => assertAcceptedArtifacts(actual, expected),
    error => error.code === 'ACCEPTED_ARTIFACT_MUTATED'
      && error.details.relative_path === 'accepted/chapters/ch_001.json'
      && error.details.expected_hash === 'sha256:original'
      && error.details.actual_hash === 'sha256:changed'
  );
});

test('chapter acceptance persists deterministic candidate keys and an artifact manifest entry', () => {
  const { paths } = prepareAcceptedChapters();
  const chapter = readJson(path.join(paths.chapters, 'ch_001.json'));
  const artifactManifest = readJson(paths.artifactManifest);
  const entry = artifactManifest.entries.find(value => value.relative_path === 'accepted/chapters/ch_001.json');

  assert.equal(chapter.events[0].candidate_key, 'ch001:events:event:相逢');
  assert.equal(chapter.coverage.events.quotable_count, 1);
  assert.match(entry.content_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(entry.input_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(entry.accepted_at, /^\d{4}-\d{2}-\d{2}T/);
});

test('mutating accepted chapter, merge, or clean artifacts blocks the next dependent command', () => {
  const { novel, paths } = prepareAcceptedChapters();
  const merge = mergedDraft(paths);
  const mergeDraftFile = writeStagingDraft(novel, 'merge:book', merge);

  const chapterFile = path.join(paths.chapters, 'ch_001.json');
  const chapterRaw = fs.readFileSync(chapterFile, 'utf8');
  fs.writeFileSync(chapterFile, `${chapterRaw} `, 'utf8');
  assertMutation(
    flowJson(['accept', novel, '--unit', 'merge:book', '--draft', mergeDraftFile]),
    'accepted/chapters/ch_001.json'
  );
  fs.writeFileSync(chapterFile, chapterRaw, 'utf8');

  assertPassed(flowJson(['accept', novel, '--unit', 'merge:book', '--draft', mergeDraftFile]), 'accept merge');
  const cleanDraftFile = writeStagingDraft(novel, 'clean:book', validCleanedBook({
    candidate_resolutions: merge.candidate_resolutions
  }));

  const mergeRaw = fs.readFileSync(paths.merged, 'utf8');
  fs.writeFileSync(paths.merged, `${mergeRaw} `, 'utf8');
  assertMutation(
    flowJson(['accept', novel, '--unit', 'clean:book', '--draft', cleanDraftFile]),
    'accepted/merged/book.json'
  );
  fs.writeFileSync(paths.merged, mergeRaw, 'utf8');

  assertPassed(flowJson(['accept', novel, '--unit', 'clean:book', '--draft', cleanDraftFile]), 'accept clean');
  const cleanRaw = fs.readFileSync(paths.cleaned, 'utf8');
  fs.writeFileSync(paths.cleaned, `${cleanRaw} `, 'utf8');
  assertMutation(flowJson(['build-final', novel]), 'accepted/cleaned/book.json');
});
