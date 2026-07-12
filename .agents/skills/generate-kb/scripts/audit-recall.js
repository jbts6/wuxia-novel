#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildSourceIndex, discoverChapterFiles, matchCompleteCitation, splitLines } = require('./lib/source');
const { readJsonl } = require('./lib/ledger');

const MARTIAL_SUFFIXES = [
  '神功', '剑法', '刀法', '掌法', '拳法', '指法', '心法', '内功', '轻功',
  '阵法', '杖法', '棍法', '鞭法', '身法', '功法', '剑术', '刀术',
  '棒法', '枪法', '爪法'
];
const GENERIC_PREFIXES = new Set([
  '这套', '那套', '一套', '两人', '他们', '他的', '她的', '我的', '你的',
  '咱们', '本门', '各门', '门中', '一路', '这路', '那路', '一种', '此种',
  '上乘', '高明', '精妙', '所使', '所学', '武林', '天下', '如此', '什么'
]);
const NAMING_CUES = ['名为', '名叫', '叫做', '叫作', '称为', '唤作'];
const FINAL_CATEGORY_FILES = {
  character: 'characters.json',
  faction: 'factions.json',
  location: 'locations.json',
  skill: 'skills.json',
  technique: 'techniques.json',
  item: 'items.json',
  dialogue: 'dialogues.json',
  chapter_summary: 'chapter_summaries.json'
};

function loadJson(filename, fallback = null) {
  return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : fallback;
}

function collectFinalRecords(novelDir) {
  const records = [];
  for (const [category, filename] of Object.entries(FINAL_CATEGORY_FILES)) {
    for (const record of loadJson(path.join(novelDir, 'data', filename), [])) {
      records.push({ category, ...record });
    }
  }
  for (const event of loadJson(path.join(novelDir, 'build', 'events.json'), [])) {
    records.push({ category: 'event', ...event });
  }
  return records;
}

function collectCategoryDecisions(candidates, decisions) {
  const decisionByCandidate = new Map();
  for (const decision of decisions) {
    for (const id of decision.candidate_ids ?? []) decisionByCandidate.set(id, decision);
  }

  const categories = new Set([
    ...Object.keys(FINAL_CATEGORY_FILES),
    'event',
    ...candidates.map(candidate => normalizeCategory(candidate.category_hint) || 'unknown')
  ]);
  const result = {};
  for (const category of [...categories].sort()) {
    result[category] = { candidates: [], kept: [], rejected: [], unresolved: [] };
  }

  for (const candidate of candidates) {
    const category = normalizeCategory(candidate.category_hint) || 'unknown';
    const candidateSummary = {
      candidate_id: candidate.candidate_id,
      name: candidate.name ?? null,
      chapter: candidate.chapter ?? null,
      window_id: candidate.window_id ?? null,
      discovery_pass: candidate.discovery_pass ?? null
    };
    result[category].candidates.push(candidateSummary);

    const decision = decisionByCandidate.get(candidate.candidate_id);
    if (!decision) {
      result[category].unresolved.push(candidateSummary);
      continue;
    }
    const decisionSummary = {
      candidate_id: candidate.candidate_id,
      decision: decision.decision,
      reason: decision.reason ?? null,
      canonical_name: decision.canonical_name ?? candidate.name ?? null,
      final_category: normalizeCategory(decision.final_category) || category,
      final_id: decision.final_id ?? null
    };
    if (decision.decision === 'reject') result[category].rejected.push(decisionSummary);
    else result[category].kept.push(decisionSummary);
  }

  return result;
}

