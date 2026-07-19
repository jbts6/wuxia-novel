'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const skillRoots = [
  'generate-game-kb',
  'generate-game-kb-lite',
  'generate-game-kb-deep-characters',
  'generate-game-kb-deep-skills',
  'generate-game-kb-deep-items',
  'generate-game-kb-deep-factions'
];

const deepTaskTypes = {
  'generate-game-kb-deep-characters': 'characters-deep',
  'generate-game-kb-deep-skills': 'skills-deep',
  'generate-game-kb-deep-items': 'items-deep',
  'generate-game-kb-deep-factions': 'factions-deep'
};

function readChineseSkill(root) {
  const file = path.resolve(__dirname, '..', '..', root, 'SKILL-cn.md');
  assert.equal(fs.existsSync(file), true, `${root} must provide SKILL-cn.md`);
  return fs.readFileSync(file, 'utf8');
}

test('all game-kb skills provide Chinese reference documents with runnable contracts', () => {
  for (const root of skillRoots) {
    const text = readChineseSkill(root);
    assert.match(text, /^---\r?\nname:\s+generate-game-kb(?:-[a-z0-9-]+)?-cn\r?\n/m, root);
    assert.match(text, /古龙[\\/]剑神一笑/, root);
    assert.match(text, /retry-unit|task-apply/, root);
    assert.match(text, /characters\.yaml/, root);
    assert.match(text, /chapter_summaries\.yaml/, root);
    assert.match(text, /YAML/i, root);
  }
});

test('Chinese deep references reuse task-add output instead of guessing identifiers or paths', () => {
  for (const [root, taskType] of Object.entries(deepTaskTypes)) {
    const text = readChineseSkill(root);
    const outputMatch = text.match(/```json\r?\n(\{[\s\S]*?\})\r?\n```/);
    assert.ok(outputMatch, `${root} must show task-add JSON output`);
    const output = JSON.parse(outputMatch[1]);
    assert.match(output.task_id, new RegExp(`^${taskType}-\\d{13}-[a-f0-9]{8}$`), root);
    assert.match(output.base_manifest_hash, /^sha256:[a-f0-9]{64}$/, root);
    assert.match(output.base_data_hash, /^sha256:[a-f0-9]{64}$/, root);
    assert.equal(output.status, 'pending', root);
    assert.match(output.input_path, /\.game-kb-work[\\/]deferred[\\/]/, root);
    assert.match(output.staging_path, /\.game-kb-work[\\/]deferred[\\/]/, root);

    const outputIndex = text.indexOf(outputMatch[0]);
    const runLine = text.split(/\r?\n/).find(line => line.includes(' task-run '));
    const applyLine = text.split(/\r?\n/).find(line => line.includes(' task-apply '));
    assert.ok(runLine && text.indexOf(runLine) > outputIndex, root);
    assert.ok(applyLine && text.indexOf(applyLine) > outputIndex, root);
    assert.ok(runLine.includes(`--task-id ${output.task_id}`), root);
    assert.ok(runLine.includes(`--draft "${output.staging_path}"`), root);
    assert.ok(applyLine.includes(`--task-id ${output.task_id}`), root);
  }
});
