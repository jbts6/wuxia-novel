'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { atomicWriteJson, readJson } = require('./io');

const EMPTY_DURATIONS = Object.freeze({
  prepare_ms: 0,
  chapter_extraction_ms: 0,
  registry_ms: 0,
  domain_distill_ms: 0,
  quality_ms: 0,
  install_ms: 0,
  archive_ms: 0,
  merge_ms: 0,
  clean_ms: 0,
  targeted_recall_ms: 0,
  script_ms: 0,
  human_wait_ms: 0,
  total_ms: 0
});
const COMMAND_PHASES = Object.freeze({
  prepare: 'prepare_ms',
  'prepare-merge': 'registry_ms',
  'assemble-merge': 'domain_distill_ms',
  'prepare-clean': 'domain_distill_ms',
  'assemble-clean': 'domain_distill_ms',
  'check-coverage': 'targeted_recall_ms',
  'check-resolution': 'targeted_recall_ms',
  'build-final': 'quality_ms',
  verify: 'quality_ms',
  install: 'install_ms',
  'archive-run': 'archive_ms'
});
const FINAL_ENTITY_FILES = Object.freeze([
  'characters.yaml', 'items.yaml', 'skills.yaml', 'factions.yaml'
]);

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function elapsed(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start;
}

function latestDone(progress, predicate, lowerBound, upperBound) {
  const times = Object.entries(progress?.units || {})
    .filter(([unit, state]) => state?.status === 'done' && predicate(unit))
    .map(([, state]) => timestamp(state.updated_at))
    .filter(value => Number.isFinite(value))
    .filter(value => !Number.isFinite(lowerBound) || value >= lowerBound)
    .filter(value => !Number.isFinite(upperBound) || value <= upperBound);
  return times.length > 0 ? Math.max(...times) : null;
}

function derivePhaseDurations(metadata, progress, endedAt) {
  const existing = { ...EMPTY_DURATIONS, ...(metadata?.phase_durations || {}) };
  const started = timestamp(metadata?.started_at);
  const ended = timestamp(endedAt);
  const chapterEnd = latestDone(progress, unit => unit.startsWith('chapter:'), started, ended);
  const domainEnd = latestDone(progress, unit => unit.startsWith('distill:'), chapterEnd, ended);
  const mergeEnd = latestDone(progress, unit => unit === 'merge:book', chapterEnd, ended);
  const cleanEnd = latestDone(progress, unit => unit === 'clean:book', mergeEnd, ended);
  const recallEnd = latestDone(progress, unit => unit.startsWith('recall:'), chapterEnd, mergeEnd);
  const supplementEnd = latestDone(progress, unit => unit.startsWith('supplement:'), mergeEnd, cleanEnd);
  const mergeStart = recallEnd ?? chapterEnd;
  const cleanStart = supplementEnd ?? mergeEnd;
  const qualityStart = cleanEnd ?? domainEnd ?? mergeEnd;
  const qualityEnd = latestDone(progress, unit => unit === 'quality:sample', qualityStart, ended);
  const domainStart = recallEnd ?? chapterEnd;
  const totalMs = ended === null ? existing.total_ms : elapsed(started, ended);
  const scriptMs = existing.script_ms;

  return {
    ...existing,
    chapter_extraction_ms: chapterEnd === null ? existing.chapter_extraction_ms : elapsed(started, chapterEnd),
    domain_distill_ms: domainEnd === null || domainStart === null
      ? existing.domain_distill_ms
      : elapsed(domainStart, domainEnd),
    merge_ms: mergeEnd === null || mergeStart === null ? existing.merge_ms : elapsed(mergeStart, mergeEnd),
    clean_ms: cleanEnd === null || cleanStart === null ? existing.clean_ms : elapsed(cleanStart, cleanEnd),
    targeted_recall_ms: (
      (recallEnd === null || chapterEnd === null ? 0 : elapsed(chapterEnd, recallEnd))
      + (supplementEnd === null || mergeEnd === null ? 0 : elapsed(mergeEnd, supplementEnd))
    ),
    quality_ms: qualityEnd === null || qualityStart === null
      ? existing.quality_ms
      : elapsed(qualityStart, qualityEnd),
    human_wait_ms: Math.max(0, totalMs - scriptMs),
    total_ms: totalMs
  };
}

function commandPhase(command, unit) {
  if (command === 'accept') {
    if (unit?.startsWith('chapter:')) return 'chapter_extraction_ms';
    if (unit?.startsWith('distill:')) return 'domain_distill_ms';
    if (unit?.startsWith('recall:') || unit?.startsWith('supplement:')) return 'targeted_recall_ms';
    if (unit === 'quality:sample') return 'quality_ms';
  }
  return COMMAND_PHASES[command] || null;
}

