'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const {
  assertAcceptedArtifacts,
  ensureAcceptedArtifact,
  readArtifactManifest
} = require('./candidate-ledger');
const { createProgress, assertProgressInvariant } = require('./chapter-progress');
const { activeJobMetadata, issueNextWindow } = require('./chapter-work');
const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson, stableHash, writeImmutableFile } = require('./io');
const { pathsFor } = require('./paths');
const { hashReferenceRecoveryReport } = require('./reference-recovery');
const { createOrResumeRun, resolveRunReadOnly, sourceState } = require('./run');
const { prepareNovel } = require('./source');

function recoveryError(code, message, details = {}) {
  throw new GameKbError(code, message, details);
}

function unitName(number) {
  return `chapter:${String(number).padStart(3, '0')}`;
}

function chapterFile(paths, unit) {
  return path.join(paths.chapters, `${unit.replaceAll(':', '_')}.yaml`);
}

function recoveryRunId(parentRun, reportHash) {
  const suffix = `relation-recovery-${reportHash.slice('sha256:'.length, 'sha256:'.length + 12)}`;
  const prefix = parentRun.slice(0, 127 - suffix.length - 1);
  return `${prefix}-${suffix}`;
}

function validateReferenceReport(parentPaths, manifest) {
  if (!fs.existsSync(parentPaths.referenceRecovery)) {
    recoveryError('REFERENCE_RECOVERY_REPORT_MISSING', 'Parent run has no relationship recovery report');
  }
  const report = readJson(parentPaths.referenceRecovery);
  if (report.schema_version !== 1 || report.parent_run !== parentPaths.runId
    || report.source_hash !== manifest.source_hash
    || !Array.isArray(report.recovery_units) || report.recovery_units.length === 0
    || !Array.isArray(report.relationships)) {
    recoveryError('REFERENCE_RECOVERY_REPORT_INVALID', 'Relationship recovery report is invalid');
  }
  if (hashReferenceRecoveryReport(report) !== report.report_hash) {
    recoveryError('REFERENCE_RECOVERY_REPORT_HASH_INVALID', 'Relationship recovery report hash is stale');
  }
  const artifactManifest = readArtifactManifest(parentPaths);
  if (stableHash(artifactManifest) !== report.artifact_manifest_hash) {
    recoveryError('REFERENCE_RECOVERY_ARTIFACT_HASH_INVALID', 'Parent artifact manifest changed after report creation');
  }
  assertAcceptedArtifacts(parentPaths);
  return { report, artifactManifest };
}

function validateParentState(parentPaths, manifest, report) {
  const progress = readJson(parentPaths.progress);
  const knownUnits = manifest.chapters.map(chapter => unitName(chapter.number));
  if (report.recovery_units.some(unit => !knownUnits.includes(unit))) {
    recoveryError('REFERENCE_RECOVERY_UNIT_INVALID', 'Recovery report contains an unknown chapter');
  }
  const incomplete = knownUnits.filter(unit => progress.units?.[unit]?.status !== 'accepted');
  if (incomplete.length > 0) {
    recoveryError('REFERENCE_RECOVERY_PARENT_INCOMPLETE', 'Parent run chapters are not all accepted', {
      units: incomplete
    });
  }
  return progress;
}

function parentChapterEntry(parentPaths, artifactManifest, unit) {
  const relativePath = `accepted/chapters/${unit.replaceAll(':', '_')}.yaml`;
  const entry = artifactManifest.entries.find(value => value.relative_path === relativePath);
  const file = chapterFile(parentPaths, unit);
  if (!entry || !fs.existsSync(file)) {
    recoveryError('REFERENCE_RECOVERY_PARENT_ARTIFACT_MISSING', 'Parent accepted chapter is missing', {
      unit,
      relative_path: relativePath
    });
  }
  return { entry, file, relativePath };
}

function ensureRecoveryInput(file, content) {
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== content) {
      recoveryError('REFERENCE_RECOVERY_INPUT_CONFLICT', 'Recovery input already exists with different content', {
        file
      });
    }
    return;
  }
  writeImmutableFile(file, content, 'REFERENCE_RECOVERY_INPUT_EXISTS');
}

