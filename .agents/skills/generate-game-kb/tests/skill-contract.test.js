'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const skillRoot = path.resolve(__dirname, '..');
const skill = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
const extraction = fs.readFileSync(path.join(skillRoot, 'prompts', 'extract-chapters.md'), 'utf8');
const backendSpec = fs.readFileSync(path.resolve(skillRoot, '../../../.trellis/spec/backend/quality-guidelines.md'), 'utf8');

function readPrompt(name) {
  const file = path.join(skillRoot, 'prompts', name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

test('a Skill invocation makes the current main model own workflow routing', () => {
  assert.match(skill, /用户只需.*书籍目录/);
  assert.match(skill, /当前主模型.*自主/);
  assert.match(skill, /没有活动 run/);
  assert.match(skill, /恰有一个活动 run/);
  assert.match(skill, /多个活动 run/);
  assert.match(skill, /archive-existing[\s\S]*prepare[\s\S]*逐章[\s\S]*prepare-merge[\s\S]*assemble-merge[\s\S]*prepare-clean[\s\S]*assemble-clean[\s\S]*archive-run/);
});

test('merge and clean semantics use bounded category work items', () => {
  assert.match(skill, /merge:<category>:<shard>/);
  assert.match(skill, /merge:<category>:consolidate/);
  assert.match(skill, /clean:<category>:<shard>/);
  assert.match(skill, /clean:materials:001/);
  assert.match(skill, /merge:book.*attempts.*0|attempts.*0.*merge:book/);
  assert.match(skill, /clean:book.*attempts.*0|attempts.*0.*clean:book/);
  assert.doesNotMatch(skill, /生成一次全书合并草稿|生成唯一一轮清理草稿/);
  assert.match(skill, /AI.*不得.*candidate_key|candidate_key.*脚本/);
  assert.match(skill, /AI.*不得.*local_key|local_key.*脚本/);
  assert.match(skill, /最终 ID.*脚本|脚本.*最终 ID/);
});

test('category prompts expose only short semantic references', () => {
  const merge = readPrompt('merge-category.md');
  const clean = readPrompt('clean-category.md');
  const materials = readPrompt('select-materials.md');

  assert.notEqual(merge, '', 'merge-category.md must exist');
  assert.notEqual(clean, '', 'clean-category.md must exist');
  assert.notEqual(materials, '', 'select-materials.md must exist');
  assert.match(merge, /member_refs/);
  assert.match(merge, /member_refs.*恰好.*一次|恰好.*一次.*member_refs/);
  assert.match(clean, /entity_ref/);
  assert.match(clean, /obligation|义务/);
  assert.match(materials, /紧凑|短引用|catalog/);
  for (const [name, text] of [['merge-category.md', merge], ['clean-category.md', clean], ['select-materials.md', materials]]) {
    assert.match(text, /candidate_key|local_key|最终 ID/, name);
    assert.match(text, /private bindings|私有 bindings|私有绑定/, name);
    assert.match(text, /CTX\/context-mode|CTX|context-mode/, name);
  }
});

test('category orchestration preserves dependency order and durable recovery', () => {
  assert.match(skill, /events.*dialogues|事件.*对白/);
  assert.match(skill, /所有实体.*clean.*materials|实体.*清理.*clean:materials:001/);
  assert.match(skill, /类别.*并发|并发.*类别/);
  assert.match(skill, /主模型.*串行.*accept/);
  assert.match(skill, /同一.*worker pool|同一.*worker-pool|同一.*工作池/);
  assert.match(skill, /上下文压缩.*work item|上下文压缩.*工作项/);
  assert.match(skill, /done.*不.*重做|done.*不.*重读/);
});

test('chapter semantics use isolated native workers while the main model owns acceptance', () => {
  assert.match(skill, /原生子代理/);
  assert.match(skill, /每个子代理.*一个章节/);
  assert.match(skill, /主模型.*串行.*accept/);
  assert.match(skill, /子代理.*直接.*完整.*章节原文/);
  assert.match(extraction, /子代理.*直接.*完整.*章节原文/);
  for (const [name, text] of [['SKILL.md', skill], ['extract-chapters.md', extraction]]) {
    assert.match(text, /CTX\/context-mode/, name);
    assert.match(text, /检索摘要/, name);
    assert.match(text, /启发式/, name);
    assert.match(text, /外部模型 CLI/, name);
  }
  assert.doesNotMatch(skill, /另一个代理.*不能代替/);
});

test('the main model assigns durable per-run staging paths instead of arbitrary temp files', () => {
  assert.match(skill, /run-id.*unit.*attempt/);
  assert.match(skill, /staging/);
  assert.equal(skill.includes('/tmp'), true);
  assert.match(skill, /只写.*路径/);
  assert.match(skill, /只返回.*路径/);
});

test('context compaction resumes chapter work only from durable run state', () => {
  assert.match(skill, /上下文压缩/);
  assert.match(skill, /done.*不.*重读/);
  assert.match(skill, /staging.*存在.*accept/);
  assert.match(skill, /staging.*不存在.*新.*子代理.*完整.*原文/);
});

test('resume accepts only the unsubmitted next staging attempt', () => {
  assert.match(skill, /下一个 attempt.*attempts\s*\+\s*1/);
  assert.match(skill, /attempt.*小于.*不得.*accept/);
  assert.match(skill, /成功或拒绝.*删除.*staging/);
  assert.match(skill, /manual_review.*终态.*不得.*reset-unit/);
});

test('chapter workers use a persistent adaptive concurrency limit', () => {
  assert.match(skill, /并发.*10/);
  assert.match(skill, /宿主.*可用.*待处理章节/);
  assert.match(skill, /429.*10.*5.*2.*1/);
  assert.match(skill, /同一.*批次.*只.*一次/);
  assert.match(skill, /429.*不.*消耗.*语义.*提交/);
  assert.match(skill, /上下文压缩.*不.*重置.*并发/);
  assert.match(skill, /新 run.*10/);
  assert.match(skill, /并发.*1.*429.*停止/);
});

test('the fast-profile code spec records adaptive worker concurrency as an executable contract', () => {
  assert.match(backendSpec, /worker-backoff.*--batch.*--reason 429/);
  assert.match(backendSpec, /worker-pool\.json/);
  assert.match(backendSpec, /10.*5.*2.*1/);
  assert.match(backendSpec, /WORKER_BACKOFF_REASON_INVALID/);
  assert.match(backendSpec, /WORKER_RATE_LIMITED/);
  assert.match(backendSpec, /progress\.json.*unchanged/);
});

test('the reusable Skill and extraction prompt contain no book-specific branch', () => {
  assert.doesNotMatch(`${skill}\n${extraction}`, /笑傲江湖|飞狐外传|金庸/);
});
