'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { sourceRef, validMergedBook } = require('./helpers');
const { buildFinalData, writeFinalData, writeFinalDataAtomic } = require('../scripts/lib/finalize');
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

test('persisted identity anchors keep IDs stable across rename, reorder, and collision removal', () => {
  const initial = assignStableIds({ characters: [
    { registry_key: 'registry:characters:a', local_key: 'character:a', name: '同名', aliases: [], source_refs: [sourceRef(1, '甲')] },
    { registry_key: 'registry:characters:b', local_key: 'character:b', name: '同名', aliases: [], source_refs: [sourceRef(2, '乙')] }
  ] });
  const prior = { characters: initial.characters.map(record => ({
    identity_anchor: record.identity_anchor,
    disambiguator: record.disambiguator,
    id: record.id,
    registry_key: record.registry_key,
    canonical_name: record.name,
    aliases: record.aliases
  })) };
  const revised = assignStableIds({ characters: [
    { registry_key: 'registry:characters:a', local_key: 'character:a', name: '真名', aliases: ['同名'], source_refs: [sourceRef(1, '甲')] }
  ] }, prior);
  assert.equal(revised.characters[0].id, initial.characters.find(row => row.registry_key.endsWith(':a')).id);
  assert.match(revised.characters[0].disambiguator, /^[a-p]{8}$/);
});

test('distinct same-name registry entries sharing evidence receive different stable IDs', () => {
  const records = { characters: [
    { registry_key: 'registry:characters:a', local_key: 'character:a', name: '同名', aliases: [], source_refs: [sourceRef(1, '同一句证据')] },
    { registry_key: 'registry:characters:b', local_key: 'character:b', name: '同名', aliases: [], source_refs: [sourceRef(1, '同一句证据')] }
  ] };
  const initial = assignStableIds(records).characters;
  const reordered = assignStableIds({ characters: [...records.characters].reverse() }).characters;
  const byRegistry = values => Object.fromEntries(values.map(value => [value.registry_key, value.id]));

  assert.equal(new Set(initial.map(record => record.id)).size, 2);
  assert.deepEqual(byRegistry(reordered), byRegistry(initial));
  for (const record of initial) assert.match(record.id, /^char_tong_ming_[a-p]{8}$/);
});

test('controller rejects model-authored or numeric disambiguators', () => {
  assert.throws(
    () => assignStableIds({ characters: [{ local_key: 'character:a', name: '甲', disambiguator: '1' }] }),
    error => error.code === 'ID_DISAMBIGUATOR_FORBIDDEN'
  );
});

test('one projection rewrites character and skill references to stable IDs', () => {
  const result = buildFinalData(validMergedBook(), manifest);

  assert.deepEqual(result.issues, []);
  const character = result.data[FINAL_FILES.characters][0];
  const skill = result.data[FINAL_FILES.skills][0];
  assert.deepEqual(character.skills, ['skill_xuan_men_nei_gong']);
  assert.deepEqual(character.factions, ['faction_xuan_men']);
  assert.deepEqual(skill.factions, ['faction_xuan_men']);
  assert.deepEqual(skill.techniques, [{ name: '飞云掌', description: '掌势迅疾。' }]);
});

test('final reference projection preserves first-confirmed order while deduplicating', () => {
  const book = validMergedBook();
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

test('non-empty unresolved or display-name links are omitted with blocking issues', () => {
  const missing = validMergedBook();
  missing.characters[0].skills = ['registry:skills:missing'];
  const missingResult = buildFinalData(missing, manifest);
  assert.deepEqual(missingResult.data[FINAL_FILES.characters][0].skills, []);
  assert.ok(missingResult.issues.some(issue =>
    issue.code === 'REFERENCE_UNRESOLVED' && issue.target === 'registry:skills:missing'));

  const displayName = validMergedBook();
  displayName.characters[0].factions = ['玄门'];
  const displayNameResult = buildFinalData(displayName, manifest);
  assert.deepEqual(displayNameResult.data[FINAL_FILES.characters][0].factions, []);
  assert.ok(displayNameResult.issues.some(issue =>
    issue.code === 'REFERENCE_UNRESOLVED' && issue.target === '玄门'));
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
  const finalRoot = path.join(root, 'final');
  const paths = {
    finalRoot,
    finalData: path.join(finalRoot, 'data'),
    finalIdPlan: path.join(finalRoot, 'id_plan.json'),
    finalReports: path.join(finalRoot, 'reports'),
    assemblyReport: path.join(finalRoot, 'reports', 'assembly-report.json')
  };
  const result = buildFinalData(validMergedBook(), manifest);

  writeFinalData(paths, result);

  assert.deepEqual(fs.readdirSync(paths.finalData).sort(), Object.values(FINAL_FILES).sort());
  for (const filename of Object.values(FINAL_FILES)) {
    assert.ok(Array.isArray(yaml.load(fs.readFileSync(path.join(paths.finalData, filename), 'utf8'))));
  }
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(paths.finalIdPlan, 'utf8')));
});

test('final publication rolls back data, ID plan, and report as one transaction', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-final-rollback-'));
  const finalRoot = path.join(root, 'final');
  const paths = {
    finalRoot,
    finalData: path.join(finalRoot, 'data'),
    finalIdPlan: path.join(finalRoot, 'id_plan.json'),
    finalReports: path.join(finalRoot, 'reports'),
    assemblyReport: path.join(finalRoot, 'reports', 'assembly-report.json')
  };
  const first = buildFinalData(validMergedBook(), manifest);
  first.assembly_report = { revision: 1 };
  writeFinalDataAtomic(paths, first);
  const before = {
    data: Object.fromEntries(fs.readdirSync(paths.finalData).map(file => [
      file, fs.readFileSync(path.join(paths.finalData, file), 'utf8')
    ])),
    idPlan: fs.readFileSync(paths.finalIdPlan, 'utf8'),
    report: fs.readFileSync(paths.assemblyReport, 'utf8')
  };

  const secondBook = validMergedBook();
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
