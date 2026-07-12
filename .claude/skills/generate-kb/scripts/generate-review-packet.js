#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { assessQuality, writeReports } = require('./assess-quality');
const {
  buildReviewPacket,
  writeReviewPacket
} = require('./lib/review-readiness');

function parseArgs(argv) {
  const flags = new Set(argv.filter(arg => arg.startsWith('--')));
  const positional = argv.filter(arg => !arg.startsWith('--'));
  if (positional.length !== 1) {
    throw new Error(
      'Usage: node generate-review-packet.js <novel-dir> [--report-only] [--dry-run]'
    );
  }
  return {
    novelDir: path.resolve(positional[0]),
    reportOnly: flags.has('--report-only'),
    dryRun: flags.has('--dry-run')
  };
}

if (require.main === module) {
  try {
    const { novelDir, reportOnly, dryRun } = parseArgs(process.argv.slice(2));
    const quality = assessQuality(novelDir);
    const packet = buildReviewPacket(novelDir, { qualityReport: quality });

    if (!dryRun) {
      writeReports(novelDir, quality);
      writeReviewPacket(novelDir, packet);
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
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs };

