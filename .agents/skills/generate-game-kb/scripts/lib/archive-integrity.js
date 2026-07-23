'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { assertAcceptedArtifacts, readArtifactManifest } = require('./candidate-ledger');
const { GameKbError } = require('./errors');
const { readJson, stableHash } = require('./io');
const { TIMING_CONTRACT_VERSION, readTimingEvents, timingEventsHash } = require('./timing-events');
const { inspectWorkspaceFinal } = require('./verify');

function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function verifyRunArtifacts(paths) {
  const manifest = readArtifactManifest(paths);
  const mismatches = [];
  for (const entry of manifest.entries) {
    const file = path.join(paths.run, ...entry.relative_path.split('/'));
    const actual = fs.existsSync(file) && fs.statSync(file).isFile() ? sha256File(file) : null;
    if (actual !== entry.content_hash) {
      mismatches.push({
        relative_path: entry.relative_path,
        expected_hash: entry.content_hash,
        actual_hash: actual
      });
    }
  }
  if (mismatches.length > 0) {
    throw new GameKbError('ACCEPTED_ARTIFACT_MUTATED', 'Run contains mutated accepted artifacts', {
      mismatches
    });
  }
  return manifest;
}

function assertInstalledIdentity(metadata, installed, runId) {
  const requested = {
    semantic_contract_version: metadata.semantic_contract_version ?? null,
    source_hash: metadata.source_hash ?? null,
    final_data_hash: metadata.final_data_hash ?? null
  };
  const actual = {
    semantic_contract_version: installed.semantic_contract_version ?? null,
    source_hash: installed.source_hash ?? null,
    final_data_hash: installed.final_data_hash ?? null
  };
  const mismatches = Object.keys(requested)
    .filter(key => requested[key] !== actual[key])
    .map(key => ({ field: key, requested: requested[key], installed: actual[key] }));
  if (mismatches.length > 0) {
    throw new GameKbError(
      'ARCHIVE_INSTALLED_IDENTITY_MISMATCH',
      'Requested run does not match the installed data identity',
      { run_id: runId, requested, installed: actual, mismatches }
    );
  }
}

function validateReportBindings(context) {
  const { assembly, verification, installedReceipt, hashes, manifest, metadata, expectedHash } = context;
  const blockingErrors = [...context.workspace.blocking_errors];
  const warnings = [];
  if (typeof expectedHash !== 'string' || expectedHash === '') {
    blockingErrors.push({ code: 'ASSEMBLY_FINAL_HASH_MISSING', path: context.paths.assemblyReport, target: '' });
  }
  if (verification?.passed !== true) {
    blockingErrors.push({ code: 'VERIFICATION_NOT_PASSED', path: context.paths.verificationReport, target: '' });
  }
  const bindings = [
    ['VERIFICATION_SOURCE_HASH_STALE', verification?.source_hash, manifest.source_hash, context.paths.verificationReport],
    ['VERIFICATION_FINAL_HASH_STALE', verification?.final_data_hash, expectedHash, context.paths.verificationReport],
    ['ASSEMBLY_SOURCE_HASH_STALE', assembly?.source_hash, manifest.source_hash, context.paths.assemblyReport],
    ['ASSEMBLY_REVIEW_HASH_STALE', assembly?.review_report_hash, hashes.review, context.paths.assemblyReport],
    ['VERIFICATION_REVIEW_HASH_STALE', verification?.review_report_hash, hashes.review, context.paths.verificationReport],
    ['INSTALL_SOURCE_HASH_STALE', installedReceipt?.source_hash, manifest.source_hash, context.installedReceiptFile],
    ['INSTALL_FINAL_HASH_STALE', installedReceipt?.final_data_hash, expectedHash, context.installedReceiptFile],
    ['INSTALL_VERIFICATION_HASH_STALE', installedReceipt?.verification_report_hash, hashes.verification, context.installedReceiptFile],
    ['INSTALL_REVIEW_HASH_STALE', installedReceipt?.review_report_hash, hashes.review, context.installedReceiptFile]
  ];
  for (const [code, actual, expected, reportPath] of bindings) {
    if (actual !== expected) blockingErrors.push({ code, path: reportPath, target: actual ?? '' });
  }
  const advisory = [
    ['VERIFICATION_REPORT_HASH_MISMATCH', metadata.verification_report_hash, hashes.verification, context.paths.verificationReport],
    ['ID_PLAN_HASH_MISMATCH', metadata.id_plan_hash, hashes.idPlan, context.paths.finalIdPlan],
    ['MIGRATION_RECEIPT_HASH_MISMATCH', metadata.migration_receipt_hash ?? null, hashes.migration, context.paths.chapterImportReceipt]
  ];
  for (const [code, actual, expected, reportPath] of advisory) {
    if (actual !== expected) warnings.push({ code, path: reportPath, target: actual ?? '' });
  }
  return { blockingErrors, warnings };
}