function fileHash(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function recordScriptDuration(runJson, elapsedMs, command = '', unit = '') {
  if (!runJson || !fs.existsSync(runJson)) return;
  const metadata = readJson(runJson);
  const durations = { ...EMPTY_DURATIONS, ...(metadata.phase_durations || {}) };
  const increment = Math.max(1, Math.ceil(Number(elapsedMs) || 0));
  const phase = commandPhase(command, unit);
  const updatedDurations = {
    ...durations,
    ...(phase ? { [phase]: durations[phase] + increment } : {}),
    script_ms: durations.script_ms + increment
  };
  if (updatedDurations.total_ms > 0) {
    updatedDurations.human_wait_ms = Math.max(0, updatedDurations.total_ms - updatedDurations.script_ms);
  }
  atomicWriteJson(runJson, {
    ...metadata,
    phase_durations: updatedDurations
  });
  const runDir = path.dirname(runJson);
  const metricsFile = path.join(runDir, 'reports', 'run-metrics.json');
  let metricsHash = null;
  if (fs.existsSync(metricsFile)) {
    const metrics = readJson(metricsFile);
    atomicWriteJson(metricsFile, { ...metrics, phase_durations: updatedDurations });
    metricsHash = fileHash(metricsFile);
    const receiptFile = path.join(runDir, 'archive-receipt.json');
    if (fs.existsSync(receiptFile)) {
      atomicWriteJson(receiptFile, { ...readJson(receiptFile), metrics_hash: metricsHash });
    }
  }
  return { phase_durations: updatedDurations, metrics_hash: metricsHash };
}

function safeJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function countDomainRecords(book) {
  if (!book || typeof book !== 'object') return 0;
  return FINAL_ENTITY_FILES.reduce((sum, filename) => {
    const category = filename.replace(/\.json$/, '');
    return sum + (Array.isArray(book[category]) ? book[category].length : 0);
  }, 0);
}

function countFinalRecords(finalData) {
  return FINAL_ENTITY_FILES.reduce((sum, filename) => {
    const file = path.join(finalData, filename);
    const records = safeJson(file);
    return sum + (Array.isArray(records) ? records.length : 0);
  }, 0);
}

function inputFiles(root, result = []) {
  if (!root || !fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) inputFiles(file, result);
    else if (entry.isFile() && entry.name === 'input.json') result.push(file);
  }
  return result;
}

function maxAiInputBytes(paths) {
  const files = inputFiles(paths.semanticWork);
  if (fs.existsSync(paths.sourceChapters)) {
    files.push(...fs.readdirSync(paths.sourceChapters)
      .map(name => path.join(paths.sourceChapters, name))
      .filter(file => fs.statSync(file).isFile()));
  }
  if (fs.existsSync(paths.qualitySample)) files.push(paths.qualitySample);
  return files.reduce((max, file) => Math.max(max, fs.statSync(file).size), 0);
}

function aiUnitType(unit) {
  if (unit.startsWith('chapter:')) return 'chapter';
  if (unit.startsWith('distill:')) return 'domain';
  if (unit.startsWith('recall:') || unit.startsWith('supplement:')) return 'targeted_recall';
  if (unit === 'quality:sample') return 'quality';
  return null;
}

function emptyUnitMetrics() {
  return { planned: 0, done: 0, attempts: 0, format_repairs: 0, semantic_remedies: 0 };
}

function aiUnitMetrics(progress) {
  const result = Object.fromEntries(['chapter', 'domain', 'targeted_recall', 'quality', 'total']
    .map(type => [type, emptyUnitMetrics()]));
  for (const [unit, state] of Object.entries(progress?.units || {})) {
    const type = aiUnitType(unit);
    if (!type) continue;
    const attempts = Math.max(0, Number(state?.attempts) || 0);
    const formatRepairs = Math.max(0, Number(state?.format_repairs ?? state?.format_attempts) || 0);
    const semanticRemedies = Math.max(0, Number(state?.semantic_remedies)
      || Math.max(0, attempts - 1 - formatRepairs));
    for (const key of [type, 'total']) {
      result[key].planned += 1;
      if (state?.status === 'done') result[key].done += 1;
      result[key].attempts += attempts;
      result[key].format_repairs += formatRepairs;
      result[key].semantic_remedies += semanticRemedies;
    }
  }
  return result;
}

function buildRunMetrics(paths, metadata, progress, endedAt) {
  const registry = safeJson(paths.candidateRegistry);
  const domainBook = safeJson(paths.domainBook);
  return {
    schema_version: 1,
    run_id: metadata?.run_id || paths.runId,
    semantic_profile: metadata?.semantic_profile || null,
    generated_at: endedAt,
    phase_durations: derivePhaseDurations(metadata, progress, endedAt),
    ai_units: aiUnitMetrics(progress),
    max_ai_input_bytes: maxAiInputBytes(paths),
    candidate_counts: {
      chapter_candidates: Number(registry?.stats?.input_candidates) || 0,
      registered_entries: Number(registry?.stats?.registered_entries) || 0,
      domain_records: countDomainRecords(domainBook),
      final_records: countFinalRecords(paths.finalData)
    }
  };
}

module.exports = {
  EMPTY_DURATIONS,
  buildRunMetrics,
  derivePhaseDurations,
  recordScriptDuration
};
