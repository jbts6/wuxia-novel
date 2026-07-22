'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { archiveRun } = require('../scripts/lib/archive');
const { installVerifiedData } = require('../scripts/lib/install');
const { verifyFinal } = require('../scripts/lib/verify');
const { createV7Workspace } = require('./v7-fixture');

test('archive receipt binds assembly, verification, install, review, source, and final hashes', () => {
  const fixture = createV7Workspace();
  const verification = verifyFinal(fixture.paths, { deep: false });
  const install = installVerifiedData(fixture.novel, { runId: fixture.runId, deep: false });
  const receipt = archiveRun(fixture.novel, fixture.runId);

  for (const field of [
    'assembly_report_hash', 'verification_report_hash', 'install_receipt_hash',
    'review_report_hash', 'source_hash', 'final_data_hash'
  ]) {
    assert.match(receipt[field], /^sha256:[a-f0-9]{64}$/, field);
  }
  assert.equal(receipt.source_hash, fixture.manifest.source_hash);
  assert.equal(receipt.final_data_hash, verification.final_data_hash);
  assert.equal(receipt.review_report_hash, install.review_report_hash);
  assert.equal(fs.existsSync(fixture.paths.run), false);
  assert.equal(fs.existsSync(path.join(receipt.archive_dir, 'archive-receipt.json')), true);
});
