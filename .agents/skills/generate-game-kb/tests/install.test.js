'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { installVerifiedData, promoteVerifiedData } = require('../scripts/lib/install');
const { readJson } = require('../scripts/lib/io');
const { buildReviewReport } = require('../scripts/lib/review-report');
const { verifyFinal } = require('../scripts/lib/verify');
const { createV7Workspace } = require('./v7-fixture');

function installFixtureWithReviewReport() {
  const fixture = createV7Workspace();
  const verification = verifyFinal(fixture.paths, { deep: false });
  const receipt = installVerifiedData(fixture.novel, { runId: fixture.runId, deep: false });
  const installedReview = path.join(fixture.novel, 'reports', 'game-kb-review.json');
  const previousReviewText = fs.readFileSync(installedReview, 'utf8');
  const previousDataDigest = receipt.final_data_hash;
  return {
    ...fixture,
    verification,
    receipt,
    installedReview,
    previousReviewText,
    previousDataDigest,
    installedDataDigest() {
      return require('../scripts/lib/verify').verifyDataRoot(
        path.join(fixture.novel, 'data'),
        { chapters: fixture.manifest.chapters }
      ).final_data_hash;
    },
    promote(options = {}) {
      const review = buildReviewReport({
        sourceHash: fixture.manifest.source_hash,
        finalDataHash: verification.final_data_hash,
        warnings: []
      });
      const reviewText = `${JSON.stringify(review, null, 2)}\n`;
      const verificationText = `${JSON.stringify({
        ...verification,
        review_report_hash: require('../scripts/lib/review-report').hashReport(review)
      }, null, 2)}\n`;
      return promoteVerifiedData(fixture.novel, {
        sourceData: fixture.paths.finalData,
        sourceHash: fixture.manifest.source_hash,
        finalDataHash: verification.final_data_hash,
        idPlanHash: receipt.id_plan_hash,
        chapters: fixture.manifest.chapters,
        runId: fixture.runId,
        verificationReportContent: verificationText,
        reviewReportContent: reviewText,
        ...options
      });
    }
  };
}

test('install publishes data, verification, and review report with bound hashes', () => {
  const fixture = installFixtureWithReviewReport();
  assert.equal(fs.existsSync(fixture.installedReview), true);
  assert.equal(readJson(fixture.installedReview).final_data_hash, fixture.receipt.final_data_hash);
  assert.match(fixture.receipt.review_report_hash, /^sha256:[a-f0-9]{64}$/);
});

test('restores old data and review report when report promotion fails', () => {
  const fixture = installFixtureWithReviewReport();
  assert.throws(
    () => fixture.promote({ faultAt: 'after-review-write' }),
    error => error.code === 'INSTALL_FAULT_INJECTED'
  );
  assert.equal(fs.readFileSync(fixture.installedReview, 'utf8'), fixture.previousReviewText);
  assert.equal(fixture.installedDataDigest(), fixture.previousDataDigest);
});

module.exports = { installFixtureWithReviewReport };
