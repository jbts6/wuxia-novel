'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { semanticDecisionFile } = require('./accept');
const {
  acceptedArtifactHash,
  assertAcceptedArtifacts
} = require('./candidate-ledger');
const { assembleDomainMergedBook } = require('./domain-assembly');
const { GameKbError } = require('./errors');
const { hashFinalData } = require('./final-data-hash');
const { buildFinalData, writeFinalDataAtomic } = require('./finalize');
const { atomicWriteJson, readJson, readYaml } = require('./io');
const { DOMAIN_UNITS, SEMANTIC_CONTRACT_VERSION } = require('./semantic-contract');
const { readWorkPlan } = require('./semantic-work');

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function chapterUnit(number) {
  return `chapter:${String(number).padStart(3, '0')}`;
}

function loadAcceptedChapters(paths, manifest) {
  const acceptedHashes = {};
  const chapters = [...(manifest.chapters || [])]
    .sort((left, right) => left.number - right.number)
    .map(chapter => {
      const unit = chapterUnit(chapter.number);
      const file = path.join(paths.chapters, `ch_${String(chapter.number).padStart(3, '0')}.yaml`);
      acceptedHashes[unit] = acceptedArtifactHash(paths, file);
      return readYaml(file);
    });
  return { acceptedHashes, chapters };
}

function loadDomainDecisions(paths) {
  const plan = readWorkPlan(paths, 'domain');
  const units = (plan.inputs || []).map(input => input.unit);
  if (!sameValues(units, DOMAIN_UNITS)) {
    throw new GameKbError('DOMAIN_PLAN_INVALID', 'Assembly requires exactly the four stable domain units', {
      expected: DOMAIN_UNITS,
      actual: units
    });
  }
  const decisionHashes = {};
  const decisions = plan.inputs.map(input => {
    const file = semanticDecisionFile(paths, input.unit, input.input_hash);
    decisionHashes[input.unit] = acceptedArtifactHash(paths, file);
    return readYaml(file);
  });
  return { decisionHashes, decisions, plan };
}

function candidateCount(registry) {
  return Object.values(registry?.categories || {}).flatMap(entries => entries || [])
    .reduce((total, entry) => total + (Array.isArray(entry.member_refs) ? entry.member_refs.length : 0), 0);
}

function countsFor(data) {
  return Object.fromEntries(Object.entries(data).map(([filename, records]) => [filename, records.length]));
}

function assembleRun({ paths }) {
  assertAcceptedArtifacts(paths);
  const manifest = readJson(paths.manifest);
  const { acceptedHashes, chapters } = loadAcceptedChapters(paths, manifest);
  const { decisionHashes, decisions, plan } = loadDomainDecisions(paths);
  acceptedArtifactHash(paths, paths.candidateRegistry);
  const registry = readJson(paths.candidateRegistry);
  const book = assembleDomainMergedBook({
    manifest,
    chapters,
    registry,
    work_plan: plan,
    decisions
  });
  const result = buildFinalData(book, manifest);
  if (result.issues.length > 0) {
    throw new GameKbError('FINAL_PROJECTION_FAILED', 'Assembled data contains unresolved final projection issues', {
      issues: result.issues
    });
  }
  const finalDataHash = hashFinalData(result.data);
  const counts = countsFor(result.data);
  const report = {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    source_hash: manifest.source_hash,
    accepted_hashes: acceptedHashes,
    decision_hashes: decisionHashes,
    candidate_count: candidateCount(registry),
    candidate_resolution_count: book.candidate_resolutions.length,
    final_data_hash: finalDataHash,
    counts,
    warnings: result.warnings
  };
  writeFinalDataAtomic(paths, result);
  fs.mkdirSync(paths.finalReports, { recursive: true });
  atomicWriteJson(paths.assemblyReport, report);
  return {
    final_data_hash: finalDataHash,
    counts,
    data_dir: paths.finalData,
    report: paths.assemblyReport
  };
}

module.exports = { assembleRun };
