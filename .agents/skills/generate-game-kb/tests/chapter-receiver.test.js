'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');

const { createProgress, transitionProgress } = require('../scripts/lib/chapter-progress');
const { issueNextWindow, issueRetryJob } = require('../scripts/lib/chapter-work');
const { receiveAvailableChapterOutputs } = require('../scripts/lib/chapter-receiver');
const { pathsFor } = require('../scripts/lib/paths');
const { v7WorkerDraft } = require('./helpers');

function manifestWithChapters(count) {
  const chapters = [];
  for (let i = 1; i <= count; i++) {
    chapters.push({
      number: i,
      title: `第${i}章`,
      file: `/tmp/novel/ch${String(i).padStart(3, '0')}.txt`,
      input_hash: `sha256:ch${i}`
    });
  }
  return { chapters };
}

function prepareIssuedChapter({ chapterCount = 1 } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-recv-'));
  const novel = path.join(tmp, 'novel');
  fs.mkdirSync(novel, { recursive: true });
  const paths = pathsFor(novel, 'run-recv');
  fs.mkdirSync(paths.run, { recursive: true });
  const manifest = manifestWithChapters(chapterCount);
  let progress = createProgress(manifest);
  const issued = issueNextWindow({ paths, manifest, progress });
  progress = issued.progress;
  return { paths, manifest, progress, jobs: issued.jobs, job: issued.jobs[0] };
}

function writeYaml(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, yaml.dump(value, { noRefs: true, lineWidth: -1 }), 'utf8');
}

describe('chapter-receiver', () => {
  it('accepts an expected staging YAML without submit', () => {
    const issued = prepareIssuedChapter({ chapterCount: 1 });
    writeYaml(issued.job.output, v7WorkerDraft());
    const result = receiveAvailableChapterOutputs(issued);
    assert.equal(result.received[0].status, 'accepted');
    assert.equal(fs.existsSync(issued.job.output), false);
    assert.equal(fs.existsSync(path.join(issued.paths.chapters, 'chapter_001.yaml')), true);
    const accepted = yaml.load(fs.readFileSync(path.join(issued.paths.chapters, 'chapter_001.yaml'), 'utf8'));
    assert.equal(accepted.schema_version, 7);
    assert.equal(accepted.chapter, 1);
    assert.equal(accepted.characters[0].local_key, 'character:甲');
  });

  it('skips units without output files', () => {
    const issued = prepareIssuedChapter({ chapterCount: 1 });
    const result = receiveAvailableChapterOutputs(issued);
    assert.deepEqual(result.received, []);
    assert.equal(result.progress.units['chapter:001'].status, 'active');
  });

  it('syntax-only failure sets repair_allowed and consumes attempt', () => {
    const issued = prepareIssuedChapter({ chapterCount: 1 });
    fs.mkdirSync(path.dirname(issued.job.output), { recursive: true });
    fs.writeFileSync(issued.job.output, '```yaml\ncharacters: []\n```\n');
    const result = receiveAvailableChapterOutputs(issued);
    assert.equal(result.received[0].status, 'rejected');
    assert.equal(result.received[0].repair_allowed, true);
    assert.equal(result.progress.units['chapter:001'].status, 'rejected');
  });

  it('validation failure rejects without repair_allowed', () => {
    const issued = prepareIssuedChapter({ chapterCount: 1 });
    const bad = v7WorkerDraft();
    bad.items[0].type = '武器';
    writeYaml(issued.job.output, bad);
    const result = receiveAvailableChapterOutputs(issued);
    assert.equal(result.received[0].status, 'rejected');
    assert.equal(result.received[0].repair_allowed, false);
  });

  it('archives failure with error report', () => {
    const issued = prepareIssuedChapter({ chapterCount: 1 });
    const bad = v7WorkerDraft();
    bad.skills[0].types = ['magic'];
    writeYaml(issued.job.output, bad);
    receiveAvailableChapterOutputs(issued);
    const errorFile = path.join(issued.paths.revisions, 'chapter_001', 'cycle_01', 'attempt_01.errors.json');
    assert.ok(fs.existsSync(errorFile));
    const report = JSON.parse(fs.readFileSync(errorFile, 'utf8'));
    assert.ok(report.errors.some(e => e.code === 'TYPE_VALUE_UNKNOWN'));
  });

  it('moves raw draft to drafts on acceptance', () => {
    const issued = prepareIssuedChapter({ chapterCount: 1 });
    writeYaml(issued.job.output, v7WorkerDraft());
    receiveAvailableChapterOutputs(issued);
    const draftFile = path.join(issued.paths.drafts, 'chapter_001', 'cycle_01', 'attempt_01.yaml');
    assert.ok(fs.existsSync(draftFile));
  });

  it('attempt 2 failure leads to manual_review via advanceChapterWork', () => {
    const issued = prepareIssuedChapter({ chapterCount: 1 });
    const bad = v7WorkerDraft();
    bad.characters[0].name = '';
    writeYaml(issued.job.output, bad);
    const first = receiveAvailableChapterOutputs(issued);
    assert.equal(first.received[0].status, 'rejected');

    const retry = issueRetryJob({ paths: issued.paths, manifest: issued.manifest, progress: first.progress, unit: 'chapter:001' });
    writeYaml(retry.job.output, bad);
    const second = receiveAvailableChapterOutputs({ paths: issued.paths, manifest: issued.manifest, progress: retry.progress });
    assert.equal(second.received[0].status, 'rejected');
    assert.equal(second.progress.units['chapter:001'].attempt, 2);
  });
});
