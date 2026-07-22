'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { pathsFor } = require('../scripts/lib/paths');
const { SEMANTIC_CONTRACT_VERSION, SEMANTIC_PROFILE } = require('../scripts/lib/semantic-contract');
const { makeNovel, readJson, runFlow } = require('./helpers');

const SKILL_ROOT = path.resolve(__dirname, '..');

function productionFiles() {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'tests') continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else files.push(target);
    }
  }
  visit(SKILL_ROOT);
  return files.sort();
}

function readProductionText() {
  return productionFiles()
    .filter(file => file.endsWith('.js') || file.endsWith('.md'))
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');
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
  const examples = fs.readFileSync(path.join(SKILL_ROOT, 'examples.md'), 'utf8');
  const schema = fs.readFileSync(path.join(SKILL_ROOT, 'schemas.md'), 'utf8');
  const skill = fs.readFileSync(path.join(SKILL_ROOT, 'SKILL.md'), 'utf8');
  const combined = `${prompt}\n${agent}\n${examples}\n${schema}\n${skill}`;

  for (const required of [
    'input_file', 'output_file', 'chapter-worker', 'main-agent-repair', 'YAML',
    'worker_contract', 'chapter_text.includes', 'summary.trim()', 'source_refs'
  ]) assert.match(combined, new RegExp(required));
  for (const dispatchSurface of [prompt, agent, examples]) {
    assert.match(dispatchSurface, /worker_contract/);
  }
  assert.match(combined, /递归|recursive/i);
  assert.match(combined, /不依赖|must not depend/i);
  assert.doesNotMatch(combined, /按其中引用的 v7 合同|follow the referenced v7 extraction contract/i);
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

test('runtime has no transport helper or chapter fragment scripts', () => {
  const scriptsRoot = `${path.join(SKILL_ROOT, 'scripts')}${path.sep}`;
  const forbidden = productionFiles()
    .filter(file => file.startsWith(scriptsRoot))
    .map(file => path.relative(scriptsRoot, file))
    .filter(file => /envelope|clean|submit|chapter[-_]?fragment/i.test(file));

  assert.deepEqual(forbidden, []);
});
