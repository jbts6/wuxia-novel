#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { assessQuality, collectRawCounts } = require('../scripts/assess-quality');
const { generateSummary } = require('../scripts/generate-summary');
const { computeFinalDataHash } = require('../scripts/lib/final-data-contract');
const { buildReviewPacket } = require('../scripts/lib/review-readiness');
const { buildCompleteData } = require('./helpers/final-data-fixture');

function writeJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture() {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-report-roots-'));
  const sourceText = '主角说道：“我练的是北冥神功。”';
  const dataRoot = path.join(novelDir, 'staging', 'data');
  const reportsRoot = path.join(novelDir, 'staging', 'reports');
  fs.mkdirSync(path.join(novelDir, 'ch_split'), { recursive: true });
  fs.writeFileSync(path.join(novelDir, 'ch_split', 'ch_001.txt'), sourceText);
  fs.writeFileSync(path.join(novelDir, `${path.basename(novelDir)}.txt`), sourceText);
  for (const [filename, records] of Object.entries(buildCompleteData(sourceText))) {
    writeJson(path.join(dataRoot, filename), records);
  }
  return {
    novelDir,
    dataRoot,
    reportsRoot,
    finalDataHash: computeFinalDataHash(novelDir, { dataRoot })
  };
}

function passingQuality(finalDataHash) {
  return {
    completion_gate_passed: true,
    final_data_hash: finalDataHash,
    baseline_mode: 'no_gold',
    gates: Object.fromEntries(['G1', 'G2', 'G3', 'G4', 'G5'].map(id => [
      id,
      { passed: true, reasons: [] }
    ]))
  };
}

