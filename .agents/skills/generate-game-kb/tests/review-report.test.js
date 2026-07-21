'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildReviewReport, validateReviewReport, hashReport } = require('../scripts/lib/review-report');

const sourceHash = 'sha256:source123';
const finalDataHash = 'sha256:final456';

describe('buildReviewReport', () => {
  it('builds a valid empty report', () => {
    const report = buildReviewReport({ sourceHash, finalDataHash, warnings: [] });
    assert.equal(report.schema_version, 1);
    assert.equal(report.source_hash, sourceHash);
    assert.equal(report.final_data_hash, finalDataHash);
    assert.equal(report.summary.warning_count, 0);
    assert.equal(report.summary.info_count, 0);
    assert.deepEqual(report.warnings, []);
    assert.deepEqual(validateReviewReport(report), []);
  });

  it('builds a report with warnings', () => {
    const report = buildReviewReport({
      sourceHash, finalDataHash,
      warnings: [{
        code: 'GENERIC_CANDIDATE_FILTERED',
        category: 'characters',
        name: '店小二',
        chapters: [1, 3],
        reason: '泛称角色',
        resolution: 'filtered'
      }]
    });
    assert.equal(report.summary.warning_count, 1);
    assert.equal(report.warnings[0].severity, 'warning');
    assert.equal(report.warnings[0].code, 'GENERIC_CANDIDATE_FILTERED');
    assert.deepEqual(validateReviewReport(report), []);
  });
});

describe('validateReviewReport', () => {
  it('rejects info and auto-resolved entries in review report', () => {
    const report = buildReviewReport({ sourceHash, finalDataHash, warnings: [] });
    report.summary.info_count = 1;
    assert.ok(validateReviewReport(report).some(issue => issue.code === 'REVIEW_REPORT_INVALID'));
  });

  it('rejects auto_resolved_count > 0', () => {
    const report = buildReviewReport({ sourceHash, finalDataHash, warnings: [] });
    report.summary.auto_resolved_count = 2;
    assert.ok(validateReviewReport(report).some(issue => issue.code === 'REVIEW_REPORT_INVALID'));
  });

  it('rejects non-warning severity', () => {
    const report = buildReviewReport({ sourceHash, finalDataHash, warnings: [] });
    report.warnings.push({ code: 'TEST', severity: 'info', category: 'x', name: 'y', chapters: [], reason: '', resolution: '' });
    report.summary.warning_count = 1;
    assert.ok(validateReviewReport(report).some(issue => issue.code === 'REVIEW_REPORT_INVALID'));
  });

  it('rejects missing required fields on warning entries', () => {
    const report = buildReviewReport({ sourceHash, finalDataHash, warnings: [] });
    report.warnings.push({ code: 'TEST' });
    report.summary.warning_count = 1;
    const issues = validateReviewReport(report);
    assert.ok(issues.length > 0);
  });

  it('rejects non-object report', () => {
    assert.ok(validateReviewReport(null).some(issue => issue.code === 'REVIEW_REPORT_INVALID'));
  });

  it('rejects mismatched warning_count', () => {
    const report = buildReviewReport({ sourceHash, finalDataHash, warnings: [] });
    report.summary.warning_count = 5;
    assert.ok(validateReviewReport(report).some(issue => issue.code === 'REVIEW_REPORT_INVALID'));
  });
});

describe('hashReport', () => {
  it('produces deterministic hash', () => {
    const report = buildReviewReport({ sourceHash, finalDataHash, warnings: [] });
    const hash1 = hashReport(report);
    const hash2 = hashReport(report);
    assert.equal(hash1, hash2);
    assert.ok(hash1.startsWith('sha256:'));
  });

  it('different reports produce different hashes', () => {
    const report1 = buildReviewReport({ sourceHash, finalDataHash, warnings: [] });
    const report2 = buildReviewReport({ sourceHash: 'sha256:other', finalDataHash, warnings: [] });
    assert.notEqual(hashReport(report1), hashReport(report2));
  });
});
