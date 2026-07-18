'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { semanticDecisionFile, stableHash } = require('./accept');
const { applyBasicCurate, validateBasicCurateDraft } = require('./basic-curate');
const {
  acceptedArtifactHash,
  assertAcceptedArtifacts,
  readArtifactManifest
} = require('./candidate-ledger');
const { assembleDomainMergedBook, assembleGroundedBook } = require('./domain-assembly');
const { GameKbError } = require('./errors');
const { hashFinalData } = require('./final-data-hash');
const { buildFinalData, writeFinalDataAtomic } = require('./finalize');
const { atomicWriteJson, readJson, readYaml } = require('./io');
const {
  DOMAIN_UNITS,
  PROFILE_V4,
  requiredDomainUnitsForProfile
} = require('./semantic-contract');
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

function finalHashesFor(data) {
  return Object.fromEntries(Object.entries(data).map(([filename, records]) => [filename, stableHash(records)]));
}

function registryLedgerEntry(paths) {
  const relativePath = path.relative(paths.run, paths.candidateRegistry).split(path.sep).join('/');
  return readArtifactManifest(paths).entries.find(entry => entry.relative_path === relativePath);
}

function finalizeAssembly({ paths, manifest, book, report }) {
  const priorIdPlan = fs.existsSync(paths.finalIdPlan) ? readJson(paths.finalIdPlan) : {};
  const result = buildFinalData(book, manifest, priorIdPlan);
  if (result.issues.length > 0) {
    throw new GameKbError('FINAL_PROJECTION_FAILED', 'Assembled data contains unresolved final projection issues', {
      issues: result.issues
    });
  }
  const finalDataHash = hashFinalData(result.data);
  const idPlanHash = stableHash(result.id_plan);
  const counts = countsFor(result.data);
  const completeReport = {
    ...report,
    candidate_resolution_count: book.candidate_resolutions.length,
    candidate_resolution_hash: stableHash(book.candidate_resolutions),
    id_plan_hash: idPlanHash,
    final_data_hash: finalDataHash,
    final_hashes: finalHashesFor(result.data),
    counts,
    warnings: result.warnings
  };
  result.assembly_report = completeReport;
  writeFinalDataAtomic(paths, result);
  return {
    final_data_hash: finalDataHash,
    id_plan_hash: idPlanHash,
    counts,
    data_dir: paths.finalData,
    report: paths.assemblyReport
  };
}

function assembleRunV4({ paths, manifest, acceptedHashes, chapters, semanticContractVersion }) {
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
  return finalizeAssembly({
    paths,
    manifest,
    book,
    report: {
    schema_version: 1,
    semantic_contract_version: semanticContractVersion,
    source_hash: manifest.source_hash,
    accepted_hashes: acceptedHashes,
    decision_hashes: decisionHashes,
    candidate_count: candidateCount(registry)
    }
  });
}

function assembleRunV5({ paths, manifest, acceptedHashes, chapters, semanticContractVersion }) {
  const registryHash = acceptedArtifactHash(paths, paths.candidateRegistry);
  const registry = readJson(paths.candidateRegistry);
  const curatePath = path.join(path.dirname(paths.candidateRegistry), 'basic-curate.json');
  let curatedRegistry = registry;
  let curateHash = null;
  if (fs.existsSync(curatePath)) {
    curateHash = acceptedArtifactHash(paths, curatePath);
    const artifact = readJson(curatePath);
    const errors = validateBasicCurateDraft({
      schema_version: artifact?.schema_version,
      decisions: artifact?.decisions
    }, registry);
    curatedRegistry = errors.length === 0 ? applyBasicCurate(registry, artifact.decisions) : null;
    if (artifact?.input_hash !== stableHash(registry)
      || errors.length > 0
      || artifact?.curated_registry_hash !== stableHash(curatedRegistry)) {
      throw new GameKbError('BASIC_CURATE_ACCEPTED_INVALID', 'Accepted basic curation is invalid or stale', { errors });
    }
  }
  const book = assembleGroundedBook({
    manifest,
    chapters,
    registry: curatedRegistry,
    source_registry: registry
  });
  return finalizeAssembly({
    paths,
    manifest,
    book,
    report: {
      schema_version: 1,
      semantic_contract_version: semanticContractVersion,
      source_hash: manifest.source_hash,
      accepted_hashes: acceptedHashes,
      registry_ledger: registryLedgerEntry(paths),
      registry_hash: registryHash,
      curate_hash: curateHash,
      candidate_count: candidateCount(registry)
    }
  });
}

function assembleRun({ paths, profile }) {
  assertAcceptedArtifacts(paths);
  const run = readJson(paths.runJson);
  const manifest = readJson(paths.manifest);
  const { acceptedHashes, chapters } = loadAcceptedChapters(paths, manifest);
  const selectedProfile = profile || run.profile || PROFILE_V4;
  const requiredDomains = requiredDomainUnitsForProfile(selectedProfile, run.semantic_contract_version);
  if (requiredDomains.length > 0) {
    return assembleRunV4({
      paths, manifest, acceptedHashes, chapters, semanticContractVersion: run.semantic_contract_version
    });
  }
  return assembleRunV5({
    paths, manifest, acceptedHashes, chapters, semanticContractVersion: run.semantic_contract_version
  });
}

module.exports = { assembleRun };
