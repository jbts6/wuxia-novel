'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  assertAcceptedArtifacts,
  ensureAcceptedArtifact,
  initializeArtifactManifest,
  readArtifactManifest
} = require('../scripts/lib/candidate-ledger');
const { pathsFor } = require('../scripts/lib/paths');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-artifact-'));
  const novel = path.join(root, 'novel');
  fs.mkdirSync(novel, { recursive: true });
  const paths = pathsFor(novel, 'run-artifact');
  fs.mkdirSync(paths.run, { recursive: true });
  initializeArtifactManifest(paths);
  return paths;
}

test('accepted artifact mutation is rejected instead of refreshing the expected hash', () => {
  const expected = { 'accepted/chapters/chapter_001.yaml': 'sha256:original' };
  const actual = { 'accepted/chapters/chapter_001.yaml': 'sha256:changed' };
  assert.throws(
    () => assertAcceptedArtifacts(actual, expected),
    error => error.code === 'ACCEPTED_ARTIFACT_MUTATED'
      && error.details.relative_path === 'accepted/chapters/chapter_001.yaml'
      && error.details.expected_hash === 'sha256:original'
      && error.details.actual_hash === 'sha256:changed'
  );
});

test('tracked accepted YAML remains immutable after its manifest entry is written', () => {
  const paths = fixture();
  const file = path.join(paths.chapters, 'chapter_001.yaml');
  const chapter = {
    schema_version: 7,
    chapter: 1,
    title: '第一章',
    source_hash: 'sha256:chapter',
    characters: [],
    skills: [],
    items: [],
    factions: [],
    chapter_summary: { summary: '摘要', source_refs: [] },
    normalizations: []
  };
  const entry = ensureAcceptedArtifact(paths, file, 'sha256:worker-output', chapter);
  assert.equal(readArtifactManifest(paths).entries[0].content_hash, entry.content_hash);
  fs.appendFileSync(file, ' ', 'utf8');
  assert.throws(
    () => assertAcceptedArtifacts(paths),
    error => error.code === 'ACCEPTED_ARTIFACT_MUTATED'
      && error.details.relative_path === 'accepted/chapters/chapter_001.yaml'
  );
});
