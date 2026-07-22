'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { installVerifiedData, verifyInstalled } = require('../scripts/lib/install');
const { verifyFinal } = require('../scripts/lib/verify');
const { createV7Workspace } = require('./v7-fixture');

function installedFixture() {
  const fixture = createV7Workspace();
  verifyFinal(fixture.paths, { deep: false });
  const receipt = installVerifiedData(fixture.novel, { runId: fixture.runId, deep: false });
  return { ...fixture, receipt };
}

test('installed verification uses the installed review report and receipt only', () => {
  const fixture = installedFixture();
  assert.equal(verifyInstalled(fixture.novel).passed, true);

  fs.rmSync(path.join(fixture.novel, 'reports', 'game-kb-review.json'));
  const missing = verifyInstalled(fixture.novel);
  assert.equal(missing.passed, false);
  assert.ok(missing.blocking_errors.some(issue => issue.code === 'INSTALL_REVIEW_REPORT_MISSING'));
  assert.equal(fs.existsSync(fixture.paths.reviewReport), true);
});

test('installed verification rejects review report byte drift', () => {
  const fixture = installedFixture();
  fs.appendFileSync(path.join(fixture.novel, 'reports', 'game-kb-review.json'), '\n');
  const result = verifyInstalled(fixture.novel);
  assert.equal(result.passed, false);
  assert.ok(result.blocking_errors.some(issue => issue.code === 'INSTALL_REVIEW_REPORT_HASH_MISMATCH'));
});
