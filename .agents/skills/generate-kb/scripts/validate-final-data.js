#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateFinalData } = require('./lib/final-data-contract');
const { assertLegacyWriteAllowed } = require('./lib/managed-write');

function buildReport(novelDir) {
  const result = validateFinalData(novelDir);
  const report = {
    generated_at: new Date().toISOString(),
    novel: path.basename(novelDir),
    passed: [
      result.missing_data_files,
      result.invalid_data_files,
      result.schema_errors,
      result.enrichment_errors
    ].every(items => items.length === 0) && Boolean(result.final_data_hash),
    final_data_hash: result.final_data_hash,
    counts: result.counts,
    missing_data_files: result.missing_data_files,
    invalid_data_files: result.invalid_data_files,
    schema_errors: result.schema_errors,
    enrichment_errors: result.enrichment_errors
  };
  return report;
}

function printSummary(report) {
  console.log(`Final data contract: ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log(`Missing files: ${report.missing_data_files.length}`);
  console.log(`Invalid files: ${report.invalid_data_files.length}`);
  console.log(`Schema errors: ${report.schema_errors.length}`);
  console.log(`Enrichment errors: ${report.enrichment_errors.length}`);
  const errors = [
    ...report.missing_data_files.map(item => `missing: ${item}`),
    ...report.invalid_data_files.map(item => `invalid: ${item}`),
    ...report.schema_errors.map(item => `schema: ${item}`),
    ...report.enrichment_errors.map(item => `enrichment: ${item}`)
  ];
  errors.slice(0, 20).forEach(error => console.log(`- ${error}`));
  if (errors.length > 20) console.log(`- ... ${errors.length - 20} more; see final_data_validation.json`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const positional = args.filter(arg => !arg.startsWith('--'));
  if (positional.length !== 1) {
    console.error('Usage: node validate-final-data.js <novel-dir> [--dry-run]');
    process.exit(1);
  }
  const novelDir = path.resolve(positional[0]);
  assertLegacyWriteAllowed(novelDir, { operation: 'validate-final-data', dryRun });
  const report = buildReport(novelDir);
  if (!dryRun) {
    const reportsDir = path.join(novelDir, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportsDir, 'final_data_validation.json'),
      `${JSON.stringify(report, null, 2)}\n`
    );
  }
  printSummary(report);
  if (!report.passed) process.exitCode = 1;
}

module.exports = { buildReport, printSummary };