function assertValidWorkspace(context, runId) {
  const { blockingErrors, warnings } = validateReportBindings(context);
  if (blockingErrors.length === 0) return warnings;
  throw new GameKbError(
    'ARCHIVE_WORKSPACE_FINAL_INVALID',
    'Current workspace final data must match assembly and verification evidence before archive-run',
    {
      run_id: runId,
      expected_final_data_hash: context.expectedHash ?? null,
      actual_final_data_hash: context.workspace.final_data_hash,
      blocking_errors: blockingErrors,
      warnings
    }
  );
}

function collectArchiveEvidence(novel, paths, metadata, runId) {
  const { INSTALL_RECEIPT, verifyInstalled } = require('./install');
  const installed = verifyInstalled(novel);
  if (!installed.passed) {
    throw new GameKbError('INSTALLED_VERIFICATION_REQUIRED', 'verify --installed must pass before archive-run', installed);
  }
  assertInstalledIdentity(metadata, installed, runId);
  const manifest = readJson(paths.manifest);
  const assembly = readJson(paths.assemblyReport);
  const verification = readJson(paths.verificationReport);
  const installedReceiptFile = path.join(novel, 'reports', INSTALL_RECEIPT);
  const installedReceipt = readJson(installedReceiptFile);
  const hashes = {
    assembly: sha256File(paths.assemblyReport),
    verification: sha256File(paths.verificationReport),
    install: sha256File(installedReceiptFile),
    review: sha256File(paths.reviewReport),
    idPlan: stableHash(readJson(paths.finalIdPlan)),
    migration: fs.existsSync(paths.chapterImportReceipt) ? sha256File(paths.chapterImportReceipt) : null
  };
  const expectedHash = assembly?.final_data_hash;
  const workspace = inspectWorkspaceFinal(paths, { chapters: manifest.chapters, expectedHash });
  const context = {
    paths, metadata, manifest, assembly, verification, installedReceipt,
    installedReceiptFile, hashes, expectedHash, workspace
  };
  const warnings = assertValidWorkspace(context, runId);
  assertAcceptedArtifacts(paths);
  return { ...context, warnings, artifactManifest: verifyRunArtifacts(paths) };
}

function relocateRunPaths(paths, run) {
  const relocated = { ...paths, run };
  for (const [key, value] of Object.entries(paths)) {
    if (typeof value !== 'string') continue;
    const relative = path.relative(paths.run, value);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      relocated[key] = path.join(run, relative);
    }
  }
  return relocated;
}

function timingEvidenceFields(paths, metadata) {
  if (metadata.timing_contract_version !== TIMING_CONTRACT_VERSION) return {};
  return {
    timing_contract_version: TIMING_CONTRACT_VERSION,
    timing_events_hash: timingEventsHash(paths.events)
  };
}

function buildArchiveReceipt(context, paths, archiveDir, archivedAt) {
  const timing = timingEvidenceFields(paths, context.metadata);
  return {
    schema_version: Object.keys(timing).length > 0 ? 2 : 1,
    semantic_contract_version: context.metadata.semantic_contract_version,
    ...timing,
    status: 'archived',
    run_id: context.metadata.run_id,
    archive_dir: archiveDir,
    archived_at: archivedAt,
    artifact_manifest_hash: sha256File(paths.artifactManifest),
    assembly_report_hash: context.hashes.assembly,
    verification_report_hash: context.hashes.verification,
    install_receipt_hash: context.hashes.install,
    review_report_hash: context.hashes.review,
    source_hash: context.manifest.source_hash,
    final_data_hash: context.expectedHash,
    id_plan_hash: context.hashes.idPlan,
    migration_receipt_hash: context.hashes.migration,
    warnings: context.warnings,
    artifact_count: context.artifactManifest.entries.length,
    metrics_hash: sha256File(paths.runMetrics)
  };
}

function verifyArchivedTimingEvidence(runDir) {
  try {
    const metadata = readJson(path.join(runDir, 'run.json'));
    if (metadata.timing_contract_version === undefined) return;
    if (metadata.timing_contract_version !== TIMING_CONTRACT_VERSION) throw new Error('unsupported timing contract');
    const events = path.join(runDir, 'events.jsonl');
    const metricsFile = path.join(runDir, 'reports', 'run-metrics.json');
    const receipt = readJson(path.join(runDir, 'archive-receipt.json'));
    const metrics = readJson(metricsFile);
    readTimingEvents(events);
    const eventHash = timingEventsHash(events);
    const valid = receipt.timing_contract_version === TIMING_CONTRACT_VERSION
      && receipt.timing_events_hash === eventHash
      && metrics.timing_events_hash === eventHash
      && receipt.metrics_hash === sha256File(metricsFile)
      && metrics.schema_version === 2;
    if (!valid) throw new Error('timing hashes or versions do not match');
  } catch (error) {
    if (error.code === 'TIMING_EVIDENCE_INVALID') throw error;
    throw new GameKbError('TIMING_EVIDENCE_INVALID', 'Archived timing evidence is invalid', {
      run_dir: runDir,
      cause: error.message
    });
  }
}

module.exports = {
  buildArchiveReceipt,
  collectArchiveEvidence,
  relocateRunPaths,
  sha256File,
  verifyArchivedTimingEvidence,
  verifyRunArtifacts
};
