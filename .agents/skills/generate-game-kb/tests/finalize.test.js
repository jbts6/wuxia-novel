'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { sourceRef, validMergedBook } = require('./helpers');
const { buildFinalData, writeFinalData, writeFinalDataAtomic } = require('../scripts/lib/finalize');
const { makeBaseId } = require('../scripts/lib/ids');
const { FINAL_FIELDS, FINAL_FILES } = require('../scripts/lib/semantic-contract');

const manifest = {
  chapters: [1, 2, 3].map(number => ({ number, title: `第${number}章`, input_hash: `sha256:${number}` }))
};

function validV7MergedBook() {
  const book = validMergedBook();
  book.items[0].types = ['丹药'];
  delete book.items[0].type;
  book.factions[0].types = ['门派'];
  delete book.factions[0].type;
  return book;
}

function finalPaths(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const finalRoot = path.join(root, 'final');
  return {
    finalRoot,
    finalData: path.join(finalRoot, 'data'),
    finalIdPlan: path.join(finalRoot, 'id_plan.json'),
    finalReports: path.join(finalRoot, 'reports'),
    assemblyReport: path.join(finalRoot, 'reports', 'assembly-report.json')
  };
}

test('北冥神功 receives skill_bei_ming_shen_gong', () => {
  assert.equal(makeBaseId('skills', '北冥神功'), 'skill_bei_ming_shen_gong');
});

test('one v7 projection rewrites references and preserves plural types', () => {
  const result = buildFinalData(validV7MergedBook(), manifest);

  assert.deepEqual(result.issues, []);
  const character = result.data[FINAL_FILES.characters][0];
  const skill = result.data[FINAL_FILES.skills][0];
  assert.deepEqual(character.skills, ['skill_xuan_men_nei_gong']);
  assert.deepEqual(character.factions, ['faction_xuan_men']);
  assert.deepEqual(skill.factions, ['faction_xuan_men']);
  assert.deepEqual(skill.techniques, [{ name: '飞云掌', description: '掌势迅疾。' }]);
  assert.deepEqual(result.data[FINAL_FILES.items][0].types, ['丹药']);
  assert.deepEqual(result.data[FINAL_FILES.factions][0].types, ['门派']);
  assert.equal(Object.hasOwn(result.data[FINAL_FILES.items][0], 'type'), false);
  assert.equal(Object.hasOwn(result.data[FINAL_FILES.factions][0], 'type'), false);
});

test('final reference projection preserves first-confirmed order while deduplicating', () => {
  const book = validV7MergedBook();
  book.skills.push({
    registry_key: 'registry:skills:0002',
    local_key: 'skill:a-nan-dao-fa',
    name: '阿难刀法',
    aliases: [],
    types: ['刀法'],
    factions: [],
    rank: null,
    description: null,
    techniques: [],
    source_refs: [sourceRef(2, '阿难刀法')]
  });
  book.characters[0].skills = [
    'registry:skills:0001',
    'registry:skills:0002',
    'registry:skills:0001'
  ];

  const result = buildFinalData(book, manifest);

  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.data[FINAL_FILES.characters][0].skills, [
    'skill_xuan_men_nei_gong',
    'skill_a_nan_dao_fa'
  ]);
});

test('non-empty unresolved links are omitted with blocking issues', () => {
  const missing = validV7MergedBook();
  missing.characters[0].skills = ['registry:skills:missing'];
  const missingResult = buildFinalData(missing, manifest);
  assert.deepEqual(missingResult.data[FINAL_FILES.characters][0].skills, []);
  assert.ok(missingResult.issues.some(issue =>
    issue.code === 'REFERENCE_UNRESOLVED' && issue.target === 'registry:skills:missing'));
});

test('final references resolve canonical names before colliding aliases', () => {
  const book = validV7MergedBook();
  book.factions.push({
    registry_key: 'registry:factions:0002',
    local_key: 'faction:xuan-men-bie-yuan',
    name: '玄门别院',
    aliases: ['玄门'],
    types: ['门派'],
    description: null,
    source_refs: [sourceRef(2, '玄门别院')]
  });
  book.characters[0].skills = ['玄门内功'];
  book.characters[0].factions = ['玄门'];

  const result = buildFinalData(book, manifest);

  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.data[FINAL_FILES.characters][0].skills, ['skill_xuan_men_nei_gong']);
  assert.deepEqual(result.data[FINAL_FILES.characters][0].factions, ['faction_xuan_men']);
});

test('final references resolve a unique alias but reject an ambiguous alias', () => {
  const unique = validV7MergedBook();
  unique.factions[0].aliases = ['玄门道统'];
  unique.characters[0].factions = ['玄门道统'];
  const uniqueResult = buildFinalData(unique, manifest);
  assert.deepEqual(uniqueResult.issues, []);
  assert.deepEqual(uniqueResult.data[FINAL_FILES.characters][0].factions, ['faction_xuan_men']);

  const ambiguous = validV7MergedBook();
  ambiguous.factions[0].aliases = ['共同别名'];
  ambiguous.factions.push({
    registry_key: 'registry:factions:0002',
    local_key: 'faction:other',
    name: '别院',
    aliases: ['共同别名'],
    types: ['门派'],
    description: null,
    source_refs: [sourceRef(2, '别院')]
  });
  ambiguous.characters[0].factions = ['共同别名'];
  const ambiguousResult = buildFinalData(ambiguous, manifest);
  assert.deepEqual(ambiguousResult.data[FINAL_FILES.characters][0].factions, []);
  assert.ok(ambiguousResult.issues.some(issue =>
    issue.code === 'REFERENCE_AMBIGUOUS' && issue.target === '共同别名'));
});

test('build emits exactly five byte-stable arrays with exact v7 fields', () => {
  const first = validV7MergedBook();
  const second = structuredClone(first);
  second.characters.reverse();
  second.skills.reverse();
  const left = buildFinalData(first, manifest);
  const right = buildFinalData(second, manifest);

  assert.equal(left.issues.length, 0);
  assert.deepEqual(Object.keys(left.data).sort(), Object.values(FINAL_FILES).sort());
  assert.ok(Object.values(left.data).every(Array.isArray));
  assert.equal(JSON.stringify(left.data), JSON.stringify(right.data));
  for (const [category, filename] of Object.entries(FINAL_FILES)) {
    for (const record of left.data[filename]) {
      assert.deepEqual(Object.keys(record), [...FINAL_FIELDS[category]]);
    }
  }
});

test('source refs reject unknown chapters but allow omitted line numbers', () => {
  const valid = buildFinalData(validV7MergedBook(), manifest);
  assert.equal(valid.issues.some(issue => issue.code === 'SOURCE_CHAPTER_UNKNOWN'), false);

  const invalid = validV7MergedBook();
  invalid.items[0].source_refs = [{ chapter: 99, text: '错误章节' }];
  assert.ok(buildFinalData(invalid, manifest).issues.some(issue => issue.code === 'SOURCE_CHAPTER_UNKNOWN'));
});

test('writeFinalData writes five YAML files and a source-independent ID plan', () => {
  const paths = finalPaths('game-kb-final-');
  const result = buildFinalData(validV7MergedBook(), manifest);

  writeFinalData(paths, result);

  assert.deepEqual(fs.readdirSync(paths.finalData).sort(), Object.values(FINAL_FILES).sort());
  for (const filename of Object.values(FINAL_FILES)) {
    assert.ok(Array.isArray(yaml.load(fs.readFileSync(path.join(paths.finalData, filename), 'utf8'))));
  }
  const plan = JSON.parse(fs.readFileSync(paths.finalIdPlan, 'utf8'));
  assert.equal(JSON.stringify(plan).includes('source_refs'), false);
  assert.equal(JSON.stringify(plan).includes('candidate_key'), false);
});

test('final publication rolls back data, ID plan, and report as one transaction', () => {
  const paths = finalPaths('game-kb-final-rollback-');
  const first = buildFinalData(validV7MergedBook(), manifest);
  first.assembly_report = { revision: 1 };
  writeFinalDataAtomic(paths, first);
  const before = {
    data: Object.fromEntries(fs.readdirSync(paths.finalData).map(file => [
      file, fs.readFileSync(path.join(paths.finalData, file), 'utf8')
    ])),
    idPlan: fs.readFileSync(paths.finalIdPlan, 'utf8'),
    report: fs.readFileSync(paths.assemblyReport, 'utf8')
  };

  const secondBook = validV7MergedBook();
  secondBook.characters[0].description = '新修订。';
  const second = buildFinalData(secondBook, manifest, first.id_plan);
  second.assembly_report = { revision: 2 };
  assert.throws(
    () => writeFinalDataAtomic(paths, second, { faultAt: 'after-new-promote' }),
    error => error.code === 'FINAL_PUBLICATION_FAULT_INJECTED'
  );

  assert.deepEqual(Object.fromEntries(fs.readdirSync(paths.finalData).map(file => [
    file, fs.readFileSync(path.join(paths.finalData, file), 'utf8')
  ])), before.data);
  assert.equal(fs.readFileSync(paths.finalIdPlan, 'utf8'), before.idPlan);
  assert.equal(fs.readFileSync(paths.assemblyReport, 'utf8'), before.report);
});
