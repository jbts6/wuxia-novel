'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { applyOverlay, validateOverlay } = require('../scripts/lib/overlay');
const { deferredPathsFor } = require('../scripts/lib/paths');
const { verifyInstalled } = require('../scripts/lib/install');
const { readJson, runFlow, sourceRef } = require('./helpers');
const { pass, preparePublishedLiteRun } = require('./lite-published-helper');

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

function registryKeysByName(archivedRun, scope = 'characters') {
  const registry = readJson(path.join(archivedRun, 'accepted', 'candidate-registry.json'));
  return Object.fromEntries(registry.categories[scope].map(entry => [entry.canonical_name, entry.registry_key]));
}

function writeOverlay(paths, task, operations) {
  const file = task.staging_path;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, yaml.dump({
    schema_version: 1,
    base_manifest_hash: task.base_manifest_hash,
    base_data_hash: task.base_data_hash,
    operations: [...operations].sort((left, right) => left.registry_key.localeCompare(right.registry_key))
  }, { noRefs: true, lineWidth: -1 }), 'utf8');
  return file;
}

function addTask(fixture, scope = 'characters') {
  return pass(runFlow([
    'task-add', fixture.novel, '--run', fixture.prepared.run_id,
    '--type', `${scope}-deep`, '--scope', scope, '--json'
  ]), 'task-add');
}

function readyTask(fixture, paths, task, operations) {
  const draft = writeOverlay(paths, task, operations);
  return pass(runFlow([
    'task-run', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', task.task_id, '--draft', draft, '--json'
  ]), 'task-run');
}

test('overlay patch fields match the version-6 entity contract', () => {
  const contracts = {
    characters: {
      patch: {
        aliases: ['甲'], identities: ['掌门'], level: '核心', rank: '炉火纯青',
        description: '人物描述。', factions: ['faction_a'], skills: ['skill_a']
      },
      forbidden: ['name', 'identity', 'biography', 'faction', 'items']
    },
    skills: {
      patch: {
        aliases: ['甲功'], types: ['内功'], factions: ['faction_a'], rank: '炉火纯青',
        description: '武功描述。', techniques: [{ name: '甲式', description: null }]
      },
      forbidden: ['name', 'type', 'faction']
    },
    items: {
      patch: { aliases: ['甲物'], type: '兵器', description: '物品描述。' },
      forbidden: ['name', 'holders']
    },
    factions: {
      patch: { aliases: ['甲门'], type: '门派', description: '势力描述。' },
      forbidden: ['name', 'members']
    }
  };
  for (const [scope, contract] of Object.entries(contracts)) {
    const registryKey = `${scope}:one`;
    const finalId = `${scope}_one`;
    const baseRegistry = { categories: { [scope]: [{ registry_key: registryKey }] } };
    const groundingContext = {
      base_manifest_hash: 'sha256:manifest',
      base_data_hash: 'sha256:data',
      registry_map: { categories: { [scope]: { [registryKey]: finalId } } },
      scope
    };
    const makeOverlay = patch => ({
      schema_version: 1,
      base_manifest_hash: groundingContext.base_manifest_hash,
      base_data_hash: groundingContext.base_data_hash,
      operations: [{ action: 'patch', registry_key: registryKey, patch }]
    });
    assert.deepEqual(validateOverlay(makeOverlay(contract.patch), { baseRegistry, groundingContext }), [], scope);
    for (const field of contract.forbidden) {
      const errors = validateOverlay(makeOverlay({ [field]: 'forbidden' }), { baseRegistry, groundingContext });
      assert.equal(errors.some(error => error.code === 'OVERLAY_PATCH_FIELD_INVALID'), true, `${scope}.${field}`);
    }
  }
});

