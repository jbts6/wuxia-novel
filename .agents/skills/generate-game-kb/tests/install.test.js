'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  DATA_FILES,
  PENDING_RECEIPT,
  installVerifiedData,
  recoverInterruptedInstall,
  verifyInstalled
} = require('../scripts/lib/install');
const { atomicWriteJson } = require('../scripts/lib/io');
const {
  makeNovel,
  parseJsonLine,
  prepareAssembledRun,
  runFlow
} = require('./helpers');

function fixture(name) {
  return prepareAssembledRun({ name, runId: 'run-install-test' });
}

function writeOldData(novel) {
  const data = path.join(novel, 'data');
  fs.mkdirSync(path.join(data, 'legacy'), { recursive: true });
  fs.writeFileSync(path.join(data, 'characters.json'), '[{"id":"old"}]\n', 'utf8');
  fs.writeFileSync(path.join(data, 'notes.txt'), '旧资料\n', 'utf8');
  fs.writeFileSync(path.join(data, 'legacy', 'meta.json'), '{"old":true}\n', 'utf8');
  return data;
}

function directoryDigest(root) {
  const rows = [];
  function walk(current, relative = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const childRelative = path.join(relative, entry.name);
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        rows.push(`dir:${childRelative}`);
        walk(child, childRelative);
      } else {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(child)).digest('hex');
        rows.push(`file:${childRelative}:${hash}`);
      }
    }
  }
  walk(root);
  return rows;
}

test('install refuses a blocking current verification failure', () => {
  const current = fixture('安装阻断试书');
  fs.writeFileSync(path.join(current.paths.finalData, 'characters.yaml'), '{}\n', 'utf8');

  assert.throws(
    () => installVerifiedData(current.novel, { runId: current.prepared.run_id }),
    error => error.code === 'INSTALL_VERIFICATION_FAILED'
      && error.details.blocking_errors.some(issue => issue.code === 'FINAL_FILE_NOT_ARRAY')
  );
  assert.equal(fs.existsSync(path.join(current.novel, 'data')), false);
});

test('install preserves unknown old entries in the whole-directory archive while live data stays exact', () => {
  const current = fixture('未知旧文件安装试书');
  writeOldData(current.novel);

  const receipt = installVerifiedData(current.novel, { runId: current.prepared.run_id });

  assert.deepEqual(fs.readdirSync(path.join(current.novel, 'data')).sort(), [...DATA_FILES].sort());
  assert.equal(fs.readFileSync(path.join(receipt.archive_data, 'notes.txt'), 'utf8'), '旧资料\n');
  assert.equal(fs.readFileSync(path.join(receipt.archive_data, 'legacy', 'meta.json'), 'utf8'), '{"old":true}\n');
});

test('interrupted install refuses an ambiguous dirty recovery state without changing it', () => {
  const novel = makeNovel('安装恢复试书', '第一章 起始\n正文。\n');
  const data = writeOldData(novel);
  const archiveData = path.join(novel, '_archive', 'pending-pre-generate-game-kb', 'data');
  fs.mkdirSync(archiveData, { recursive: true });
  fs.writeFileSync(path.join(archiveData, 'old.txt'), 'archive\n', 'utf8');
  const nextData = path.join(novel, 'data.next-generate-game-kb-pending');
  fs.mkdirSync(nextData, { recursive: true });
  const reports = path.join(novel, 'reports');
  fs.mkdirSync(reports, { recursive: true });
  atomicWriteJson(path.join(reports, PENDING_RECEIPT), {
    schema_version: 1,
    phase: 'old_moved',
    data_path: data,
    archive_root: path.dirname(archiveData),
    archive_data: archiveData,
    next_data: nextData,
    original_data_state: 'nonempty'
  });

  assert.throws(() => recoverInterruptedInstall(novel), { code: 'INSTALL_RECOVERY_AMBIGUOUS' });
  assert.equal(fs.existsSync(data), true);
  assert.equal(fs.existsSync(archiveData), true);
  assert.equal(fs.existsSync(nextData), true);
});

