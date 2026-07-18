'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const skillRoot = path.resolve(__dirname, '..', '..', 'generate-game-kb-v5');
const skill = fs.existsSync(path.join(skillRoot, 'SKILL.md'))
  ? fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8')
  : '';
const extraction = fs.existsSync(path.join(skillRoot, 'prompts', 'extract-chapters.md'))
  ? fs.readFileSync(path.join(skillRoot, 'prompts', 'extract-chapters.md'), 'utf8')
  : '';

const deepSkills = {
  characters: {
    taskType: 'characters-deep',
    terms: [/biography/i, /aliases/i, /level/i]
  },
  skills: {
    taskType: 'skills-deep',
    terms: [/martial/i, /technique/i, /rank/i]
  },
  items: {
    taskType: 'items-deep',
    terms: [/plot/i, /type/i, /description/i]
  },
  factions: {
    taskType: 'factions-deep',
    terms: [/hierarch/i, /relationship/i, /description/i]
  }
};

const explicitUserInvocation = /user-(?:invoked|loaded)|(?:user|用户)[^\r\n]*(?:invoke|load|触发|加载)|(?:invoke|load|触发|加载)[^\r\n]*(?:user|用户)/i;

function readDeepSkill(domain) {
  const file = path.resolve(
    __dirname,
    '..',
    '..',
    'generate-game-kb-deep-' + domain,
    'SKILL.md'
  );
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function assertSkillFrontmatter(text, name) {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(frontmatter, name + ' must start with YAML frontmatter');
  assert.match(frontmatter[1], new RegExp('^name:\\s*' + name + '$', 'm'));
  assert.match(frontmatter[1], /^description:[ \t]*["']?Use when\b/im);
}

function assertControllerIssuedDeepExample(text, name, taskType) {
  const outputMatch = text.match(/```json\r?\n(\{[\s\S]*?\})\r?\n```/);
  assert.ok(outputMatch, name + ' must show task-add JSON output');
  const output = JSON.parse(outputMatch[1]);
  assert.match(output.task_id, new RegExp('^' + taskType + '-\\d{13}-[a-f0-9]{8}$'), name);
  assert.match(output.base_manifest_hash, /^sha256:[a-f0-9]{64}$/, name);
  assert.match(output.base_data_hash, /^sha256:[a-f0-9]{64}$/, name);
  assert.equal(output.status, 'pending', name);
  assert.match(output.input_path, /\.game-kb-work[\\/]deferred[\\/]/, name);
  assert.match(output.staging_path, /\.game-kb-work[\\/]deferred[\\/]/, name);
  assert.match(output.staging_path, new RegExp(taskType + '-\\d{13}-[a-f0-9]{8}[\\\\/]overlay\\.yaml$'), name);

  const addIndex = text.indexOf(' task-add ');
  const outputIndex = text.indexOf(outputMatch[0]);
  const runLine = text.split(/\r?\n/).find(line => line.includes(' task-run '));
  const applyLine = text.split(/\r?\n/).find(line => line.includes(' task-apply '));
  assert.ok(addIndex >= 0 && outputIndex > addIndex, name + ' must show output after task-add');
  assert.ok(runLine, name + ' must show task-run');
  assert.ok(applyLine, name + ' must show task-apply');
  assert.ok(text.indexOf(runLine) > outputIndex, name + ' must run only after task-add output');
  assert.match(runLine, new RegExp('--task-id\\s+' + output.task_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'), name);
  assert.ok(runLine.includes(`--draft "${output.staging_path}"`), name + ' must reuse staging_path');
  assert.match(applyLine, new RegExp('--task-id\\s+' + output.task_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'), name);
}

test('v5 skill exposes the complete lightweight-v4 base workflow', () => {
  assert.ok(fs.existsSync(path.join(skillRoot, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(skillRoot, 'prompts', 'extract-chapters.md')));
  assertSkillFrontmatter(skill, 'generate-game-kb-v5');
  assert.match(skill, /lightweight[^\r\n]*v4/i);
  assert.match(skill, /semantic_contract_version\s*:\s*5/);
  for (const command of ['v5-prepare', 'v5-accept', 'v5-basic-curate', 'v5-publish', 'v5-status']) {
    assert.match(skill, new RegExp('\\b' + command + '\\b'), command);
  }
  assert.doesNotMatch(skill, /\bplan-domains\b/);
  assert.match(skill, explicitUserInvocation);
  assert.match(skill, /(?:non-blocking|does not block|不阻塞)/i);
  assert.match(skill, /古龙[\\/]剑神一笑/);
  assert.match(skill, /retry-unit[^\r\n]*chapter:001/i);
});

test('v5 skill defines YAML final artifacts and publication evidence', () => {
  assert.match(skill, /chapter[^\r\n]*draft[^\r\n]*YAML/i);
  assert.match(skill, /JSON[\s\S]{0,80}(?:controller|metadata)/i);
  for (const file of [
    'characters.yaml',
    'skills.yaml',
    'items.yaml',
    'factions.yaml',
    'chapter_summaries.yaml'
  ]) {
    assert.match(skill, new RegExp('\\b' + file.replace('.', '\\.') + '\\b'), file);
  }
  assert.match(skill, /<novel>[/\\]data|novel[^\r\n]*data\//i);
  for (const artifact of [
    'verification-report.json',
    'generate_game_kb_install.json',
    'archive-receipt.json',
    'artifact-manifest.json'
  ]) {
    assert.match(skill, new RegExp(artifact.replaceAll('.', '\\.')), artifact);
  }
  assert.match(skill, /source_hash/);
  assert.match(skill, /final_data_hash/);
  assert.match(skill, /reference closure/i);
  assert.match(skill, /YAML\s+overlay/i);
  assert.match(skill, /installed verification/i);
  assert.match(skill, /manual_review/);
  assert.match(skill, /next_action/);
});

test('deep skills are complete user-invoked YAML distill workflows', () => {
  for (const [domain, contract] of Object.entries(deepSkills)) {
    const text = readDeepSkill(domain);
    const name = 'generate-game-kb-deep-' + domain;
    assertSkillFrontmatter(text, name);
    assert.match(text, /(?:published[\s\S]{0,80}v5|v5[\s\S]{0,80}published|archived[\s\S]{0,80}v5)/i, name);
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
    assert.match(
      text,
      /\.game-kb-work[/\\]deferred[/\\](?:<run-id>|run-jian-shen-yi-xiao)/i,
      name
    );
    assert.match(text, /back(?:up|s up)[\s\S]{0,100}(?:current|installed)[^\r\n]*data/i, name);
    assert.match(text, /atomic(?:ally)?[\s\S]{0,100}(?:promote|install)/i, name);
    assert.match(text, /Dashboard/i, name);
    assert.match(text, /cumulative/i, name);
    assert.match(text, /backup_final_data_hash/, name);
    assert.match(text, /source_refs/, name);
    assert.match(text, /deterministic|sorted\s+by\s+`?registry_key`?/i, name);
    for (const term of contract.terms) assert.match(text, term, name);
    assertControllerIssuedDeepExample(text, name, contract.taskType);
  }
});

test('v5 extraction prompt keeps chapter evidence local and YAML-bound', () => {
  assert.match(extraction, /YAML/i);
  assert.match(extraction, /source_refs/);
  assert.match(extraction, /chapter/i);
  assert.match(extraction, /local_key/);
  assert.match(extraction, /techniques/);
  assert.match(extraction, /one|each|每个/i);
  assert.match(extraction, /2\s*(?:or|to|-)\s*3\s+chapters?/i);
  assert.match(extraction, /36,?000\s+CJK\s+characters?/i);
  assert.match(extraction, /(?:one|exactly\s+one)\s+controller-(?:issued|provided)[^\r\n]*attempt/i);
  assert.match(extraction, /(?:one|exactly\s+one)\s+controller-(?:issued|provided)[^\r\n]*staging_path/i);
  assert.match(extraction, /at\s+most\s+one\s+automatic\s+retry/i);
  assert.match(extraction, /(?:no|never)\s+(?:scheduler|worker)[\s\S]{0,60}(?:automatic\s+)?third\s+attempt/i);
});
