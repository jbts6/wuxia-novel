#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { auditRecall } = require('./audit-recall');
const { collectEvidenceIntegrity, collectSemanticCoverage } = require('./lib/audits');
const { evaluateHardGates } = require('./lib/quality-gates');
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

function collectRawCounts(novelDir) {
  return Object.fromEntries(DATA_FILES.map(filename => [
    filename.replace('.json', ''),
    loadArray(path.join(novelDir, 'data', filename)).length
  ]));
}

function assessQuality(novelDir) {
  const inventory = validateInventory(novelDir);
  const evidence = collectEvidenceIntegrity(novelDir);
  const recall = auditRecall(novelDir);
  const semantic = collectSemanticCoverage(novelDir);
  const gateReport = evaluateHardGates({
    source_coverage: inventory.source,
    ledger_closure: inventory.ledger,
    evidence_integrity: evidence,
    recall_evidence: recall,
    semantic_coverage: semantic
  });

  return {
    generated_at: gateReport.generated_at,
    novel: path.basename(novelDir),
    baseline_mode: recall.gold_status,
    completion_gate_passed: gateReport.completion_gate_passed,
    gates: gateReport.gates,
    raw_counts: collectRawCounts(novelDir)
  };
}

function reportMarkdown(report) {
  const lines = [
    `# ${report.novel} Quality Gate`,
    '',
    `Completion gate: **${report.completion_gate_passed ? 'PASS' : 'FAIL'}**`,
    `Gold status: \`${report.baseline_mode}\``,
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

function writeReports(novelDir, report) {
  const reportsDir = path.join(novelDir, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'quality_report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(reportsDir, 'quality_report.md'), `${reportMarkdown(report)}\n`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const reportOnly = args.includes('--report-only');
  const dryRun = args.includes('--dry-run');
  const positional = args.filter(arg => !arg.startsWith('--'));
  if (positional.length !== 1) {
    console.error('Usage: node assess-quality.js <novel-dir> [--report-only] [--dry-run]');
    process.exit(1);
  }
  try {
    const novelDir = path.resolve(positional[0]);
    const report = assessQuality(novelDir);
    if (!dryRun) writeReports(novelDir, report);
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
