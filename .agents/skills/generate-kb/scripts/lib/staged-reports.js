#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { PipelineError } = require('./atomic-json');

const CONTROLLER_PRODUCER = 'generate-kb-controller';

function runJsonReport(scriptName, novelDir, dataRoot, finalDataHash) {
  const scriptPath = path.join(__dirname, '..', scriptName);
  const result = spawnSync(process.execPath, [
    scriptPath,
    novelDir,
    '--data-root', dataRoot,
    '--expected-final-data-hash', finalDataHash,
    '--dry-run',
    '--json'
  ], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error || result.signal) {
    throw new PipelineError(
      'PUBLISH_REPORT_GENERATION_FAILED',
      `${scriptName} could not complete: ${result.error?.message ?? result.signal}`
    );
  }
  try {
    return JSON.parse(result.stdout.trim());
  } catch (error) {
    const detail = String(result.stderr ?? '').trim().split(/\r?\n/).slice(-1)[0];
    throw new PipelineError(
      'PUBLISH_REPORT_GENERATION_FAILED',
      `${scriptName} did not return a JSON report${detail ? `: ${detail}` : ''}`
    );
  }
}

function gate(details, reasons) {
  return { passed: reasons.length === 0, reasons, details };
}

function reportErrors(report) {
  return Array.isArray(report?.errors) ? report.errors.map(String) : [];
}

function buildStagedQualityReport(input) {
  const {
    novelDir,
    finalDataHash,
    generatedAt,
    sourceValidation,
    finalDataValidation,
    verificationReport,
    crossValidationReport,
    semanticAuditReport,
    reviewPacket,
    stageEvidence = {}
  } = input;
  const sourceEvidence = {
    source_validation: sourceValidation,
    prepare: stageEvidence.prepare ?? null,
    inventory: stageEvidence.inventory ?? null
  };
  const ledgerEvidence = stageEvidence.reconcile ?? {
    stage: 'reconcile',
    status: 'unknown'
  };
  const reviewEvidence = {
    ...stageEvidence.recall,
    review_packet: reviewPacket
  };
  const finalEvidence = {
    final_data_validation: finalDataValidation,
    verification: verificationReport
  };
  const verificationReasons = [
    ...(verificationReport.file_errors ?? []).map(String),
    ...(verificationReport.grand_total?.weak === 0
      ? [] : [`verification has ${verificationReport.grand_total?.weak ?? 'unknown'} weak refs`]),
    ...(verificationReport.grand_total?.unverified === 0
      ? [] : [`verification has ${verificationReport.grand_total?.unverified ?? 'unknown'} unverified refs`]),
    ...(verificationReport.no_ref_count === 0
      ? [] : [`verification has ${verificationReport.no_ref_count ?? 'unknown'} entities without refs`])
  ];
  const crossErrors = Number(crossValidationReport.summary?.errors);
  const crossReasons = Number.isInteger(crossErrors) && crossErrors === 0
    ? []
    : [`cross validation has ${Number.isInteger(crossErrors) ? crossErrors : 'unknown'} errors`];
  const sourceReasons = [
    ...(sourceValidation.passed === true ? [] : reportErrors(sourceValidation).length > 0
      ? reportErrors(sourceValidation)
      : ['source validation did not pass']),
    ...(sourceEvidence.prepare?.status === 'passed' ? [] : ['prepare stage did not pass']),
    ...(sourceEvidence.inventory?.status === 'passed' ? [] : ['inventory stage did not pass'])
  ];
  const ledgerReasons = ledgerEvidence.status === 'passed'
    ? [] : ['reconcile ledger stage did not pass'];
  const finalReasons = finalDataValidation.passed === true
    ? []
    : [
      ...reportErrors(finalDataValidation),
      ...(finalDataValidation.schema_errors ?? []).map(String),
      ...(finalDataValidation.enrichment_errors ?? []).map(String)
    ];
  const gates = {
    G1: gate(sourceEvidence, sourceReasons),
    G2: gate(ledgerEvidence, ledgerReasons),
    G3: gate(finalEvidence, [...finalReasons, ...verificationReasons]),
    G4: gate(reviewEvidence, reviewPacket?.status && reviewPacket.status !== 'needs_ai_review'
      ? [] : ['recall review still requires AI review']),
    G5: gate({ semantic_audit: semanticAuditReport, cross_validation: crossValidationReport }, [
      ...(semanticAuditReport.passed === true ? [] : reportErrors(semanticAuditReport).length > 0
        ? reportErrors(semanticAuditReport)
        : ['semantic audit did not pass']),
      ...crossReasons
    ])
  };
  return {
    schema_version: 1,
    generated_at: generatedAt,
    generated_by: CONTROLLER_PRODUCER,
    novel: path.basename(novelDir),
    final_data_hash: finalDataHash,
    completion_gate_passed: Object.values(gates).every(value => value.passed),
    gates
  };
}

function buildStagedReports(input) {
  const verificationReport = runJsonReport(
    'verify.js', input.novelDir, input.dataRoot, input.finalDataHash
  );
  const crossValidationReport = runJsonReport(
    'cross-validate.js', input.novelDir, input.dataRoot, input.finalDataHash
  );
  const normalizedVerification = {
    ...verificationReport,
    generated_at: input.generatedAt,
    generated_by: CONTROLLER_PRODUCER
  };
  const normalizedCrossValidation = {
    ...crossValidationReport,
    generated_at: input.generatedAt,
    generated_by: CONTROLLER_PRODUCER
  };
  return {
    ...input.reportInputs,
    verification_report: normalizedVerification,
    cross_validation_report: normalizedCrossValidation,
    quality_report: buildStagedQualityReport({
      ...input,
      verificationReport: normalizedVerification,
      crossValidationReport: normalizedCrossValidation,
      sourceValidation: input.reportInputs.source_validation,
      semanticAuditReport: input.reportInputs.semantic_audit_report,
      reviewPacket: input.reportInputs.review_packet
    })
  };
}

module.exports = {
  CONTROLLER_PRODUCER,
  buildStagedQualityReport,
  buildStagedReports,
  runJsonReport
};
