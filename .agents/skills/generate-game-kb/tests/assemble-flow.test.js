'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { SEMANTIC_CONTRACT_VERSION } = require('../scripts/lib/semantic-contract');
const { prepareAssembledRun, runFlow, sourceRef } = require('./helpers');

function pass(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function mergedDomainDraft(input) {
  const retained = input.entries.filter(entry => entry.canonical_name !== '茶杯');
  const target = retained[0];
  return {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    unit: input.unit,
    input_hash: input.input_hash,
    decisions: input.entries.map(entry => {
      if (entry.canonical_name === '茶杯') {
        return {
          entry_ref: entry.entry_ref,
          action: 'reject',
          reason: 'ordinary_item',
          detail: '普通生活器具，不进入游戏知识库。'
        };
      }
      if (entry.entry_ref !== target.entry_ref) {
        return { entry_ref: entry.entry_ref, action: 'merge', target_ref: target.entry_ref, patch: {} };
      }
      return {
        entry_ref: entry.entry_ref,
        action: 'keep',
        patch: {
          canonical_name: entry.canonical_name,
          ...(['characters', 'skills'].includes(entry.category) ? { rank: '登堂入室' } : {}),
          ...(entry.category === 'items' ? { inclusion_reason: '神兵利器' } : {})
        }
      };
    }),
    notes: []
  };
}

function chapterCandidates(chapter) {
  if (chapter.number === 1) {
    return {
      characters: [{
        local_key: 'character:hu-fei', name: '胡斐', identity: '胡家后人', level: '核心', rank: '登堂入室',
        faction: '飞狐一脉', skill_names: ['胡家刀法'], item_names: ['冷月宝刀'],
        source_refs: [sourceRef(1, '胡斐')]
      }],
      skills: [{
        local_key: 'skill:hu-dao', name: '胡家刀法', type: '刀法', faction: '飞狐一脉', rank: '登堂入室',
        description: '胡家家传刀法。', techniques: [{ name: '八方藏刀式', named_in_source: true, description: '刀势回护。' }],
        source_refs: [sourceRef(1, '胡家刀法')]
      }],
      items: [{
        local_key: 'item:leng-yue', name: '冷月宝刀', type: '武器', inclusion_reason: '神兵利器',
        description: '胡家宝刀。', source_refs: [sourceRef(1, '冷月宝刀')]
      }],
      factions: [{
        local_key: 'faction:fei-hu', name: '飞狐一脉', type: '家族', description: '胡家传承。',
        source_refs: [sourceRef(1, '飞狐一脉')]
      }]
    };
  }
  if (chapter.number === 2) {
    return {
      characters: [{
        local_key: 'character:xue-shan', name: '雪山飞狐', identity: '胡斐', level: '核心', rank: '登堂入室',
        faction: '胡家一脉', skill_names: ['胡氏刀法'], item_names: ['宝刀'],
        source_refs: [sourceRef(2, '雪山飞狐')]
      }],
      skills: [{
        local_key: 'skill:hu-shi', name: '胡氏刀法', type: '刀法', faction: '胡家一脉', rank: '登堂入室',
        description: '胡氏刀法别称。', techniques: [], source_refs: [sourceRef(2, '胡氏刀法')]
      }],
      items: [{
        local_key: 'item:bao-dao', name: '宝刀', type: '武器', inclusion_reason: '神兵利器',
        description: '冷月宝刀别称。', source_refs: [sourceRef(2, '宝刀')]
      }],
      factions: [{
        local_key: 'faction:hu-jia', name: '胡家一脉', type: '家族', description: '飞狐一脉别称。',
        source_refs: [sourceRef(2, '胡家一脉')]
      }]
    };
  }
  return {
    characters: [],
    skills: [],
    factions: [],
    items: [{
      local_key: 'item:tea-cup', name: '茶杯', type: '其他', description: '普通茶杯。',
      source_refs: [sourceRef(3, '茶杯')]
    }]
  };
}

test('three-chapter normal path assembles verifies installs and verifies only five YAML files', () => {
  const fixture = prepareAssembledRun({
    name: '三章正常路径试书',
    runId: 'run-three-chapter-flow',
    source: '第一章 雪山相逢\n胡斐使出八方藏刀式。\n第二章 宝刀重现\n雪山飞狐携宝刀而来。\n第三章 客栈收束\n桌上只有一只茶杯。\n',
    chapterOverrides: chapterCandidates,
    domainDraftForInput: mergedDomainDraft
  });
  const commands = [...fixture.commands];

  commands.push('verify');
  const workspace = pass(runFlow(['verify', fixture.novel, '--run', fixture.prepared.run_id, '--json']), 'verify');
  commands.push('install');
  pass(runFlow(['install', fixture.novel, '--run', fixture.prepared.run_id, '--json']), 'install');
  commands.push('verify --installed');
  const installed = pass(runFlow(['verify', fixture.novel, '--installed', '--json']), 'verify installed');
  commands.push('archive-run');
  const archived = pass(runFlow([
    'archive-run', fixture.novel, '--run', fixture.prepared.run_id, '--json'
  ]), 'archive run');
  const archivedMetrics = JSON.parse(fs.readFileSync(
    path.join(archived.archive_dir, 'reports', 'run-metrics.json'),
    'utf8'
  ));

  assert.equal(workspace.passed, true);
  assert.equal(installed.passed, true);
  assert.match(archived.metrics_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(fs.existsSync(fixture.paths.run), false);
  assert.equal(fs.existsSync(archived.archive_dir), true);
  assert.equal(archivedMetrics.run_id, fixture.prepared.run_id);
  assert.deepEqual(commands, [
    'prepare',
    'accept',
    'accept',
    'accept',
    'plan-domains',
    'accept',
    'accept',
    'accept',
    'accept',
    'assemble',
    'verify',
    'install',
    'verify --installed',
    'archive-run'
  ]);
  assert.deepEqual(fs.readdirSync(path.join(fixture.novel, 'data')).sort(), [
    'characters.yaml',
    'skills.yaml',
    'items.yaml',
    'factions.yaml',
    'chapter_summaries.yaml'
  ].sort());
  assert.deepEqual(workspace.counts, {
    characters: 1,
    skills: 1,
    items: 1,
    factions: 1,
    chapter_summaries: 3
  });
  const skills = yaml.load(fs.readFileSync(path.join(fixture.novel, 'data', 'skills.yaml'), 'utf8'));
  assert.equal(skills[0].techniques.some(technique => technique.name === '八方藏刀式'), true);
});
