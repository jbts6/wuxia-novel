'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..');
const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
const extraction = fs.readFileSync(path.join(root, 'prompts', 'extract-chapters.md'), 'utf8');
const novel = 'C:\\git\\wuxia-novel\\古龙\\剑神一笑';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  assert.ok(match, 'SKILL.md must begin with YAML frontmatter');
  return yaml.load(match[1]);
}

test('V4 Skill has valid discovery metadata and no forbidden workflow wording', () => {
  const metadata = frontmatter(skill);
  assert.equal(metadata.name, 'generate-game-kb');
  assert.match(metadata.description, /^Use when\b/);
  assert.doesNotMatch(`${skill}\n${extraction}`, /事件|对话|dialogue|dialog|event/i);
});

test('V4 Skill defines dynamic chapter jobs and one controller-current path', () => {
  assert.match(skill, /2\s*(?:至|-)\s*3\s*章/);
  assert.match(skill, /36[，,]?000\s*(?:个)?中日韩字符/);
  assert.match(skill, /相邻/);
  assert.match(skill, /attempt/);
  assert.match(skill, /staging_path/);
  assert.doesNotMatch(skill, /staging_paths/);
  assert.match(extraction, /2\s*(?:至|-)\s*3\s*章/);
  assert.match(extraction, /完整读取[^\n]*原文/);
  assert.match(extraction, /唯一的 `?staging_path/);
});

test('V4 chapter workers persist and report progress after each chapter', () => {
  for (const contract of [skill, extraction]) {
    assert.match(contract, /每完成一章[^\n]*(?:立即|马上)[^\n]*staging_path/);
    assert.match(contract, /每完成一章[^\n]*(?:立即|马上)[^\n]*(?:汇报|报告)/);
    assert.match(contract, /(?:未开始|原文已读|提取中|YAML已写)/);
    assert.match(contract, /不得[^\n]*(?:progress|控制器状态)/);
  }
});

test('V4 Skill documents bounded retry, manual review, and the complete YAML output', () => {
  assert.match(skill, /最多\s*1\s*次(?:自动)?重试/);
  assert.match(skill, /manual_review/);
  assert.match(skill, /retry-unit/);
  assert.match(skill, /拒绝.*草稿.*保留|保留.*拒绝.*草稿/);
  for (const filename of [
    'characters.yaml',
    'skills.yaml',
    'items.yaml',
    'factions.yaml',
    'chapter_summaries.yaml'
  ]) assert.match(skill, new RegExp(filename.replace('.', '\\.'), 'i'));
  assert.match(skill, /data[\\/]/);
  assert.match(skill, /assembly-report\.json/);
  assert.match(skill, /verification-report\.json/);
  assert.match(skill, /install-receipt\.json/);
  assert.match(skill, /archive-receipt\.json/);
  assert.match(skill, /artifact-manifest\.json/);
});

test('every V4 user-facing command has a concrete Jian Shen Yi Xiao example', () => {
  const commands = [
    'archive-existing',
    'prepare',
    'status',
    'accept',
    'retry-unit',
    'plan-domains',
    'assemble',
    'verify',
    'install',
    'archive-run'
  ];
  for (const command of commands) {
    assert.match(skill, new RegExp(`${command}[^\\n]*${escapeRegex(novel)}`), command);
  }
  assert.match(skill, /run-jian-shen-yi-xiao/);
  assert.match(skill, /chapter:001/);
  assert.match(skill, /distill:characters/);
});