function carryAcceptedChapter(childPaths, parentArtifact, unit, progress) {
  const value = yaml.load(fs.readFileSync(parentArtifact.file, 'utf8'));
  const childEntry = ensureAcceptedArtifact(
    childPaths,
    chapterFile(childPaths, unit),
    parentArtifact.entry.input_hash,
    value,
    { acceptedAt: parentArtifact.entry.accepted_at }
  );
  if (childEntry.content_hash !== parentArtifact.entry.content_hash) {
    recoveryError('REFERENCE_RECOVERY_CARRY_HASH_MISMATCH', 'Carry-forward chapter changed during serialization', {
      unit
    });
  }
  progress.units[unit] = {
    status: 'accepted', cycle: 1, attempt: 1, producer: 'carry-forward',
    input_hash: parentArtifact.entry.input_hash,
    input_file: null, output_file: null, output_hash: childEntry.content_hash,
    reject_reason: null, repair_allowed: false, errors: []
  };
}

function relationshipErrors(report, chapterNumber) {
  return report.relationships
    .filter(relationship => relationship.source_chapters.includes(chapterNumber))
    .map(relationship => structuredClone(relationship));
}

function buildRecoveryState(parent, childPaths, manifest, report, artifactManifest) {
  const progress = createProgress(manifest);
  progress.recovery_units = [...report.recovery_units];
  const recoverySet = new Set(report.recovery_units);
  const carriedUnits = [];
  const unitContext = {};

  for (const chapter of manifest.chapters) {
    const unit = unitName(chapter.number);
    const parentArtifact = parentChapterEntry(parent.paths, artifactManifest, unit);
    if (!recoverySet.has(unit)) {
      carryAcceptedChapter(childPaths, parentArtifact, unit, progress);
      carriedUnits.push(unit);
      continue;
    }
    const inputFile = path.join(childPaths.recoveryInputs, `${unit.replaceAll(':', '_')}.yaml`);
    ensureRecoveryInput(inputFile, fs.readFileSync(parentArtifact.file, 'utf8'));
    unitContext[unit] = {
      parent_accepted_draft: inputFile,
      parent_accepted_hash: parentArtifact.entry.content_hash,
      relationship_errors: relationshipErrors(report, chapter.number)
    };
  }
  return { progress, carriedUnits, unitContext };
}

function hashRecoveryReceipt(receipt) {
  const { receipt_hash: ignored, ...unsigned } = receipt;
  void ignored;
  return stableHash(unsigned);
}

function writeRecoveryMetadata(childPaths, parentRun, report, state) {
  const receipt = {
    schema_version: 1,
    run_id: childPaths.runId,
    parent_run: parentRun,
    source_hash: report.source_hash,
    artifact_manifest_hash: report.artifact_manifest_hash,
    report_hash: report.report_hash,
    carried_units: state.carriedUnits,
    reopened_units: [...report.recovery_units],
    unit_context: state.unitContext
  };
  receipt.receipt_hash = hashRecoveryReceipt(receipt);
  atomicWriteJson(childPaths.recoveryReceipt, receipt);
  const metadata = readJson(childPaths.runJson);
  atomicWriteJson(childPaths.runJson, {
    ...metadata,
    run_kind: 'relation-recovery',
    parent_run: parentRun,
    recovery_receipt_hash: receipt.receipt_hash
  });
  return receipt;
}

function resumeRecovery(child, childPaths, parentRun, reportHash) {
  const receipt = readJson(childPaths.recoveryReceipt);
  if (receipt.parent_run !== parentRun || receipt.report_hash !== reportHash
    || hashRecoveryReceipt(receipt) !== receipt.receipt_hash) {
    recoveryError('RECOVERY_RECEIPT_INVALID', 'Existing recovery receipt does not match its parent report');
  }
  const manifest = readJson(childPaths.manifest);
  let progress = readJson(childPaths.progress);
  assertProgressInvariant(progress, manifest, childPaths);
  let jobs = activeJobMetadata(childPaths, progress);
  if (jobs.length === 0 && Object.values(progress.units).some(state => state.status === 'pending')) {
    const issued = issueNextWindow({ paths: childPaths, manifest, progress });
    progress = issued.progress;
    jobs = issued.jobs;
    atomicWriteJson(childPaths.progress, progress);
  }
  return { child, progress, jobs };
}

