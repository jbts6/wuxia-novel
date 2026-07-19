'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { hashFinalData } = require('../scripts/lib/final-data-hash');
const { buildFinalData, writeFinalData } = require('../scripts/lib/finalize');
const { resolveNextAction } = require('../scripts/lib/next-action');
const { pathsFor } = require('../scripts/lib/paths');
const { freshProgress, freshUnit } = require('../scripts/lib/progress');
const { writeWorkPlan } = require('../scripts/lib/semantic-work');
const { sourceRef, validMergedBook } = require('./helpers');

const DOMAIN_UNITS = [
  'distill:factions',
  'distill:characters',
  'distill:skills',
  'distill:items'
];

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const CURRENT_NOVEL = path.resolve('C:/next-action-novel');
const CURRENT_RUN_ID = 'run-next-action';
const CURRENT_PATHS = pathsFor(CURRENT_NOVEL, CURRENT_RUN_ID);

function chapterStagingPaths(number) {
  const padded = String(number).padStart(3, '0');
  return [1, 2].map(attempt => path.join(
    CURRENT_PATHS.staging,
    `chapter_${padded}_attempt_${String(attempt).padStart(2, '0')}.yaml`
  ));
}

const CURRENT_MANIFEST = {
  source_hash: 'sha256:source',
  novel_dir: CURRENT_NOVEL,
  run_id: CURRENT_RUN_ID,
  chapters: [
    {
      number: 10,
      title: '第10章',
      file: '/source/ch_010.txt',
      input_hash: 'sha256:chapter-010',
      source_char_count: 1000,
      staging_paths: chapterStagingPaths(10)
    },
    {
      number: 2,
      title: '第2章',
      file: '/source/ch_002.txt',
      input_hash: 'sha256:chapter-002',
      source_char_count: 1000,
      staging_paths: chapterStagingPaths(2)
    }
  ]
};

function currentFinalData() {
  const book = validMergedBook();
  for (const category of ['characters', 'items', 'skills', 'factions']) {
    book[category] = book[category].map(record => ({
      ...record,
      source_refs: [sourceRef(2, '第二章原文锚点')]
    }));
  }
  book.chapter_summaries = CURRENT_MANIFEST.chapters.map(chapter => ({
    chapter: chapter.number,
    title: `第${chapter.number}章`,
    summary: `第${chapter.number}章摘要。`,
    source_refs: [sourceRef(chapter.number, `第${chapter.number}章原文锚点`)]
  }));
  const result = buildFinalData(book, CURRENT_MANIFEST);
  assert.deepEqual(result.issues, []);
  return result;
}

const CURRENT_FINAL_DATA = currentFinalData();
const CURRENT_FINAL_DATA_HASH = hashFinalData(CURRENT_FINAL_DATA.data);

