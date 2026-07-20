'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..');
const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
const skillCn = fs.readFileSync(path.join(root, 'SKILL-cn.md'), 'utf8');
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

test('V4 Skill separates scheduler batches from single-chapter zero-write workers', () => {
  assert.match(skill, /2\s*(?:至|-)\s*3\s*章/);
  assert.match(skill, /36[，,]?000\s*(?:个)?中日韩字符/);
  assert.match(skill, /调度[^\n]*(?:batch|批次)|(?:batch|批次)[^\n]*调度/i);
  assert.match(skill, /(?:每个|一个)[^\n]*子代理[^\n]*(?:一章|一个章节)|子代理[^\n]*(?:只|仅)[^\n]*(?:一章|一个章节)/);
  assert.match(skill, /worker_write_paths[^\n]*\[\]/i);
  assert.match(extraction, /WORKER_WRITE_PATHS\s*=\s*\[\]/i);
  assert.match(extraction, /完整读取[^\n]*原文/);
  assert.match(extraction, /(?:JSON envelope|JSON 封装|JSON 信封)/i);
  assert.doesNotMatch(extraction, /staging_path|output_path/i);
});

test('V4 Skills use the Claude workflow rolling pool without multi-chapter workers', () => {
  for (const [label, contract] of [['primary', skill], ['Chinese reference', skillCn]]) {
    assert.match(contract, /game-kb-chapter-extract/iu, `${label}: workflow`);
    assert.match(contract, /(?:first|前)[^\r\n]*(?:concurrency_limit|并发上限)[^\r\n]*(?:distinct|不同)[^\r\n]*batch/iu, `${label}: bounded window`);
    assert.match(contract, /(?:5|五)[^\r\n]*(?:3|三)[^\r\n]*(?:429|rate)/iu, `${label}: fallback`);
    assert.match(contract, /(?:all|全部)[^\r\n]*guard[^\r\n]*(?:before|前)[^\r\n]*(?:submit|提交)/iu, `${label}: barrier`);
    assert.match(contract, /(?:serial|串行)[^\r\n]*(?:submit|提交)/iu, `${label}: broker`);
    assert.doesNotMatch(contract, /(?:worker|子代理)[^\r\n]*(?:2|2\s*(?:-|至|到)\s*3)[^\r\n]*(?:chapter|章)/iu);
  }
});

test('V4 chapter workers never write files and use the guarded controller broker', () => {
  for (const contract of [skill, extraction]) {
    assert.match(contract, /子代理[^\n]*(?:不得|不能)[^\n]*(?:创建|修改|移动|删除|写)[^\n]*(?:文件|目录)/);
    assert.match(contract, /(?:stdin|标准输入)/i);
    assert.match(contract, /(?:controller|控制器)[^\n]*(?:序列化|写入)[^\n]*YAML/i);
  }
  assert.match(skill, /guard-open[\s\S]*guard-check[\s\S]*submit-draft/);
  assert.match(extraction, /description[^\r\n]*只包含描述正文[^\r\n]*概述：[^\r\n]*描述：/);
});

test('V4 domain workers use read-only controller input and return JSON envelopes', () => {
  assert.match(distill, /worker-input\.json/i);
  assert.match(distill, /WORKER_WRITE_PATHS\s*=\s*\[\]/i);
  assert.match(distill, /(?:JSON envelope|JSON 封装|JSON 信封)/i);
  assert.match(distill, /(?:controller|控制器)[^\n]*(?:序列化|写入)[^\n]*YAML/i);
  assert.doesNotMatch(distill, /staging_path|output_path/i);
  assert.match(distill, /description[^\r\n]*只包含描述正文[^\r\n]*概述：[^\r\n]*描述：/);
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
    'guard-open',
    'guard-check',
    'submit-draft',
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

test('V4 chapter envelope example uses only the version-6 fields', () => {
  const match = extraction.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(match, 'chapter envelope example');
  const envelope = JSON.parse(match[1]);
  assert.deepEqual(Object.keys(envelope).sort(), [
    'attempt', 'batch_id', 'draft', 'input_hash', 'schema_version', 'unit'
  ]);
  const draft = envelope.draft;
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
  assert.doesNotMatch(match[1], /"biography"\s*:|"identity"\s*:|"faction"\s*:|named_in_source|"holders?"\s*:|"owners?"\s*:|"members?"\s*:|"users?"\s*:/i);
});
