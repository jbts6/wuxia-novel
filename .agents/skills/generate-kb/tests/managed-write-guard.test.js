#!/usr/bin/env node
'use strict';

const { it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { writeReports } = require('../scripts/assess-quality');
const { initializePipelineRun } = require('../scripts/lib/pipeline-state');

const scriptsRoot = path.resolve(__dirname, '..', 'scripts');

function topLevelWriterScripts() {
  const writerPattern = /(?:writeFileSync|appendFileSync|writeReports?\s*\(|writeReviewPacket\s*\(|writeJson\s*\(|mkdirSync|renameSync|copyFileSync)/;
  return fs.readdirSync(scriptsRoot)
    .filter(file => file.endsWith('.js'))
    .filter(file => {
      const source = fs.readFileSync(path.join(scriptsRoot, file), 'utf8');
      return /process\.argv/.test(source) && writerPattern.test(source);
    })
    .sort();
}

it('requires every top-level writer CLI to invoke the managed-run guard', () => {
  const unguarded = topLevelWriterScripts().filter(file => {
    const source = fs.readFileSync(path.join(scriptsRoot, file), 'utf8');
    return !/managed-write/.test(source) || !/assertLegacyWriteAllowed\s*\(/.test(source);
  });
  assert.deepEqual(unguarded, []);
});

it('blocks legacy write entry points for a managed run while preserving dry-run', () => {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-managed-write-'));
  try {
    const sourceText = '主角说道：“我练的是北冥神功。”';
    fs.mkdirSync(path.join(novelDir, 'ch_split'), { recursive: true });
    fs.writeFileSync(path.join(novelDir, 'ch_split', 'ch_001.txt'), sourceText);
    fs.writeFileSync(path.join(novelDir, '原著.txt'), sourceText);
    initializePipelineRun(novelDir, { runId: 'run-managed', config: {} });

    assert.throws(
      () => writeReports(novelDir, {
        novel: '测试',
        completion_gate_passed: false,
        gates: {},
        raw_counts: {}
      }),
      error => error.code === 'MANAGED_RUN_WRITE_FORBIDDEN'
    );

    const script = path.join(__dirname, '..', 'scripts', 'prepare-source.js');
    const blocked = spawnSync(process.execPath, [script, novelDir], { encoding: 'utf8' });
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /MANAGED_RUN_WRITE_FORBIDDEN/);
    assert.equal(fs.existsSync(path.join(novelDir, 'build', 'source-index.json')), false);

    const dryRun = spawnSync(process.execPath, [script, novelDir, '--dry-run'], { encoding: 'utf8' });
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(fs.existsSync(path.join(novelDir, 'build', 'source-index.json')), false);
  } finally {
    fs.rmSync(novelDir, { recursive: true, force: true });
  }
});

it('blocks report, validation, and source migration writers before they can inspect or write data', () => {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-managed-writers-'));
  try {
    const sourceText = '第一回\n主角说道：“我练的是北冥神功。”';
    fs.mkdirSync(path.join(novelDir, 'ch_split'), { recursive: true });
    fs.writeFileSync(path.join(novelDir, 'ch_split', 'ch_001.txt'), sourceText);
    fs.writeFileSync(path.join(novelDir, `${path.basename(novelDir)}.txt`), sourceText);
    initializePipelineRun(novelDir, { runId: 'run-writers', config: {} });

    for (const script of ['generate-review-packet.js', 'validate-final-data.js', 'split-chapters.js']) {
      const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', script), novelDir], {
        encoding: 'utf8'
      });
      assert.equal(result.status, 1, `${script} should be rejected`);
      assert.match(`${result.stdout}\n${result.stderr}`, /MANAGED_RUN_WRITE_FORBIDDEN/, script);
    }
    assert.equal(fs.existsSync(path.join(novelDir, 'reports', 'final_data_validation.json')), false);
    assert.equal(fs.existsSync(path.join(novelDir, 'build', 'manifest.json')), false);
  } finally {
    fs.rmSync(novelDir, { recursive: true, force: true });
  }
});
