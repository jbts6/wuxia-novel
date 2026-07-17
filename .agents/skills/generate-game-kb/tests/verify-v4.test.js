'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { readWorkPlan } = require('../scripts/lib/semantic-work');
const { FINAL_FILES } = require('../scripts/lib/semantic-contract');
const { verifyDataRoot, verifyFinal } = require('../scripts/lib/verify');
const {
  prepareAssembledRun,
  readJson,
  replaceAcceptedArtifact,
  sourceRef
} = require('./helpers');

function validFinalData() {
  return {
    'characters.yaml': [{
      id: 'char_jia',
      name: '甲',
      aliases: [],
      identity: '侠客',
      level: '核心',
      rank: '登堂入室',
      biography: '甲在江湖中追查旧事。',
      faction: 'faction_xuan_men',
      skills: ['skill_xuan_men_nei_gong'],
      items: ['item_hui_sheng_dan']
    }],
    'skills.yaml': [{
      id: 'skill_xuan_men_nei_gong',
      name: '玄门内功',
      type: '内功',
      faction: 'faction_xuan_men',
      rank: '登堂入室',
      description: '调息养气。',
      techniques: [{ name: '飞云掌', description: '掌势迅疾。' }]
    }],
    'items.yaml': [{
      id: 'item_hui_sheng_dan',
      name: '回生丹',
      type: '丹药',
      description: '用于救治重伤。'
    }],
    'factions.yaml': [{
      id: 'faction_xuan_men',
      name: '玄门',
      type: '门派',
      description: '隐居山中。'
    }],
    'chapter_summaries.yaml': [{ chapter: 1, title: '第一章 起始', summary: '甲初入江湖。' }]
  };
}

function writeData(data = validFinalData()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-game-kb-v4-'));
  for (const filename of Object.values(FINAL_FILES)) {
    fs.writeFileSync(path.join(root, filename), yaml.dump(data[filename], { noRefs: true, lineWidth: -1 }));
  }
  return root;
}

