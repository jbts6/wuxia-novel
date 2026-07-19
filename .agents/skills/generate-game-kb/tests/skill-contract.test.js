'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const skillRoot = path.resolve(__dirname, '..');
const skill = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
const extraction = fs.readFileSync(path.join(skillRoot, 'prompts', 'extract-chapters.md'), 'utf8');
const domainPrompt = fs.readFileSync(path.join(skillRoot, 'prompts', 'distill-domain.md'), 'utf8');
const schemas = fs.readFileSync(path.join(skillRoot, 'schemas.md'), 'utf8');
const examples = fs.existsSync(path.join(skillRoot, 'examples.md'))
  ? fs.readFileSync(path.join(skillRoot, 'examples.md'), 'utf8')
  : '';
const backendSpec = fs.readFileSync(path.resolve(skillRoot, '../../../.trellis/spec/backend/quality-guidelines.md'), 'utf8');
const fastProfile = backendSpec.slice(backendSpec.indexOf('## Scenario: Fast Game-Material Knowledge Base Profile'));

const docs = [
  ['SKILL.md', skill],
  ['extract-chapters.md', extraction],
  ['distill-domain.md', domainPrompt],
  ['schemas.md', schemas]
];

function yamlExampleAfter(text, heading) {
  const headingIndex = text.indexOf(heading);
  assert.notEqual(headingIndex, -1, heading);
  const match = text.slice(headingIndex).match(/```yaml\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(match, heading);
  return yaml.load(match[1]);
}

test('AI drafts, accepted artifacts, and final data are YAML while controller state stays JSON', () => {
  for (const [name, text] of docs) assert.match(text, /YAML/i, name);
  assert.match(`${skill}\n${examples}`, /staging\/[\s\S]*\.yaml/);
  assert.match(skill, /accepted\/[\s\S]*\.yaml/);
  assert.match(skill, /accepted\/[\s\S]*\.yaml/);
  assert.match(skill, /final\/data\/[\s\S]*\.yaml/);
  assert.match(skill, /progress\.json[\s\S]*(控制器|脚本生成|状态)/);
  assert.doesNotMatch(skill, /staging\/[^\r\n]*\.json|accepted\/[^\r\n]*\.json|final\/data\/[^\r\n]*\.json/);
});

test('legacy domain documentation retains the shared four domain units in stable order', () => {
  const units = ['distill:factions', 'distill:characters', 'distill:skills', 'distill:items'];
  for (const [name, text] of [['distill-domain.md', domainPrompt], ['schemas.md', schemas]]) {
    let previous = -1;
    for (const unit of units) {
      const index = text.indexOf(unit);
      assert.ok(index > previous, name + ': ' + unit);
      previous = index;
    }
    assert.doesNotMatch(text, /distill:(?:plot|martial|world)/, name);
  }
});

test('chapter drafts have four v6 entity arrays, nested techniques, and chapter_summary.summary', () => {
  for (const text of [extraction, schemas]) {
    assert.match(text, /characters:/);
    assert.match(text, /skills:[\s\S]*techniques:/);
    assert.match(text, /items:/);
    assert.match(text, /factions:/);
    assert.match(text, /chapter_summary:[\s\S]*summary:/);
    assert.match(text, /source_refs:/);
    assert.doesNotMatch(text, /^(?:events|locations|dialogues|techniques):/m);
    assert.doesNotMatch(text, /\bbiography\b|\bholders?\b|\bowners?\b|\bmembers?\b|\busers?\b/i);
  }
  assert.match(extraction, /identities:/);
  assert.match(extraction, /factions:/);
  assert.match(extraction, /types:/);
  assert.match(extraction, /description:/);
});

test('final documentation names five YAML files and only simplified top-level fields', () => {
  for (const filename of ['characters.yaml', 'skills.yaml', 'items.yaml', 'factions.yaml', 'chapter_summaries.yaml']) {
    assert.match(skill, new RegExp(filename.replace('.', '\\.')));
    assert.match(schemas, new RegExp(filename.replace('.', '\\.')));
  }
  for (const text of [skill, schemas]) {
    assert.match(text, /characters[\s\S]*\blevel\b[\s\S]*\brank\b/);
    assert.match(text, /skills[\s\S]*\brank\b[\s\S]*techniques/);
    assert.doesNotMatch(text, /\bpower_rank\b|\bitems\.tags\b|\btags\b/);
  }
});

test('the v4 Skill path assembles accepted chapters and four domain decisions', () => {
  const normalPath = /archive-existing[\s\S]*prepare[\s\S]*chapter[^\r\n]*accept[\s\S]*assemble[\s\S]*verify[\s\S]*install[\s\S]*verify[^\r\n]*--installed[\s\S]*archive-run/i;
  assert.match(skill, normalPath);
  assert.match(skill, /plan-domains[\s\S]*distill:factions[\s\S]*distill:characters[\s\S]*distill:skills[\s\S]*distill:items/i);
  assert.doesNotMatch(skill, /\b(?:prepare-merge|assemble-merge|prepare-clean|assemble-clean|build-final|check-coverage|check-resolution)\b/);
  assert.doesNotMatch(skill, /quality:sample|fixed 95%|fixed quality|game_materials\.json|nine (?:files|arrays)|九个?(?:文件|数组)/i);
});

test('workspace and installed verification are bound to five YAML files and controller receipts', () => {
  for (const [name, text] of [['SKILL.md', skill], ['schemas.md', schemas], ['fast profile spec', fastProfile]]) {
    assert.match(text, /assembly-report\.json/i, name);
    assert.match(text, /verification-report\.json/i, name);
    assert.match(text, /exactly five|正好五|恰好五|严格五|五个 YAML/i, name);
  }
  assert.match(fastProfile, /accepted[\s\S]*evidence[\s\S]*assembly[- ]report/i);
  assert.match(fastProfile, /install[^\r\n]*receipt[\s\S]*five[- ]file|安装[^\r\n]*收据[\s\S]*五文件/i);
  assert.doesNotMatch(fastProfile, /top-level[^\r\n]*(?:events|locations|dialogues|techniques)|顶层[^\r\n]*(?:events|locations|dialogues|techniques)/i);
});

test('the writable V4 Skill is semantic contract version 6 with a v4 profile and old runs stay fail-closed', () => {
  assert.match(skill, /semantic_contract_version[^\r\n]*6/);
  assert.match(skill, /profile:\s*v4/);
  assert.match(skill, /LEGACY_SEMANTIC_CONTRACT/);
  assert.match(skill, /不得.*原地.*升级|不.*原地.*升级/);
  assert.match(skill, /版本 5[^\r\n]*(?:查询|归档|迁移)/);
});

test('current domain YAML examples use the writable semantic contract version 6', () => {
  for (const [name, text, heading] of [
    ['distill-domain.md', domainPrompt, '## YAML 模板'],
    ['schemas.md', schemas, '## 域蒸馏草稿示例']
  ]) {
    const example = yamlExampleAfter(text, heading);
    assert.equal(example.schema_version, 1, name);
    assert.equal(example.semantic_contract_version, 6, name);
    assert.match(example.unit, /^distill:/, name);
  }
});

test('source grounding, bounded concurrency, and main-model-only acceptance remain explicit', () => {
  assert.match(skill, /source_refs/);
  assert.match(extraction, /完整读取.*章节原文/);
  assert.match(skill, /最多\s*5\s*个.*Worker|章节[^\r\n]*5\s*并发|并发.*5/);
  assert.match(skill, /主模型.*串行.*accept/);
  assert.match(skill, /429.*5.*3|5\s*→\s*3/);
  assert.match(skill, /(?:第二|再次|持续).*429[^\r\n]*(?:停止|停机|halt)/i);
});

test('legacy domain inputs remain independent and canonical order is presentation only', () => {
  for (const [name, text] of [
    ['distill-domain.md', domainPrompt],
    ['schemas.md', schemas]
  ]) {
    assert.match(text, /(?:四个域|four domains?)[^\r\n]*(?:彼此独立|independent)[^\r\n]*(?:并发|concurrent)/i, name);
    assert.match(text, /(?:固定|canonical)[^\r\n]*(?:顺序|order)[^\r\n]*(?:展示|报告|presentation|report)/i, name);
    assert.match(text, /faction[^\r\n]*(?:late-bound|延迟绑定|assemble)/i, name);
    assert.doesNotMatch(text, /factions?[^\r\n]*(?:必须先|先完成|first)|先执行|后续并行|后三域/i, name);
  }
});

test('two-submission and single-action recovery contracts are synchronized', () => {
  for (const [name, text] of [
    ['SKILL.md', skill],
    ['schemas.md', schemas],
    ['fast profile spec', fastProfile]
  ]) {
    assert.match(text, /(?:最多|at most)\s*(?:2|two)[^\r\n]*(?:提交|submission)/i, name);
    assert.match(text, /manual_review/i, name);
    assert.match(text, /next_action/i, name);
    assert.match(text, /next_units/i, name);
    assert.doesNotMatch(text, /最多\s*3\s*次提交|at most three[^\r\n]*submissions?|format repair|semantic remedy/i, name);
  }
  assert.match(skill, /YAML[^\r\n]*(?:解析|parse)[^\r\n]*(?:语义|semantic)[^\r\n]*(?:同一|shared)[^\r\n]*(?:预算|budget)/i);
  assert.match(fastProfile, /parse[^\r\n]*semantic[^\r\n]*shared[^\r\n]*budget/i);
});

test('the reusable Skill and prompts contain no book-specific branch', () => {
  assert.doesNotMatch([skill, extraction, domainPrompt].join('\n'), /笑傲江湖|飞狐外传|雪山飞狐|金庸/);
});