describe('explicit report roots', () => {
  it('verification reads staged data and writes only to the explicit reports root', () => {
    const fixture = createFixture();
    try {
      const result = spawnSync(process.execPath, [
        path.join(__dirname, '..', 'scripts', 'verify.js'),
        fixture.novelDir,
        '--data-root', fixture.dataRoot,
        '--reports-root', fixture.reportsRoot,
        '--expected-final-data-hash', fixture.finalDataHash
      ], { encoding: 'utf8' });

      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      const report = JSON.parse(fs.readFileSync(
        path.join(fixture.reportsRoot, 'verification_report.json'),
        'utf8'
      ));
      assert.equal(report.final_data_hash, fixture.finalDataHash);
      assert.equal(report.file_errors.length, 0);
      assert.equal(fs.existsSync(path.join(fixture.novelDir, 'reports')), false);
      assert.equal(fs.existsSync(path.join(fixture.novelDir, 'verification_result.json')), false);
    } finally {
      fs.rmSync(fixture.novelDir, { recursive: true, force: true });
    }
  });

  it('verification rejects a stale expected final-data hash before writing reports', () => {
    const fixture = createFixture();
    try {
      const result = spawnSync(process.execPath, [
        path.join(__dirname, '..', 'scripts', 'verify.js'),
        fixture.novelDir,
        '--data-root', fixture.dataRoot,
        '--reports-root', fixture.reportsRoot,
        '--expected-final-data-hash', 'stale-final-data-hash'
      ], { encoding: 'utf8' });

      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /FINAL_DATA_HASH_MISMATCH/);
      assert.equal(fs.existsSync(fixture.reportsRoot), false);
    } finally {
      fs.rmSync(fixture.novelDir, { recursive: true, force: true });
    }
  });

  it('cross-validation reads staged data and binds its report to the expected hash', () => {
    const fixture = createFixture();
    try {
      const result = spawnSync(process.execPath, [
        path.join(__dirname, '..', 'scripts', 'cross-validate.js'),
        fixture.novelDir,
        '--data-root', fixture.dataRoot,
        '--reports-root', fixture.reportsRoot,
        '--expected-final-data-hash', fixture.finalDataHash
      ], { encoding: 'utf8' });

      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      const report = JSON.parse(fs.readFileSync(
        path.join(fixture.reportsRoot, 'cross_validation_report.json'),
        'utf8'
      ));
      assert.equal(report.final_data_hash, fixture.finalDataHash);
      assert.equal(report.summary.errors, 0);
      assert.equal(fs.existsSync(path.join(fixture.novelDir, 'reports')), false);
      assert.equal(fs.existsSync(path.join(fixture.novelDir, 'cross_validation_report.json')), false);
    } finally {
      fs.rmSync(fixture.novelDir, { recursive: true, force: true });
    }
  });

  it('cross-validation rejects a stale expected final-data hash before writing reports', () => {
    const fixture = createFixture();
    try {
      const result = spawnSync(process.execPath, [
        path.join(__dirname, '..', 'scripts', 'cross-validate.js'),
        fixture.novelDir,
        '--data-root', fixture.dataRoot,
        '--reports-root', fixture.reportsRoot,
        '--expected-final-data-hash', 'stale-final-data-hash'
      ], { encoding: 'utf8' });

      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /FINAL_DATA_HASH_MISMATCH/);
      assert.equal(fs.existsSync(fixture.reportsRoot), false);
    } finally {
      fs.rmSync(fixture.novelDir, { recursive: true, force: true });
    }
  });

  it('quality, review, and summary projections use the same explicit artifact roots', () => {
    const fixture = createFixture();
    try {
      writeJson(path.join(fixture.reportsRoot, 'verification_report.json'), {
        final_data_hash: fixture.finalDataHash,
        file_errors: [],
        grand_total: { entities: 2, refs: 2, grounded: 2, weak: 0, unverified: 0 }
      });
      writeJson(path.join(fixture.reportsRoot, 'cross_validation_report.json'), {
        final_data_hash: fixture.finalDataHash,
        summary: { total: 0, errors: 0, warnings: 0, info: 0 },
        issues: []
      });

      const options = {
        dataRoot: fixture.dataRoot,
        reportsRoot: fixture.reportsRoot,
        expectedFinalDataHash: fixture.finalDataHash
      };
      const quality = assessQuality(fixture.novelDir, options);
      assert.equal(quality.final_data_hash, fixture.finalDataHash);
      assert.equal(quality.raw_counts.characters, 1);
      assert.equal(quality.gates.G3.passed, true, quality.gates.G3.reasons.join('; '));
      assert.equal(collectRawCounts(fixture.novelDir, options).characters, 1);

      const packet = buildReviewPacket(fixture.novelDir, {
        ...options,
        qualityReport: passingQuality(fixture.finalDataHash)
      });
      assert.equal(packet.final_data_hash, fixture.finalDataHash);
      assert.equal(packet.category_stats.character.final_records, 1);

      writeJson(
        path.join(fixture.reportsRoot, 'quality_report.json'),
        passingQuality(fixture.finalDataHash)
      );
      const summary = generateSummary(fixture.novelDir, options);
      assert.match(summary, /\| characters \| 1 \|/);
      assert.match(summary, /完成门禁：PASS/);
    } finally {
      fs.rmSync(fixture.novelDir, { recursive: true, force: true });
    }
  });

  it('review and summary CLIs preserve explicit artifact roots', () => {
    const fixture = createFixture();
    try {
      writeJson(path.join(fixture.reportsRoot, 'verification_report.json'), {
        final_data_hash: fixture.finalDataHash,
        file_errors: [],
        grand_total: { entities: 2, refs: 2, grounded: 2, weak: 0, unverified: 0 }
      });
      writeJson(path.join(fixture.reportsRoot, 'cross_validation_report.json'), {
        final_data_hash: fixture.finalDataHash,
        summary: { total: 0, errors: 0, warnings: 0, info: 0 },
        issues: []
      });

      const review = spawnSync(process.execPath, [
        path.join(__dirname, '..', 'scripts', 'generate-review-packet.js'),
        fixture.novelDir,
        '--data-root', fixture.dataRoot,
        '--reports-root', fixture.reportsRoot,
        '--expected-final-data-hash', fixture.finalDataHash,
        '--report-only'
      ], { encoding: 'utf8' });

      assert.equal(review.status, 0, `${review.stdout}\n${review.stderr}`);
      for (const filename of ['quality_report.json', 'review_packet.json']) {
        const report = JSON.parse(fs.readFileSync(path.join(fixture.reportsRoot, filename), 'utf8'));
        assert.equal(report.final_data_hash, fixture.finalDataHash);
      }
      assert.equal(fs.existsSync(path.join(fixture.novelDir, 'reports')), false);

      writeJson(
        path.join(fixture.reportsRoot, 'quality_report.json'),
        passingQuality(fixture.finalDataHash)
      );
      const summary = spawnSync(process.execPath, [
        path.join(__dirname, '..', 'scripts', 'generate-summary.js'),
        fixture.novelDir,
        '--data-root', fixture.dataRoot,
        '--reports-root', fixture.reportsRoot,
        '--expected-final-data-hash', fixture.finalDataHash
      ], { encoding: 'utf8' });

      assert.equal(summary.status, 0, `${summary.stdout}\n${summary.stderr}`);
      const markdown = fs.readFileSync(path.join(fixture.novelDir, 'summary.md'), 'utf8');
      assert.match(markdown, /\| characters \| 1 \|/);
      assert.match(markdown, /完成门禁：PASS/);
      assert.equal(fs.existsSync(path.join(fixture.novelDir, 'reports')), false);
    } finally {
      fs.rmSync(fixture.novelDir, { recursive: true, force: true });
    }
  });
});
