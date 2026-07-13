#!/usr/bin/env node
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const {
  PipelineError,
  readJson,
  sha256,
  writeJsonAtomic
} = require('./lib/atomic-json');
const {
  computeReceiptHash,
  promoteBundle,
  rollbackBundle,
  verifyVersionBundle
} = require('./lib/publish-bundle');
const { runCurrentStageAction } = require('./lib/pipeline-controller');
const { getPipelinePaths } = require('./lib/pipeline-paths');
const {
  appendPipelineEvent,
  initializePipelineRun,
  loadActivePipelineState,
  loadActiveRun,
  loadPipelineState
} = require('./lib/pipeline-state');
const {
  buildManagedPublishBundle,
  loadManagedPublishContext
} = require('./lib/staged-publish');
const { recordRecallReview } = require('./lib/staged-reconcile');
const { claimWorkItem, submitWorkItem } = require('./lib/work-items');

function parseArguments(argv) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const name = value.slice(2);
    if (name === 'json') {
      flags.json = true;
      continue;
    }
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
      throw new PipelineError('INVALID_ARGUMENT', `--${name} requires a value`);
    }
    flags[name] = argv[index + 1];
    index += 1;
  }
  return { positionals, flags };
}

function integerFlag(flags, name, fallback) {
  if (flags[name] === undefined) return fallback;
  const value = Number(flags[name]);
  if (!Number.isInteger(value)) throw new PipelineError('INVALID_CONFIG', `--${name} must be an integer`);
  return value;
}

function generatedRunId(now = new Date()) {
  return `run-${now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${sha256(String(process.pid)).slice(0, 6)}`;
}

function resolveBundleRoot(novelDir, runId, value) {
  if (!value) throw new PipelineError('INVALID_ARGUMENT', '--bundle is required');
  const paths = getPipelinePaths(novelDir, runId);
  const candidates = [
    path.resolve(value),
    path.join(paths.publish, 'staging', value),
    path.join(novelDir, '.kb', 'versions', value)
  ];
  const found = candidates.find(candidate => {
    try {
      return fs.lstatSync(candidate).isDirectory();
    } catch (error) {
      return error.code !== 'ENOENT' ? (() => { throw error; })() : false;
    }
  });
  if (!found) throw new PipelineError('BUNDLE_NOT_FOUND', `Bundle does not exist: ${value}`);
  return found;
}

function verifiedManifest(bundleRoot) {
  const verification = verifyVersionBundle(bundleRoot);
  if (!verification.passed) {
    throw new PipelineError(
      'BUNDLE_VERIFICATION_FAILED',
      verification.errors.join('; '),
      verification
    );
  }
  return verification;
}

function renderStatus(state) {
  const stages = Object.entries(state.stages)
    .map(([stage, value]) => `${stage}: ${value.status}`)
    .join('\n');
  return `run: ${state.run_id}\n${stages}\nnext: ${state.next_action.command}${state.next_action.stage ? ` ${state.next_action.stage}` : ''}`;
}

