'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const deepSkills = {
  characters: {
    taskType: 'characters-deep',
    patchFields: ['aliases', 'identities', 'level', 'rank', 'description', 'factions', 'skills']
  },
  skills: {
    taskType: 'skills-deep',
    patchFields: ['aliases', 'types', 'factions', 'rank', 'description', 'techniques']
  },
  items: {
    taskType: 'items-deep',
    patchFields: ['aliases', 'type', 'description']
  },
  factions: {
    taskType: 'factions-deep',
    patchFields: ['aliases', 'type', 'description']
  }
};

const explicitUserInvocation = /user-(?:invoked|loaded)|(?:user|用户)[^\r\n]*(?:invoke|load|触发|加载)|(?:invoke|load|触发|加载)[^\r\n]*(?:user|用户)/i;

function readDeepSkill(domain) {
  const file = path.resolve(__dirname, '..', '..', 'generate-game-kb-deep-' + domain, 'SKILL.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function overlayPatch(text, name) {
  const fence = String.fromCharCode(96).repeat(3);
  const blocks = text.split(fence + 'yaml').slice(1).map(part => part.split(fence)[0].trim());
  const parsed = blocks.map(block => yaml.load(block)).find(value => value?.operations?.[0]?.patch);
  assert.ok(parsed, name + ' must include a parseable YAML overlay patch');
  return parsed.operations[0].patch;
}

function assertSkillFrontmatter(text, name) {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(frontmatter, name + ' must start with YAML frontmatter');
  assert.match(frontmatter[1], new RegExp('^name:\\s*' + name + '$', 'm'));
  assert.match(frontmatter[1], /^description:[ \t]*["']?Use when\b/im);
}

function assertControllerIssuedDeepExample(text, name, taskType) {
  const fence = String.fromCharCode(96).repeat(3);
  const jsonBlock = text.split(fence + 'json')[1]?.split(fence)[0]?.trim();
  assert.ok(jsonBlock, name + ' must show task-add JSON output');
  const output = JSON.parse(jsonBlock);
  assert.match(output.task_id, new RegExp('^' + taskType + '-\\d{13}-[a-f0-9]{8}$'), name);
  assert.match(output.base_manifest_hash, /^sha256:[a-f0-9]{64}$/, name);
  assert.match(output.base_data_hash, /^sha256:[a-f0-9]{64}$/, name);
  assert.equal(output.status, 'pending', name);
  assert.match(output.input_path, /\.game-kb-work[\\/]deferred[\\/]/, name);
  assert.match(output.staging_path, /\.game-kb-work[\\/]deferred[\\/]/, name);
  assert.match(output.staging_path, new RegExp(taskType + '-\\d{13}-[a-f0-9]{8}[\\\\/]overlay\\.yaml$'), name);

  const addIndex = text.indexOf(' task-add ');
  const outputIndex = text.indexOf(fence + 'json');
  const runLine = text.split(/\r?\n/).find(line => line.includes(' task-run '));
  const applyLine = text.split(/\r?\n/).find(line => line.includes(' task-apply '));
  assert.ok(addIndex >= 0 && outputIndex > addIndex, name + ' must show output after task-add');
  assert.ok(runLine, name + ' must show task-run');
  assert.ok(applyLine, name + ' must show task-apply');
  assert.ok(text.indexOf(runLine) > outputIndex, name + ' must run only after task-add output');
  assert.match(runLine, new RegExp('--task-id\\s+' + output.task_id + '\\b'), name);
  assert.ok(runLine.includes('--draft "' + output.staging_path + '"'), name + ' must reuse staging_path');
  assert.match(applyLine, new RegExp('--task-id\\s+' + output.task_id + '\\b'), name);
}

test('deep skills are complete user-invoked Lite YAML distill workflows', () => {
  for (const [domain, contract] of Object.entries(deepSkills)) {
    const text = readDeepSkill(domain);
    const name = 'generate-game-kb-deep-' + domain;
    assertSkillFrontmatter(text, name);
    assert.match(text, /(?:published[\s\S]{0,80}lite|lite[\s\S]{0,80}published|archived[\s\S]{0,80}lite)/i, name);
    assert.match(text, explicitUserInvocation, name);
    assert.match(text, /(?:non-blocking|does not block|不阻塞)/i, name);
    assert.match(text, new RegExp('\\b' + contract.taskType + '\\b'), name);
    assert.match(text, new RegExp('--scope\\s+' + domain + '\\b'), name);
    for (const command of ['task-add', 'task-run', 'task-apply']) {
      assert.match(text, new RegExp('\\b' + command + '\\b'), name + ': ' + command);
    }
    assert.match(text, /(?:YAML\s+overlay|overlay\s+is\s+YAML)/i, name);
    assert.match(text, /base_manifest_hash/, name);
    assert.match(text, /base_data_hash/, name);
    assert.match(text, /stale/i, name);
    assert.match(text, /revision-receipt\.json/, name);
    assert.match(text, /immutable revision/i, name);
    assert.match(text, /\.game-kb-work[/\\]deferred[/\\](?:<run-id>|run-jian-shen-yi-xiao)/i, name);
    assert.match(text, /back(?:up|s up)[\s\S]{0,100}(?:current|installed)[^\r\n]*data/i, name);
    assert.match(text, /atomic(?:ally)?[\s\S]{0,100}(?:promote|install)/i, name);
    assert.match(text, /Dashboard/i, name);
    assert.match(text, /cumulative/i, name);
    assert.match(text, /backup_final_data_hash/, name);
    assert.match(text, /source_refs/, name);
    assert.match(text, /deterministic|sorted\s+by\s+\x60?registry_key/i, name);
    assert.match(text, /merge policy/i, name);
    const patch = overlayPatch(text, name);
    assert.deepEqual(Object.keys(patch).sort(), [...contract.patchFields].sort(), name);
    if (domain === 'characters') {
      assert.match(text, /ordered union/i, name);
      assert.match(text, /full-book[\s\S]{0,80}rank/i, name);
      assert.match(text, /description[\s\S]{0,80}conflict/i, name);
      assert.equal('identity' in patch, false, name);
      assert.equal('faction' in patch, false, name);
      assert.equal('items' in patch, false, name);
      assert.equal('biography' in patch, false, name);
    }
    if (domain === 'skills') {
      assert.match(text, /ordered union/i, name);
      assert.match(text, /technique[\s\S]{0,80}exact name/i, name);
      assert.match(text, /full-book[\s\S]{0,80}rank/i, name);
      assert.equal('type' in patch, false, name);
      assert.equal('faction' in patch, false, name);
    }
    if (domain === 'items') assert.doesNotMatch(text, /\bholders?\b/i, name);
    if (domain === 'items' || domain === 'factions') {
      assert.match(text, /conflicting[\s\S]{0,80}(?:type|description)[\s\S]{0,80}(?:null|unchanged)/i, name);
    }
    assertControllerIssuedDeepExample(text, name, contract.taskType);
  }
});
