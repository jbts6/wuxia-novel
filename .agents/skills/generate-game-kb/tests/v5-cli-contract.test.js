'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, parseJsonLine, runFlow } = require('./helpers');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');

test('v5-prepare creates an explicitly profiled v5 run', () => {
  const novel = makeNovel('v5 路由试书', '第一章 起始\n甲。\n');
  const result = runFlow(['v5-prepare', novel, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const metadata = JSON.parse(fs.readFileSync(pathsFor(novel, output.run_id).runJson, 'utf8'));
  assert.equal(metadata.profile, 'v5');
  assert.equal(metadata.semantic_contract_version, 5);
  assert.equal(output.profile, 'v5');
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
