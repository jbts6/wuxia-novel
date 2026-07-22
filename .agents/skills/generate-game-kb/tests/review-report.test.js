'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildReviewReport, validateReviewReport, hashReport } = require('../scripts/lib/review-report');

const sourceHash = 'sha256:source123';
const finalDataHash = 'sha256:final456';

function warning(overrides = {}) {
  return {
    code: 'GENERIC_CANDIDATE_FILTERED',
    severity: 'warning',
    category: 'characters',
    name: '店小二',
    chapter_numbers: [1, 3],
    source_refs: [{ chapter: 1, text: '店小二端来酒菜。' }],
    member_refs: ['ch001:character:店小二'],
    reason: 'confirmed_generic_name',
    resolution: 'filtered',
    ...overrides
  };
}

describe('buildReviewReport', () => {
  it('builds the exact warning-only schema and deterministic summaries', () => {
    const report = buildReviewReport({
      sourceHash,
      finalDataHash,
      warnings: [warning(), warning({ code: 'IDENTITY_COLLISION_REVIEW_REQUIRED', name: '同名人' })]
    });

    assert.deepEqual(Object.keys(report), [
      'report_version', 'source_hash', 'final_data_hash', 'summary', 'entries'
    ]);
    assert.deepEqual(report.summary, {
      warning_count: 2,
      by_code: {
        GENERIC_CANDIDATE_FILTERED: 1,
        IDENTITY_COLLISION_REVIEW_REQUIRED: 1
      },
      by_category: { characters: 2 }
    });
    assert.deepEqual(Object.keys(report.entries[0]), [
      'code', 'severity', 'category', 'name', 'chapter_numbers',
      'source_refs', 'member_refs', 'reason', 'resolution'
    ]);
    assert.deepEqual(validateReviewReport(report), []);
  });

  it('is deeply stable under reversed warning input', () => {
    const warnings = [warning({ name: '乙' }), warning({ name: '甲' })];
    const forward = buildReviewReport({ sourceHash, finalDataHash, warnings });
    const reverse = buildReviewReport({ sourceHash, finalDataHash, warnings: [...warnings].reverse() });
    assert.deepEqual(forward, reverse);
    assert.equal(hashReport(forward), hashReport(reverse));
  });
});

describe('validateReviewReport', () => {
  it('rejects info and auto-resolved summary fields', () => {
    for (const field of ['info_count', 'auto_resolved_count']) {
      const report = buildReviewReport({ sourceHash, finalDataHash, warnings: [] });
      report.summary[field] = 1;
      assert.ok(validateReviewReport(report).some(issue => issue.code === 'REVIEW_REPORT_INVALID'));
    }
  });

  it('rejects non-warning entries and incomplete evidence', () => {
    for (const mutate of [
      report => { report.entries[0].severity = 'info'; },
      report => { report.entries[0].source_refs = []; },
      report => { report.entries[0].member_refs = []; }
    ]) {
      const report = buildReviewReport({ sourceHash, finalDataHash, warnings: [warning()] });
      mutate(report);
      assert.ok(validateReviewReport(report).some(issue => issue.code === 'REVIEW_REPORT_INVALID'));
    }
  });

  it('rejects stale summaries and unexpected top-level fields', () => {
    const stale = buildReviewReport({ sourceHash, finalDataHash, warnings: [warning()] });
    stale.summary.warning_count = 5;
    assert.ok(validateReviewReport(stale).some(issue => issue.path === 'summary.warning_count'));

    const extra = buildReviewReport({ sourceHash, finalDataHash, warnings: [warning()] });
    extra.warnings = [];
    assert.ok(validateReviewReport(extra).some(issue => issue.path === '$'));
  });
});