function extractLexicalSignals(sourceIndex) {
  const occurrences = new Map();
  for (const window of sourceIndex.windows) {
    const lines = window.text.split('\n');
    lines.forEach((line, offset) => {
      for (const suffix of MARTIAL_SUFFIXES) {
        let index = line.indexOf(suffix);
        while (index !== -1) {
          const prefixCharacters = [...line.slice(0, index)];
          const stem = prefixCharacters.slice(-2).join('');
          const name = `${stem}${suffix}`;
          if (/^\p{Script=Han}{2}$/u.test(stem) && !GENERIC_PREFIXES.has(stem)) {
            const locationKey = `${window.chapter}:${window.line_start + offset}:${name}`;
            if (!occurrences.has(name)) occurrences.set(name, new Map());
            occurrences.get(name).set(locationKey, {
              chapter: window.chapter,
              line: window.line_start + offset,
              suffix,
              text: name,
              context: line.trim(),
              has_naming_cue: NAMING_CUES.some(cue => line.includes(`${cue}${name}`)) ||
                [`《${name}》`, `“${name}”`, `「${name}」`, `『${name}』`]
                  .some(marked => line.includes(marked))
            });
          }
          index = line.indexOf(suffix, index + suffix.length);
        }
      }
    });
  }
  const signals = [];
  for (const locations of occurrences.values()) {
    const entries = [...locations.values()];
    if (!entries.some(entry => entry.has_naming_cue)) continue;
    signals.push(...entries);
  }
  return signals.map((signal, index) => ({
    id: `lex_${String(index + 1).padStart(5, '0')}`,
    ...signal
  }));
}

function normalizeCategory(category) {
  const value = String(category ?? '').toLowerCase();
  return value.endsWith('s') ? value.slice(0, -1) : value;
}

function validateGold(novelDir, sourceIndex, finalRecords) {
  const filename = path.join(novelDir, 'audit', 'gold.json');
  if (!fs.existsSync(filename)) {
    return { status: 'no_gold', missing_must_include: [], present_must_exclude: [], errors: [] };
  }

  const gold = loadJson(filename, {});
  const errors = [];
  if (gold.provenance !== 'human_curated') errors.push('gold provenance must be human_curated');
  if (gold.source_hash !== sourceIndex.source_hash) errors.push('gold source_hash is stale');
  const chapterLines = new Map(discoverChapterFiles(novelDir).map(entry => [
    entry.chapter,
    splitLines(fs.readFileSync(entry.file, 'utf8'))
  ]));
  for (const item of [...(gold.must_include ?? []), ...(gold.must_exclude ?? [])]) {
    const ref = item.source_ref;
    const lines = chapterLines.get(ref?.chapter ?? item.chapter);
    if (!lines || !ref?.text || !Number.isInteger(ref.line_start) ||
        !Number.isInteger(ref.line_end) || !matchCompleteCitation(lines, ref.text, {
      lineStart: ref.line_start,
      lineEnd: ref.line_end
    }).matched) {
      errors.push(`gold item is not source-grounded: ${item.name ?? '<unnamed>'}`);
    }
  }
  if (errors.length) {
    return { status: 'invalid_gold', missing_must_include: [], present_must_exclude: [], errors };
  }

  const hasRecord = item => finalRecords.some(record =>
    normalizeCategory(record.category) === normalizeCategory(item.category) &&
    (record.name === item.name || (record.alias ?? []).includes(item.name))
  );
  const missing = (gold.must_include ?? []).filter(item => !hasRecord(item));
  const present = (gold.must_exclude ?? []).filter(hasRecord);
  return {
    status: missing.length || present.length ? 'failed' : 'passed',
    missing_must_include: missing.map(item => `${item.category}:${item.name}`),
    present_must_exclude: present.map(item => `${item.category}:${item.name}`),
    errors: []
  };
}