test('verifyDataRoot accepts an exact five-file YAML dataset with closed references', () => {
  const result = verifyDataRoot(writeData(), { chapters: [1] });

  assert.equal(result.passed, true, JSON.stringify(result.blocking_errors));
  assert.match(result.final_data_hash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(result.counts, {
    characters: 1,
    skills: 1,
    items: 1,
    factions: 1,
    chapter_summaries: 1
  });
  assert.deepEqual(result.blocking_errors, []);
});

test('verifyDataRoot rejects missing, malformed, extra, or field-drifted files', () => {
  const missing = writeData();
  fs.rmSync(path.join(missing, 'skills.yaml'));
  assert.equal(verifyDataRoot(missing).blocking_errors.some(error => error.code === 'FINAL_FILE_MISSING'), true);

  const malformed = writeData();
  fs.writeFileSync(path.join(malformed, 'skills.yaml'), '[invalid');
  assert.equal(verifyDataRoot(malformed).blocking_errors.some(error => error.code === 'FINAL_FILE_YAML_INVALID'), true);

  const extra = writeData();
  fs.writeFileSync(path.join(extra, 'legacy.json'), '[]\n');
  assert.equal(verifyDataRoot(extra).blocking_errors.some(error => error.code === 'FINAL_FILE_SET_INVALID'), true);

  const driftedData = validFinalData();
  driftedData['characters.yaml'][0].source_refs = [{ chapter: 1, text: '不应进入最终文件' }];
  const drifted = verifyDataRoot(writeData(driftedData));
  assert.equal(drifted.blocking_errors.some(error => error.code === 'FINAL_FIELDS_INVALID'), true);
});

test('verifyDataRoot rejects invalid IDs, enums, and nested technique names', () => {
  const data = validFinalData();
  data['characters.yaml'][0].id = '角色_甲';
  data['characters.yaml'][0].level = '主角';
  data['characters.yaml'][0].rank = '一流';
  data['items.yaml'][0].type = '宝物';
  data['skills.yaml'][0].techniques[0].name = '';

  const codes = new Set(verifyDataRoot(writeData(data)).blocking_errors.map(error => error.code));
  assert.equal(codes.has('FINAL_ID_INVALID'), true);
  assert.equal(codes.has('CHARACTER_LEVEL_INVALID'), true);
  assert.equal(codes.has('POWER_RANK_INVALID'), true);
  assert.equal(codes.has('ITEM_TYPE_INVALID'), true);
  assert.equal(codes.has('TECHNIQUE_NAME_REQUIRED'), true);
});

test('verifyDataRoot rejects unresolved references and incomplete chapter summaries', () => {
  const data = validFinalData();
  data['characters.yaml'][0].faction = 'faction_missing';
  data['characters.yaml'][0].skills = ['skill_missing'];
  data['characters.yaml'][0].items = ['item_missing'];
  data['skills.yaml'][0].faction = 'faction_missing';

  const result = verifyDataRoot(writeData(data), { chapters: [1, 2] });
  const codes = new Set(result.blocking_errors.map(error => error.code));
  assert.equal(codes.has('FINAL_REFERENCE_MISSING'), true);
  assert.equal(codes.has('SUMMARY_CHAPTER_MISSING'), true);
});

test('verifyFinal binds accepted evidence to the assembled hash in its verification report', () => {
  const { assembled, paths } = prepareAssembledRun({
    name: '工作区验证试书',
    runId: 'run-verify-workspace'
  });

  const result = verifyFinal(paths);
  assert.equal(result.passed, true, JSON.stringify(result.blocking_errors));
  assert.equal(result.final_data_hash, assembled.final_data_hash);
  assert.equal(fs.existsSync(path.join(paths.finalReports, 'verification-report.json')), true);
});

test('verifyFinal rejects mutated accepted evidence and does not write a passing receipt', () => {
  const { paths } = prepareAssembledRun({ name: '证据变更试书', runId: 'run-mutated-evidence' });
  const chapter = path.join(paths.chapters, 'ch_001.yaml');
  fs.appendFileSync(chapter, '\n# mutated\n');

  const result = verifyFinal(paths);
  assert.equal(result.passed, false);
  assert.equal(result.blocking_errors.some(error => error.code === 'ACCEPTED_ARTIFACT_MUTATED'), true);
  assert.equal(fs.existsSync(paths.verificationReport), false);
});

test('verifyFinal rejects stale assembly hashes and unresolved manual review', () => {
  const stale = prepareAssembledRun({ name: '报告过期试书', runId: 'run-stale-report' });
  const report = readJson(stale.paths.assemblyReport);
  report.final_data_hash = 'sha256:stale';
  fs.writeFileSync(stale.paths.assemblyReport, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(
    verifyFinal(stale.paths).blocking_errors.some(error => error.code === 'ASSEMBLY_FINAL_HASH_STALE'),
    true
  );

  const manual = prepareAssembledRun({ name: '人工复核试书', runId: 'run-manual-review' });
  fs.writeFileSync(manual.paths.manualReview, `${JSON.stringify([{ unit: 'distill:items' }], null, 2)}\n`);
  assert.equal(
    verifyFinal(manual.paths).blocking_errors.some(error => error.code === 'MANUAL_REVIEW_BLOCKS_FINAL'),
    true
  );
});

test('verifyFinal rejects an ordinary item kept without an allowed inclusion reason', () => {
  const { paths } = prepareAssembledRun({
    name: '普通物品试书',
    runId: 'run-ordinary-item',
    chapterOverrides: {
      items: [{
        local_key: 'item:tea-cup',
        name: '茶杯',
        type: '其他',
        description: '普通茶杯。',
        inclusion_reason: '其他稀有特殊',
        source_refs: [sourceRef(1, '茶杯')]
      }]
    }
  });
  const plan = readWorkPlan(paths, 'domain');
  const input = plan.inputs.find(item => item.unit === 'distill:items');
  const file = path.join(paths.domainDecisions, 'distill_items.yaml');
  const decision = yaml.load(fs.readFileSync(file, 'utf8'));
  decision.decisions[0].patch.inclusion_reason = '普通物品';
  replaceAcceptedArtifact(paths, file, decision);

  const result = verifyFinal(paths);
  assert.equal(result.passed, false);
  assert.equal(input.entries.length, 1);
  assert.equal(result.blocking_errors.some(error => error.code === 'ITEM_NOT_IMPORTANT'), true);
});