function execute(argv) {
  const { positionals, flags } = parseArguments(argv);
  const [command, novelArg] = positionals;
  if (!command || !novelArg) {
    throw new PipelineError('INVALID_ARGUMENT', 'Usage: pipeline.js <command> <novel-dir> [options]');
  }
  const novelDir = path.resolve(novelArg);

  if (command === 'init') {
    return initializePipelineRun(novelDir, {
      runId: flags['run-id'] || generatedRunId(),
      config: {
        max_workers: integerFlag(flags, 'concurrency', 1),
        risk_limit: integerFlag(flags, 'risk-limit', 15)
      }
    });
  }
  if (command === 'status' || command === 'check') {
    return loadActivePipelineState(novelDir);
  }
  const active = loadActiveRun(novelDir);
  if (command === 'run') {
    const sourceOptions = {};
    if (flags['window-lines'] !== undefined) {
      sourceOptions.windowLines = integerFlag(flags, 'window-lines');
    }
    if (flags['overlap-lines'] !== undefined) {
      sourceOptions.overlapLines = integerFlag(flags, 'overlap-lines');
    }
    return runCurrentStageAction(novelDir, active.run_id, { sourceOptions });
  }
  if (command === 'claim') {
    if (!flags.worker) throw new PipelineError('INVALID_ARGUMENT', '--worker is required');
    return claimWorkItem(novelDir, active.run_id, { workerId: flags.worker });
  }
  if (command === 'submit') {
    for (const name of ['worker', 'item', 'draft']) {
      if (!flags[name]) throw new PipelineError('INVALID_ARGUMENT', `--${name} is required`);
    }
    return submitWorkItem(novelDir, active.run_id, {
      workerId: flags.worker,
      itemId: flags.item,
      draftPath: path.resolve(flags.draft)
    });
  }
  if (command === 'review-packet') {
    const paths = getPipelinePaths(novelDir, active.run_id);
    const packet = readJson(path.join(paths.review, 'recall-packet.json'), null);
    if (!packet) throw new PipelineError('REVIEW_PACKET_MISSING', 'recall-packet.json is missing');
    return { packet };
  }
  if (command === 'record-review') {
    if (!flags.input) throw new PipelineError('INVALID_ARGUMENT', '--input is required');
    const receipt = readJson(path.resolve(flags.input), null);
    if (!receipt) throw new PipelineError('REVIEW_RECEIPT_INVALID', 'Review receipt input is missing');
    return recordRecallReview(novelDir, active.run_id, receipt);
  }
  if (command === 'build-publish') {
    if (!flags.draft) throw new PipelineError('INVALID_ARGUMENT', '--draft is required');
    const state = loadPipelineState(novelDir, active.run_id);
    const built = buildManagedPublishBundle(novelDir, active.run_id, flags.draft, { state });
    const { bundle_root: bundleRoot, manifest, verification } = built;
    const nextState = appendPipelineEvent(novelDir, active.run_id, 'publish_bundle_built', {
      stage: 'publish',
      input_hash: state.stages.publish.input_hash,
      bundle_hash: manifest.bundle_hash,
      final_data_hash: manifest.final_data_hash,
      output_hash: manifest.bundle_hash,
      manifest_hash: sha256(manifest),
      bundle_root: bundleRoot,
      publish_input_hash: built.publish_input_hash
    }, {
      beforeCommit({ currentState, paths }) {
        const current = loadManagedPublishContext(
          novelDir,
          active.run_id,
          flags.draft,
          currentState
        );
        if (current.publishDraft.draft_hash !== built.publish_input_hash
          || current.reconcile.output_hash !== manifest.reconcile_hash
          || current.enrich.output_hash !== manifest.enrich_hash
          || current.semanticReport.output_hash !== manifest.semantic_audit_hash) {
          throw new PipelineError('PUBLISH_ARTIFACT_STALE', 'Publish inputs changed while building');
        }
        writeJsonAtomic(path.join(paths.publish, 'id-plan.json'), built.id_plan);
      }
    });
    return {
      action: 'publish-bundle-built',
      bundle_root: bundleRoot,
      manifest,
      state: nextState
    };
  }
  if (command === 'promote') {
    if (flags['expected-current'] === undefined) {
      throw new PipelineError('INVALID_ARGUMENT', '--expected-current is required');
    }
    const state = loadPipelineState(novelDir, active.run_id);
    if (state.publish?.status !== 'built') {
      throw new PipelineError('INVALID_STAGE_TRANSITION', 'promote requires a built publish bundle');
    }
    const bundleRoot = resolveBundleRoot(novelDir, active.run_id, flags.bundle);
    const verification = verifiedManifest(bundleRoot);
    const manifest = verification.manifest;
    if (manifest.bundle_hash !== state.publish.bundle_hash) {
      throw new PipelineError('BUNDLE_MISMATCH', 'Promote bundle does not match the recorded publish bundle');
    }
    const receiptHash = computeReceiptHash(
      'promote',
      flags['expected-current'],
      manifest.bundle_hash,
      manifest.final_data_hash
    );
    let promotion = null;
    const nextState = appendPipelineEvent(novelDir, active.run_id, 'bundle_promoted', {
      stage: 'publish',
      bundle_hash: manifest.bundle_hash,
      final_data_hash: manifest.final_data_hash,
      receipt_hash: receiptHash
    }, {
      beforeCommit({ currentState }) {
        if (currentState.publish?.bundle_hash !== manifest.bundle_hash) {
          throw new PipelineError('BUNDLE_MISMATCH', 'Publish bundle changed before promote');
        }
        promotion = promoteBundle(novelDir, bundleRoot, {
          expectedCurrent: flags['expected-current']
        });
      }
    });
    return { action: 'promote', ...promotion, state: nextState };
  }
  if (command === 'rollback') {
    if (flags['expected-current'] === undefined) {
      throw new PipelineError('INVALID_ARGUMENT', '--expected-current is required');
    }
    const state = loadPipelineState(novelDir, active.run_id);
    if (state.publish?.status !== 'promoted') {
      throw new PipelineError('INVALID_STAGE_TRANSITION', 'rollback requires a promoted publish bundle');
    }
    const bundleRoot = resolveBundleRoot(novelDir, active.run_id, flags.bundle);
    const verification = verifiedManifest(bundleRoot);
    const manifest = verification.manifest;
    const receiptHash = computeReceiptHash(
      'rollback',
      flags['expected-current'],
      manifest.bundle_hash,
      manifest.final_data_hash
    );
    let rollback = null;
    const nextState = appendPipelineEvent(novelDir, active.run_id, 'bundle_rolled_back', {
      stage: 'publish',
      bundle_hash: manifest.bundle_hash,
      final_data_hash: manifest.final_data_hash,
      receipt_hash: receiptHash
    }, {
      beforeCommit({ currentState }) {
        if (currentState.publish?.status !== 'promoted') {
          throw new PipelineError('INVALID_STAGE_TRANSITION', 'Publish state changed before rollback');
        }
        rollback = rollbackBundle(novelDir, manifest.bundle_hash, {
          expectedCurrent: flags['expected-current']
        });
      }
    });
    return { action: 'rollback', ...rollback, state: nextState };
  }
  if (command === 'advance') {
    const state = loadActivePipelineState(novelDir);
    const stage = state.next_action.stage;
    if (state.next_action.command !== 'start-stage' || !stage) {
      throw new PipelineError('INVALID_STAGE_TRANSITION', 'Current next action is not advance');
    }
    const stageIndex = Object.keys(state.stages).indexOf(stage);
    const previousStage = stageIndex > 0 ? Object.keys(state.stages)[stageIndex - 1] : null;
    const inputHash = flags['input-hash']
      || (previousStage ? state.stages[previousStage].output_hash : state.config.source_hash);
    if (!inputHash) {
      throw new PipelineError('STAGE_INPUT_UNAVAILABLE', `${stage} input hash is not available`);
    }
    return appendPipelineEvent(novelDir, active.run_id, 'stage_started', {
      stage,
      input_hash: inputHash,
      gate_version: flags['gate-version'] || `${stage}-v1`
    });
  }
  throw new PipelineError('UNKNOWN_COMMAND', `Unknown pipeline command: ${command}`);
}

function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArguments(argv);
    const result = execute(argv);
    if (parsed.flags.json || typeof result === 'object') {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`${renderStatus(result)}\n`);
    }
    return 0;
  } catch (error) {
    const code = error instanceof PipelineError ? error.code : 'INTERNAL_ERROR';
    const body = {
      error: {
        code,
        message: error.message,
        details: error.details || null
      }
    };
    process.stderr.write(`${JSON.stringify(body, null, 2)}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  execute,
  main,
  parseArguments,
  renderStatus
};
