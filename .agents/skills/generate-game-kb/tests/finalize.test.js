'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { validCleanedBook } = require('./helpers');
const { buildFinalData } = require('../scripts/lib/finalize');
const { assignStableIds, makeBaseId } = require('../scripts/lib/ids');

const manifest = {
  chapters: [1, 2, 3].map(number => ({ number, title: `第${number}章`, input_hash: `sha256:${number}` }))
};

test('北冥神功 receives skill_bei_ming_shen_gong', () => {
  assert.equal(makeBaseId('skills', '北冥神功'), 'skill_bei_ming_shen_gong');
  assert.equal(makeBaseId('skills', '北冥神功'), makeBaseId('skills', '北冥神功'));
});

test('same-pinyin names receive stable alphabetic collision suffixes', () => {
  const records = {
    locations: [
      { local_key: 'location:陆路', canonical_name: '陆路' },
      { local_key: 'location:鹿路', canonical_name: '鹿路' }
    ]
  };
  const forward = assignStableIds(records).locations;
  const reverse = assignStableIds({ locations: [...records.locations].reverse() }).locations;
  const byName = values => Object.fromEntries(values.map(value => [value.canonical_name, value.id]));

  assert.deepEqual(byName(forward), byName(reverse));
  assert.notEqual(forward[0].id, forward[1].id);
  for (const record of forward) assert.match(record.id, /^loc_lu_lu_[a-p]{8}$/);
});

test('one projection rewrites all supported name links to stable IDs', () => {
  const book = validCleanedBook();
  book.characters[0].relationship_names = ['甲'];
  book.items[0].related_character_names = ['甲'];
  book.items[0].related_skill_names = ['玄门内功'];
  book.factions[0].leader_name = '甲';
  book.factions[0].location_name = '无名山谷';
  book.locations[0].faction_names = ['玄门'];
  const result = buildFinalData(book, manifest);

  assert.deepEqual(result.issues, []);
  const data = result.data;
  assert.deepEqual(data['characters.json'][0].known_skills, ['skill_xuan_men_nei_gong']);
  assert.deepEqual(data['characters.json'][0].relationships.map(value => value.target), ['char_jia']);
  assert.deepEqual(data['events.json'][0].participants, ['char_jia']);
  assert.deepEqual(data['events.json'][0].locations, ['loc_wu_ming_shan_gu']);
  assert.deepEqual(data['skills.json'][0].holders, ['char_jia']);
  assert.deepEqual(data['skills.json'][0].techniques, ['tech_fei_yun_zhang']);
  assert.equal(data['techniques.json'][0].source_skill, 'skill_xuan_men_nei_gong');
  assert.equal(data['dialogues.json'][0].event_id, 'event_shan_zhong_xiang_feng');
  assert.equal(data['dialogues.json'][0].speaker, 'char_jia');
  assert.deepEqual(data['chapter_summaries.json'][0].key_events, ['event_shan_zhong_xiang_feng']);
});

test('zero-match and multi-match links create structured issues', () => {
  const missing = validCleanedBook();
  missing.dialogues[0].speaker_name = '失踪者';
  assert.ok(buildFinalData(missing, manifest).issues.some(issue =>
    issue.code === 'REFERENCE_UNRESOLVED' && issue.path === 'dialogues[0].speaker_name'));

  const ambiguous = validCleanedBook();
  ambiguous.characters.push({
    ...ambiguous.characters[0],
    local_key: 'character:乙',
    canonical_name: '乙',
    aliases: ['甲']
  });
  assert.ok(buildFinalData(ambiguous, manifest).issues.some(issue =>
    issue.code === 'REFERENCE_AMBIGUOUS' && issue.target === '甲'));
});

test('build emits exactly nine arrays and is byte-stable across input ordering', () => {
  const first = validCleanedBook();
  const second = structuredClone(first);
  second.characters.reverse();
  second.events.reverse();
  const left = buildFinalData(first, manifest);
  const right = buildFinalData(second, manifest);

  assert.equal(left.issues.length, 0);
  assert.deepEqual(Object.keys(left.data).sort(), [
    'chapter_summaries.json', 'characters.json', 'dialogues.json', 'events.json', 'factions.json',
    'items.json', 'locations.json', 'skills.json', 'techniques.json'
  ]);
  assert.ok(Object.values(left.data).every(Array.isArray));
  assert.equal(JSON.stringify(left.data), JSON.stringify(right.data));
});

test('source refs reject unknown chapters but allow omitted line numbers', () => {
  const valid = buildFinalData(validCleanedBook(), manifest);
  assert.equal(valid.issues.some(issue => issue.code === 'SOURCE_CHAPTER_UNKNOWN'), false);

  const invalid = validCleanedBook();
  invalid.items[0].source_refs = [{ chapter: 99, text: '错误章节' }];
  assert.ok(buildFinalData(invalid, manifest).issues.some(issue => issue.code === 'SOURCE_CHAPTER_UNKNOWN'));
});
