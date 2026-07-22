'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { assembleRun } = require('../scripts/lib/assemble');
const { FINAL_FIELDS, FINAL_FILES } = require('../scripts/lib/semantic-contract');

function sourceRef(chapter, text) {
  return { chapter, text };
}

function acceptedChapter(chapter, overrides = {}) {
  const evidence = sourceRef(chapter, `第${chapter}章证据。`);
  return {
    schema_version: 7,
    chapter,
    title: `第${chapter}章`,
    source_hash: `sha256:chapter-${chapter}`,
    characters: [{
      local_key: 'character:甲', name: '甲', aliases: [], identities: ['侠客'],
      level: '核心', rank: '初窥门径', description: '甲行走江湖。',
      factions: ['faction:玄门'], skills: ['skill:玄门内功'], source_refs: [evidence]
    }],
    skills: [{
      local_key: 'skill:玄门内功', name: '玄门内功', aliases: [],
      types: chapter === 1 ? ['内功'] : ['心法'], factions: ['faction:玄门'],
      rank: '初窥门径', description: '调息养气。',
      techniques: [{ name: '飞云掌', description: '掌势迅疾。' }], source_refs: [evidence]
    }],
    items: [{
      local_key: 'item:回生丹', name: '回生丹', aliases: [], types: ['丹药'],
      description: '用于救治重伤。', source_refs: [evidence]
    }],
    factions: [{
      local_key: 'faction:玄门', name: '玄门', aliases: [], types: ['门派'],
      description: '隐居山中。', source_refs: [evidence]
    }],
    chapter_summary: {
      summary: `第${chapter}章摘要。`,
      source_refs: [evidence]
    },
    normalizations: [],
    ...overrides
  };
}

function assemblyPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-assemble-v7-'));
  const paths = {
    manifest: path.join(root, 'manifest.json'),
    chapters: path.join(root, 'accepted', 'chapters'),
    finalData: path.join(root, 'final', 'data'),
    finalIdPlan: path.join(root, 'final', 'id_plan.json'),
    finalReports: path.join(root, 'final', 'reports'),
    reviewReport: path.join(root, 'final', 'reports', 'game-kb-review.json'),
    assemblyReport: path.join(root, 'final', 'reports', 'assembly-report.json'),
    manualReview: path.join(root, 'manual_review.json')
  };
  fs.mkdirSync(paths.chapters, { recursive: true });
  fs.writeFileSync(paths.manifest, `${JSON.stringify({
    source_hash: 'sha256:source',
    chapters: [1, 2].map(number => ({ number, title: `第${number}章` }))
  }, null, 2)}\n`, 'utf8');
  for (const chapter of [1, 2]) {
    fs.writeFileSync(
      path.join(paths.chapters, `chapter_${String(chapter).padStart(3, '0')}.yaml`),
      yaml.dump(acceptedChapter(chapter), { noRefs: true, lineWidth: -1 }),
      'utf8'
    );
  }
  return paths;
}

function finalBytes(dataRoot) {
  return Object.fromEntries(Object.values(FINAL_FILES).sort().map(filename => [
    filename, fs.readFileSync(path.join(dataRoot, filename), 'utf8')
  ]));
}

test('v7 assembly projects exactly five deterministic consumer YAML files', () => {
  const paths = assemblyPaths();
  assembleRun({ paths });

  assert.deepEqual(fs.readdirSync(paths.finalData).sort(), Object.values(FINAL_FILES).sort());
  const data = Object.fromEntries(Object.entries(FINAL_FILES).map(([category, filename]) => [
    category, yaml.load(fs.readFileSync(path.join(paths.finalData, filename), 'utf8'))
  ]));
  assert.equal(data.characters.length, 1);
  assert.equal(data.skills.length, 1);
  assert.deepEqual(data.characters[0].skills, ['skill_xuan_men_nei_gong']);
  assert.deepEqual(data.characters[0].factions, ['faction_xuan_men']);
  assert.deepEqual(data.skills[0].types, ['内功', '心法']);
  assert.deepEqual(data.items[0].types, ['丹药']);
  assert.deepEqual(data.factions[0].types, ['门派']);
  assert.deepEqual(data.chapter_summaries.map(summary => summary.chapter), [1, 2]);
  for (const [category, records] of Object.entries(data)) {
    for (const record of records) assert.deepEqual(Object.keys(record), [...FINAL_FIELDS[category]]);
  }
});

test('repeated v7 assembly is byte stable', () => {
  const paths = assemblyPaths();
  assembleRun({ paths });
  const before = finalBytes(paths.finalData);
  const planBefore = fs.readFileSync(paths.finalIdPlan, 'utf8');

  assembleRun({ paths });

  assert.deepEqual(finalBytes(paths.finalData), before);
  assert.equal(fs.readFileSync(paths.finalIdPlan, 'utf8'), planBefore);
});
