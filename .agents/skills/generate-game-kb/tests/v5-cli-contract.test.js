'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, parseJsonLine, runFlow } = require('./helpers');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');
const { SEMANTIC_CONTRACT_VERSION } = require('../scripts/lib/semantic-contract');

test('v5-prepare creates an explicitly profiled v5 run', () => {
  const novel = makeNovel('v5 路由试书', '第一章 起始\n甲。\n');
  const result = runFlow(['v5-prepare', novel, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const metadata = JSON.parse(fs.readFileSync(pathsFor(novel, output.run_id).runJson, 'utf8'));
  assert.equal(metadata.profile, 'v5');
  assert.equal(metadata.semantic_contract_version, SEMANTIC_CONTRACT_VERSION);
  assert.equal(output.profile, 'v5');
});

test('v5 accepts nested Chinese author and book directory names on Windows', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-game-kb-unicode-'));
  const novel = path.join(root, '金庸', '射雕英雄传');
  fs.mkdirSync(novel, { recursive: true });
  fs.writeFileSync(
    path.join(novel, '射雕英雄传.txt'),
    '第一章 风雪惊变\n郭啸天与杨铁心在牛家村饮酒。\n',
    'utf8'
  );

  const result = runFlow(['v5-prepare', novel, '--run', 'run-unicode-path', '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.novel_dir, path.resolve(novel));
  assert.equal(output.source_file, path.join(path.resolve(novel), '射雕英雄传.txt'));
});

test('v5-status reports the v5 profile without planning domains', () => {
  const novel = makeNovel('v5 状态试书', '第一章 起始\n甲。\n');
  const prepared = runFlow(['v5-prepare', novel, '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);
  const runId = JSON.parse(prepared.stdout).run_id;

  const result = runFlow(['v5-status', novel, '--run', runId, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.profile, 'v5');
  assert.notEqual(output.next_action, 'plan-domains');
  assert.equal(output.next_units?.some(unit => String(unit).startsWith('distill:')), false);
});

test('v4 commands reject a run explicitly created for v5', () => {
  const novel = makeNovel('v5 隔离试书', '第一章 起始\n甲。\n');
  const created = createOrResumeRun(novel, { runId: 'run-v5', profile: 'v5' });

  const result = runFlow(['prepare', novel, '--run', created.run_id, '--json']);

  assert.notEqual(result.status, 0);
  assert.equal(parseJsonLine(result.stderr).code, 'PROFILE_MISMATCH');
  const metadata = JSON.parse(fs.readFileSync(path.join(created.run_dir, 'run.json'), 'utf8'));
  assert.equal(metadata.profile, 'v5');
});

test('generic retry-unit auto-detects a v5 run profile', () => {
  const novel = makeNovel('v5 重试试书', '第一章 起始\n甲。\n');
  const prepared = runFlow(['v5-prepare', novel, '--run', 'run-v5-retry', '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);

  const result = runFlow([
    'retry-unit', novel, '--run', 'run-v5-retry',
    '--unit', 'chapter:001', '--confirm', '--json'
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { reset: 'chapter:001' });
});

test('generic reset-unit remains compatible with a v5 run profile', () => {
  const novel = makeNovel('v5 重置兼容试书', '第一章 起始\n甲。\n');
  const prepared = runFlow(['v5-prepare', novel, '--run', 'run-v5-reset', '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);

  const result = runFlow([
    'reset-unit', novel, '--run', 'run-v5-reset',
    '--unit', 'chapter:001', '--confirm', '--json'
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { reset: 'chapter:001' });
});

test('all v5 command aliases are dispatched by the controller', () => {
  const novel = makeNovel('v5 命令试书', '第一章 起始\n甲。\n');
  const cases = [
    ['v5-accept', ['--json']],
    ['v5-basic-curate', ['--json']],
    ['v5-publish', ['--json']]
  ];

  for (const [command, flags] of cases) {
    const result = runFlow([command, novel, ...flags]);
    assert.notEqual(result.status, 0, command);
    assert.notEqual(parseJsonLine(result.stderr).code, 'COMMAND_UNKNOWN', command);
  }
});
