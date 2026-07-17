'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { makeNovelDirectory, readJson } = require('./helpers');
const {
  archiveExisting,
  assertCleanNovelRoot,
  buildArchivePlan
} = require('../scripts/lib/archive');

function writeTree(root, entries) {
  for (const [relative, content] of Object.entries(entries)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
}

function snapshotTree(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(directory, entry.name);
      const relative = path.relative(root, target);
      if (entry.isDirectory()) {
        rows.push({ path: relative, kind: 'directory' });
        visit(target);
      } else if (entry.isSymbolicLink()) {
        rows.push({ path: relative, kind: 'symlink', target: fs.readlinkSync(target) });
      } else {
        rows.push({
          path: relative,
          kind: 'file',
          hash: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')
        });
      }
    }
  }
  visit(root);
  return rows;
}

test('archive plan includes every non-source artifact and preserves relative paths', () => {
  const novel = makeNovelDirectory({
    '试书.txt': '第一章 起始\n正文。\n',
    'summary.md': 'old summary\n',
    'split-config.json': '{}\n',
    '.hidden': 'hidden\n'
  });
  writeTree(novel, {
    'ch_split/ch_001.txt': '第一章 起始\n正文。\n',
    'data/characters.json': '[]\n',
    'reports/quality.json': '{}\n',
    'build/source-index.json': '{}\n',
    'prompts/extract.md': 'old\n',
    'review/issues.json': '[]\n',
    '.game-kb-work/manifest.json': '{}\n',
    'other/nested/value.txt': 'keep in archive\n'
  });

  const plan = buildArchivePlan(novel, { archiveId: 'before-run-a' });

  assert.deepEqual(plan.retained.sort(), ['_archive', 'ch_split', '试书.txt']);
  for (const relative of [
    '.game-kb-work/manifest.json',
    '.hidden',
    'build/source-index.json',
    'data/characters.json',
    'other/nested/value.txt',
    'prompts/extract.md',
    'reports/quality.json',
    'review/issues.json',
    'split-config.json',
    'summary.md'
  ]) {
    const entry = plan.entries.find(candidate => candidate.relative_path === relative);
    assert.ok(entry, `missing archive entry: ${relative}`);
    assert.match(entry.sha256, /^sha256:[a-f0-9]{64}$/);
    assert.equal(entry.archive_path, path.join(plan.archive_dir, relative));
  }
});

test('archive writes a manifest and leaves only source, ch_split, and _archive', () => {
  const novel = makeNovelDirectory({
    '试书.txt': '第一章 起始\n正文。\n',
    'summary.md': 'old summary\n'
  });
  writeTree(novel, {
    'ch_split/ch_001.txt': '第一章 起始\n正文。\n',
    'data/characters.json': '[]\n',
    'reports/quality.json': '{}\n'
  });

  const receipt = archiveExisting(novel, { archiveId: 'before-run-a' });

  assert.equal(receipt.status, 'archived');
  assertCleanNovelRoot(novel);
  assert.deepEqual(fs.readdirSync(novel).sort(), ['_archive', 'ch_split', '试书.txt']);
  const manifest = readJson(path.join(receipt.archive_dir, 'archive-manifest.json'));
  assert.equal(manifest.status, 'archived');
  assert.ok(manifest.entries.some(entry => entry.relative_path === 'data/characters.json'));
  assert.equal(fs.readFileSync(path.join(receipt.archive_dir, 'summary.md'), 'utf8'), 'old summary\n');
});

test('archive rejects ambiguous source texts before moving anything', () => {
  const novel = makeNovelDirectory({
    '试书.txt': '正文。\n',
    '附录.txt': '附录。\n',
    'summary.md': 'old\n'
  });
  const before = snapshotTree(novel);

  assert.throws(() => buildArchivePlan(novel, { archiveId: 'ambiguous' }), error => error.code === 'SOURCE_AMBIGUOUS');
  assert.deepEqual(snapshotTree(novel), before);
});

test('archive rejects a symlink that resolves outside the novel root', () => {
  const novel = makeNovelDirectory({ '试书.txt': '正文。\n' });
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-outside-'));
  const secret = path.join(outside, 'secret.txt');
  fs.writeFileSync(secret, 'secret\n');
  fs.symlinkSync(outside, path.join(novel, 'external-link'), 'junction');

  assert.throws(
    () => buildArchivePlan(novel, { archiveId: 'symlink' }),
    error => error.code === 'ARCHIVE_SYMLINK_ESCAPE'
  );
  assert.equal(fs.readFileSync(secret, 'utf8'), 'secret\n');
});

test('archive rolls back prior moves after an injected mid-move failure', () => {
  const novel = makeNovelDirectory({
    '试书.txt': '正文。\n',
    'notes.md': 'notes\n',
    'summary.md': 'summary\n'
  });
  writeTree(novel, { 'data/characters.json': '[]\n' });
  const before = snapshotTree(novel);

  assert.throws(
    () => archiveExisting(novel, { archiveId: 'fault', failAfterMoves: 1 }),
    error => error.code === 'ARCHIVE_MOVE_FAILED'
  );

  assert.deepEqual(snapshotTree(novel), before);
  assert.equal(fs.existsSync(path.join(novel, '_archive', 'fault')), false);
});
