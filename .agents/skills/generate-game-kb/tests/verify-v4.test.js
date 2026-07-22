'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const yaml = require('js-yaml');

const { atomicWriteJson, readJson } = require('../scripts/lib/io');
const { verifyDataRoot, verifyFinal } = require('../scripts/lib/verify');
const { createV7Workspace } = require('./v7-fixture');

test('verifyDataRoot accepts exact v7 plural types and rejects legacy type', () => {
  const fixture = createV7Workspace();
  const valid = verifyDataRoot(fixture.paths.finalData, { chapters: fixture.manifest.chapters });
  assert.equal(valid.passed, true);

  const itemFile = `${fixture.paths.finalData}/items.yaml`;
  const items = yaml.load(fs.readFileSync(itemFile, 'utf8'));
  items[0].type = items[0].types[0];
  delete items[0].types;
  fs.writeFileSync(itemFile, yaml.dump(items, { noRefs: true, lineWidth: -1 }), 'utf8');
  const legacy = verifyDataRoot(fixture.paths.finalData, { chapters: fixture.manifest.chapters });
  assert.equal(legacy.passed, false);
  assert.ok(legacy.blocking_errors.some(issue => issue.code === 'FINAL_FIELDS_INVALID'));
});

test('workspace verification recomputes deterministic audit and review report hashes', () => {
  const fixture = createV7Workspace();
  const result = verifyFinal(fixture.paths, { deep: false });
  const assembly = readJson(fixture.paths.assemblyReport);

  assert.equal(result.passed, true);
  assert.equal(result.deterministic_audit_hash, assembly.deterministic_audit_hash);
  assert.equal(result.review_report_hash, assembly.review_report_hash);
  assert.equal(readJson(fixture.paths.verificationReport).review_report_hash, assembly.review_report_hash);
});

test('workspace verification rejects stale audit and review evidence', () => {
  for (const mutation of ['audit', 'review']) {
    const fixture = createV7Workspace({ prefix: `game-kb-v7-${mutation}-` });
    if (mutation === 'audit') {
      const assembly = readJson(fixture.paths.assemblyReport);
      assembly.deterministic_audit_hash = 'sha256:stale';
      atomicWriteJson(fixture.paths.assemblyReport, assembly);
    } else {
      const review = readJson(fixture.paths.reviewReport);
      review.source_hash = 'sha256:stale';
      atomicWriteJson(fixture.paths.reviewReport, review);
    }
    const result = verifyFinal(fixture.paths, { deep: false });
    assert.equal(result.passed, false, mutation);
    assert.ok(result.blocking_errors.some(issue => /AUDIT|REVIEW/.test(issue.code)), mutation);
  }
});
