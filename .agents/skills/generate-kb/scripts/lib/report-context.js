#!/usr/bin/env node
'use strict';

const path = require('node:path');

const { PipelineError } = require('./atomic-json');

const VALUE_FLAGS = Object.freeze({
  '--bundle-root': 'bundleRoot',
  '--data-root': 'dataRoot',
  '--reports-root': 'reportsRoot',
  '--build-root': 'buildRoot',
  '--expected-final-data-hash': 'expectedFinalDataHash'
});

function resolveArtifactRoots(novelDir, options = {}) {
  const root = path.resolve(novelDir);
  if (options.bundleRoot && (options.dataRoot || options.reportsRoot)) {
    throw new PipelineError(
      'ARTIFACT_ROOT_AMBIGUOUS',
      '--bundle-root cannot be combined with --data-root or --reports-root'
    );
  }
  const bundleRoot = options.bundleRoot ? path.resolve(options.bundleRoot) : null;
  return {
    novelDir: root,
    bundleRoot,
    dataRoot: path.resolve(options.dataRoot ?? (bundleRoot
      ? path.join(bundleRoot, 'data')
      : path.join(root, 'data'))),
    reportsRoot: path.resolve(options.reportsRoot ?? (bundleRoot
      ? path.join(bundleRoot, 'reports')
      : path.join(root, 'reports'))),
    buildRoot: path.resolve(options.buildRoot ?? path.join(root, 'build')),
    expectedFinalDataHash: options.expectedFinalDataHash ?? null,
    explicitDataRoot: Boolean(options.bundleRoot || options.dataRoot),
    explicitReportsRoot: Boolean(options.bundleRoot || options.reportsRoot)
  };
}

function parseArtifactArgs(argv, options = {}) {
  const values = {};
  const booleans = new Set();
  const positional = [];
  const allowedBooleanFlags = new Set(options.booleanFlags ?? []);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (Object.hasOwn(VALUE_FLAGS, arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new PipelineError('CLI_USAGE', `${arg} requires a value`);
      }
      values[VALUE_FLAGS[arg]] = value;
      index += 1;
    } else if (arg.startsWith('--')) {
      if (!allowedBooleanFlags.has(arg)) {
        throw new PipelineError('CLI_USAGE', `Unknown option: ${arg}`);
      }
      booleans.add(arg);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 1) {
    throw new PipelineError('CLI_USAGE', options.usage ?? 'Exactly one novel directory is required');
  }
  return {
    ...resolveArtifactRoots(positional[0], values),
    flags: booleans
  };
}

function assertExpectedFinalDataHash(actualHash, expectedHash) {
  if (expectedHash && actualHash !== expectedHash) {
    throw new PipelineError(
      'FINAL_DATA_HASH_MISMATCH',
      `Expected final data hash ${expectedHash}, received ${actualHash ?? 'none'}`,
      { expected: expectedHash, actual: actualHash ?? null }
    );
  }
  return actualHash;
}

module.exports = {
  VALUE_FLAGS,
  assertExpectedFinalDataHash,
  parseArtifactArgs,
  resolveArtifactRoots
};
