'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');
const { prepareNovel } = require('../scripts/lib/source');
const {
  makeNovel,
  readJson,
  sourceRef,
  validChapterDraft
} = require('./helpers');

let preflight = {};
try {
  preflight = require('../scripts/lib/draft-preflight');
} catch {
  // First TDD run exercises the missing module.
}

function chapterFixture(name, runId) {
  const novel = makeNovel(name, '第一章 起始\n甲在山谷中与故人相逢。\n');
  createOrResumeRun(novel, { runId });
  prepareNovel(novel, { runId });
  const paths = pathsFor(novel, runId);
  fs.mkdirSync(paths.staging, { recursive: true });
  const manifest = readJson(paths.manifest);
  const chapter = manifest.chapters[0];
  return { novel, paths, chapter, manifest };
}

function writeYaml(file, value) {
  fs.writeFileSync(file, yaml.dump(value, { noRefs: true, lineWidth: -1 }), 'utf8');
  return file;
}

function validDraft(chapter) {
  return validChapterDraft({
    skills: [],
    items: [],
    factions: [],
    source_hash: chapter.input_hash,
    chapter_summary: {
      title: chapter.title,
      summary: '甲在山谷中与故人相逢。',
      source_refs: [sourceRef(chapter.number, '甲在山谷中与故人相逢')]
    }
  });
}

test('preflightChapterDraft returns valid for a correct rogue file', () => {
  const fixture = chapterFixture('预检有效试书', 'run-preflight-valid');
  const roguePath = path.join(fixture.paths.staging, 'rogue_valid.yaml');
  writeYaml(roguePath, validDraft(fixture.chapter));

  const result = preflight.preflightChapterDraft({
    paths: fixture.paths,
    manifest: fixture.manifest,
    unit: 'chapter:001',
    draftPath: roguePath
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(typeof result.canonical_yaml, 'string');
  assert.equal(result.canonical_yaml.trimStart().startsWith('{'), false);
});

test('preflightChapterDraft returns errors for malformed YAML', () => {
  const fixture = chapterFixture('预检畸形试书', 'run-preflight-malformed');
  const roguePath = path.join(fixture.paths.staging, 'rogue_malformed.yaml');
  fs.writeFileSync(roguePath, 'decisions: [\n', 'utf8');

  const result = preflight.preflightChapterDraft({
    paths: fixture.paths,
    manifest: fixture.manifest,
    unit: 'chapter:001',
    draftPath: roguePath
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length > 0, true);
});

test('preflightChapterDraft returns errors for missing fields', () => {
  const fixture = chapterFixture('预检缺字段试书', 'run-preflight-missing');
  const roguePath = path.join(fixture.paths.staging, 'rogue_missing.yaml');
  writeYaml(roguePath, { schema_version: 1 });

  const result = preflight.preflightChapterDraft({
    paths: fixture.paths,
    manifest: fixture.manifest,
    unit: 'chapter:001',
    draftPath: roguePath
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length > 0, true);
});

test('preflightChapterDraft returns errors for wrong source_hash', () => {
  const fixture = chapterFixture('预检错误哈希试书', 'run-preflight-wrong-hash');
  const roguePath = path.join(fixture.paths.staging, 'rogue_wrong_hash.yaml');
  const draft = validDraft(fixture.chapter);
  draft.source_hash = 'sha256:wrong';
  writeYaml(roguePath, draft);

  const result = preflight.preflightChapterDraft({
    paths: fixture.paths,
    manifest: fixture.manifest,
    unit: 'chapter:001',
    draftPath: roguePath
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some(e => e.code === 'SOURCE_HASH_MISMATCH'), true);
});

test('preflightChapterDraft does not mutate progress or ledger', () => {
  const fixture = chapterFixture('预检不变更试书', 'run-preflight-no-mutate');
  const roguePath = path.join(fixture.paths.staging, 'rogue_no_mutate.yaml');
  writeYaml(roguePath, validDraft(fixture.chapter));

  const progressBefore = readJson(fixture.paths.progress);

  preflight.preflightChapterDraft({
    paths: fixture.paths,
    manifest: fixture.manifest,
    unit: 'chapter:001',
    draftPath: roguePath
  });

  const progressAfter = readJson(fixture.paths.progress);
  assert.deepEqual(progressBefore, progressAfter);
});

test('preflightChapterDraft rejects symbolic link source', () => {
  const fixture = chapterFixture('预检符号链接试书', 'run-preflight-symlink');
  const realPath = path.join(fixture.paths.staging, 'real_draft.yaml');
  const symlinkPath = path.join(fixture.paths.staging, 'symlink_draft.yaml');
  writeYaml(realPath, validDraft(fixture.chapter));

  try {
    fs.symlinkSync(realPath, symlinkPath);
  } catch (err) {
    // Skip if symlinks not supported
    if (err.code === 'EPERM' || err.code === 'ENOSYS') return;
    throw err;
  }

  assert.throws(
    () => preflight.preflightChapterDraft({
      paths: fixture.paths,
      manifest: fixture.manifest,
      unit: 'chapter:001',
      draftPath: symlinkPath
    }),
    error => error.code === 'DRAFT_SOURCE_SYMLINK'
  );
});

test('preflightChapterDraft rejects source outside current run', () => {
  const fixture = chapterFixture('预检跨运行试书', 'run-preflight-cross-run');
  const otherRunDir = path.join(fixture.paths.runs, 'run-other');
  fs.mkdirSync(path.join(otherRunDir, 'staging'), { recursive: true });
  const crossRunPath = path.join(otherRunDir, 'staging', 'cross_draft.yaml');
  writeYaml(crossRunPath, validDraft(fixture.chapter));

  assert.throws(
    () => preflight.preflightChapterDraft({
      paths: fixture.paths,
      manifest: fixture.manifest,
      unit: 'chapter:001',
      draftPath: crossRunPath
    }),
    error => error.code === 'DRAFT_SOURCE_CROSS_RUN'
  );
});
