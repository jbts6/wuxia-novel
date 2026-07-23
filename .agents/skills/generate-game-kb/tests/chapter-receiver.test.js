'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');

const { createProgress } = require('../scripts/lib/chapter-progress');
const { issueNextWindow, issueRetryJob, advanceChapterWork } = require('../scripts/lib/chapter-work');
const { receiveAvailableChapterOutputs } = require('../scripts/lib/chapter-receiver');
const { initializeArtifactManifest, readArtifactManifest } = require('../scripts/lib/candidate-ledger');
const { atomicWriteJson, stableHash } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const {
  TIMING_CONTRACT_VERSION,
  appendTimingEvent,
  readTimingEvents
} = require('../scripts/lib/timing-events');
const { v7WorkerDraft } = require('./helpers');

const CHAPTER_TEXT = [
  '甲修习玄门内功并使出飞云掌。',
  '甲服下回生丹。',
  '玄门隐居山中。'
].join('\n') + '\n';

function manifestWithChapters(count, sourceRoot) {
  fs.mkdirSync(sourceRoot, { recursive: true });
  const chapters = [];
  for (let number = 1; number <= count; number += 1) {
    const file = path.join(sourceRoot, `chapter_${String(number).padStart(3, '0')}.txt`);
    fs.writeFileSync(file, CHAPTER_TEXT, 'utf8');
    chapters.push({
      number,
      title: `第${number}章`,
      file,
      input_hash: `sha256:ch${number}`
    });
  }
  return { chapters };
}

function prepareIssuedChapter({ chapterCount = 1 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-recv-'));
  const novel = path.join(root, 'novel');
  fs.mkdirSync(novel, { recursive: true });
  const paths = pathsFor(novel, 'run-recv');
  fs.mkdirSync(paths.run, { recursive: true });
  const startedAt = new Date(Date.now() - 1_000).toISOString();
  atomicWriteJson(paths.runJson, {
    run_id: paths.runId,
    timing_contract_version: TIMING_CONTRACT_VERSION,
    started_at: startedAt
  });
  appendTimingEvent(paths.events, { type: 'run_started' }, { occurredAt: startedAt });
  initializeArtifactManifest(paths);
  const manifest = manifestWithChapters(chapterCount, path.join(root, 'source'));
  const issued = issueNextWindow({ paths, manifest, progress: createProgress(manifest) });
  return { paths, manifest, progress: issued.progress, jobs: issued.jobs, job: issued.jobs[0] };
}

function writeYaml(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, yaml.dump(value, { noRefs: true, lineWidth: -1 }), 'utf8');
}

