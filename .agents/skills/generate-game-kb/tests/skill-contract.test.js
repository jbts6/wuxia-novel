'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const skillRoot = path.resolve(__dirname, '..');
const skill = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
const extraction = fs.readFileSync(path.join(skillRoot, 'prompts', 'extract-chapters.md'), 'utf8');
const domainPromptPath = path.join(skillRoot, 'prompts', 'distill-domain.md');
const domainPrompt = fs.existsSync(domainPromptPath) ? fs.readFileSync(domainPromptPath, 'utf8') : '';
const schemas = fs.readFileSync(path.join(skillRoot, 'schemas.md'), 'utf8');
const backendSpec = fs.readFileSync(path.resolve(skillRoot, '../../../.trellis/spec/backend/quality-guidelines.md'), 'utf8');

test('a Skill invocation makes the current main model own fresh profile routing', () => {
  assert.match(skill, /用户只需.*书籍目录/);
  assert.match(skill, /当前主模型.*自主/);
  assert.match(skill, /semantic_profile.*domain-distill-v1/);
  assert.match(skill, /没有活动 run/);
  assert.match(skill, /恰有一个活动 run/);
  assert.match(skill, /多个活动 run/);
  assert.match(skill, /archive-existing[\s\S]*prepare[\s\S]*逐章[\s\S]*prepare-merge[\s\S]*assemble-merge[\s\S]*prepare-clean[\s\S]*assemble-clean[\s\S]*archive-run/);
});

test('normal post-processing is four domain units with deterministic compatibility assembly', () => {
  for (const unit of ['distill:plot', 'distill:martial', 'distill:items', 'distill:world']) {
    assert.match(skill, new RegExp(unit.replace(':', '\\:')));
  }
  assert.match(skill, /chapter_summaries.*(机械|确定性).*(投影|生成)/);
  assert.match(skill, /merge:book.*attempts.*0|attempts.*0.*merge:book/);
  assert.match(skill, /clean:book.*attempts.*0|attempts.*0.*clean:book/);
  assert.doesNotMatch(skill, /merge:<category>:<shard>|merge:<category>:consolidate/);
  assert.doesNotMatch(skill, /clean:<category>:<shard>|clean:materials:001/);
  assert.match(skill, /prepare-clean.*(零|0).*AI/);
});

test('one domain prompt owns the bounded joint decision contract', () => {
  assert.notEqual(domainPrompt, '', 'distill-domain.md must exist');
  assert.match(domainPrompt, /plot[\s\S]*characters[\s\S]*events[\s\S]*dialogues/);
  assert.match(domainPrompt, /martial[\s\S]*skills[\s\S]*techniques/);
  assert.match(domainPrompt, /items[\s\S]*world[\s\S]*factions[\s\S]*locations/);
  assert.match(domainPrompt, /keep[\s\S]*merge[\s\S]*reject[\s\S]*pending/);
  assert.match(domainPrompt, /每个.*entry_ref.*恰好.*一次|entry_ref.*exactly once/i);
  assert.match(domainPrompt, /candidate_key|local_key|最终 ID/);
  assert.match(domainPrompt, /private bindings|私有 bindings|私有绑定/);
  assert.match(domainPrompt, /CTX\/context-mode|检索摘要/);
  assert.match(schemas, /四域.*草稿示例/);
  assert.match(schemas, /duplicate_identity[\s\S]*ordinary_action[\s\S]*ordinary_item/);
});

test('chapter semantics stay isolated while the main model serializes acceptance', () => {
  assert.match(skill, /原生子代理/);
  assert.match(skill, /每个子代理.*一个章节/);
  assert.match(skill, /子代理.*直接.*完整.*章节原文/);
  assert.match(skill, /主模型.*串行.*accept/);
  assert.match(skill, /run-id.*unit.*attempt/);
  assert.match(skill, /staging.*不存在.*新.*子代理.*完整.*原文/);
  assert.match(skill, /done.*不.*重读|done.*不.*重做/);
  for (const [name, text] of [['SKILL.md', skill], ['extract-chapters.md', extraction]]) {
    assert.match(text, /CTX\/context-mode/, name);
    assert.match(text, /检索摘要/, name);
    assert.match(text, /启发式/, name);
    assert.match(text, /外部模型 CLI/, name);
  }
});

