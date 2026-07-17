'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { validMergedBook } = require('./helpers');
const { buildFinalData, writeFinalData } = require('../scripts/lib/finalize');
const { assignStableIds, makeBaseId } = require('../scripts/lib/ids');
const { FINAL_FIELDS, FINAL_FILES } = require('../scripts/lib/semantic-contract');

const manifest = {
  chapters: [1, 2, 3].map(number => ({ number, title: `第${number}章`, input_hash: `sha256:${number}` }))
};

test('北冥神功 receives skill_bei_ming_shen_gong', () => {
  assert.equal(makeBaseId('skills', '北冥神功'), 'skill_bei_ming_shen_gong');
  assert.equal(makeBaseId('skills', '北冥神功'), makeBaseId('skills', '北冥神功'));
});

test('same-pinyin names receive stable alphabetic collision suffixes', () => {
  const records = {
    characters: [
      { local_key: 'character:陆路', canonical_name: '陆路' },
      { local_key: 'character:鹿路', canonical_name: '鹿路' }
    ]
  };
  const forward = assignStableIds(records).characters;
  const reverse = assignStableIds({ characters: [...records.characters].reverse() }).characters;
  const byName = values => Object.fromEntries(values.map(value => [value.canonical_name, value.id]));

  assert.deepEqual(byName(forward), byName(reverse));
  assert.notEqual(forward[0].id, forward[1].id);
  for (const record of forward) assert.match(record.id, /^char_lu_lu_[a-p]{8}$/);
});

test('one projection rewrites character and skill references to stable IDs', () => {
  const result = buildFinalData(validMergedBook(), manifest);

  assert.deepEqual(result.issues, []);
  const character = result.data[FINAL_FILES.characters][0];
  const skill = result.data[FINAL_FILES.skills][0];
  assert.deepEqual(character.skills, ['skill_xuan_men_nei_gong']);
  assert.deepEqual(character.items, ['item_hui_sheng_dan']);
  assert.equal(character.faction, 'faction_xuan_men');
  assert.equal(skill.faction, 'faction_xuan_men');
  assert.deepEqual(skill.techniques, [{ name: '飞云掌', description: '掌势迅疾。' }]);
});

test('non-empty unresolved or ambiguous links are omitted with blocking issues', () => {
  const missing = validMergedBook();
  missing.characters[0].skill_names = ['失踪武功'];
  const missingResult = buildFinalData(missing, manifest);
  assert.deepEqual(missingResult.data[FINAL_FILES.characters][0].skills, []);
  assert.ok(missingResult.issues.some(issue =>
    issue.code === 'REFERENCE_UNRESOLVED' && issue.target === '失踪武功'));

  const ambiguous = validMergedBook();
  ambiguous.factions.push({
    ...ambiguous.factions[0],
    local_key: 'faction:玄门别院',
    canonical_name: '玄门别院',
    aliases: ['玄门']
  });
  const ambiguousResult = buildFinalData(ambiguous, manifest);
  assert.equal(ambiguousResult.data[FINAL_FILES.characters][0].faction, null);
  assert.ok(ambiguousResult.issues.some(issue =>
    issue.code === 'REFERENCE_AMBIGUOUS' && issue.target === '玄门'));
});

test('build emits exactly five stable YAML arrays', () => {
  const first = validMergedBook();
  const second = structuredClone(first);
  second.characters.reverse();
  second.skills.reverse();
  const left = buildFinalData(first, manifest);
  const right = buildFinalData(second, manifest);

  assert.equal(left.issues.length, 0);
  assert.deepEqual(Object.keys(left.data).sort(), Object.values(FINAL_FILES).sort());
  assert.ok(Object.values(left.data).every(Array.isArray));
  assert.equal(JSON.stringify(left.data), JSON.stringify(right.data));
});

test('every final record uses only the shared simplified fields and rank names', () => {
  const result = buildFinalData(validMergedBook(), manifest);

  for (const [category, filename] of Object.entries(FINAL_FILES)) {
    for (const record of result.data[filename]) {
      assert.deepEqual(Object.keys(record), [...FINAL_FIELDS[category]]);
    }
  }
  assert.equal(result.data[FINAL_FILES.characters][0].rank, '初窥门径');
  assert.equal(result.data[FINAL_FILES.skills][0].rank, '初窥门径');
  assert.equal(Object.hasOwn(result.data[FINAL_FILES.items][0], 'tags'), false);
  assert.equal(Object.hasOwn(result.data[FINAL_FILES.characters][0], 'power_rank'), false);
});

test('source refs reject unknown chapters but allow omitted line numbers', () => {
  const valid = buildFinalData(validMergedBook(), manifest);
  assert.equal(valid.issues.some(issue => issue.code === 'SOURCE_CHAPTER_UNKNOWN'), false);

  const invalid = validMergedBook();
  invalid.items[0].source_refs = [{ chapter: 99, text: '错误章节' }];
  assert.ok(buildFinalData(invalid, manifest).issues.some(issue => issue.code === 'SOURCE_CHAPTER_UNKNOWN'));
});

test('writeFinalData writes five YAML files while keeping the ID plan as controller JSON', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-final-'));
  const paths = { finalData: path.join(root, 'data'), finalIdPlan: path.join(root, 'id-plan.json') };
  const result = buildFinalData(validMergedBook(), manifest);

  writeFinalData(paths, result);

  assert.deepEqual(fs.readdirSync(paths.finalData).sort(), Object.values(FINAL_FILES).sort());
  for (const filename of Object.values(FINAL_FILES)) {
    assert.ok(Array.isArray(yaml.load(fs.readFileSync(path.join(paths.finalData, filename), 'utf8'))));
  }
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(paths.finalIdPlan, 'utf8')));
});
