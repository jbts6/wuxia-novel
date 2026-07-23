#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { deniedRootTempTargets } = require('./lib/root-temp-guard');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DENIAL_REASON =
  'Repository-root .tmp-* and .temp-* writes are forbidden; write only to a managed output path.';

function main() {
  let event;
  try {
    event = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch (error) {
    process.stderr.write(`Invalid PreToolUse JSON: ${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  if (deniedRootTempTargets(event, REPO_ROOT).length === 0) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: DENIAL_REASON
    }
  }));
}

main();
