'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { pathsFor } = require('../scripts/lib/paths');
const { SEMANTIC_CONTRACT_VERSION, SEMANTIC_PROFILE } = require('../scripts/lib/semantic-contract');
const { makeNovel, readJson, runFlow } = require('./helpers');

const SKILL_ROOT = path.resolve(__dirname, '..');

function readProductionText() {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'tests') continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.name.endsWith('.js') || entry.name.endsWith('.md')) files.push(target);
    }
  }
  visit(SKILL_ROOT);
  return files.sort().map(file => fs.readFileSync(file, 'utf8')).join('\n');
}

test('new runs persist only the v7 direct chapter semantic contract', () => {
  const novel = makeNovel('合同测试书', '第一章 起始\n合同证据。\n');
  const result = runFlow(['run', novel, '--run', 'run-contract', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const metadata = readJson(pathsFor(novel, 'run-contract').runJson);
  assert.equal(SEMANTIC_CONTRACT_VERSION, 7);
  assert.equal(SEMANTIC_PROFILE, 'chapter-direct-v1');
  assert.equal(metadata.semantic_contract_version, 7);
  assert.equal(metadata.semantic_profile, 'chapter-direct-v1');
  assert.equal(Object.hasOwn(metadata, 'deep'), false);
});

test('worker instructions require direct single-file YAML transport', () => {
  const prompt = fs.readFileSync(path.join(SKILL_ROOT, 'prompts', 'extract-chapters.md'), 'utf8');
  const agent = fs.readFileSync(path.join(SKILL_ROOT, '..', '..', '..', '.claude', 'agents', 'game-kb-chapter-worker.md'), 'utf8');
  const combined = `${prompt}\n${agent}`;

  for (const required of [
    'input_file', 'output_file', 'chapter-worker', 'main-agent-repair', 'YAML'
  ]) assert.match(combined, new RegExp(required));
  assert.doesNotMatch(combined, /JSON envelope|submitWorkerEnvelope|extract-plan|\bsubmit\b/i);
});

test('runtime has no legacy transport or domain contract', () => {
  const production = readProductionText();
  for (const forbidden of [
    'submitWorkerEnvelope', 'plan-domains', 'distill:', 'worker-pool.json',
    'WORKER_WRITE_PATHS = []', 'JSON envelope'
  ]) {
    assert.equal(production.includes(forbidden), false, forbidden);
  }
});
