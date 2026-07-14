'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { assertAcceptedArtifacts } = require('../scripts/lib/candidate-ledger');
const { pathsFor } = require('../scripts/lib/paths');
const { readWorkItem } = require('../scripts/lib/semantic-work');
const {
  makeNovel,
  readJson,
  runFlow,
  sourceRef,
  writeStagingDraft,
  validChapterDraft
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

function mergeDecision(input) {
  return {
    schema_version: 1,
    stage: 'merge_decision',
    unit: input.unit,
    decisions: [{
      entity_ref: 'e001',
      member_refs: input.candidates.map(candidate => candidate.candidate_ref),
      action: 'merge',
      canonical_name: input.candidates[0].name,
      aliases: [],
      fields: {}
    }],
    ambiguities: []
  };
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

test('mutating an accepted chapter or category decision blocks deterministic planning', () => {
  const { novel, paths } = prepareAcceptedChapters();

  const chapterFile = path.join(paths.chapters, 'ch_001.json');
  const chapterRaw = fs.readFileSync(chapterFile, 'utf8');
  fs.writeFileSync(chapterFile, `${chapterRaw} `, 'utf8');
  assertMutation(
    flowJson(['prepare-merge', novel]),
    'accepted/chapters/ch_001.json'
  );
  fs.writeFileSync(chapterFile, chapterRaw, 'utf8');

  const prepared = assertPassed(flowJson(['prepare-merge', novel]), 'prepare merge');
  const unit = prepared.units[0];
  const input = readWorkItem(paths, unit).input;
  const accepted = assertPassed(flowJson([
    'accept', novel,
    '--unit', unit,
    '--draft', writeStagingDraft(novel, unit, mergeDecision(input))
  ]), 'accept merge category');
  const relativePath = path.relative(paths.run, accepted.accepted_file).split(path.sep).join('/');
  const raw = fs.readFileSync(accepted.accepted_file, 'utf8');
  fs.writeFileSync(accepted.accepted_file, `${raw} `, 'utf8');
  assertMutation(flowJson(['prepare-merge', novel]), relativePath);
});
