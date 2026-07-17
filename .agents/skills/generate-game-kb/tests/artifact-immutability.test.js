'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { assertAcceptedArtifacts } = require('../scripts/lib/candidate-ledger');
const { pathsFor } = require('../scripts/lib/paths');
const { readWorkPlan } = require('../scripts/lib/semantic-work');
const {
  makeNovel,
  parseJsonLine,
  readJson,
  runFlow,
  sourceRef,
  writeStagingDraft,
  validChapterDraft,
  validDomainDraft
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
  const error = parseJsonLine(result.stderr);
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
    const base = validChapterDraft();
    const draft = validChapterDraft({
      chapter: chapter.number,
      title: chapter.title,
      source_hash: chapter.input_hash,
      characters: first ? base.characters : [],
      items: [],
      skills: first ? base.skills : [],
      factions: [],
      chapter_summary: {
        title: chapter.title,
        summary: `第${chapter.number}章摘要。`,
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

test('accepted artifact mutation is rejected instead of refreshing the expected hash', () => {
  const expected = { 'accepted/chapters/ch_001.yaml': 'sha256:original' };
  const actual = { 'accepted/chapters/ch_001.yaml': 'sha256:changed' };

  assert.throws(
    () => assertAcceptedArtifacts(actual, expected),
    error => error.code === 'ACCEPTED_ARTIFACT_MUTATED'
      && error.details.relative_path === 'accepted/chapters/ch_001.yaml'
      && error.details.expected_hash === 'sha256:original'
      && error.details.actual_hash === 'sha256:changed'
  );
});

test('chapter acceptance persists deterministic candidate keys and an artifact manifest entry', () => {
  const { paths } = prepareAcceptedChapters();
  const chapter = readJson(path.join(paths.chapters, 'ch_001.yaml'));
  const artifactManifest = readJson(paths.artifactManifest);
  const entry = artifactManifest.entries.find(value => value.relative_path === 'accepted/chapters/ch_001.yaml');

  assert.equal(chapter.characters[0].candidate_key, 'ch001:characters:character:甲');
  assert.equal(chapter.skills[0].candidate_key, 'ch001:skills:skill:内功');
  assert.match(entry.content_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(entry.input_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(entry.accepted_at, /^\d{4}-\d{2}-\d{2}T/);
});

test('mutating an accepted chapter or domain decision blocks planning and assembly', () => {
  const { novel, paths } = prepareAcceptedChapters();

  const chapterFile = path.join(paths.chapters, 'ch_001.yaml');
  const chapterRaw = fs.readFileSync(chapterFile, 'utf8');
  fs.writeFileSync(chapterFile, `${chapterRaw} `, 'utf8');
  assertMutation(
    flowJson(['plan-domains', novel, '--run', paths.runId]),
    'accepted/chapters/ch_001.yaml'
  );
  fs.writeFileSync(chapterFile, chapterRaw, 'utf8');

  assertPassed(
    flowJson(['plan-domains', novel, '--run', paths.runId]),
    'plan domains'
  );
  const plan = readWorkPlan(paths, 'domain');
  const acceptedFiles = [];
  for (const input of plan.inputs) {
    const accepted = assertPassed(flowJson([
      'accept', novel,
      '--run', paths.runId,
      '--unit', input.unit,
      '--draft', writeStagingDraft(novel, input.unit, validDomainDraft(input))
    ]), `accept ${input.unit}`);
    acceptedFiles.push(accepted.accepted_file);
  }

  const decisionFile = acceptedFiles[0];
  const relativePath = path.relative(paths.run, decisionFile).split(path.sep).join('/');
  const raw = fs.readFileSync(decisionFile, 'utf8');
  fs.writeFileSync(decisionFile, `${raw} `, 'utf8');
  assertMutation(
    flowJson(['assemble', novel, '--run', paths.runId]),
    relativePath
  );
});
