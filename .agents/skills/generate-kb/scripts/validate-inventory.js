#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  buildSourceIndex,
  discoverChapterFiles,
  matchCompleteCitation,
  splitLines
} = require('./lib/source');
const { readJsonl, validateLedgerClosure } = require('./lib/ledger');

const FINAL_FILES = [
  'characters.json', 'factions.json', 'locations.json', 'skills.json',
  'techniques.json', 'items.json', 'dialogues.json', 'chapter_summaries.json'
];

function loadJson(filename, fallback = null) {
  return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : fallback;
}

function collectFinalIds(novelDir) {
  const ids = new Set();
  for (const filename of FINAL_FILES) {
    const records = loadJson(path.join(novelDir, 'data', filename), []);
    for (const record of records) if (record?.id) ids.add(record.id);
  }
  for (const event of loadJson(path.join(novelDir, 'build', 'events.json'), [])) {
    if (event?.id) ids.add(event.id);
  }
  return ids;
}

function validateCandidateSourceRefs(candidates, sourceIndex, chapterLines) {
  const errors = [];
  const windowById = new Map((sourceIndex?.windows ?? []).map(window => [window.id, window]));
  for (const candidate of candidates) {
    const label = candidate.candidate_id ?? '<unknown>';
    const window = windowById.get(candidate.window_id);
    if (!window) {
      errors.push(`${label}: source window not found: ${candidate.window_id}`);
      continue;
    }
    if (window.chapter !== candidate.chapter) {
      errors.push(`${label}: candidate chapter does not match source window`);
    }
    const ref = candidate.source_ref;
    if (ref?.line_start < window.line_start || ref?.line_end > window.line_end) {
      errors.push(`${label}: source_ref is outside source window`);
    }
    const lines = chapterLines.get(candidate.chapter);
    const match = lines && ref?.text
      ? matchCompleteCitation(lines, ref.text, {
        lineStart: ref.line_start,
        lineEnd: ref.line_end
      })
      : { matched: false };
    if (!match.matched) errors.push(`${label}: complete source_ref text not found in declared lines`);
  }
  return errors;
}

