'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const skillRoot = path.resolve(__dirname, '..', '..', 'generate-game-kb-lite');
const skill = fs.existsSync(path.join(skillRoot, 'SKILL.md'))
  ? fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8')
  : '';
const skillCn = fs.existsSync(path.join(skillRoot, 'SKILL-cn.md'))
  ? fs.readFileSync(path.join(skillRoot, 'SKILL-cn.md'), 'utf8')
  : '';
const examples = fs.existsSync(path.join(skillRoot, 'examples.md'))
  ? fs.readFileSync(path.join(skillRoot, 'examples.md'), 'utf8')
  : '';
const examplesCn = fs.existsSync(path.join(skillRoot, 'examples-cn.md'))
  ? fs.readFileSync(path.join(skillRoot, 'examples-cn.md'), 'utf8')
  : '';
const extraction = fs.existsSync(path.join(skillRoot, 'prompts', 'extract-chapters.md'))
  ? fs.readFileSync(path.join(skillRoot, 'prompts', 'extract-chapters.md'), 'utf8')
  : '';

const explicitUserInvocation = /user-(?:invoked|loaded)|(?:user|用户)[^\r\n]*(?:invoke|load|触发|加载)|(?:invoke|load|触发|加载)[^\r\n]*(?:user|用户)/i;

function readAllMarkdown(root) {
  if (!fs.existsSync(root)) return '';
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) return [readAllMarkdown(file)];
    return entry.name.endsWith('.md') ? [fs.readFileSync(file, 'utf8')] : [];
  }).join('\n');
}

function assertSkillFrontmatter(text, name) {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(frontmatter, name + ' must start with YAML frontmatter');
  assert.match(frontmatter[1], new RegExp('^name:\\s*' + name + '$', 'm'));
  assert.match(frontmatter[1], /^description:[ \t]*["']?Use when\b/im);
}

test('Lite skill exposes the complete lightweight-v4 base workflow', () => {
  assert.ok(fs.existsSync(path.join(skillRoot, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(skillRoot, 'SKILL-cn.md')));
  assert.ok(fs.existsSync(path.join(skillRoot, 'examples.md')));
  assert.ok(fs.existsSync(path.join(skillRoot, 'examples-cn.md')));
  assert.ok(fs.existsSync(path.join(skillRoot, 'prompts', 'extract-chapters.md')));
  assertSkillFrontmatter(skill, 'generate-game-kb-lite');
  assertSkillFrontmatter(skillCn, 'generate-game-kb-lite-cn');
  assert.match(skill, /lightweight[^\r\n]*v4/i);
  assert.match(skill, /semantic_contract_version\s*:\s*6/);
  assert.match(skill, /profile\s*:\s*lite/i);
  assert.match(skill, /semantic_contract_version[\s\S]{0,100}controller[\s\S]{0,80}JSON/i);
  const allExamples = `${examples}\n${examplesCn}`;
  for (const command of [
    'lite-prepare',
    'lite-accept',
    'lite-basic-curate',
    'lite-publish',
    'lite-status',
    'retry-unit'
  ]) {
    assert.match(allExamples, new RegExp('\\b' + command + '\\b'), command);
  }
  assert.doesNotMatch(skill, /\bplan-domains\b/);
  assert.match(skill, explicitUserInvocation);
  assert.match(skill, /(?:non-blocking|does not block|不阻塞)/i);
  assert.match(allExamples, /古龙[\\/]剑神一笑/);
  assert.match(allExamples, /retry-unit[^\r\n]*chapter:001/i);
  assert.doesNotMatch(readAllMarkdown(skillRoot), /\bv5-(?:prepare|status|accept|basic-curate|publish)\b/i);
  assert.doesNotMatch(readAllMarkdown(skillRoot), /generate-game-kb-v5|profile\s*:\s*v5/i);
});

test('Lite skill defines YAML final artifacts and publication evidence', () => {
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

test('Lite extraction prompt keeps version-6 chapter evidence local and YAML-bound', () => {
  assert.match(extraction, /semantic_contract_version\s*:\s*6/);
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
  assert.match(extraction, /(?:do not|never)[^\r\n]*(?:semantic_contract_version|profile)[^\r\n]*chapter YAML/i);
  assert.match(extraction, /(?:no|never)\s+(?:scheduler|worker)[\s\S]{0,60}(?:automatic\s+)?third\s+attempt/i);
  assert.doesNotMatch(extraction, /semantic_contract_version\s*:\s*5/);
  assert.doesNotMatch(extraction, /\b(?:biography|holders?|members?)\b/i);
});

test('Lite and deep Skill resources never introduce event or dialogue workflows', () => {
  const roots = [skillRoot, ...['characters', 'skills', 'items', 'factions'].map(domain => path.resolve(
    __dirname,
    '..',
    '..',
    `generate-game-kb-deep-${domain}`
  ))];
  for (const root of roots) {
    assert.doesNotMatch(readAllMarkdown(root), /\b(?:events?|dialogues?)\b|事件|对话/i, root);
  }
});
