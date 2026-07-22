'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson, stableHash } = require('./io');
const { assembleDeterministicBook } = require('./book-assembly');
const { assignStableIds } = require('./ids');
const { resolveReferences } = require('./finalize');
const { buildReferenceRecoveryReport } = require('./reference-recovery');
const { buildReviewReport, hashReport } = require('./review-report');
const { hashFinalData } = require('./final-data-hash');

function loadAcceptedChapters(paths) {
  const dir = paths.chapters;
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.yaml'))
    .sort()
    .map(f => yaml.load(fs.readFileSync(path.join(dir, f), 'utf8')));
}

function writeFinalYaml(dir, name, records) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.yaml`);
  fs.writeFileSync(file, yaml.dump(records, { noRefs: true, lineWidth: -1 }), 'utf8');
  return file;
}

function writeReferenceRecovery(paths, manifest, chapterCount, issues, relationProvenance) {
  const report = buildReferenceRecoveryReport({
    parentRun: paths.runId,
    sourceHash: manifest.source_hash || '',
    artifactManifestHash: stableHash(readJson(paths.artifactManifest)),
    issues,
    relationProvenance
  });
  fs.mkdirSync(paths.reports, { recursive: true });
  atomicWriteJson(paths.referenceRecovery, report);
  atomicWriteJson(paths.manualReview, report.recovery_units);
  return {
    status: 'manual_review',
    chapter_count: chapterCount,
    manual_review: report.recovery_units,
    reference_recovery_report: paths.referenceRecovery
  };
}

function publishFinalAssembly(input) {
  const { paths, manifest, chapters, finalData, idPlan, deterministicAudit, reviewWarnings } = input;
  for (const [name, filename] of [
    ['characters', 'characters.yaml'],
    ['skills', 'skills.yaml'],
    ['items', 'items.yaml'],
    ['factions', 'factions.yaml'],
    ['chapter_summaries', 'chapter_summaries.yaml']
  ]) writeFinalYaml(paths.finalData, name, finalData[filename]);
  atomicWriteJson(paths.finalIdPlan, idPlan);

  const sourceHash = manifest.source_hash || '';
  const finalDataHash = hashFinalData(finalData);
  const reviewReport = buildReviewReport({ sourceHash, finalDataHash, warnings: reviewWarnings });
  const assemblyReport = {
    schema_version: 7,
    source_hash: sourceHash,
    final_data_hash: finalDataHash,
    deterministic_audit_hash: stableHash(deterministicAudit),
    review_report_hash: hashReport(reviewReport),
    deterministic_audit: deterministicAudit,
    chapter_count: chapters.length,
    entity_counts: Object.fromEntries([
      ['characters', 'characters.yaml'], ['skills', 'skills.yaml'], ['items', 'items.yaml'],
      ['factions', 'factions.yaml'], ['chapter_summaries', 'chapter_summaries.yaml']
    ].map(([category, filename]) => [category, finalData[filename].length]))
  };
  atomicWriteJson(paths.reviewReport, reviewReport);
  atomicWriteJson(paths.assemblyReport, assemblyReport);
  atomicWriteJson(paths.manualReview, []);
  return {
    status: 'assembled',
    chapter_count: chapters.length,
    entity_counts: assemblyReport.entity_counts,
    review_warnings: reviewWarnings.length,
    assembly_report: paths.assemblyReport,
    review_report: paths.reviewReport
  };
}

function assembleRun({ paths }) {
  const manifest = readJson(paths.manifest);
  const chapters = loadAcceptedChapters(paths);

  if (chapters.length === 0) {
    throw new GameKbError('NO_ACCEPTED_CHAPTERS', 'No accepted chapters found for assembly', {
      chapters_dir: paths.chapters
    });
  }

  const { book, deterministic_audit, relation_provenance, review_warnings, manual_review } =
    assembleDeterministicBook({ manifest, chapters });

  if (manual_review.length > 0) {
    throw new GameKbError('ASSEMBLY_BLOCKED', 'Identity collisions require manual review', {
      manual_review
    });
  }

  const priorPlan = fs.existsSync(paths.finalIdPlan) ? readJson(paths.finalIdPlan) : {};
  const { recordsByCategory, idPlan } = assignStableIds({
    characters: book.characters,
    skills: book.skills,
    items: book.items,
    factions: book.factions
  }, priorPlan);

  const projection = resolveReferences({
    ...recordsByCategory,
    chapter_summaries: book.chapter_summaries
  });
  if (projection.issues.length > 0) {
    return writeReferenceRecovery(
      paths, manifest, chapters.length, projection.issues, relation_provenance
    );
  }
  return publishFinalAssembly({
    paths,
    manifest,
    chapters,
    finalData: projection.data,
    idPlan,
    deterministicAudit: deterministic_audit,
    reviewWarnings: review_warnings,
    manualReview: manual_review
  });
}

module.exports = { assembleRun };