test('chapter dialogue extraction is disabled while the compatibility file remains empty by default', () => {
  assert.match(skill, /逐章.*对白.*(关闭|禁用)/);
  assert.match(extraction, /不得.*提取.*对白/);
  assert.match(extraction, /dialogues.*\[\]/);
  assert.doesNotMatch(extraction, /quotable.*至少保留.*对白/);
  assert.match(schemas, /dialogues.*必须.*\[\]/);
  assert.match(schemas, /dialogues\.json.*空数组/);
});

test('named techniques may remain independent only when the source does not state a parent skill', () => {
  assert.match(skill, /原文.*(未说明|未载明).*(所属|归属).*source_skill.*null/);
  assert.match(domainPrompt, /原文.*(未说明|未载明).*(所属|归属)/);
  assert.match(domainPrompt, /不得.*(猜测|虚构).*(所属|归属)/);
  assert.doesNotMatch(domainPrompt, /招式必须.*引用.*skill/);
  assert.match(schemas, /source_skill.*null/);
  assert.match(skill, /DOMAIN_PENDING_UNRESOLVED/);
});

test('chapter and domain workers share the persistent three-worker ceiling', () => {
  assert.match(skill, /最多\s*3\s*个.*Worker|并发.*3/);
  assert.match(skill, /章节.*领域.*(同一|共享).*worker|worker.*章节.*领域/i);
  assert.match(skill, /429.*3.*1/);
  assert.match(skill, /同一.*批次.*只.*一次/);
  assert.match(skill, /429.*不.*消耗.*attempt|429.*不.*消耗.*语义/i);
  assert.match(skill, /并发.*1.*429.*停止/);
  assert.match(backendSpec, /worker-pool\.json/);
  assert.match(backendSpec, /3.*1/);
  assert.match(backendSpec, /progress\.json.*unchanged/);
});

test('priority gates, targeted recall, bounded remedies and metrics are explicit', () => {
  assert.match(skill, /角色.*武功.*招式.*关键物品.*事件/);
  assert.match(skill, /地点.*势力.*普通对白.*warning/);
  assert.match(skill, /recall.*只.*(高优先级|重点)/);
  assert.match(skill, /95%/);
  assert.match(skill, /格式修正.*语义补救/);
  assert.match(skill, /最多\s*3\s*次/);
  assert.match(skill, /run-metrics\.json/);
  assert.match(skill, /planned.*done.*attempts/);
  assert.match(skill, /最大.*输入.*字节/);
  assert.match(skill, /候选.*变化/);
  assert.match(backendSpec, /domain-distill-v1/);
  assert.match(backendSpec, /distill:plot/);
  assert.match(backendSpec, /低优先级|low-priority/i);
});

test('semantic contract v2 treats old profiles as read-only evidence', () => {
  assert.match(skill, /semantic_contract_version.*2/);
  assert.match(skill, /LEGACY_SEMANTIC_CONTRACT/);
  assert.match(skill, /semantic_profile[\s\S]*LEGACY_SEMANTIC_CONTRACT|LEGACY_SEMANTIC_CONTRACT[\s\S]*semantic_profile/);
  assert.match(skill, /archive-abandoned.*--confirm/);
  assert.match(skill, /不得.*静默.*升级|不能.*原地.*升级/);
  assert.match(skill, /旧 run.*不得.*install|legacy.*不得.*install/i);
});

test('the reusable Skill and extraction prompt contain no book-specific branch', () => {
  assert.doesNotMatch(`${skill}\n${extraction}\n${domainPrompt}`, /笑傲江湖|飞狐外传|雪山飞狐|金庸/);
});