function validateInventory(novelDir) {
  const buildDir = path.join(novelDir, 'build');
  const sourceIndex = loadJson(path.join(buildDir, 'source-index.json'));
  const manifest = loadJson(path.join(buildDir, 'scan-manifest.json'));
  const errors = [];
  if (!sourceIndex) errors.push('missing build/source-index.json');
  if (!manifest) errors.push('missing build/scan-manifest.json');

  let source = {
    passed: false,
    source_hash_valid: false,
    source_file_valid: false,
    missing_windows_by_pass: {},
    chapter_summary_issues: [],
    errors: []
  };
  if (sourceIndex && manifest) {
    const current = buildSourceIndex(novelDir, {
      windowLines: sourceIndex.window_lines,
      overlapLines: sourceIndex.overlap_lines
    });
    const sourceErrors = [];
    const sourceFileValid = Boolean(sourceIndex.source_file && current.source_file);
    if (!sourceFileValid) {
      sourceErrors.push('original novel source file is missing');
    }
    const sourceHashValid = current.source_hash === sourceIndex.source_hash &&
      manifest.source_hash === sourceIndex.source_hash;
    if (!sourceHashValid) {
      sourceErrors.push('source hash does not match current original text');
    }
    if (current.chapter_corpus_hash !== sourceIndex.chapter_corpus_hash ||
        manifest.chapter_corpus_hash !== sourceIndex.chapter_corpus_hash) {
      sourceErrors.push('chapter corpus hash does not match current ch_split files');
    }
    if (current.source_alignment_valid !== true || sourceIndex.source_alignment_valid !== true) {
      sourceErrors.push('ch_split chapters are not aligned with the current original text');
    }
    const required = new Set(sourceIndex.windows.map(window => window.id));
    const missingWindowsByPass = {};
    for (const pass of ['named-inventory', 'event-dialogue', 'gap-audit']) {
      const completed = new Set(manifest.passes?.[pass]?.completed_window_ids ?? []);
      const missing = [...required].filter(id => !completed.has(id));
      missingWindowsByPass[pass] = missing;
      const unknown = [...completed].filter(id => !required.has(id));
      if (missing.length) sourceErrors.push(`${pass} missing ${missing.length} source windows`);
      if (unknown.length) sourceErrors.push(`${pass} contains ${unknown.length} unknown source windows`);
    }

    const summaries = loadJson(path.join(novelDir, 'data', 'chapter_summaries.json'), []);
    const summaryCounts = new Map();
    const chapterSummaryIssues = [];
    for (const [index, summary] of summaries.entries()) {
      const label = `chapter summary ${summary?.chapter ?? `#${index}`}`;
      const summaryChapter = summary?.chapter;
      summaryCounts.set(summaryChapter, (summaryCounts.get(summaryChapter) ?? 0) + 1);
      if (!Number.isInteger(summary?.chapter)) chapterSummaryIssues.push(`${label} has invalid chapter`);
      if (!String(summary?.title ?? '').trim()) chapterSummaryIssues.push(`${label} is missing title`);
      if (!String(summary?.summary ?? '').trim()) chapterSummaryIssues.push(`${label} is missing summary`);
      if (!Array.isArray(summary?.key_events) || summary.key_events.length === 0) {
        chapterSummaryIssues.push(`${label} must contain key_events`);
      }
      if (!Array.isArray(summary?.key_characters) || summary.key_characters.length === 0) {
        chapterSummaryIssues.push(`${label} must contain key_characters`);
      }
    }
    for (const chapter of sourceIndex.chapters) {
      if (summaryCounts.get(chapter.chapter) !== 1) {
        const issue = `chapter ${chapter.chapter} must have exactly one chapter summary`;
        chapterSummaryIssues.push(issue);
        sourceErrors.push(issue);
      }
    }
    const validChapters = new Set(sourceIndex.chapters.map(chapter => chapter.chapter));
    for (const chapter of summaryCounts.keys()) {
      if (!validChapters.has(chapter)) {
        const issue = `chapter summary references unknown chapter ${chapter}`;
        chapterSummaryIssues.push(issue);
        sourceErrors.push(issue);
      }
    }
    sourceErrors.push(...chapterSummaryIssues.filter(issue => !sourceErrors.includes(issue)));
    source = {
      passed: sourceErrors.length === 0,
      source_hash_valid: sourceHashValid,
      source_file_valid: sourceFileValid,
      missing_windows_by_pass: missingWindowsByPass,
      chapter_summary_issues: chapterSummaryIssues,
      errors: sourceErrors
    };
    errors.push(...sourceErrors);
  }

  const candidatePath = path.join(buildDir, 'candidates.jsonl');
  const decisionPath = path.join(buildDir, 'decisions.jsonl');
  const candidates = readJsonl(candidatePath, { optional: true });
  const decisions = readJsonl(decisionPath, { optional: true });
  const ledger = validateLedgerClosure(candidates, decisions, { finalIds: collectFinalIds(novelDir) });
  if (!fs.existsSync(candidatePath)) ledger.errors.unshift('missing build/candidates.jsonl');
  if (!fs.existsSync(decisionPath)) ledger.errors.unshift('missing build/decisions.jsonl');
  if (sourceIndex) {
    const chapterLines = new Map(discoverChapterFiles(novelDir).map(entry => [
      entry.chapter,
      splitLines(fs.readFileSync(entry.file, 'utf8'))
    ]));
    ledger.errors.push(...validateCandidateSourceRefs(candidates, sourceIndex, chapterLines));
  }
  ledger.passed = ledger.errors.length === 0;
  errors.push(...ledger.errors);

  return {
    passed: errors.length === 0,
    source,
    ledger,
    errors
  };
}

if (require.main === module) {
  if (process.argv.length !== 3) {
    console.error('Usage: node validate-inventory.js <novel-dir>');
    process.exit(1);
  }
  const novelDir = path.resolve(process.argv[2]);
  try {
    const result = validateInventory(novelDir);
    const reportsDir = path.join(novelDir, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportsDir, 'inventory_validation.json'),
      `${JSON.stringify(result, null, 2)}\n`
    );
    console.log(result.passed ? 'Inventory validation passed.' : `Inventory validation failed (${result.errors.length} errors).`);
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  FINAL_FILES,
  collectFinalIds,
  validateCandidateSourceRefs,
  validateInventory
};
