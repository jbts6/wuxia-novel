'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  makeNovel,
  parseJsonLine,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft,
  writeStagingDraft
} = require('./helpers');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');
const {
  LEGACY_PROFILE_V5,
  PROFILE_LITE,
  SEMANTIC_CONTRACT_VERSION
} = require('../scripts/lib/semantic-contract');

test('lite-prepare creates an explicitly profiled semantic-contract-v6 run', () => {
  const novel = makeNovel('lite 路由试书', '第一章 起始\n甲。\n');
  const result = runFlow(['lite-prepare', novel, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const metadata = JSON.parse(fs.readFileSync(pathsFor(novel, output.run_id).runJson, 'utf8'));
  assert.equal(metadata.profile, PROFILE_LITE);
  assert.equal(metadata.semantic_contract_version, SEMANTIC_CONTRACT_VERSION);
  assert.equal(metadata.semantic_contract_version, 6);
  assert.equal(output.profile, PROFILE_LITE);
});

test('lite accepts nested Chinese author and book directory names on Windows', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-game-kb-unicode-'));
  const novel = path.join(root, '金庸', '射雕英雄传');
  fs.mkdirSync(novel, { recursive: true });
  fs.writeFileSync(
    path.join(novel, '射雕英雄传.txt'),
    '第一章 风雪惊变\n郭啸天与杨铁心在牛家村饮酒。\n',
    'utf8'
  );

  const result = runFlow(['lite-prepare', novel, '--run', 'run-unicode-path', '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.novel_dir, path.resolve(novel));
  assert.equal(output.source_file, path.join(path.resolve(novel), '射雕英雄传.txt'));
});

test('lite-status preserves chapter extraction then routes around domain planning', () => {
  const novel = makeNovel('lite 状态试书', '第一章 起始\n甲。\n');
  const prepared = runFlow(['lite-prepare', novel, '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);
  const runId = JSON.parse(prepared.stdout).run_id;

  const extracting = runFlow(['lite-status', novel, '--run', runId, '--json']);

  assert.equal(extracting.status, 0, extracting.stderr);
  assert.equal(JSON.parse(extracting.stdout).next_action, 'accept-chapters');

  const paths = pathsFor(novel, runId);
  const manifest = readJson(paths.manifest);
  const draft = validChapterDraft({
    source_hash: manifest.chapters[0].input_hash,
    characters: [],
    skills: [],
    items: [],
    factions: [],
    chapter_summary: {
      title: manifest.chapters[0].title,
      summary: '甲在本章出现。',
      source_refs: [sourceRef(1, '甲。')]
    }
  });
  const accepted = runFlow([
    'lite-accept', novel, '--run', runId, '--unit', 'chapter:001',
    '--draft', writeStagingDraft(novel, 'chapter:001', draft), '--json'
  ]);
  assert.equal(accepted.status, 0, accepted.stderr);

  const result = runFlow(['lite-status', novel, '--run', runId, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.profile, PROFILE_LITE);
  assert.notEqual(output.next_action, 'plan-domains');
  assert.equal(output.next_action, 'lite-publish');
  assert.equal(output.next_units?.some(unit => String(unit).startsWith('distill:')), false);
});

test('v4 commands reject a run explicitly created for lite', () => {
  const novel = makeNovel('lite 隔离试书', '第一章 起始\n甲。\n');
  const created = createOrResumeRun(novel, { runId: 'run-lite', profile: PROFILE_LITE });

  const result = runFlow(['prepare', novel, '--run', created.run_id, '--json']);

  assert.notEqual(result.status, 0);
  assert.equal(parseJsonLine(result.stderr).code, 'PROFILE_MISMATCH');
  const metadata = JSON.parse(fs.readFileSync(path.join(created.run_dir, 'run.json'), 'utf8'));
  assert.equal(metadata.profile, PROFILE_LITE);
});

test('generic retry-unit auto-detects a lite run profile', () => {
  const novel = makeNovel('lite 重试试书', '第一章 起始\n甲。\n');
  const prepared = runFlow(['lite-prepare', novel, '--run', 'run-lite-retry', '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);

  const result = runFlow([
    'retry-unit', novel, '--run', 'run-lite-retry',
    '--unit', 'chapter:001', '--confirm', '--json'
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { reset: 'chapter:001' });
});

test('generic reset-unit remains compatible with a lite run profile', () => {
  const novel = makeNovel('lite 重置兼容试书', '第一章 起始\n甲。\n');
  const prepared = runFlow(['lite-prepare', novel, '--run', 'run-lite-reset', '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);

  const result = runFlow([
    'reset-unit', novel, '--run', 'run-lite-reset',
    '--unit', 'chapter:001', '--confirm', '--json'
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { reset: 'chapter:001' });
});

test('all lite command routes are dispatched by the controller', () => {
  const novel = makeNovel('lite 命令试书', '第一章 起始\n甲。\n');
  const cases = [
    ['lite-accept', ['--json']],
    ['lite-basic-curate', ['--json']],
    ['lite-publish', ['--json']]
  ];

  for (const [command, flags] of cases) {
    const result = runFlow([command, novel, ...flags]);
    assert.notEqual(result.status, 0, command);
    assert.notEqual(parseJsonLine(result.stderr).code, 'COMMAND_UNKNOWN', command);
  }
});

test('all public v5 command aliases are removed', () => {
  const novel = makeNovel('旧命令拒绝试书', '第一章 起始\n甲。\n');
  for (const command of [
    'v5-prepare',
    'v5-status',
    'v5-accept',
    'v5-basic-curate',
    'v5-publish'
  ]) {
    const result = runFlow([command, novel, '--json']);
    assert.notEqual(result.status, 0, command);
    assert.equal(parseJsonLine(result.stderr).code, 'COMMAND_UNKNOWN', command);
  }
});

test('legacy profile v5 is readable through lite and migrates on lite-prepare', () => {
  const novel = makeNovel('旧 profile 迁移试书', '第一章 起始\n甲。\n');
  const prepared = runFlow(['lite-prepare', novel, '--run', 'run-profile-migration', '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);
  const runJson = pathsFor(novel, 'run-profile-migration').runJson;
  const legacy = JSON.parse(fs.readFileSync(runJson, 'utf8'));
  legacy.profile = LEGACY_PROFILE_V5;
  fs.writeFileSync(runJson, `${JSON.stringify(legacy, null, 2)}\n`, 'utf8');

  const status = runFlow(['lite-status', novel, '--run', 'run-profile-migration', '--json']);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).profile, PROFILE_LITE);
  assert.equal(JSON.parse(fs.readFileSync(runJson, 'utf8')).profile, LEGACY_PROFILE_V5);

  const migrated = runFlow(['lite-prepare', novel, '--run', 'run-profile-migration', '--json']);
  assert.equal(migrated.status, 0, migrated.stderr);
  assert.equal(JSON.parse(migrated.stdout).profile, PROFILE_LITE);
  assert.equal(JSON.parse(fs.readFileSync(runJson, 'utf8')).profile, PROFILE_LITE);
});

test('new runs cannot persist the legacy v5 profile', () => {
  const novel = makeNovel('旧 profile 新建拒绝试书', '第一章 起始\n甲。\n');
  assert.throws(
    () => createOrResumeRun(novel, { runId: 'run-new-v5-forbidden', profile: LEGACY_PROFILE_V5 }),
    error => error?.code === 'PROFILE_LEGACY'
  );
});