function lifecycleInput({
  chapterStatuses = {},
  domainPlanned = false,
  domainStatuses = {},
  domainProgressOrder = DOMAIN_UNITS,
  domainPlanOrder = DOMAIN_UNITS,
  assembly = null,
  verification = null,
  installed = null
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-next-action-'));
  const paths = {
    run: root,
    staging: path.join(root, 'staging'),
    domainWork: path.join(root, 'work', 'domain'),
    finalData: path.join(root, 'final', 'data'),
    finalIdPlan: path.join(root, 'final', 'reports', 'id-plan.json'),
    assemblyReport: path.join(root, 'final', 'reports', 'assembly-report.json'),
    verificationReport: path.join(root, 'final', 'reports', 'verification-report.json')
  };
  const manifest = CURRENT_MANIFEST;
  writeFinalData(paths, CURRENT_FINAL_DATA);
  const progress = freshProgress();
  for (const chapter of manifest.chapters) {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    progress.units[unit] = {
      ...freshUnit(chapter.input_hash),
      status: chapterStatuses[chapter.number] || 'done'
    };
  }
  for (const unit of domainProgressOrder) {
    if (!domainPlanned) continue;
    progress.units[unit] = {
      ...freshUnit(`sha256:${unit}`),
      status: domainStatuses[unit] || 'done'
    };
  }
  if (domainPlanned) {
    const written = writeWorkPlan(paths, {
      stage: 'domain',
      source_hash: manifest.source_hash,
      inputs: domainPlanOrder.map(unit => ({ unit, input_hash: `sha256:${unit}` }))
    });
    const persistedPlan = JSON.parse(fs.readFileSync(written.plan, 'utf8'));
    assert.equal(Array.isArray(persistedPlan.units), true);
    assert.equal('inputs' in persistedPlan, false);
    assert.deepEqual(persistedPlan.units.map(({ unit, input_hash: inputHash }) => ({ unit, input_hash: inputHash })),
      domainPlanOrder.map(unit => ({ unit, input_hash: `sha256:${unit}` })));
  }
  if (assembly) writeJson(paths.assemblyReport, assembly);
  if (verification) writeJson(paths.verificationReport, verification);

  return { paths, manifest, progress, installed };
}

function assertAction(input, next_action, next_units = []) {
  assert.deepEqual(resolveNextAction(input), { next_action, next_units });
}

const CURRENT_ASSEMBLY = {
  source_hash: 'sha256:source',
  final_data_hash: CURRENT_FINAL_DATA_HASH
};

const CURRENT_VERIFICATION = {
  passed: true,
  source_hash: 'sha256:source',
  final_data_hash: CURRENT_FINAL_DATA_HASH
};

const CURRENT_INSTALL = {
  passed: true,
  source_hash: 'sha256:source',
  final_data_hash: CURRENT_FINAL_DATA_HASH,
  chapters: [
    { number: 10, input_hash: 'sha256:chapter-010' },
    { number: 2, input_hash: 'sha256:chapter-002' }
  ]
};

test('returns accept-chapters with numerically sorted unfinished chapters', () => {
  const input = lifecycleInput({
    chapterStatuses: { 2: 'pending', 10: 'pending' }
  });
  const result = resolveNextAction(input);
  assert.equal(result.next_action, 'accept-chapters');
  assert.deepEqual(result.next_units, ['chapter:002', 'chapter:010']);
  assert.equal(result.chapter_jobs.length, 2);
  assert.equal(result.chapter_jobs[0].batch_id, 'chapter-batch-002');
  assert.equal(result.chapter_jobs[0].chapters[0].unit, 'chapter:002');
  assert.deepEqual(result.chapter_jobs[0].worker_write_paths, []);
  assert.equal(result.chapter_jobs[1].batch_id, 'chapter-batch-010');
  assert.equal(result.chapter_jobs[1].chapters[0].unit, 'chapter:010');
  assert.deepEqual(result.chapter_jobs[1].worker_write_paths, []);
});

test('chapter jobs include only current unfinished units and ignore progress insertion order', () => {
  const chapters = [1, 2, 3, 4].map(number => ({
    number,
    title: `第${number}章`,
    file: `/source/ch_${String(number).padStart(3, '0')}.txt`,
    input_hash: `sha256:chapter-${number}`,
    source_char_count: 1000,
    staging_paths: chapterStagingPaths(number)
  }));
  const progress = freshProgress();
  for (const number of [4, 2, 1, 3]) {
    progress.units[`chapter:${String(number).padStart(3, '0')}`] = {
      ...freshUnit(`sha256:chapter-${number}`),
      status: number === 2 || number === 3 ? 'pending' : 'done'
    };
  }

  const result = resolveNextAction({
    paths: {},
    manifest: { ...CURRENT_MANIFEST, chapters },
    progress,
    installed: null
  });
  assert.deepEqual(result.next_units, ['chapter:002', 'chapter:003']);
  assert.deepEqual(result.chapter_jobs.map(job => job.chapters.map(chapter => chapter.unit)), [
    ['chapter:002', 'chapter:003']
  ]);
});

test('a failed chapter descriptor is rescheduled without completed siblings', () => {
  const input = lifecycleInput({ chapterStatuses: { 2: 'pending', 10: 'done' } });
  input.progress.units['chapter:002'].attempts = 1;
  const result = resolveNextAction(input);

  assert.deepEqual(result.next_units, ['chapter:002']);
  assert.deepEqual(result.chapter_jobs.map(job => job.chapters.map(chapter => chapter.unit)), [['chapter:002']]);
  assert.equal(result.chapter_jobs[0].chapters[0].attempt, 2);
  assert.equal(result.chapter_jobs[0].chapters[0].staging_path, chapterStagingPaths(2)[1]);
});

test('returns plan-domains only after all chapter accepts complete', () => {
  assertAction(lifecycleInput(), 'plan-domains');
});

test('returns accept-domains with canonical domain ordering', () => {
  assertAction(lifecycleInput({
    domainPlanned: true,
    domainProgressOrder: [
      'distill:items',
      'distill:skills',
      'distill:characters',
      'distill:factions'
    ],
    domainPlanOrder: [
      'distill:skills',
      'distill:items',
      'distill:factions',
      'distill:characters'
    ],
    domainStatuses: {
      'distill:factions': 'pending',
      'distill:characters': 'pending',
      'distill:skills': 'pending',
      'distill:items': 'pending'
    }
  }), 'accept-domains', DOMAIN_UNITS);
});

test('returns assemble after every accepted domain decision is current', () => {
  assertAction(lifecycleInput({ domainPlanned: true }), 'assemble');
});

test('returns verify after current assembly evidence exists', () => {
  assertAction(lifecycleInput({
    domainPlanned: true,
    assembly: CURRENT_ASSEMBLY
  }), 'verify');
});

test('returns install after current verification evidence exists', () => {
  assertAction(lifecycleInput({
    domainPlanned: true,
    assembly: CURRENT_ASSEMBLY,
    verification: CURRENT_VERIFICATION
  }), 'install');
});

test('returns archive-run only after the selected run is installed', () => {
  assertAction(lifecycleInput({
    domainPlanned: true,
    assembly: CURRENT_ASSEMBLY,
    verification: CURRENT_VERIFICATION,
    installed: CURRENT_INSTALL
  }), 'archive-run');
});

const WORKSPACE_FINAL_DRIFT_CASES = [
  {
    name: 'changed',
    mutate(paths) {
      const file = path.join(paths.finalData, 'characters.yaml');
      const records = yaml.load(fs.readFileSync(file, 'utf8'));
      records[0].identity = 'workspace drift';
      fs.writeFileSync(file, yaml.dump(records, { noRefs: true, lineWidth: -1 }), 'utf8');
    }
  },
  {
    name: 'missing',
    mutate(paths) {
      fs.rmSync(path.join(paths.finalData, 'characters.yaml'));
    }
  },
  {
    name: 'extra',
    mutate(paths) {
      fs.writeFileSync(path.join(paths.finalData, 'extra.yaml'), '[]\n', 'utf8');
    }
  }
];

for (const drift of WORKSPACE_FINAL_DRIFT_CASES) {
  test(`returns assemble when workspace final YAML is ${drift.name}`, () => {
    const input = lifecycleInput({
      domainPlanned: true,
      assembly: CURRENT_ASSEMBLY,
      verification: CURRENT_VERIFICATION,
      installed: CURRENT_INSTALL
    });
    drift.mutate(input.paths);
    assertAction(input, 'assemble');
  });
}

test('manual review takes precedence over every executable lifecycle action', () => {
  assertAction(lifecycleInput({
    chapterStatuses: { 2: 'manual_review', 10: 'pending' },
    domainPlanned: true,
    domainStatuses: { 'distill:items': 'manual_review' },
    assembly: CURRENT_ASSEMBLY,
    verification: CURRENT_VERIFICATION,
    installed: CURRENT_INSTALL
  }), 'manual-review', ['chapter:002', 'distill:items']);
});

test('stale assembly, verification, and installation evidence return to their owning gate', () => {
  assertAction(lifecycleInput({
    domainPlanned: true,
    assembly: { ...CURRENT_ASSEMBLY, source_hash: 'sha256:stale-source' }
  }), 'assemble');
  assertAction(lifecycleInput({
    domainPlanned: true,
    assembly: CURRENT_ASSEMBLY,
    verification: { ...CURRENT_VERIFICATION, final_data_hash: 'sha256:stale-data' }
  }), 'verify');
  assertAction(lifecycleInput({
    domainPlanned: true,
    assembly: CURRENT_ASSEMBLY,
    verification: CURRENT_VERIFICATION,
    installed: { ...CURRENT_INSTALL, source_hash: 'sha256:other-run' }
  }), 'install');
  assertAction(lifecycleInput({
    domainPlanned: true,
    assembly: CURRENT_ASSEMBLY,
    verification: CURRENT_VERIFICATION,
    installed: { ...CURRENT_INSTALL, final_data_hash: 'sha256:other-final-data' }
  }), 'install');
  assertAction(lifecycleInput({
    domainPlanned: true,
    assembly: CURRENT_ASSEMBLY,
    verification: CURRENT_VERIFICATION,
    installed: {
      ...CURRENT_INSTALL,
      chapters: [{ number: 2, input_hash: 'sha256:chapter-002' }]
    }
  }), 'install');
  assertAction(lifecycleInput({
    domainPlanned: true,
    assembly: CURRENT_ASSEMBLY,
    verification: CURRENT_VERIFICATION,
    installed: {
      ...CURRENT_INSTALL,
      chapters: [
        { number: 10, input_hash: 'sha256:chapter-010' },
        { number: 2 }
      ]
    }
  }), 'install');
  assertAction(lifecycleInput({
    domainPlanned: true,
    assembly: CURRENT_ASSEMBLY,
    verification: CURRENT_VERIFICATION,
    installed: {
      ...CURRENT_INSTALL,
      chapters: [
        { number: 10, input_hash: 'sha256:chapter-010' },
        { number: 2, input_hash: 'sha256:other-chapter' }
      ]
    }
  }), 'install');
});