function auditRecall(novelDir) {
  const buildDir = path.join(novelDir, 'build');
  const savedIndex = loadJson(path.join(buildDir, 'source-index.json'));
  const sourceIndex = buildSourceIndex(novelDir, {
    windowLines: savedIndex?.window_lines,
    overlapLines: savedIndex?.overlap_lines
  });
  const candidatePath = path.join(buildDir, 'candidates.jsonl');
  const decisionPath = path.join(buildDir, 'decisions.jsonl');
  const candidates = readJsonl(candidatePath, { optional: true });
  const decisions = readJsonl(decisionPath, { optional: true });
  const decisionByCandidate = new Map();
  for (const decision of decisions) {
    for (const id of decision.candidate_ids ?? []) decisionByCandidate.set(id, decision);
  }
  const finalRecords = collectFinalRecords(novelDir);
  const explainNames = [
    ...candidates.filter(candidate => decisionByCandidate.has(candidate.candidate_id)).map(candidate => candidate.name),
    ...finalRecords.map(record => record.name)
  ].filter(Boolean);
  const lexicalSignals = extractLexicalSignals(sourceIndex);
  const unexplained = lexicalSignals.filter(signal =>
    !explainNames.some(name => signal.text.includes(name))
  );

  const unresolvedMartial = candidates.filter(candidate => {
    if (!['skill', 'technique'].includes(candidate.category_hint)) return false;
    const decision = decisionByCandidate.get(candidate.candidate_id);
    if (!decision) return true;
    if (decision.decision !== 'reject') return false;
    return !['duplicate', 'generic_unnamed', 'not_an_entity', 'not_source_grounded'].includes(decision.reason);
  }).map(candidate => candidate.candidate_id);

  if (!fs.existsSync(candidatePath)) unresolvedMartial.push('candidate ledger missing');
  if (!fs.existsSync(decisionPath)) unresolvedMartial.push('decision ledger missing');

  const gapAudit = loadJson(path.join(buildDir, 'gap-audit.json'));
  let unresolvedGap = [];
  let finalGapRoundComplete = false;
  if (gapAudit && Array.isArray(gapAudit.rounds) && gapAudit.rounds.length) {
    const lastRound = gapAudit.rounds.at(-1);
    unresolvedGap = (lastRound.new_candidate_ids ?? []).filter(id => {
      const decision = decisionByCandidate.get(id);
      return !decision || decision.decision !== 'reject';
    });
    finalGapRoundComplete = unresolvedGap.length === 0;
  } else {
    unresolvedGap = ['gap audit record missing'];
  }

  const gold = validateGold(novelDir, sourceIndex, finalRecords);
  return {
    generated_at: new Date().toISOString(),
    source_hash: sourceIndex.source_hash,
    unresolved_gap_candidates: unresolvedGap,
    unexplained_lexical_signals: unexplained.map(signal =>
      `${signal.chapter}:${signal.line}:${signal.suffix}:${signal.text}`
    ),
    unresolved_martial_candidates: unresolvedMartial,
    missing_must_include: gold.missing_must_include,
    present_must_exclude: gold.present_must_exclude,
    final_gap_round_complete: finalGapRoundComplete,
    gold_status: gold.status,
    gold_errors: gold.errors,
    category_decisions: collectCategoryDecisions(candidates, decisions),
    counts: {
      lexical_signals: lexicalSignals.length,
      unexplained_lexical_signals: unexplained.length,
      candidates: candidates.length,
      decisions: decisions.length
    }
  };
}

function parseArgs(argv) {
  const flags = new Set(argv.filter(arg => arg.startsWith('--')));
  const positional = argv.filter(arg => !arg.startsWith('--'));
  if (positional.length !== 1) {
    throw new Error('Usage: node audit-recall.js <novel-dir> [--legacy] [--dry-run]');
  }
  return { novelDir: path.resolve(positional[0]), dryRun: flags.has('--dry-run') };
}

if (require.main === module) {
  try {
    const { novelDir, dryRun } = parseArgs(process.argv.slice(2));
    const report = auditRecall(novelDir);
    if (!dryRun) {
      const reportsDir = path.join(novelDir, 'reports');
      fs.mkdirSync(reportsDir, { recursive: true });
      fs.writeFileSync(path.join(reportsDir, 'recall_audit.json'), `${JSON.stringify(report, null, 2)}\n`);
    }
    const failures = report.unresolved_gap_candidates.length +
      report.unexplained_lexical_signals.length + report.unresolved_martial_candidates.length +
      report.missing_must_include.length + report.present_must_exclude.length;
    console.log(`Recall audit: ${failures === 0 ? 'PASS' : 'FAIL'} (${failures} blocking findings)`);
    console.log(`Gold: ${report.gold_status}`);
    if (failures || !['no_gold', 'passed'].includes(report.gold_status)) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { auditRecall, collectCategoryDecisions, extractLexicalSignals, validateGold };
