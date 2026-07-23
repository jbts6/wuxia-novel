'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  assertProgressInvariant,
  createProgress,
  transitionProgress
} = require('../scripts/lib/chapter-progress');
const { issueNextWindow } = require('../scripts/lib/chapter-work');
const { pathsFor } = require('../scripts/lib/paths');

function manifestWithChapters(count) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-source-'));
  const chapters = [];
  for (let number = 1; number <= count; number += 1) {
    const file = path.join(root, `chapter_${String(number).padStart(3, '0')}.txt`);
    fs.writeFileSync(file, `第${number}章\n甲在此章现身。\n`, 'utf8');
    chapters.push({
      number,
      title: `第${number}章`,
      file,
      input_hash: `sha256:chapter-${number}`
    });
  }
  return { chapters };
}

function temporaryRunPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-work-'));
  const novel = path.join(root, 'novel');
  fs.mkdirSync(novel, { recursive: true });
  const paths = pathsFor(novel, 'run-test');
  fs.mkdirSync(paths.run, { recursive: true });
  return paths;
}

describe('chapter-progress', () => {
  it('initializes the complete v7 unit state', () => {
    const progress = createProgress(manifestWithChapters(3));
    assert.equal(progress.schema_version, 7);
    assert.equal(progress.semantic_contract_version, 7);
    assert.deepEqual(progress.active_units, []);
    assert.deepEqual(progress.units['chapter:001'], {
      status: 'pending',
      cycle: 0,
      attempt: 0,
      producer: null,
      input_hash: null,
      input_file: null,
      output_file: null,
      output_hash: null,
      reject_reason: null,
      repair_allowed: false,
      errors: []
    });
  });

  it('keeps the whole fixed window until every unit is accepted', () => {
    const paths = temporaryRunPaths();
    const manifest = manifestWithChapters(2);
    const issued = issueNextWindow({ paths, manifest, progress: createProgress(manifest) });
    let progress = transitionProgress(issued.progress, {
      type: 'accepted', unit: 'chapter:001', output_hash: 'sha256:one', manifest, paths
    });
    assert.deepEqual(progress.active_units, ['chapter:001', 'chapter:002']);
    progress = transitionProgress(progress, {
      type: 'accepted', unit: 'chapter:002', output_hash: 'sha256:two', manifest, paths
    });
    assert.deepEqual(progress.active_units, []);
  });

  it('rejects a later window while an earlier chapter is pending', () => {
    const manifest = manifestWithChapters(10);
    const progress = createProgress(manifest);
    progress.active_units = ['chapter:006'];
    progress.units['chapter:006'] = {
      status: 'active', cycle: 1, attempt: 1, producer: 'chapter-worker',
      input_hash: 'sha256:x', input_file: 'C:/outside/input.json',
      output_file: 'C:/outside/output.yaml', output_hash: null,
      reject_reason: null, repair_allowed: false, errors: []
    };
    assert.throws(
      () => assertProgressInvariant(progress, manifest),
      error => error.code === 'ACTIVE_WINDOW_INVALID'
    );
  });
});
