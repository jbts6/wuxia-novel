'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const {
  DATA_FILES,
  installVerifiedData,
  verifyInstalled
} = require('../scripts/lib/install');
const { pathsFor } = require('../scripts/lib/paths');
const { prepareAssembledRun, readJson, runFlow } = require('./helpers');

function pass(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function fileHash(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function installReceiptPath(novel) {
  return path.join(novel, 'reports', 'generate_game_kb_install.json');
}

test('install stages exactly five YAML files and archives the previous whole data directory', () => {
  const { novel, prepared } = prepareAssembledRun({
    name: '五文件安装试书',
    runId: 'run-install-v4'
  });
  const oldData = path.join(novel, 'data');
  fs.mkdirSync(oldData, { recursive: true });
  fs.writeFileSync(path.join(oldData, 'legacy.json'), '[{"old":true}]\n');

  const receipt = pass(runFlow(['install', novel, '--run', prepared.run_id, '--json']), 'install');
  assert.deepEqual(fs.readdirSync(oldData).sort(), [...DATA_FILES].sort());
  assert.equal(receipt.schema_version, 2);
  assert.equal(receipt.run_id, prepared.run_id);
  assert.equal(receipt.semantic_contract_version, readJson(pathsFor(novel, prepared.run_id).runJson).semantic_contract_version);
  assert.match(receipt.final_data_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(receipt.id_plan_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(receipt.migration_receipt_hash, null);
  assert.equal(typeof receipt.verification_report_hash, 'string');
  assert.deepEqual(
    receipt.data_file_hashes,
    Object.fromEntries(DATA_FILES.map(filename => [filename, fileHash(path.join(oldData, filename))]))
  );
  assert.equal(fs.existsSync(path.join(receipt.backup_path, 'legacy.json')), true);
  assert.equal(readJson(installReceiptPath(novel)).final_data_hash, receipt.final_data_hash);
  assert.equal(verifyInstalled(novel).passed, true);
});

test('installed verification rejects a receipt without the complete five-file hash map', () => {
  const fixture = prepareAssembledRun({ name: '安装文件哈希缺失试书', runId: 'run-install-file-hashes-missing' });
  pass(runFlow(['install', fixture.novel, '--run', fixture.prepared.run_id, '--json']), 'install file hashes');
  const receipt = readJson(installReceiptPath(fixture.novel));
  delete receipt.data_file_hashes;
  fs.writeFileSync(installReceiptPath(fixture.novel), `${JSON.stringify(receipt, null, 2)}\n`);

  const result = verifyInstalled(fixture.novel);
  assert.equal(result.passed, false);
  assert.equal(
    result.blocking_errors.some(error => error.code === 'INSTALL_DATA_FILE_HASHES_INVALID'),
    true
  );
});

test('installed verification rejects a receipt with a wrong data-file hash', () => {
  const fixture = prepareAssembledRun({ name: '安装文件哈希错误试书', runId: 'run-install-file-hash-wrong' });
  pass(runFlow(['install', fixture.novel, '--run', fixture.prepared.run_id, '--json']), 'install wrong file hash');
  const receipt = readJson(installReceiptPath(fixture.novel));
  receipt.data_file_hashes['characters.yaml'] = `sha256:${'0'.repeat(64)}`;
  fs.writeFileSync(installReceiptPath(fixture.novel), `${JSON.stringify(receipt, null, 2)}\n`);

  const result = verifyInstalled(fixture.novel);
  assert.equal(result.passed, false);
  assert.equal(
    result.blocking_errors.some(error => error.code === 'INSTALL_DATA_FILE_HASH_MISMATCH'),
    true
  );
});

test('installed verification detects byte-only drift in an installed YAML file', () => {
  const fixture = prepareAssembledRun({ name: '安装文件字节漂移试书', runId: 'run-install-file-byte-drift' });
  pass(runFlow(['install', fixture.novel, '--run', fixture.prepared.run_id, '--json']), 'install byte drift');
  fs.appendFileSync(path.join(fixture.novel, 'data', 'characters.yaml'), '\n');

  const result = verifyInstalled(fixture.novel);
  assert.equal(result.passed, false);
  assert.equal(
    result.blocking_errors.some(error => error.code === 'INSTALL_DATA_FILE_HASH_MISMATCH'),
    true
  );
});

test('installed verification binds ID plan and optional chapter migration evidence', () => {
  const idPlanFixture = prepareAssembledRun({ name: 'ID计划漂移试书', runId: 'run-id-plan-drift' });
  pass(runFlow(['install', idPlanFixture.novel, '--run', idPlanFixture.prepared.run_id, '--json']), 'install ID plan');
  const idPlan = readJson(idPlanFixture.paths.finalIdPlan);
  fs.writeFileSync(idPlanFixture.paths.finalIdPlan, `${JSON.stringify({ ...idPlan, tampered: true }, null, 2)}\n`);
  const idPlanResult = verifyInstalled(idPlanFixture.novel);
  assert.equal(idPlanResult.passed, false);
  assert.equal(idPlanResult.blocking_errors.some(error => error.code === 'INSTALL_ID_PLAN_HASH_MISMATCH'), true);

  const migrationFixture = prepareAssembledRun({ name: '迁移凭据漂移试书', runId: 'run-migration-drift' });
  fs.mkdirSync(path.dirname(migrationFixture.paths.chapterImportReceipt), { recursive: true });
  fs.writeFileSync(migrationFixture.paths.chapterImportReceipt, '{"schema_version":1,"operation":"import-chapters"}\n');
  const receipt = pass(runFlow([
    'install', migrationFixture.novel, '--run', migrationFixture.prepared.run_id, '--json'
  ]), 'install migration');
  const expectedMigrationHash = `sha256:${crypto.createHash('sha256')
    .update(fs.readFileSync(migrationFixture.paths.chapterImportReceipt)).digest('hex')}`;
  assert.equal(receipt.migration_receipt_hash, expectedMigrationHash);
  fs.appendFileSync(migrationFixture.paths.chapterImportReceipt, ' ');
  const migrationResult = verifyInstalled(migrationFixture.novel);
  assert.equal(migrationResult.passed, false);
  assert.equal(
    migrationResult.blocking_errors.some(error => error.code === 'INSTALL_MIGRATION_RECEIPT_HASH_MISMATCH'),
    true
  );
});

test('installed verification requires its receipt and detects data hash drift', () => {
  const missing = prepareAssembledRun({ name: '缺少安装凭据试书', runId: 'run-missing-receipt' });
  assert.equal(verifyInstalled(missing.novel).blocking_errors[0].code, 'INSTALL_RECEIPT_MISSING');

  const installed = prepareAssembledRun({ name: '安装哈希漂移试书', runId: 'run-installed-drift' });
  pass(runFlow(['install', installed.novel, '--run', installed.prepared.run_id, '--json']), 'install drift fixture');
  const charactersFile = path.join(installed.novel, 'data', 'characters.yaml');
  const characters = yaml.load(fs.readFileSync(charactersFile, 'utf8'));
  characters[0].description = '被安装后修改。';
  fs.writeFileSync(charactersFile, yaml.dump(characters, { noRefs: true, lineWidth: -1 }));
  const result = verifyInstalled(installed.novel);
  assert.equal(result.passed, false);
  assert.equal(result.blocking_errors.some(error => error.code === 'FINAL_DATA_HASH_MISMATCH'), true);
});

test('reinstalling the same verified five-file result is idempotent', () => {
  const fixture = prepareAssembledRun({ name: '幂等安装试书', runId: 'run-install-idempotent' });
  const first = pass(runFlow(['install', fixture.novel, '--run', fixture.prepared.run_id, '--json']), 'first install');
  const second = pass(runFlow(['install', fixture.novel, '--run', fixture.prepared.run_id, '--json']), 'second install');

  assert.equal(second.idempotent, true);
  assert.equal(second.final_data_hash, first.final_data_hash);
  assert.equal(second.backup_path, first.backup_path);
});

for (const faultAt of ['before-old-move', 'after-old-move']) {
  test(`install restores the previous whole data directory after ${faultAt}`, () => {
    const fixture = prepareAssembledRun({
      name: `安装回滚${faultAt}`,
      runId: `run-install-${faultAt}`
    });
    const data = path.join(fixture.novel, 'data');
    fs.mkdirSync(data, { recursive: true });
    fs.writeFileSync(path.join(data, 'legacy.json'), '[{"preserve":true}]\n');

    assert.throws(() => installVerifiedData(fixture.novel, {
      runId: fixture.prepared.run_id,
      faultAt
    }), error => error?.code === 'INSTALL_FAULT_INJECTED');
    assert.equal(fs.existsSync(path.join(data, 'legacy.json')), true);
    assert.deepEqual(fs.readdirSync(data), ['legacy.json']);
  });
}
