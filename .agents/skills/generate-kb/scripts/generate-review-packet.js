#!/usr/bin/env node
'use strict';

const { assessQuality, writeReports } = require('./assess-quality');
const { assertLegacyWriteAllowed } = require('./lib/managed-write');
const { parseArtifactArgs } = require('./lib/report-context');
const {
  buildReviewPacket,
  writeReviewPacket
} = require('./lib/review-readiness');

function parseArgs(argv) {
  const context = parseArtifactArgs(argv, {
    booleanFlags: ['--report-only', '--dry-run'],
    usage: 'Usage: node generate-review-packet.js <novel-dir> [--bundle-root DIR | --data-root DIR --reports-root DIR] [--build-root DIR] [--expected-final-data-hash HASH] [--report-only] [--dry-run]'
  });
  return {
    ...context,
    reportOnly: context.flags.has('--report-only'),
    dryRun: context.flags.has('--dry-run')
  };
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const { novelDir, reportOnly, dryRun } = options;
    assertLegacyWriteAllowed(novelDir, { operation: 'generate-review-packet', dryRun });
    const quality = assessQuality(novelDir, options);
    const packet = buildReviewPacket(novelDir, { ...options, qualityReport: quality });

    if (!dryRun) {
      writeReports(novelDir, quality, options);
      writeReviewPacket(novelDir, packet, options);
    }

    console.log('Review readiness: ' + packet.review_readiness.status);
    console.log(
      'Alerts: ' + packet.review_readiness.blocking_alert_count + ' blocking, ' +
      packet.review_readiness.warning_count + ' warning'
    );
    console.log('High-risk decisions: ' + packet.review_readiness.high_risk_total);

    if (packet.review_readiness.status !== 'ready_for_human_review' && !reportOnly) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`${error.code ? `${error.code}: ` : ''}${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs };
