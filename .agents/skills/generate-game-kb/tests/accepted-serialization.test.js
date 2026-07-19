'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const {
  readArtifactManifest,
  recordAcceptedArtifact
} = require('../scripts/lib/candidate-ledger');
const { serializeYaml } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const {
  ACCEPTED_SERIALIZATION,
  assertAcceptedSerialization,
  createOrResumeRun,
  resolveRun,
  resolveWritableRun
} = require('../scripts/lib/run');
const { sha256 } = require('../scripts/lib/source');
const { makeNovel, readJson } = require('./helpers');

function createRun(name = '规范序列化测试书') {
  const novel = makeNovel(name, '第一章 起始\n甲使出飞云掌。\n');
  const run = createOrResumeRun(novel, { runId: 'run-current' });
  return { novel, run, paths: pathsFor(novel, run.run_id) };
}

test('accepted artifacts use deterministic block YAML bytes and bind their exact hash', () => {
  const { paths } = createRun();
  const value = {
    schema_version: 6,
    chapter: 1,
    title: '起始',
    source_hash: 'sha256:source',
    factions: [],
    characters: [{ local_key: 'character:甲', name: '甲', source_refs: [] }],
    skills: [],
    items: [],
    chapter_summary: { title: '起始', summary: '甲出掌。', source_refs: [] }
  };
  const file = path.join(paths.chapters, 'ch_001.yaml');

  const entry = recordAcceptedArtifact(paths, file, 'sha256:input', value);
  const raw = fs.readFileSync(file, 'utf8');
  const manifestEntry = readArtifactManifest(paths).entries[0];

  assert.equal(raw.trimStart().startsWith('{'), false);
  assert.equal(raw, serializeYaml(value));
  assert.deepEqual(yaml.load(raw), value);
  assert.equal(entry.content_hash, sha256(raw));
  assert.equal(manifestEntry.content_hash, sha256(raw));
  assert.equal(entry.serialization, 'yaml-v1');
  assert.equal(manifestEntry.serialization, 'yaml-v1');
});

test('new runs declare the accepted YAML serialization without rewriting on resume', () => {
  const { novel, paths } = createRun('新运行标记测试书');
  const before = fs.readFileSync(paths.runJson, 'utf8');

  assert.equal(ACCEPTED_SERIALIZATION, 'yaml-v1');
  assert.equal(readJson(paths.runJson).accepted_serialization, ACCEPTED_SERIALIZATION);

  const resumed = createOrResumeRun(novel, { runId: paths.runId });
  assert.equal(resumed.resumed, true);
  assert.equal(fs.readFileSync(paths.runJson, 'utf8'), before);
});