test('overlay applies keep merge drop and patch then promotes a verified Dashboard data revision', () => {
  const fixture = preparePublishedLiteRun({ runId: 'run-overlay-operations' });
  const paths = deferredPathsFor(fixture.novel, fixture.prepared.run_id);
  const keys = registryKeysByName(fixture.archivedRun);
  const task = addTask(fixture);
  const ready = readyTask(fixture, paths, task, [
    { action: 'patch', registry_key: keys['甲'], patch: { description: '甲遍历江湖后返乡。' } },
    { action: 'merge', registry_key: keys['乙'], target_registry_key: keys['甲'] },
    { action: 'drop', registry_key: keys['丙'] },
    { action: 'keep', registry_key: keys['丁'] }
  ]);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.staging_path, task.staging_path);
  assert.equal(ready.draft_path, task.staging_path);
  assert.equal(ready.overlay_path, path.join(paths.overlays, `${task.task_id}.yaml`));
  assert.equal(fs.existsSync(ready.overlay_path), true);

  const before = verifyInstalled(fixture.novel);
  const receipt = pass(runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', task.task_id, '--json'
  ]), 'task-apply');

  const active = readYaml(path.join(fixture.novel, 'data', 'characters.yaml'));
  const backup = readYaml(path.join(receipt.backup_path, 'characters.yaml'));
  const revision = readYaml(path.join(receipt.revision_dir, 'data', 'characters.yaml'));
  assert.deepEqual(active.map(record => record.name), ['丁', '甲']);
  assert.equal(active.find(record => record.name === '甲').description, '甲遍历江湖后返乡。');
  assert.deepEqual(revision, active);
  assert.equal(backup.length, 4);
  assert.equal(receipt.previous_final_data_hash, before.final_data_hash);
  assert.equal(receipt.backup_final_data_hash, before.final_data_hash);
  assert.equal(receipt.final_data_hash, verifyInstalled(fixture.novel).final_data_hash);
  assert.equal(verifyInstalled(fixture.novel).passed, true);
  const installedReceipt = readJson(path.join(fixture.novel, 'reports', 'generate_game_kb_install.json'));
  assert.equal(installedReceipt.registry_map_hash, receipt.registry_map_hash);

  const nextTask = addTask(fixture);
  const nextInput = readJson(nextTask.input_path);
  assert.equal(new Set(nextInput.entities.map(entity => entity.final_id)).size, nextInput.entities.length);
  const mergedEntity = nextInput.entities.find(entity => entity.record.name === '甲');
  assert.deepEqual(mergedEntity.registry_keys.sort(), [keys['乙'], keys['甲']].sort());
});

test('successive overlays are cumulative and a stale task cannot replace newer Dashboard data', () => {
  const fixture = preparePublishedLiteRun({ runId: 'run-overlay-cumulative' });
  const paths = deferredPathsFor(fixture.novel, fixture.prepared.run_id);
  const keys = registryKeysByName(fixture.archivedRun);
  const firstTask = addTask(fixture);
  readyTask(fixture, paths, firstTask, [
    { action: 'patch', registry_key: keys['甲'], patch: { description: '第一版描述。' } }
  ]);
  const first = pass(runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', firstTask.task_id, '--json'
  ]), 'first apply');

  const secondTask = addTask(fixture);
  const staleTask = addTask(fixture);
  assert.equal(secondTask.base_data_hash, first.final_data_hash);
  readyTask(fixture, paths, secondTask, [
    { action: 'patch', registry_key: keys['甲'], patch: { description: '第二版描述。' } }
  ]);
  readyTask(fixture, paths, staleTask, [
    { action: 'patch', registry_key: keys['甲'], patch: { description: '陈旧描述。' } }
  ]);
  const second = pass(runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', secondTask.task_id, '--json'
  ]), 'second apply');

  assert.notEqual(second.backup_path, first.backup_path);
  assert.equal(
    readYaml(path.join(second.backup_path, 'characters.yaml')).find(record => record.name === '甲').description,
    '第一版描述。'
  );
  const stale = runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', staleTask.task_id, '--json'
  ]);
  assert.notEqual(stale.status, 0);
  assert.equal(JSON.parse(stale.stderr).code, 'DEFERRED_TASK_STALE');
  assert.equal(
    readYaml(path.join(fixture.novel, 'data', 'characters.yaml')).find(record => record.name === '甲').description,
    '第二版描述。'
  );
});

