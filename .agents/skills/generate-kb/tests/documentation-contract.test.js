#!/usr/bin/env node
'use strict';

const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const skillRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(skillRoot, relativePath), 'utf8');
}

function assertIncludesAll(documentName, content, values) {
  for (const value of values) {
    assert.match(content, new RegExp(`\\b${value.replace('-', '\\-')}\\b`), `${documentName} must mention ${value}`);
  }
}

it('documents one six-stage pipeline with publish-only formal IDs', () => {
  const skill = read('SKILL.md');
  const pipeline = read('pipeline.md');
  const constants = read('constants.md');
  const stages = ['prepare', 'inventory', 'reconcile', 'enrich', 'semantic-audit', 'publish'];

  assertIncludesAll('SKILL.md', skill, stages);
  assertIncludesAll('pipeline.md', pipeline, stages);
  assert.match(skill, /六个(?:有序)?阶段/);
  assert.match(pipeline, /六个(?:有序)?阶段/);
  assert.match(skill, /正式 ID[^\n]*(?:只|仅)[^\n]*publish|publish[^\n]*(?:只|仅)[^\n]*正式 ID/);
  assert.match(pipeline, /正式 ID[^\n]*(?:只|仅)[^\n]*publish|publish[^\n]*(?:只|仅)[^\n]*正式 ID/);
  assert.match(constants, /正式 ID[^\n]*(?:只|仅)[^\n]*publish|publish[^\n]*(?:只|仅)[^\n]*正式 ID/);
});

it('documents pipeline.js as the only managed write entry', () => {
  const skill = read('SKILL.md');
  const pipeline = read('pipeline.md');

  assert.match(skill, /scripts\/pipeline\.js/);
  assert.match(pipeline, /scripts\/pipeline\.js/);
  assert.match(skill, /唯一[^\n]*写入入口|唯一[^\n]*执行入口/);
  assert.match(pipeline, /唯一[^\n]*写入入口|唯一[^\n]*执行入口/);
  assert.match(pipeline, /prepare[^\n]*semantic-audit[^\n]*(?:不得|禁止)[^\n]*(?:data\/\*\.json|正式数据)/);
  assert.match(pipeline, /claim\s*->\s*draft\s*->\s*submit/);
  assert.match(pipeline, /任务包[^\n]*(?:stage|阶段)[^\n]*(?:work item|work-item|工作项)[^\n]*(?:input hash|输入 hash)/i);
});

it('documents controller-built publish bundles and the bound publish draft', () => {
  const skill = read('SKILL.md');
  const pipeline = read('pipeline.md');
  const schemas = read('schemas.md');

  assert.match(pipeline, /build-publish <novel-dir> --draft <publish-draft>/);
  assert.doesNotMatch(pipeline, /build-publish <novel-dir> \[--bundle/);
  assert.match(pipeline, /build-publish[^\n]*(?:当前 run|当前运行)[^\n]*materialized/i);
  assert.match(skill, /build-publish[^\n]*--draft/);
  for (const field of ['run_id', 'semantic_audit_hash', 'token_plan']) {
    assert.match(schemas, new RegExp(`\\b${field}\\b`), `schemas.md must document ${field}`);
  }
  assert.match(schemas, /不得包含 `report_inputs`/);
  assert.match(pipeline, /staging data[^\n]*(?:verification|cross-validation)/i);
  assert.match(pipeline, /(?:确定性生成|controller-generated)[^\n]*(?:G1-G5|quality report)/i);
  assert.match(schemas, /publish draft|发布草稿/i);
  assert.match(schemas, /非受管|受管目录之外/);
});

it('documents the configurable human risk limit without silent truncation', () => {
  const pipeline = read('pipeline.md');
  const review = read('review.md');

  for (const [name, content] of [['pipeline.md', pipeline], ['review.md', review]]) {
    assert.match(content, /默认[^\n]*15/, `${name} must state the default limit of 15`);
    assert.match(content, /(?:降至|降到|调低)[^\n]*10/, `${name} must state that the limit can be lowered to 10`);
    assert.match(content, /超过[^\n]*上限[^\n]*(?:不得|不能)[^\n]*(?:截断|丢弃)/, `${name} must forbid silent truncation`);
  }
});

it('documents managed prompt submission and isolates legacy prompts', () => {
  const currentPrompts = ['named-inventory.md', 'event-dialogue.md', 'gap-audit.md'];
  for (const prompt of currentPrompts) {
    const content = read(path.join('prompts', prompt));
    assert.match(content, /claim\s*->\s*draft\s*->\s*submit/);
    assert.match(content, /零产出|空输出/);
  }

  const legacyPrompts = [
    'extract-dialogues.md',
    'generate-baseline.md',
    'generate-keywords.md',
    'outline.md',
    'pass1-entities.md',
    'pass2-details.md',
    'pass3-patch.md',
    'prompt-craft.md',
    'review-all.md'
  ];
  for (const prompt of legacyPrompts) {
    const content = read(path.join('prompts', prompt));
    assert.match(content, /LEGACY|Legacy|只读诊断|迁移/, `${prompt} must be marked as legacy-only`);
    assert.match(content, /不得[^\n]*(?:新 run|新运行)|不参与[^\n]*(?:新 run|新运行)/, `${prompt} must be excluded from new runs`);
  }
});

it('keeps the superseded roadmap out of the executable workflow', () => {
  const roadmap = read('FUTURE_PLANS.md');

  assert.match(roadmap, /LEGACY|Legacy|历史|已废止|已取代/);
  assert.match(roadmap, /SKILL\.md/);
  assert.match(roadmap, /pipeline\.md/);
  assert.doesNotMatch(roadmap, /run-pipeline\.js/);
  assert.doesNotMatch(roadmap, /Stage\s*[0-9]/i);
});
