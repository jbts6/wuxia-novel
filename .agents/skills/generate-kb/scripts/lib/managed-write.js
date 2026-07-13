#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { PipelineError, readJson } = require('./atomic-json');

function activeManagedRun(novelDir) {
  const activePath = path.join(path.resolve(novelDir), 'build', 'generate-kb', 'active-run.json');
  if (!fs.existsSync(activePath)) return null;
  const active = readJson(activePath, null);
  return typeof active?.run_id === 'string' && active.run_id ? active.run_id : 'unknown';
}

function assertLegacyWriteAllowed(novelDir, options = {}) {
  if (options.dryRun === true) return null;
  const runId = activeManagedRun(novelDir);
  if (!runId) return null;
  throw new PipelineError(
    'MANAGED_RUN_WRITE_FORBIDDEN',
    `${options.operation ?? 'Legacy command'} cannot write while managed run ${runId} is active; use pipeline.js or --dry-run`,
    { run_id: runId, operation: options.operation ?? null }
  );
}

module.exports = {
  activeManagedRun,
  assertLegacyWriteAllowed
};