function replaceWorkerContractVersion(issued, version) {
  const input = JSON.parse(fs.readFileSync(issued.job.input_file, 'utf8'));
  input.worker_contract.version = version;
  fs.writeFileSync(issued.job.input_file, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
  issued.progress.units[issued.job.unit].input_hash = stableHash(input);
}

function draftPath(paths, attempt = 1) {
  return path.join(
    paths.drafts,
    'chapter_001',
    'cycle_01',
    `attempt_${String(attempt).padStart(2, '0')}.yaml`
  );
}

function errorPath(paths, attempt = 1) {
  return path.join(
    paths.revisions,
    'chapter_001',
    'cycle_01',
    `attempt_${String(attempt).padStart(2, '0')}.errors.json`
  );
}

describe('chapter-receiver', () => {
  it('rejects a stale worker contract before reading staging YAML', () => {
    const issued = prepareIssuedChapter();
    writeYaml(issued.job.output_file, v7WorkerDraft());
    replaceWorkerContractVersion(issued, 3);

    assert.throws(
      () => receiveAvailableChapterOutputs(issued),
      error => {
        assert.equal(error.code, 'WORKER_CONTRACT_STALE_RESTART_REQUIRED');
        assert.deepEqual(error.details, {
          run_id: 'run-recv',
          unit: 'chapter:001',
          actual_version: 3,
          expected_version: 4
        });
        return true;
      }
    );
    assert.equal(fs.existsSync(issued.job.output_file), true);
    assert.equal(fs.existsSync(draftPath(issued.paths)), false);
  });

  it('accepts an expected staging YAML without submit', () => {
    const issued = prepareIssuedChapter();
    writeYaml(issued.job.output_file, v7WorkerDraft());
    const raw = fs.readFileSync(issued.job.output_file, 'utf8');
    const result = receiveAvailableChapterOutputs(issued);

    assert.equal(result.received[0].status, 'accepted');
    assert.equal(fs.existsSync(issued.job.output_file), false);
    assert.equal(fs.readFileSync(draftPath(issued.paths), 'utf8'), raw);
    const acceptedFile = path.join(issued.paths.chapters, 'chapter_001.yaml');
    const accepted = yaml.load(fs.readFileSync(acceptedFile, 'utf8'));
    assert.equal(accepted.schema_version, 7);
    assert.equal(accepted.chapter, 1);
    assert.equal(accepted.characters[0].local_key, 'character:甲');
    assert.deepEqual(accepted.normalizations, []);
    const entry = readArtifactManifest(issued.paths).entries[0];
    assert.equal(entry.relative_path, 'accepted/chapters/chapter_001.yaml');
    assert.equal(entry.input_hash, result.received[0].output_hash);
    assert.equal(JSON.parse(fs.readFileSync(issued.paths.progress, 'utf8')).units['chapter:001'].status, 'accepted');
    assert.deepEqual(readTimingEvents(issued.paths.events).map(event => event.type), [
      'run_started',
      'window_issued',
      'attempt_issued',
      'attempt_observed',
      'attempt_accepted',
      'window_closed'
    ]);
  });

  it('accepts exact quotes with wrong worker line spans and derives accepted spans', () => {
    const issued = prepareIssuedChapter();
    const draft = v7WorkerDraft();
    for (const category of ['characters', 'skills', 'items', 'factions']) {
      for (const record of draft[category]) {
        for (const ref of record.source_refs) {
          ref.line_start = 1;
          ref.line_end = 1;
        }
      }
    }
    for (const ref of draft.chapter_summary.source_refs) {
      ref.line_start = 1;
      ref.line_end = 1;
    }
    writeYaml(issued.job.output_file, draft);

    const result = receiveAvailableChapterOutputs(issued);

    assert.equal(result.received[0].status, 'accepted');
    const accepted = yaml.load(fs.readFileSync(
      path.join(issued.paths.chapters, 'chapter_001.yaml'),
      'utf8'
    ));
    assert.deepEqual(accepted.items[0].source_refs[0], {
      chapter: 1,
      text: '甲服下回生丹。',
      line_start: 2,
      line_end: 2
    });
    assert.deepEqual(accepted.factions[0].source_refs[0], {
      chapter: 1,
      text: '玄门隐居山中。',
      line_start: 3,
      line_end: 3
    });
  });

  it('recovers unique source typography and records the accepted normalization', () => {
    const issued = prepareIssuedChapter();
    const draft = v7WorkerDraft();
    draft.items[0].source_refs[0].text = '甲服下回生丹.';
    writeYaml(issued.job.output_file, draft);

    const result = receiveAvailableChapterOutputs(issued);

    assert.equal(result.received[0].status, 'accepted');
    const accepted = yaml.load(fs.readFileSync(
      path.join(issued.paths.chapters, 'chapter_001.yaml'),
      'utf8'
    ));
    assert.deepEqual(accepted.items[0].source_refs[0], {
      chapter: 1,
      text: '甲服下回生丹。',
      line_start: 2,
      line_end: 2
    });
    assert.deepEqual(accepted.normalizations, [{
      field_path: '$.items[0].source_refs[0].text',
      original_value: '甲服下回生丹.',
      normalized_value: '甲服下回生丹。',
      normalization_rule: 'grounding.typography-fold.v1'
    }]);
  });

  it('skips units without output files without consuming an attempt', () => {
    const issued = prepareIssuedChapter();
    const result = receiveAvailableChapterOutputs(issued);
    assert.deepEqual(result.received, []);
    assert.equal(result.progress.units['chapter:001'].status, 'active');
    assert.equal(result.progress.units['chapter:001'].attempt, 1);
  });

  it('syntax-only failure creates an isolated main-agent repair job', () => {
    const issued = prepareIssuedChapter();
    const raw = '```yaml\ncharacters: []\n```\n';
    fs.writeFileSync(issued.job.output_file, raw, 'utf8');
    const received = receiveAvailableChapterOutputs(issued);
    assert.equal(received.received[0].repair_allowed, true);
    assert.equal(fs.readFileSync(draftPath(issued.paths), 'utf8'), raw);
    assert.ok(fs.existsSync(errorPath(issued.paths)));

    const retry = issueRetryJob({
      paths: issued.paths,
      manifest: issued.manifest,
      progress: received.progress,
      unit: 'chapter:001'
    });
    assert.equal(retry.job.producer, 'main-agent-repair');
    assert.deepEqual(readTimingEvents(issued.paths.events).slice(-3).map(event => event.type), [
      'attempt_observed', 'attempt_rejected', 'attempt_issued'
    ]);
    const input = JSON.parse(fs.readFileSync(retry.job.input_file, 'utf8'));
    assert.equal(Object.hasOwn(input, 'chapter_text'), false);
    assert.equal(input.rejected_draft, draftPath(issued.paths));
    assert.equal(fs.existsSync(input.rejected_draft), true);
    assert.deepEqual(input.allowed_repair_codes, ['YAML_CODE_FENCE']);
  });

  it('schema, taxonomy, and relationship failures require a chapter worker', () => {
    for (const mutate of [
      draft => { draft.items[0].type = '武器'; },
      draft => { draft.skills[0].types = ['magic']; },
      draft => { draft.characters[0].skills = ['无名心法']; }
    ]) {
      const issued = prepareIssuedChapter();
      const bad = v7WorkerDraft();
      mutate(bad);
      writeYaml(issued.job.output_file, bad);
      const received = receiveAvailableChapterOutputs(issued);
      assert.equal(received.received[0].status, 'rejected');
      assert.equal(received.received[0].repair_allowed, false);
      const retry = issueRetryJob({
        paths: issued.paths,
        manifest: issued.manifest,
        progress: received.progress,
        unit: 'chapter:001'
      });
      assert.equal(retry.job.producer, 'chapter-worker');
    }
  });

  it('rejects invalid rank and level before writing an accepted artifact', () => {
    const issued = prepareIssuedChapter();
    const bad = v7WorkerDraft();
    bad.characters[0].level = '主角';
    bad.characters[0].rank = '帮主';
    bad.skills[0].rank = '掌门绝学';
    writeYaml(issued.job.output_file, bad);

    const result = receiveAvailableChapterOutputs(issued);

    assert.equal(result.received[0].status, 'rejected');
    assert.equal(result.received[0].repair_allowed, false);
    assert.deepEqual(
      result.received[0].errors
        .filter(error => ['CHARACTER_LEVEL_INVALID', 'POWER_RANK_INVALID'].includes(error.code)),
      [
        { code: 'POWER_RANK_INVALID', path: 'characters[0].rank', target: '帮主' },
        { code: 'CHARACTER_LEVEL_INVALID', path: 'characters[0].level', target: '主角' },
        { code: 'POWER_RANK_INVALID', path: 'skills[0].rank', target: '掌门绝学' }
      ]
    );
    assert.equal(fs.existsSync(path.join(issued.paths.chapters, 'chapter_001.yaml')), false);
  });

  it('rejects evidence that is absent from the source chapter', () => {
    const issued = prepareIssuedChapter();
    const bad = v7WorkerDraft();
    bad.items[0].source_refs[0].text = '原文中不存在的证据。';
    writeYaml(issued.job.output_file, bad);
    const result = receiveAvailableChapterOutputs(issued);
    assert.equal(result.received[0].repair_allowed, false);
    assert.ok(result.received[0].errors.some(error => error.code === 'SOURCE_QUOTE_NOT_FOUND'));
  });

  it('records normalization audit for accepted aliases', () => {
    const issued = prepareIssuedChapter();
    const draft = v7WorkerDraft();
    draft.items[0].types = ['weapon', '暗器'];
    writeYaml(issued.job.output_file, draft);
    receiveAvailableChapterOutputs(issued);
    const accepted = yaml.load(fs.readFileSync(
      path.join(issued.paths.chapters, 'chapter_001.yaml'),
      'utf8'
    ));
    assert.deepEqual(accepted.items[0].types, ['武器', '暗器']);
    assert.deepEqual(accepted.normalizations, [{
      field_path: '$.items[0].types[0]',
      original_value: 'weapon',
      normalized_value: '武器',
      normalization_rule: 'items.weapon'
    }]);
  });

  it('rejects multiple YAML documents as a semantic retry', () => {
    const issued = prepareIssuedChapter();
    fs.writeFileSync(issued.job.output_file, 'characters: []\n---\nitems: []\n', 'utf8');
    const result = receiveAvailableChapterOutputs(issued);
    assert.equal(result.received[0].repair_allowed, false);
    assert.deepEqual(result.received[0].errors.map(error => error.code), ['YAML_MULTI_DOCUMENT']);
  });

  it('re-observes an archived attempt without changing progress or history', () => {
    const issued = prepareIssuedChapter();
    const raw = '```yaml\ncharacters: []\n```\n';
    fs.writeFileSync(issued.job.output_file, raw, 'utf8');
    const first = receiveAvailableChapterOutputs(issued);
    const before = fs.readFileSync(errorPath(issued.paths), 'utf8');
    const eventBytes = fs.readFileSync(issued.paths.events, 'utf8');
    fs.writeFileSync(issued.job.output_file, raw, 'utf8');
    const replay = receiveAvailableChapterOutputs({
      paths: issued.paths,
      manifest: issued.manifest,
      progress: first.progress
    });
    assert.deepEqual(replay.received, []);
    assert.deepEqual(replay.progress, first.progress);
    assert.equal(fs.existsSync(issued.job.output_file), false);
    assert.equal(fs.readFileSync(errorPath(issued.paths), 'utf8'), before);
    assert.equal(fs.readFileSync(issued.paths.events, 'utf8'), eventBytes);
  });

  it('attempt two failure stops the run in manual review', () => {
    const issued = prepareIssuedChapter();
    const bad = v7WorkerDraft();
    bad.characters[0].name = '';
    writeYaml(issued.job.output_file, bad);
    const first = receiveAvailableChapterOutputs(issued);
    const retry = issueRetryJob({
      paths: issued.paths,
      manifest: issued.manifest,
      progress: first.progress,
      unit: 'chapter:001'
    });
    writeYaml(retry.job.output_file, bad);
    const second = receiveAvailableChapterOutputs({
      paths: issued.paths,
      manifest: issued.manifest,
      progress: retry.progress
    });
    assert.equal(second.progress.units['chapter:001'].attempt, 2);
    const events = readTimingEvents(issued.paths.events);
    assert.equal(events.filter(event => event.type === 'attempt_issued').length, 2);
    assert.equal(events.filter(event => event.type === 'attempt_observed').length, 2);
    assert.equal(events.filter(event => event.type === 'attempt_rejected').length, 2);
    assert.equal(
      advanceChapterWork({
        paths: issued.paths,
        manifest: issued.manifest,
        progress: second.progress
      }).status,
      'manual_review'
    );
  });
});
