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

test('v5 skill exposes an isolated grounded base workflow', () => {
  assert.ok(fs.existsSync(path.join(skillRoot, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(skillRoot, 'prompts', 'extract-chapters.md')));
  assert.match(skill, /semantic_contract_version\s*:\s*5/);
  for (const command of ['v5-prepare', 'v5-accept', 'v5-basic-curate', 'v5-publish', 'v5-status']) {
    assert.match(skill, new RegExp(`\\b${command}\\b`), command);
  }
  assert.doesNotMatch(skill, /\bplan-domains\b/);
  assert.match(skill, /generate-game-kb-deep-(?:characters|skills|items|factions)/);
});

test('v5 extraction prompt keeps chapter evidence local and YAML-bound', () => {
  assert.match(extraction, /YAML/i);
  assert.match(extraction, /source_refs/);
  assert.match(extraction, /chapter/i);
  assert.match(extraction, /local_key/);
  assert.match(extraction, /techniques/);
  assert.match(extraction, /one|each|每个/i);
});