test('faction and skill merges rewrite version-6 array references', () => {
  const evidence = '甲属于青门与白门，修习青功与白功。';
  const fixture = preparePublishedLiteRun({
    runId: 'run-overlay-array-references',
    source: `第一章 起始\n${evidence}\n第二章 续行\n甲继续前行。\n第三章 终局\n甲返回故里。\n`,
    firstChapter: {
      characters: [{
        local_key: 'character:甲', name: '甲', aliases: [], identities: [], level: '核心',
        rank: '初窥门径', description: null,
        factions: ['faction:青门', 'faction:白门'],
        skills: ['skill:青功', 'skill:白功'],
        source_refs: [sourceRef(1, evidence)]
      }],
      skills: [
        {
          local_key: 'skill:青功', name: '青功', aliases: [], types: ['内功'],
          factions: ['faction:青门'], rank: null, description: null, techniques: [],
          source_refs: [sourceRef(1, evidence)]
        },
        {
          local_key: 'skill:白功', name: '白功', aliases: [], types: ['内功'],
          factions: ['faction:白门'], rank: null, description: null, techniques: [],
          source_refs: [sourceRef(1, evidence)]
        }
      ],
      items: [],
      factions: [
        { local_key: 'faction:青门', name: '青门', aliases: [], type: '门派', description: null, source_refs: [sourceRef(1, evidence)] },
        { local_key: 'faction:白门', name: '白门', aliases: [], type: '门派', description: null, source_refs: [sourceRef(1, evidence)] }
      ]
    }
  });
  const paths = deferredPathsFor(fixture.novel, fixture.prepared.run_id);
  const factionKeys = registryKeysByName(fixture.archivedRun, 'factions');
  const factionTask = addTask(fixture, 'factions');
  readyTask(fixture, paths, factionTask, [{
    action: 'merge',
    registry_key: factionKeys['青门'],
    target_registry_key: factionKeys['白门']
  }]);
  pass(runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', factionTask.task_id, '--json'
  ]), 'faction apply');

  const factions = readYaml(path.join(fixture.novel, 'data', 'factions.yaml'));
  const targetFactionId = factions.find(record => record.name === '白门').id;
  const characterAfterFaction = readYaml(path.join(fixture.novel, 'data', 'characters.yaml'))[0];
  const skillsAfterFaction = readYaml(path.join(fixture.novel, 'data', 'skills.yaml'));
  assert.deepEqual(characterAfterFaction.factions, [targetFactionId]);
  for (const skill of skillsAfterFaction) assert.deepEqual(skill.factions, [targetFactionId]);

  const skillKeys = registryKeysByName(fixture.archivedRun, 'skills');
  const skillTask = addTask(fixture, 'skills');
  readyTask(fixture, paths, skillTask, [{
    action: 'merge',
    registry_key: skillKeys['青功'],
    target_registry_key: skillKeys['白功']
  }]);
  pass(runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', skillTask.task_id, '--json'
  ]), 'skill apply');

  const skills = readYaml(path.join(fixture.novel, 'data', 'skills.yaml'));
  const targetSkillId = skills.find(record => record.name === '白功').id;
  const characterAfterSkill = readYaml(path.join(fixture.novel, 'data', 'characters.yaml'))[0];
  assert.deepEqual(characterAfterSkill.skills, [targetSkillId]);
});

test('a mutated installed registry map blocks the next deep task', () => {
  const fixture = preparePublishedLiteRun({ runId: 'run-overlay-registry-map' });
  const paths = deferredPathsFor(fixture.novel, fixture.prepared.run_id);
  const keys = registryKeysByName(fixture.archivedRun);
  const task = addTask(fixture);
  readyTask(fixture, paths, task, [
    { action: 'patch', registry_key: keys['甲'], patch: { description: '已安装描述。' } }
  ]);
  pass(runFlow([
    'task-apply', fixture.novel, '--run', fixture.prepared.run_id,
    '--task-id', task.task_id, '--json'
  ]), 'task-apply');

  const mapping = readJson(paths.registryMap);
  mapping.categories.characters[keys['甲']] = mapping.categories.characters[keys['丁']];
  fs.writeFileSync(paths.registryMap, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');

  const next = runFlow([
    'task-add', fixture.novel, '--run', fixture.prepared.run_id,
    '--type', 'characters-deep', '--scope', 'characters', '--json'
  ]);
  assert.notEqual(next.status, 0);
  assert.equal(JSON.parse(next.stderr).code, 'DEFERRED_REGISTRY_MAP_HASH_MISMATCH');
});

test('overlay install fault restores the previous active data and leaves no applied revision', () => {
  const fixture = preparePublishedLiteRun({ runId: 'run-overlay-rollback' });
  const paths = deferredPathsFor(fixture.novel, fixture.prepared.run_id);
  const keys = registryKeysByName(fixture.archivedRun);
  const task = addTask(fixture);
  readyTask(fixture, paths, task, [
    { action: 'patch', registry_key: keys['甲'], patch: { description: '不应安装。' } }
  ]);
  const before = fs.readFileSync(path.join(fixture.novel, 'data', 'characters.yaml'), 'utf8');

  assert.throws(() => applyOverlay({
    paths,
    taskId: task.task_id,
    faultAt: 'after-old-move'
  }), error => error?.code === 'INSTALL_FAULT_INJECTED');

  assert.equal(fs.readFileSync(path.join(fixture.novel, 'data', 'characters.yaml'), 'utf8'), before);
  assert.equal(readJson(paths.deferredTasks).tasks.find(item => item.task_id === task.task_id).status, 'ready');
  assert.equal(fs.existsSync(paths.revisions), false);
});
