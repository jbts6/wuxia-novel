'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const {
  DATA_FILES,
  installVerifiedData,
  verifyInstalled
} = require('../scripts/lib/install');
const { prepareAssembledRun, readJson, runFlow } = require('./helpers');

function pass(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
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
  assert.equal(typeof receipt.verification_report_hash, 'string');
  assert.equal(fs.existsSync(path.join(receipt.backup_path, 'legacy.json')), true);
  assert.equal(readJson(path.join(novel, 'reports', 'generate_game_kb_install.json')).final_data_hash, receipt.final_data_hash);
  assert.equal(verifyInstalled(novel).passed, true);
});

test('installed verification requires its receipt and detects data hash drift', () => {
  const missing = prepareAssembledRun({ name: '缺少安装凭据试书', runId: 'run-missing-receipt' });
  assert.equal(verifyInstalled(missing.novel).blocking_errors[0].code, 'INSTALL_RECEIPT_MISSING');

  const installed = prepareAssembledRun({ name: '安装哈希漂移试书', runId: 'run-installed-drift' });
  pass(runFlow(['install', installed.novel, '--run', installed.prepared.run_id, '--json']), 'install drift fixture');
  const charactersFile = path.join(installed.novel, 'data', 'characters.yaml');
  const characters = yaml.load(fs.readFileSync(charactersFile, 'utf8'));
  characters[0].biography = '被安装后修改。';
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
