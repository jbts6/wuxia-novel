'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..');
const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
const extraction = fs.readFileSync(path.join(root, 'prompts', 'extract-chapters.md'), 'utf8');
const distill = fs.readFileSync(path.join(root, 'prompts', 'distill-domain.md'), 'utf8');
const schemas = fs.readFileSync(path.join(root, 'schemas.md'), 'utf8');
const examples = fs.existsSync(path.join(root, 'examples.md'))
  ? fs.readFileSync(path.join(root, 'examples.md'), 'utf8')
  : '';
const examplesCn = fs.existsSync(path.join(root, 'examples-cn.md'))
  ? fs.readFileSync(path.join(root, 'examples-cn.md'), 'utf8')
  : '';
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
  for (const hash of [
    'final_data_hash',
    'id_plan_hash',
    'verification_report_hash',
    'migration_receipt_hash'
  ]) assert.match(skill, new RegExp(hash));
});

test('V4 keeps rank nullable and assigns supported rank from the complete timeline', () => {
  assert.match(extraction, /rank[\s\S]{0,160}(?:null|省略)/i);
  assert.match(schemas, /章节[\s\S]{0,120}rank[\s\S]{0,120}(?:null|省略)/i);
  for (const contract of [skill, schemas, distill]) {
    assert.match(contract, /全书|完整.*时间线/);
    assert.match(contract, /后期[\s\S]{0,160}(?:战果|失败|反转|克制)/);
    assert.match(contract, /传闻|自述|身份/);
  }
  assert.match(distill, /source_files/);
  assert.match(distill, /rank_contract/);
  assert.match(distill, /(?:证据不足|无法可靠判断)[^\n]*rank[^\n]*(?:null|省略)|rank[^\n]*(?:证据不足|无法可靠判断)[^\n]*(?:null|省略)/i);
  assert.match(schemas, /最终[^\n]*rank[^\n]*(?:null|可空|省略)/i);
  assert.doesNotMatch(distill, /每个 keep[^\n]*rank[^\n]*(?:必须|必填)/i);
});

test('every V4 user-facing command has a concrete Jian Shen Yi Xiao example', () => {
  const commands = [
    'archive-existing',
    'prepare',
    'status',
    'accept',
    'retry-unit',
    'refresh-domain-work',
    'import-chapters',
    'plan-domains',
    'assemble',
    'verify',
    'install',
    'archive-run'
  ];
  for (const command of commands) {
    assert.match(examples, new RegExp(`${command}[^\\n]*${escapeRegex(novel)}`), command);
    assert.match(examplesCn, new RegExp(`${command}[^\\n]*${escapeRegex(novel)}`), `${command} cn`);
  }
  for (const contract of [examples, examplesCn]) {
    assert.match(contract, /run-jian-shen-yi-xiao-v4-real-20260718/);
    assert.match(contract, /run-jian-shen-yi-xiao-v4-v6-20260718/);
    assert.match(contract, /chapter:001/);
    assert.match(contract, /distill:characters/);
    assert.match(contract, /--from-run[^\n]*--run[^\n]*--confirm/);
  }
});

test('V4 chapter example uses only the version-6 fields', () => {
  const match = extraction.match(/```yaml\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(match, 'chapter example');
  const draft = yaml.load(match[1]);
  assert.deepEqual(Object.keys(draft).sort(), [
    'chapter', 'chapter_summary', 'characters', 'factions', 'items',
    'schema_version', 'skills', 'source_hash', 'title'
  ]);
  assert.deepEqual(Object.keys(draft.characters[0]).sort(), [
    'aliases', 'description', 'factions', 'identities', 'level', 'local_key',
    'name', 'rank', 'skills', 'source_refs'
  ]);
  assert.deepEqual(Object.keys(draft.skills[0]).sort(), [
    'aliases', 'description', 'factions', 'local_key', 'name', 'rank',
    'source_refs', 'techniques', 'types'
  ]);
  assert.deepEqual(Object.keys(draft.skills[0].techniques[0]).sort(), ['description', 'name']);
  assert.deepEqual(Object.keys(draft.items[0]).sort(), [
    'aliases', 'description', 'local_key', 'name', 'source_refs', 'type'
  ]);
  assert.deepEqual(Object.keys(draft.factions[0]).sort(), [
    'aliases', 'description', 'local_key', 'name', 'source_refs', 'type'
  ]);
  assert.doesNotMatch(match[1], /\bbiography\b|\bidentity:|\bfaction:|\bitems:.*characters|named_in_source|holders?|owners?|members?|users?/i);
});
