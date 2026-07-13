#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { auditRecall } = require('./audit-recall');
const { collectEvidenceIntegrity, collectSemanticCoverage } = require('./lib/audits');
const { computeFinalDataHash } = require('./lib/final-data-contract');
const { evaluateHardGates } = require('./lib/quality-gates');
const { assertLegacyWriteAllowed } = require('./lib/managed-write');
const {
  assertExpectedFinalDataHash,
  parseArtifactArgs,
  resolveArtifactRoots
} = require('./lib/report-context');
const { buildReviewPacket } = require('./lib/review-readiness');
const { validateInventory } = require('./validate-inventory');

const DATA_FILES = [
  'characters.json', 'factions.json', 'locations.json', 'skills.json',
  'techniques.json', 'items.json', 'dialogues.json', 'chapter_summaries.json'
];

function loadArray(filename) {
  if (!fs.existsSync(filename)) return [];
  const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
  return Array.isArray(value) ? value : [];
}

function collectRawCounts(novelDir, options = {}) {
  const roots = resolveArtifactRoots(novelDir, options);
  return Object.fromEntries(DATA_FILES.map(filename => [
    filename.replace('.json', ''),
    loadArray(path.join(roots.dataRoot, filename)).length
  ]));
}

function assessQuality(novelDir, options = {}) {
  const roots = resolveArtifactRoots(novelDir, options);
  const finalDataHash = computeFinalDataHash(novelDir, { dataRoot: roots.dataRoot });
  assertExpectedFinalDataHash(finalDataHash, roots.expectedFinalDataHash);
  const inventory = validateInventory(novelDir, roots);
  const evidence = collectEvidenceIntegrity(novelDir, roots);
  const recall = auditRecall(novelDir, roots);
  const semantic = collectSemanticCoverage(novelDir, roots);
  const gateReport = evaluateHardGates({
    source_coverage: inventory.source,
    ledger_closure: inventory.ledger,
    evidence_integrity: evidence,
    recall_evidence: recall,
    semantic_coverage: semantic
  });

  const report = {
    generated_at: gateReport.generated_at,
    novel: path.basename(novelDir),
    baseline_mode: recall.gold_status,
    final_data_hash: finalDataHash,
    completion_gate_passed: gateReport.completion_gate_passed,
    gates: gateReport.gates,
    raw_counts: collectRawCounts(novelDir, roots)
  };
  const packet = buildReviewPacket(novelDir, { ...roots, qualityReport: report });
  report.review_readiness = packet.review_readiness;
  return report;
}

function reportMarkdown(report) {
  const lines = [
    `# ${report.novel} Quality Gate`,
    '',
    `Completion gate: **${report.completion_gate_passed ? 'PASS' : 'FAIL'}**`,
    `Gold status: \`${report.baseline_mode}\``,
    `Review readiness: **${report.review_readiness?.status ?? 'blocked'}**`,
    '',
    '## Review Readiness',
    '',
    `- ${report.review_readiness?.message ?? 'Review readiness was not calculated.'}`,
    `- Blocking alerts: ${report.review_readiness?.blocking_alert_count ?? 0}`,
    `- Warnings: ${report.review_readiness?.warning_count ?? 0}`,
    `- High-risk decisions: ${report.review_readiness?.high_risk_total ?? 0}`,
    '',
    '## Hard Gates',
    ''
  ];
  for (const [id, gate] of Object.entries(report.gates)) {
    lines.push(`### ${id}: ${gate.passed ? 'PASS' : 'FAIL'}`);
    if (gate.reasons.length === 0) lines.push('- No blocking findings.');
    else gate.reasons.forEach(reason => lines.push(`- ${reason}`));
    lines.push('');
  }
  lines.push('## Raw Counts', '');
  for (const [category, count] of Object.entries(report.raw_counts)) {
    lines.push(`- ${category}: ${count}`);
  }
  lines.push('');
  return lines.join('\n');
}

function writeReports(novelDir, report, options = {}) {
  assertLegacyWriteAllowed(novelDir, { operation: 'assess-quality reports' });
  const reportsDir = resolveArtifactRoots(novelDir, options).reportsRoot;
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'quality_report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(reportsDir, 'quality_report.md'), `${reportMarkdown(report)}\n`);
}

if (require.main === module) {
  try {
    const context = parseArtifactArgs(process.argv.slice(2), {
      booleanFlags: ['--report-only', '--dry-run'],
      usage: 'Usage: node assess-quality.js <novel-dir> [--bundle-root DIR | --data-root DIR --reports-root DIR] [--build-root DIR] [--expected-final-data-hash HASH] [--report-only] [--dry-run]'
    });
    const reportOnly = context.flags.has('--report-only');
    const dryRun = context.flags.has('--dry-run');
    const report = assessQuality(context.novelDir, context);
    if (!dryRun) writeReports(context.novelDir, report, context);
    console.log(`Completion gate: ${report.completion_gate_passed ? 'PASS' : 'FAIL'}`);
    for (const [id, gate] of Object.entries(report.gates)) {
      console.log(`${id}: ${gate.passed ? 'PASS' : `FAIL (${gate.reasons.length})`}`);
    }
    if (!report.completion_gate_passed && !reportOnly) process.exitCode = 1;
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { assessQuality, collectRawCounts, reportMarkdown, writeReports };
