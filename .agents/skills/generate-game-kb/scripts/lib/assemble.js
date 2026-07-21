'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { GameKbError } = require('./errors');
const { readJson } = require('./io');
const { stableHash } = require('./io');
const { assembleDeterministicBook } = require('./book-assembly');
const { assignStableIds } = require('./ids');
const { buildReviewReport, hashReport } = require('./review-report');

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

function assembleRun({ paths }) {
  const manifest = readJson(paths.manifest);
  const chapters = loadAcceptedChapters(paths);

  if (chapters.length === 0) {
    throw new GameKbError('NO_ACCEPTED_CHAPTERS', 'No accepted chapters found for assembly', {
      chapters_dir: paths.chapters
    });
  }

  const { book, deterministic_audit, review_warnings, manual_review } =
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

  fs.mkdirSync(paths.finalData, { recursive: true });
  writeFinalYaml(paths.finalData, 'characters', recordsByCategory.characters || []);
  writeFinalYaml(paths.finalData, 'skills', recordsByCategory.skills || []);
  writeFinalYaml(paths.finalData, 'items', recordsByCategory.items || []);
  writeFinalYaml(paths.finalData, 'factions', recordsByCategory.factions || []);
  writeFinalYaml(paths.finalData, 'chapter_summaries', book.chapter_summaries);

  fs.mkdirSync(path.dirname(paths.finalIdPlan), { recursive: true });
  fs.writeFileSync(paths.finalIdPlan, `${JSON.stringify(idPlan, null, 2)}\n`, 'utf8');

  const sourceHash = manifest.source_hash || '';
  const finalDataHash = stableHash(recordsByCategory);
  const reviewReport = buildReviewReport({ sourceHash, finalDataHash, warnings: review_warnings });
  const reviewReportHash = hashReport(reviewReport);

  fs.mkdirSync(paths.finalReports, { recursive: true });
  fs.writeFileSync(paths.reviewReport, `${JSON.stringify(reviewReport, null, 2)}\n`, 'utf8');

  const deterministicAuditHash = stableHash(deterministic_audit);
  const assemblyReport = {
    schema_version: 7,
    source_hash: sourceHash,
    final_data_hash: finalDataHash,
    deterministic_audit_hash: deterministicAuditHash,
    review_report_hash: reviewReportHash,
    deterministic_audit,
    chapter_count: chapters.length,
    entity_counts: {
      characters: (recordsByCategory.characters || []).length,
      skills: (recordsByCategory.skills || []).length,
      items: (recordsByCategory.items || []).length,
      factions: (recordsByCategory.factions || []).length,
      chapter_summaries: book.chapter_summaries.length
    }
  };
  fs.writeFileSync(paths.assemblyReport, `${JSON.stringify(assemblyReport, null, 2)}\n`, 'utf8');

  return {
    status: 'assembled',
    chapter_count: chapters.length,
    entity_counts: assemblyReport.entity_counts,
    review_warnings: review_warnings.length,
    assembly_report: paths.assemblyReport,
    review_report: paths.reviewReport
  };
}

module.exports = { assembleRun };
