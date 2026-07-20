'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  LEGACY_FILE_NAMES,
  loadExistingChapterInventory,
  loadLegacyFileSet,
  resolveLegacySource
} = require('../scripts/lib/legacy-source');

function temporaryNovel() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-source-'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function writeCompleteData(root, overrides = {}) {
  fs.mkdirSync(root, { recursive: true });
  for (const [category, filename] of Object.entries(LEGACY_FILE_NAMES)) {
    writeJson(path.join(root, filename), overrides[category] ?? (
      category === 'chapter_summaries'
        ? [{ chapter: 1, title: '第一章', summary: '摘要。' }]
        : [{ id: `${category}_one`, name: `${category}记录` }]
    ));
  }
}

function writeChapterInventory(root, chapters) {
  const chapterRoot = path.join(root, 'source', 'chapters');
  for (const chapter of chapters) {
    const file = path.join(chapterRoot, `ch_${String(chapter.number).padStart(3, '0')}.txt`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, chapter.text, 'utf8');
  }
}

test('falls back from incomplete active data to a complete retained run', () => {
  const novel = temporaryNovel();
  try {
    writeCompleteData(path.join(novel, 'data'), { chapter_summaries: undefined });
    fs.rmSync(path.join(novel, 'data', 'chapter_summaries.json'));
    const retained = path.join(novel, '.game-kb-work', 'runs', 'run-retained', 'final', 'data');
    writeCompleteData(retained);

    const plan = resolveLegacySource(novel);

    assert.equal(plan.kind, 'retained-run');
    assert.equal(plan.dataRoot, retained);
    assert.equal(plan.runId, 'run-retained');
    assert.equal(plan.rejections[0].code, 'LEGACY_SOURCE_INCOMPLETE');
    assert.equal(plan.rejections[0].kind, 'active-data');
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
  }
});

test('prefers complete active data and only uses one retained source', () => {
  const novel = temporaryNovel();
  try {
    writeCompleteData(path.join(novel, 'data'));
    writeCompleteData(path.join(novel, '.game-kb-work', 'runs', 'run-old', 'final', 'data'));
    writeCompleteData(path.join(novel, '.game-kb-work', 'runs', 'run-new', 'final', 'data'));
    writeCompleteData(path.join(novel, '_archive', 'generate-game-kb', 'run-archived', 'final', 'data'));

    const plan = resolveLegacySource(novel);

    assert.equal(plan.kind, 'active-data');
    assert.equal(plan.dataRoot, path.join(novel, 'data'));
    assert.equal(plan.candidates.filter(candidate => candidate.selected).length, 1);
    assert.deepEqual(loadLegacyFileSet(plan).chapter_summaries, [{
      chapter: 1,
      title: '第一章',
      summary: '摘要。'
    }]);
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
  }
});

test('chooses the newest complete retained run before falling back to archive', () => {
  const novel = temporaryNovel();
  try {
    writeCompleteData(path.join(novel, 'data'), { chapter_summaries: undefined });
    fs.rmSync(path.join(novel, 'data', 'chapter_summaries.json'));
    const oldRoot = path.join(novel, '.game-kb-work', 'runs', 'run-old', 'final', 'data');
    const newRoot = path.join(novel, '.game-kb-work', 'runs', 'run-new', 'final', 'data');
    writeCompleteData(oldRoot);
    writeCompleteData(newRoot);
    writeCompleteData(path.join(novel, '_archive', 'generate-game-kb', 'run-archived', 'final', 'data'));
    fs.utimesSync(oldRoot, 1, 1);
    fs.utimesSync(newRoot, 2, 2);

    const plan = resolveLegacySource(novel);

    assert.equal(plan.kind, 'retained-run');
    assert.equal(plan.runId, 'run-new');
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
  }
});

test('discovers chapter inventories inside the generic archive root used by legacy migration', () => {
  const novel = temporaryNovel();
  try {
    const root = path.join(
      novel,
      '_archive',
      'migration-legacy',
      '.game-kb-work',
      'runs',
      'run-old',
      'source',
      'chapters'
    );
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'ch_001.txt'), '第一章\n归档正文。\n', 'utf8');

    const inventory = loadExistingChapterInventory(novel);

    assert.equal(inventory.root, root);
    assert.deepEqual(inventory.chapters.map(chapter => chapter.number), [1]);
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
  }
});

test('discovers the retained top-level ch_split inventory without re-extracting the novel', () => {
  const novel = temporaryNovel();
  try {
    const root = path.join(novel, 'ch_split');
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'ch_001.txt'), '第一章\n现成章节切分。\n', 'utf8');

    const inventory = loadExistingChapterInventory(novel);

    assert.equal(inventory.root, root);
    assert.deepEqual(inventory.chapters.map(chapter => chapter.number), [1]);
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
  }
});

test('rejects complete retained finals that cannot bind the current chapter inventory', () => {
  const novel = temporaryNovel();
  try {
    writeCompleteData(path.join(novel, 'data'), { chapter_summaries: undefined });
    fs.rmSync(path.join(novel, 'data', 'chapter_summaries.json'));
    const runRoot = path.join(novel, '.game-kb-work', 'runs', 'run-retained');
    writeCompleteData(path.join(runRoot, 'final', 'data'));
    writeChapterInventory(runRoot, [
      { number: 1, text: '第一章\n' },
      { number: 2, text: '第二章\n' }
    ]);

    assert.throws(
      () => resolveLegacySource(novel),
      error => error.code === 'LEGACY_SOURCE_CHAPTER_BINDING_MISMATCH'
    );
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
  }
});

test('explicit source must stay within the novel and pass the same completeness check', () => {
  const novel = temporaryNovel();
  const outside = temporaryNovel();
  try {
    writeCompleteData(path.join(novel, 'custom-data'));
    assert.equal(resolveLegacySource(novel, {
      explicitDataRoot: path.join(novel, 'custom-data')
    }).kind, 'explicit');
    assert.throws(
      () => resolveLegacySource(novel, { explicitDataRoot: outside }),
      error => error.code === 'LEGACY_SOURCE_OUTSIDE_NOVEL'
    );
    fs.rmSync(path.join(novel, 'custom-data', 'items.json'));
    assert.throws(
      () => resolveLegacySource(novel, { explicitDataRoot: path.join(novel, 'custom-data') }),
      error => error.code === 'LEGACY_SOURCE_INCOMPLETE'
    );
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('reports malformed JSON with a stable source error code', () => {
  const novel = temporaryNovel();
  try {
    writeCompleteData(path.join(novel, 'data'));
    fs.writeFileSync(path.join(novel, 'data', 'skills.json'), '{broken\n', 'utf8');

    assert.throws(
      () => resolveLegacySource(novel),
      error => error.code === 'LEGACY_JSON_INVALID'
    );
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
  }
});

test('loads the bounded retained chapter inventory deterministically', () => {
  const novel = temporaryNovel();
  try {
    writeChapterInventory(path.join(novel, '.game-kb-work', 'runs', 'run-retained'), [
      { number: 1, text: '第一章\n阿飞拔剑。\n' },
      { number: 2, text: '第二章\n铁剑在手。\n' }
    ]);

    const inventory = loadExistingChapterInventory(novel);

    assert.deepEqual(inventory.chapters.map(chapter => chapter.number), [1, 2]);
    assert.match(inventory.chapters[0].hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(inventory.chapters[1].title, '第二章');
  } finally {
    fs.rmSync(novel, { recursive: true, force: true });
  }
});
