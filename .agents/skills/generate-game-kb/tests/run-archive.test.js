'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const { archiveRun } = require('../scripts/lib/archive');
const { atomicWriteJson, readJson } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { createOrResumeRun } = require('../scripts/lib/run');
const { DOMAIN_UNITS } = require('../scripts/lib/semantic-contract');
const { readWorkPlan } = require('../scripts/lib/semantic-work');
const { derivePhaseDurations, recordScriptDuration } = require('../scripts/lib/timing');
const {
  makeNovel,
  runFlow,
  sourceRef,
  validChapterDraft,
  validDomainDraft
} = require('./helpers');

const PHASE_DURATION_KEYS = [
  'prepare_ms',
  'chapter_extraction_ms',
  'domain_distill_ms',
  'assemble_ms',
  'verify_ms',
  'install_ms',
  'archive_ms',
  'script_ms',
  'human_wait_ms',
  'total_ms'
];

function invoke(novel, runId, args, commands) {
  commands.push(args[0]);
  const [command, ...flags] = args;
  const result = runFlow([command, novel, '--run', runId, ...flags, '--json']);
  assert.equal(result.status, 0, `${args[0]}: ${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function writeDraft(paths, unit, value) {
  const file = path.join(
    paths.staging,
    `${unit.replaceAll(':', '_')}_attempt_01.yaml`
  );
  fs.writeFileSync(file, yaml.dump(value, { noRefs: true, lineWidth: -1 }), 'utf8');
  return file;
}

function sourceFile(novel) {
  const files = fs.readdirSync(novel).filter(name => name.endsWith('.txt'));
  assert.equal(files.length, 1, 'fixture requires exactly one source text');
  return path.join(novel, files[0]);
}

function alternateChapterDraft(chapter) {
  const evidenceText = fs.readFileSync(chapter.file, 'utf8')
    .split(/\r?\n/)
    .slice(1)
    .find(line => line.trim() !== '') || chapter.title;
  return validChapterDraft({
    chapter: chapter.number,
    title: chapter.title,
    source_hash: chapter.input_hash,
    characters: [{
      local_key: 'character:乙', name: '乙', level: '核心', rank: '初窥门径',
      source_refs: [sourceRef(chapter.number, evidenceText)]
    }],
    chapter_summary: {
      title: chapter.title,
      summary: `第${chapter.number}章乙出场。`,
      source_refs: [sourceRef(chapter.number, evidenceText)]
    }
  });
}

function runV4Lifecycle({ novel, runId, chapterDraft = null, install = true }) {
  const commands = [];
  const run = createOrResumeRun(novel, { runId, deep: true });
  const prepared = invoke(novel, run.run_id, ['prepare', '--deep'], commands);
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);

  for (const chapter of manifest.chapters) {
    const draft = chapterDraft
      ? chapterDraft(chapter)
      : validChapterDraft({
        chapter: chapter.number,
        title: chapter.title,
        source_hash: chapter.input_hash,
        chapter_summary: {
          title: chapter.title,
          summary: `第${chapter.number}章摘要。`,
          source_refs: [sourceRef(chapter.number, fs.readFileSync(chapter.file, 'utf8')
            .split(/\r?\n/).slice(1).find(line => line.trim() !== '') || chapter.title)]
        }
      });
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    invoke(novel, run.run_id, ['accept', '--unit', unit, '--draft', writeDraft(paths, unit, draft)], commands);
  }

  invoke(novel, run.run_id, ['plan-domains'], commands);
  const plan = readWorkPlan(paths, 'domain');
  assert.deepEqual(plan.inputs.map(input => input.unit), DOMAIN_UNITS);
  for (const input of plan.inputs) {
    invoke(novel, run.run_id, [
      'accept', '--unit', input.unit, '--draft', writeDraft(paths, input.unit, validDomainDraft(input))
    ], commands);
  }

  const assembled = invoke(novel, run.run_id, ['assemble'], commands);
  const verified = invoke(novel, run.run_id, ['verify'], commands);
  const installed = install ? invoke(novel, run.run_id, ['install'], commands) : null;
  return { assembled, commands, installed, manifest, novel, paths, runId: run.run_id, verified };
}

function installedV4Fixture(options = {}) {
  const novel = makeNovel(options.name || '归档验收书', options.source || '第一章 起始\n甲修习玄门内功并使出飞云掌。\n');
  return runV4Lifecycle({ novel, runId: options.runId || 'run-a', chapterDraft: options.chapterDraft });
}

function writeBaselineMetrics(paths) {
  fs.mkdirSync(path.dirname(paths.runMetrics), { recursive: true });
  fs.writeFileSync(paths.runMetrics, '{"baseline":true}\n', 'utf8');
}

function assertBytesEqual(file, expected) {
  assert.equal(fs.existsSync(file), expected !== null, file);
  if (expected !== null) assert.deepEqual(fs.readFileSync(file), expected, file);
}

test('archive-run moves the complete verified v4 run and keeps installed consumers', () => {
  const { commands, installed, novel, paths, runId } = installedV4Fixture();
  const installedMetadata = readJson(paths.runJson);
  const expectedVerificationReportHash = installedMetadata.verification_report_hash;
  const receipt = archiveRun(novel, runId);
  const archive = path.join(novel, '_archive', 'generate-game-kb', runId);

  assert.deepEqual(commands, [
    'prepare', 'accept', 'plan-domains',
    'accept', 'accept', 'accept', 'accept',
    'assemble', 'verify', 'install'
  ]);
  assert.equal(receipt.status, 'archived');
  assert.equal(receipt.run_id, runId);
  assert.match(receipt.artifact_manifest_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(receipt.verification_report_hash, expectedVerificationReportHash);
  assert.equal(receipt.final_data_hash, installed.final_data_hash);
  assert.equal(receipt.id_plan_hash, installedMetadata.id_plan_hash);
  assert.equal(receipt.migration_receipt_hash, null);
  assert.equal(
    readJson(path.join(archive, 'archive-receipt.json')).verification_report_hash,
    expectedVerificationReportHash
  );
  assert.equal(fs.existsSync(paths.run), false);
  assert.equal(fs.existsSync(path.join(archive, 'artifact-manifest.json')), true);
  assert.equal(fs.existsSync(path.join(novel, 'data', 'characters.yaml')), true);
  assert.equal(fs.existsSync(path.join(novel, 'reports', 'generate_game_kb_install.json')), true);
  assert.equal(readJson(path.join(archive, 'run.json')).final_data_hash, installed.final_data_hash);
  assert.equal(fs.existsSync(path.join(novel, '.game-kb-work')), false);

  const installedVerification = runFlow(['verify', novel, '--installed', '--json']);
  assert.equal(installedVerification.status, 0, installedVerification.stderr);
  assert.equal(JSON.parse(installedVerification.stdout).passed, true);
});

const WORKSPACE_VERIFICATION_ARCHIVE_DRIFT_CASES = [
  {
    name: 'not-passing',
    expectedCode: 'VERIFICATION_NOT_PASSED',
    mutate(report) {
      return { ...report, passed: false };
    }
  },
  {
    name: 'stale-source-with-same-final-hash',
    expectedCode: 'VERIFICATION_SOURCE_HASH_STALE',
    mutate(report) {
      return { ...report, source_hash: 'sha256:stale-source' };
    }
  }
];

const AUXILIARY_REPORT_DRIFT = {
  name: 'unrecorded-bytes-with-current-fields',
  expectedCode: 'VERIFICATION_REPORT_HASH_MISMATCH',
  mutate(report) {
    return { ...report, warnings: [...report.warnings, { code: 'UNRECORDED_REPORT_BYTES' }] };
  }
};

for (const drift of WORKSPACE_VERIFICATION_ARCHIVE_DRIFT_CASES) {
  test(`archive-run rejects ${drift.name} verification evidence without mutating or moving the run`, () => {
    const { novel, paths, runId } = installedV4Fixture({ runId: `run-verification-${drift.name}` });
    const verification = readJson(paths.verificationReport);
    const beforeRunJson = fs.readFileSync(paths.runJson);
    const beforeMetrics = fs.existsSync(paths.runMetrics) ? fs.readFileSync(paths.runMetrics) : null;
    const archive = path.join(novel, '_archive', 'generate-game-kb', runId);
    atomicWriteJson(paths.verificationReport, drift.mutate(verification));
    assert.equal(readJson(paths.verificationReport).final_data_hash, verification.final_data_hash);

    assert.throws(
      () => archiveRun(novel, runId),
      error => {
        assert.equal(error.code, 'ARCHIVE_WORKSPACE_FINAL_INVALID');
        assert.equal(error.details.blocking_errors.some(issue => issue.code === drift.expectedCode), true);
        return true;
      }
    );
    assert.equal(fs.existsSync(paths.run), true);
    assert.equal(fs.existsSync(archive), false);
    assertBytesEqual(paths.runJson, beforeRunJson);
    assertBytesEqual(paths.runMetrics, beforeMetrics);
    assert.equal(fs.existsSync(path.join(paths.run, 'archive-receipt.json')), false);
  });
}

test('archive-run records verification report byte drift as a warning', () => {
  const drift = AUXILIARY_REPORT_DRIFT;
  const { novel, paths, runId } = installedV4Fixture({ runId: `run-verification-${drift.name}` });
  const verification = readJson(paths.verificationReport);
  atomicWriteJson(paths.verificationReport, drift.mutate(verification));

  const receipt = archiveRun(novel, runId);

  assert.equal(fs.existsSync(paths.run), false);
  assert.equal(fs.existsSync(receipt.archive_dir), true);
  assert.equal(receipt.warnings.some(issue => issue.code === drift.expectedCode), true);
});

test('archive-run rejects a verified run that does not match installed identity', () => {
  const first = installedV4Fixture({ runId: 'run-a' });
  fs.appendFileSync(sourceFile(first.novel), '乙在后记中出现。\n');
  const second = runV4Lifecycle({
    novel: first.novel,
    runId: 'run-b',
    chapterDraft: alternateChapterDraft,
    install: false
  });
  const archive = path.join(second.novel, '_archive', 'generate-game-kb', second.runId);

  assert.notEqual(second.verified.final_data_hash, first.installed.final_data_hash);
  assert.notEqual(readJson(second.paths.runJson).source_hash, readJson(first.paths.runJson).source_hash);
  assert.throws(
    () => archiveRun(second.novel, second.runId),
    error => error.code === 'ARCHIVE_INSTALLED_IDENTITY_MISMATCH'
  );
  assert.equal(fs.existsSync(second.paths.run), true);
  assert.equal(fs.existsSync(archive), false);
});

const WORKSPACE_FINAL_ARCHIVE_DRIFT_CASES = [
  {
    name: 'changed',
    expectedCode: 'FINAL_DATA_HASH_MISMATCH',
    mutate(paths) {
      const file = path.join(paths.finalData, 'characters.yaml');
      const records = yaml.load(fs.readFileSync(file, 'utf8'));
      records[0].identity = 'workspace drift';
      fs.writeFileSync(file, yaml.dump(records, { noRefs: true, lineWidth: -1 }), 'utf8');
    }
  },
  {
    name: 'missing',
    expectedCode: 'FINAL_FILE_MISSING',
    mutate(paths) {
      fs.rmSync(path.join(paths.finalData, 'characters.yaml'));
    }
  },
  {
    name: 'extra',
    expectedCode: 'FINAL_FILE_SET_INVALID',
    mutate(paths) {
      fs.writeFileSync(path.join(paths.finalData, 'extra.yaml'), '[]\n', 'utf8');
    }
  }
];

for (const drift of WORKSPACE_FINAL_ARCHIVE_DRIFT_CASES) {
  test(`archive-run rejects ${drift.name} workspace final YAML without moving the live run`, () => {
    const { novel, paths, runId } = installedV4Fixture({ runId: `run-workspace-${drift.name}` });
    const beforeRunJson = fs.readFileSync(paths.runJson);
    const archive = path.join(novel, '_archive', 'generate-game-kb', runId);
    drift.mutate(paths);

    assert.throws(
      () => archiveRun(novel, runId),
      error => {
        assert.equal(error.code, 'ARCHIVE_WORKSPACE_FINAL_INVALID');
        assert.equal(error.details.blocking_errors.some(issue => issue.code === drift.expectedCode), true);
        return true;
      }
    );
    assert.equal(fs.existsSync(paths.run), true);
    assert.equal(fs.existsSync(archive), false);
    assert.deepEqual(fs.readFileSync(paths.runJson), beforeRunJson);
  });
}

for (const faultAt of ['after_move', 'after_archive_verification', 'after_receipt_write']) {
  test(`archive-run rolls back run metadata, metrics, and receipt on ${faultAt}`, () => {
    const { novel, paths, runId } = installedV4Fixture({ runId: `run-${faultAt}` });
    writeBaselineMetrics(paths);
    const beforeRunJson = fs.readFileSync(paths.runJson);
    const beforeMetrics = fs.readFileSync(paths.runMetrics);
    const archive = path.join(novel, '_archive', 'generate-game-kb', runId);

    assert.throws(
      () => archiveRun(novel, runId, { faultAt }),
      error => error.code === 'ARCHIVE_MOVE_FAILED'
    );

    assert.equal(fs.existsSync(paths.run), true);
    assert.equal(fs.existsSync(archive), false);
    assertBytesEqual(paths.runJson, beforeRunJson);
    assertBytesEqual(paths.runMetrics, beforeMetrics);
    assert.equal(fs.existsSync(path.join(paths.run, 'archive-receipt.json')), false);
  });
}

test('archive-run derives v4 phase durations from persisted unit timestamps', () => {
  const { novel, paths, runId } = installedV4Fixture();
  const metadata = readJson(paths.runJson);
  atomicWriteJson(paths.runJson, {
    ...metadata,
    started_at: '2026-01-01T00:00:00.000Z'
  });
  atomicWriteJson(paths.progress, {
    schema_version: 1,
    units: {
      'chapter:001': { status: 'done', attempts: 1, updated_at: '2026-01-01T00:10:00.000Z' },
      'distill:factions': { status: 'done', attempts: 1, updated_at: '2026-01-01T00:15:00.000Z' },
      'distill:characters': { status: 'done', attempts: 2, updated_at: '2026-01-01T00:20:00.000Z' },
      'distill:skills': { status: 'done', attempts: 1, updated_at: '2026-01-01T00:25:00.000Z' },
      'distill:items': { status: 'done', attempts: 2, updated_at: '2026-01-01T00:30:00.000Z' }
    },
    history: [],
    updated_at: '2026-01-01T00:30:00.000Z'
  });

  const receipt = archiveRun(novel, runId);
  const archived = readJson(path.join(receipt.archive_dir, 'run.json'));

  assert.deepEqual(Object.keys(archived.phase_durations).sort(), [...PHASE_DURATION_KEYS].sort());
  assert.equal(archived.phase_durations.chapter_extraction_ms, 10 * 60 * 1000);
  assert.equal(archived.phase_durations.domain_distill_ms, 20 * 60 * 1000);
  assert.ok(archived.phase_durations.assemble_ms > 0);
  assert.ok(archived.phase_durations.verify_ms > 0);
  assert.equal(archived.phase_durations.install_ms >= 0, true);
  assert.equal(archived.phase_durations.archive_ms >= 0, true);
});

test('missing v4 phases remain zero instead of receiving fabricated wall time', () => {
  const durations = derivePhaseDurations({
    started_at: '2026-01-01T00:00:00.000Z',
    phase_durations: { script_ms: 250, registry_ms: 500, stale_phase_ms: 750 }
  }, { units: {} }, '2026-01-01T00:01:00.000Z');

  assert.deepEqual(Object.keys(durations).sort(), [...PHASE_DURATION_KEYS].sort());
  assert.equal(durations.prepare_ms, 0);
  assert.equal(durations.chapter_extraction_ms, 0);
  assert.equal(durations.domain_distill_ms, 0);
  assert.equal(durations.assemble_ms, 0);
  assert.equal(durations.verify_ms, 0);
  assert.equal(durations.install_ms, 0);
  assert.equal(durations.archive_ms, 0);
  assert.equal(durations.total_ms, 60_000);
  assert.equal(durations.human_wait_ms, 59_750);
});

test('script timing attributes plan-domains, assemble, and verify to distinct v4 phases', () => {
  const novel = makeNovel('阶段归属书', '第一章 起始\n甲。\n');
  const run = createOrResumeRun(novel, { runId: 'run-phases', deep: true });
  const paths = pathsFor(novel, run.run_id);
  const metadata = readJson(paths.runJson);
  atomicWriteJson(paths.runJson, {
    ...metadata,
    phase_durations: { ...metadata.phase_durations, registry_ms: 40, stale_phase_ms: 50 }
  });

  recordScriptDuration(paths.runJson, 10, 'plan-domains');
  recordScriptDuration(paths.runJson, 20, 'assemble');
  recordScriptDuration(paths.runJson, 30, 'verify');
  const durations = readJson(paths.runJson).phase_durations;

  assert.deepEqual(Object.keys(durations).sort(), [...PHASE_DURATION_KEYS].sort());
  assert.equal(durations.domain_distill_ms, 10);
  assert.equal(durations.assemble_ms, 20);
  assert.equal(durations.verify_ms, 30);
  assert.equal(durations.script_ms, 60);
});

test('archive writes v4 AI workload and candidate metrics bound by receipt hash', () => {
  const { novel, paths, runId } = installedV4Fixture();
  atomicWriteJson(paths.progress, {
    schema_version: 1,
    units: {
      'chapter:001': { status: 'done', attempts: 1, updated_at: '2026-01-01T00:10:00.000Z' },
      'distill:factions': { status: 'done', attempts: 1, updated_at: '2026-01-01T00:15:00.000Z' },
      'distill:characters': { status: 'done', attempts: 2, updated_at: '2026-01-01T00:20:00.000Z' },
      'distill:skills': { status: 'done', attempts: 1, updated_at: '2026-01-01T00:21:00.000Z' },
      'distill:items': { status: 'done', attempts: 2, updated_at: '2026-01-01T00:25:00.000Z' }
    },
    history: []
  });

  const receipt = archiveRun(novel, runId);
  const metrics = readJson(path.join(receipt.archive_dir, 'reports', 'run-metrics.json'));

  assert.deepEqual(metrics.ai_units, {
    chapter: { planned: 1, done: 1, attempts: 1, corrections: 0 },
    domain: { planned: 4, done: 4, attempts: 6, corrections: 2 },
    total: { planned: 5, done: 5, attempts: 7, corrections: 2 }
  });
  assert.deepEqual(Object.keys(metrics.candidate_counts).sort(), [
    'chapter_candidates', 'final_records', 'registered_entries'
  ]);
  assert.equal(metrics.candidate_counts.final_records, 2);
  assert.match(receipt.metrics_hash, /^sha256:/);
});

test('archive-run CLI records its own script duration in the archived run', () => {
  const { novel, paths, runId } = installedV4Fixture();
  const beforeVerify = fs.readFileSync(paths.runJson);
  const preArchiveVerification = runFlow(['verify', novel, '--installed', '--json']);
  assert.equal(preArchiveVerification.status, 0, preArchiveVerification.stderr);
  assert.deepEqual(fs.readFileSync(paths.runJson), beforeVerify);

  const result = runFlow(['archive-run', novel, '--run', runId, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  const archived = readJson(path.join(receipt.archive_dir, 'run.json'));
  assert.ok(archived.phase_durations.script_ms > 0);
  assert.ok(archived.phase_durations.archive_ms > 0);

  const installed = runFlow(['verify', novel, '--installed', '--json']);
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(JSON.parse(installed.stdout).passed, true);
});