test('install removes a rebuild marker from live data and preserves it in the backup', () => {
  const current = fixture('重建标记安装试书');
  const data = writeOldData(current.novel);
  fs.writeFileSync(path.join(data, 'REBUILD_REQUIRED.md'), '旧知识库需要重建\n', 'utf8');

  const receipt = installVerifiedData(current.novel, { runId: current.prepared.run_id });

  assert.equal(fs.existsSync(path.join(current.novel, 'data', 'REBUILD_REQUIRED.md')), false);
  assert.equal(fs.existsSync(path.join(receipt.archive_data, 'REBUILD_REQUIRED.md')), true);
  assert.deepEqual(fs.readdirSync(path.join(current.novel, 'data')).sort(), [...DATA_FILES].sort());
});

test('install backs up the entire previous data directory byte for byte', () => {
  const current = fixture('全目录备份试书');
  const oldData = writeOldData(current.novel);
  const before = directoryDigest(oldData);

  const receipt = installVerifiedData(current.novel, { runId: current.prepared.run_id });

  assert.ok(receipt.archive_data);
  assert.deepEqual(directoryDigest(receipt.archive_data), before);
  assert.equal(fs.readFileSync(path.join(receipt.archive_data, 'characters.json'), 'utf8'), '[{"id":"old"}]\n');
});

for (const faultAt of ['before-old-move', 'after-old-move']) {
  test(`install restores the previous whole data directory after ${faultAt}`, () => {
    const current = fixture(`安装回滚${faultAt}`);
    const data = writeOldData(current.novel);
    const before = directoryDigest(data);

    assert.throws(
      () => installVerifiedData(current.novel, {
        runId: current.prepared.run_id,
        faultAt
      }),
      { code: 'INSTALL_FAULT_INJECTED' }
    );

    assert.deepEqual(directoryDigest(data), before);
    assert.equal(fs.existsSync(path.join(current.novel, 'reports', 'generate_game_kb_install.json')), false);
    assert.equal(fs.readdirSync(current.novel).some(name => name.startsWith('data.next-generate-game-kb-')), false);
  });
}

test('reinstalling the same verified five-file result is idempotent', () => {
  const current = fixture('幂等安装试书');
  writeOldData(current.novel);
  const first = installVerifiedData(current.novel, { runId: current.prepared.run_id });
  const receiptFile = path.join(current.novel, 'reports', 'generate_game_kb_install.json');
  const receiptBefore = fs.readFileSync(receiptFile, 'utf8');
  const archivesBefore = fs.readdirSync(path.join(current.novel, '_archive')).sort();

  const second = installVerifiedData(current.novel, { runId: current.prepared.run_id });

  assert.equal(second.idempotent, true);
  assert.equal(second.installed_at, first.installed_at);
  assert.equal(fs.readFileSync(receiptFile, 'utf8'), receiptBefore);
  assert.deepEqual(fs.readdirSync(path.join(current.novel, '_archive')).sort(), archivesBefore);
});

test('verify --installed never falls back to complete workspace final artifacts', () => {
  const current = fixture('仅安装验证试书');
  const installed = runFlow(['install', current.novel, '--run', current.prepared.run_id, '--json']);
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(verifyInstalled(current.novel).passed, true);

  fs.rmSync(path.join(current.novel, 'data', 'characters.yaml'));
  assert.equal(fs.existsSync(path.join(current.paths.finalData, 'characters.yaml')), true);

  const result = verifyInstalled(current.novel);
  assert.equal(result.passed, false);
  assert.ok(result.blocking_errors.some(issue => issue.code === 'FINAL_FILE_MISSING'));
  const cli = runFlow(['verify', current.novel, '--installed', '--json']);
  assert.notEqual(cli.status, 0);
  assert.equal(parseJsonLine(cli.stderr).code, 'INSTALLED_VERIFICATION_FAILED');
});
