#!/usr/bin/env node
'use strict';

const { GameKbError } = require('./lib/errors');
const { auditRepository, writeAuditReports } = require('./lib/repository-audit');

function main(argv = process.argv.slice(2)) {
  const [repoRoot, outputFlag, outputDir] = argv;
  if (!repoRoot) throw new GameKbError('REPOSITORY_ROOT_REQUIRED', 'audit-v6 requires <repository-root>');
  if (outputFlag !== '--output' || !outputDir || argv.length !== 3) {
    throw new GameKbError('AUDIT_OUTPUT_REQUIRED', 'audit-v6 requires --output <directory>');
  }
  const audit = auditRepository(repoRoot);
  const written = writeAuditReports(audit, outputDir);
  process.stdout.write(`${JSON.stringify({ ...written, counts: audit.counts })}\n`);
}

try {
  main();
} catch (error) {
  const payload = error instanceof GameKbError
    ? { code: error.code, message: error.message, details: error.details || {} }
    : { code: 'AUDIT_FAILED', message: error.message, details: {} };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = 1;
}

module.exports = { main };
