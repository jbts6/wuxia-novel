'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { assembleRun } = require('../scripts/lib/assemble');
const { stableHash } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { hashReport, validateReviewReport } = require('../scripts/lib/review-report');

function sourceRef(text) {
  return { chapter: 1, text };
}

function fixture() {
  const novel = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-assembly-reports-'));
  const paths = pathsFor(novel, 'run-report');
  fs.mkdirSync(paths.chapters, { recursive: true });
  fs.writeFileSync(paths.manifest, `${JSON.stringify({
    source_hash: 'sha256:source',
    chapters: [{ number: 1, title: '第一章', input_hash: 'sha256:chapter-1' }]
  }, null, 2)}\n`, 'utf8');
  const chapter = {
    schema_version: 7,
    chapter: 1,
    title: '第一章',
    source_hash: 'sha256:chapter-1',
    characters: [
      {
        local_key: 'character:店小二', name: '店小二', aliases: [], identities: [], level: '龙套',
        rank: null, description: '店小二端来酒菜。', factions: [], skills: [],
        source_refs: [sourceRef('店小二端来酒菜。')]
      },
      {
        local_key: 'character:甲', name: '甲', aliases: [], identities: ['侠客'], level: '核心',
        rank: '初窥门径', description: '甲行走江湖。', factions: [], skills: [],
        source_refs: [sourceRef('甲行走江湖。')]
      }
    ],
    skills: [],
    items: [{
      local_key: 'item:飞刀', name: '飞刀', aliases: [], types: ['武器'], description: '一柄飞刀。',
      source_refs: [sourceRef('甲取出一柄飞刀。')]
    }],
    factions: [],
    chapter_summary: { summary: '甲在客栈现身。', source_refs: [sourceRef('甲行走江湖。')] },
    normalizations: [{
      field_path: '$.items[0].types[0]', original_value: 'weapon',
      normalized_value: '武器', normalization_rule: 'items.weapon'
    }]
  };
  fs.writeFileSync(
    path.join(paths.chapters, 'chapter_001.yaml'),
    yaml.dump(chapter, { noRefs: true, lineWidth: -1 }),
    'utf8'
  );
  return paths;
}

test('one deterministic assembly binds full audit and warning-only review report', () => {
  const paths = fixture();
  assembleRun({ paths });
  const assembly = JSON.parse(fs.readFileSync(paths.assemblyReport, 'utf8'));
  const review = JSON.parse(fs.readFileSync(paths.reviewReport, 'utf8'));

  assert.deepEqual(validateReviewReport(review), []);
  assert.equal(review.entries.length, 1);
  assert.equal(review.entries[0].code, 'GENERIC_CANDIDATE_FILTERED');
  assert.equal(Object.hasOwn(review.summary, 'info_count'), false);
  assert.equal(assembly.review_report_hash, hashReport(review));
  assert.equal(assembly.deterministic_audit_hash, stableHash(assembly.deterministic_audit));
  assert.deepEqual(
    Object.keys(assembly.deterministic_audit.type_normalizations[0]),
    [
      'category', 'canonical_name', 'member_ref', 'source_ref', 'field_path',
      'original_value', 'normalized_value', 'normalization_rule'
    ]
  );
  assert.ok(assembly.deterministic_audit.field_decisions.every(row => row.source_refs.length > 0));
});
