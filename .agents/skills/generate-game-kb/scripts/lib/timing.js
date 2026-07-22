'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { readJson, readYaml } = require('./io');

const EMPTY_DURATIONS = Object.freeze({
  prepare_ms: 0,
  chapter_extraction_ms: 0,
  assemble_ms: 0,
  verify_ms: 0,
  install_ms: 0,
  archive_ms: 0,
  total_ms: 0
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
    .filter(([unit, state]) => ['accepted', 'done'].includes(state?.status) && predicate(unit))
    .map(([, state]) => timestamp(state.updated_at))
    .filter(value => Number.isFinite(value))
    .filter(value => !Number.isFinite(lowerBound) || value >= lowerBound)
    .filter(value => !Number.isFinite(upperBound) || value <= upperBound);
  return times.length > 0 ? Math.max(...times) : null;
}

function normalizePhaseDurations(durations) {
  return Object.fromEntries(Object.keys(EMPTY_DURATIONS)
    .map(key => [key, durations?.[key] ?? EMPTY_DURATIONS[key]]));
}

function derivePhaseDurations(metadata, progress, endedAt) {
  const existing = normalizePhaseDurations(metadata?.phase_durations);
  const started = timestamp(metadata?.started_at);
  const ended = timestamp(endedAt);
  const chapterEnd = latestDone(progress, unit => unit.startsWith('chapter:'), started, ended);
  const totalMs = ended === null ? existing.total_ms : elapsed(started, ended);
  return {
    ...existing,
    chapter_extraction_ms: chapterEnd === null ? existing.chapter_extraction_ms : elapsed(started, chapterEnd),
    total_ms: totalMs
  };
}

function safeJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function safeYaml(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return readYaml(file);
  } catch {
    return null;
  }
}

function countFinalRecords(finalData) {
  return FINAL_ENTITY_FILES.reduce((sum, filename) => {
    const records = safeYaml(path.join(finalData, filename));
    return sum + (Array.isArray(records) ? records.length : 0);
  }, 0);
}

function inputFiles(root, result = []) {
  if (!root || !fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) inputFiles(file, result);
    else if (entry.isFile() && /^attempt_\d+\.json$/.test(entry.name)) result.push(file);
  }
  return result;
}

function maxAiInputBytes(paths) {
  const files = inputFiles(paths.tasks);
  if (fs.existsSync(paths.sourceChapters)) {
    files.push(...fs.readdirSync(paths.sourceChapters)
      .map(name => path.join(paths.sourceChapters, name))
      .filter(file => fs.statSync(file).isFile()));
  }
  return files.reduce((max, file) => Math.max(max, fs.statSync(file).size), 0);
}

function aiUnitType(unit) {
  if (unit.startsWith('chapter:')) return 'chapter';
  return null;
}

function emptyUnitMetrics() {
  return { planned: 0, done: 0, attempts: 0, corrections: 0 };
}

function aiUnitMetrics(progress) {
  const result = Object.fromEntries(['chapter', 'total']
    .map(type => [type, emptyUnitMetrics()]));
  for (const [unit, state] of Object.entries(progress?.units || {})) {
    const type = aiUnitType(unit);
    if (!type) continue;
    const attempts = Math.max(0, Number(state?.attempt ?? state?.attempts) || 0);
    const corrections = Math.max(0, attempts - 1);
    for (const key of [type, 'total']) {
      result[key].planned += 1;
      if (['accepted', 'done'].includes(state?.status)) result[key].done += 1;
      result[key].attempts += attempts;
      result[key].corrections += corrections;
    }
  }
  return result;
}

function buildRunMetrics(paths, metadata, progress, endedAt) {
  const registry = safeJson(paths.candidateRegistry);
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
      final_records: countFinalRecords(paths.finalData)
    }
  };
}

module.exports = {
  EMPTY_DURATIONS,
  buildRunMetrics,
  derivePhaseDurations
};