test('pre-marker runs remain readable but every writable resolution fails closed', () => {
  const { novel, paths } = createRun('旧运行只读测试书');
  const metadata = readJson(paths.runJson);
  delete metadata.accepted_serialization;
  fs.writeFileSync(paths.runJson, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  const before = fs.readFileSync(paths.runJson);

  assert.equal(resolveRun(novel, paths.runId).run_id, paths.runId);
  assert.doesNotThrow(() => assertAcceptedSerialization(metadata, 'status'));
  assert.doesNotThrow(() => assertAcceptedSerialization(metadata, 'verify'));
  assert.doesNotThrow(() => assertAcceptedSerialization(metadata, 'archive-run'));
  assert.throws(
    () => resolveWritableRun(novel, paths.runId, 'accept'),
    error => error.code === 'LEGACY_ACCEPTED_SERIALIZATION'
      && error.details.run_id === paths.runId
      && error.details.required === 'yaml-v1'
      && error.details.action === 'start-new-run'
  );
  assert.equal(Buffer.compare(fs.readFileSync(paths.runJson), before), 0);
});

test('ensureAcceptedArtifact writes canonical YAML when file and entry are absent', () => {
  const { paths } = createRun('ensure 无文件测试书');
  const { ensureAcceptedArtifact } = require('../scripts/lib/candidate-ledger');
  const value = { schema_version: 6, chapter: 1, title: '测试', source_hash: 'sha256:s', factions: [], characters: [], skills: [], items: [], chapter_summary: { title: '测试', summary: '测试', source_refs: [] } };
  const file = path.join(paths.chapters, 'ch_001.yaml');

  const entry = ensureAcceptedArtifact(paths, file, 'sha256:input', value, { acceptedAt: '2026-07-19T00:00:00.000Z' });

  assert.equal(fs.existsSync(file), true);
  assert.equal(entry.serialization, 'yaml-v1');
  assert.equal(entry.input_hash, 'sha256:input');
  const raw = fs.readFileSync(file, 'utf8');
  assert.equal(raw.trimStart().startsWith('{'), false);
  assert.deepEqual(yaml.load(raw), value);
});

test('ensureAcceptedArtifact returns existing entry without mutation when file and entry match', () => {
  const { paths } = createRun('ensure 完全匹配测试书');
  const { ensureAcceptedArtifact } = require('../scripts/lib/candidate-ledger');
  const value = { schema_version: 6, chapter: 1, title: '测试', source_hash: 'sha256:s', factions: [], characters: [], skills: [], items: [], chapter_summary: { title: '测试', summary: '测试', source_refs: [] } };
  const file = path.join(paths.chapters, 'ch_001.yaml');

  const first = ensureAcceptedArtifact(paths, file, 'sha256:input', value, { acceptedAt: '2026-07-19T00:00:00.000Z' });
  const beforeBytes = fs.readFileSync(file);
  const beforeManifest = fs.readFileSync(paths.artifactManifest);

  const second = ensureAcceptedArtifact(paths, file, 'sha256:input', value, { acceptedAt: '2026-07-19T00:00:00.000Z' });

  assert.deepEqual(second, first);
  assert.equal(Buffer.compare(fs.readFileSync(file), beforeBytes), 0);
  assert.equal(Buffer.compare(fs.readFileSync(paths.artifactManifest), beforeManifest), 0);
});

test('ensureAcceptedArtifact repairs missing manifest entry when file bytes are exact', () => {
  const { paths } = createRun('ensure 修复条目测试书');
  const { ensureAcceptedArtifact, readArtifactManifest } = require('../scripts/lib/candidate-ledger');
  const value = { schema_version: 6, chapter: 1, title: '测试', source_hash: 'sha256:s', factions: [], characters: [], skills: [], items: [], chapter_summary: { title: '测试', summary: '测试', source_refs: [] } };
  const file = path.join(paths.chapters, 'ch_001.yaml');

  // First: write file and entry
  ensureAcceptedArtifact(paths, file, 'sha256:input', value, { acceptedAt: '2026-07-19T00:00:00.000Z' });

  // Simulate crash: remove manifest entry but keep file
  const fileBytes = fs.readFileSync(file);
  const manifest = readArtifactManifest(paths);
  manifest.entries = [];
  fs.writeFileSync(paths.artifactManifest, JSON.stringify(manifest, null, 2));

  const repaired = ensureAcceptedArtifact(paths, file, 'sha256:input', value, { acceptedAt: '2026-07-19T01:00:00.000Z' });

  assert.equal(repaired.serialization, 'yaml-v1');
  assert.equal(repaired.accepted_at, '2026-07-19T01:00:00.000Z');
  assert.equal(Buffer.compare(fs.readFileSync(file), fileBytes), 0);
  const entries = readArtifactManifest(paths).entries;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].relative_path, repaired.relative_path);
});

test('ensureAcceptedArtifact rejects conflicting file hash', () => {
  const { paths } = createRun('ensure 冲突哈希测试书');
  const { ensureAcceptedArtifact } = require('../scripts/lib/candidate-ledger');
  const value = { schema_version: 6, chapter: 1, title: '测试', source_hash: 'sha256:s', factions: [], characters: [], skills: [], items: [], chapter_summary: { title: '测试', summary: '测试', source_refs: [] } };
  const file = path.join(paths.chapters, 'ch_001.yaml');

  ensureAcceptedArtifact(paths, file, 'sha256:input', value, { acceptedAt: '2026-07-19T00:00:00.000Z' });

  // Tamper with the file
  fs.writeFileSync(file, 'tampered content');

  assert.throws(
    () => ensureAcceptedArtifact(paths, file, 'sha256:input', value, { acceptedAt: '2026-07-19T00:00:00.000Z' }),
    error => error.code === 'ACCEPTED_ARTIFACT_REPLAY_CONFLICT'
  );
});