function initializeRecoveryRun({
  novelDir, parentRun, parentPaths, manifest, artifactManifest, report, child, childPaths
}) {
  const childManifest = prepareNovel(novelDir, { runId: child.run_id });
  if (childManifest.source_hash !== report.source_hash
    || stableHash(childManifest.chapters.map(chapter => ({
      number: chapter.number, title: chapter.title, input_hash: chapter.input_hash
    }))) !== stableHash(manifest.chapters.map(chapter => ({
      number: chapter.number, title: chapter.title, input_hash: chapter.input_hash
    })))) {
    recoveryError('REFERENCE_RECOVERY_SOURCE_MISMATCH', 'Derived run source snapshot differs from parent');
  }
  const state = buildRecoveryState(
    { run: parentRun, paths: parentPaths }, childPaths, childManifest, report, artifactManifest
  );
  writeRecoveryMetadata(childPaths, parentRun.run_id, report, state);
  atomicWriteJson(childPaths.progress, state.progress);
  const issued = issueNextWindow({ paths: childPaths, manifest: childManifest, progress: state.progress });
  atomicWriteJson(childPaths.progress, issued.progress);
  return { child, parentRun, progress: issued.progress, jobs: issued.jobs };
}

function removeIncompleteRecoveryRun(childPaths, cause) {
  try {
    fs.rmSync(childPaths.run, { recursive: true, force: true });
  } catch (cleanupError) {
    recoveryError('RECOVERY_CLEANUP_FAILED', 'Failed to remove an incomplete recovery run', {
      run_id: childPaths.runId,
      cause_code: cause?.code || null,
      cleanup_error: cleanupError.message
    });
  }
}

function createRelationRecoveryRun(novelDir, parentRunId) {
  const parentRun = resolveRunReadOnly(novelDir, parentRunId);
  if (parentRun.semantic_contract_version !== 7) {
    recoveryError('LEGACY_SEMANTIC_CONTRACT', 'Relationship recovery requires a v7 parent run');
  }
  const parentPaths = pathsFor(novelDir, parentRun.run_id);
  if (path.resolve(parentRun.run_dir).toLowerCase() !== path.resolve(parentPaths.run).toLowerCase()) {
    recoveryError('REFERENCE_RECOVERY_PARENT_ARCHIVED', 'Archived parent runs cannot open active recovery work');
  }
  const manifest = readJson(parentPaths.manifest);
  const { report, artifactManifest } = validateReferenceReport(parentPaths, manifest);
  validateParentState(parentPaths, manifest, report);
  if (parentRun.source_hash !== report.source_hash
    || sourceState(novelDir).sourceHash !== report.source_hash) {
    recoveryError('REFERENCE_RECOVERY_SOURCE_MISMATCH', 'Novel source changed after the parent report');
  }

  const childRunId = recoveryRunId(parentRun.run_id, report.report_hash);
  const child = createOrResumeRun(novelDir, { runId: childRunId });
  const childPaths = pathsFor(novelDir, childRunId);
  if (child.resumed && fs.existsSync(childPaths.recoveryReceipt)) {
    return { ...resumeRecovery(child, childPaths, parentRun.run_id, report.report_hash), parentRun };
  }
  if (child.resumed) {
    recoveryError('RECOVERY_RUN_ID_CONFLICT', 'Derived recovery run id already exists without a receipt', {
      run_id: childRunId
    });
  }

  try {
    return initializeRecoveryRun({
      novelDir, parentRun, parentPaths, manifest, artifactManifest, report, child, childPaths
    });
  } catch (error) {
    removeIncompleteRecoveryRun(childPaths, error);
    throw error;
  }
}

module.exports = { createRelationRecoveryRun, hashRecoveryReceipt, recoveryRunId };
