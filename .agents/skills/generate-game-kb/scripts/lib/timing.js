'use strict';

const fs = require('node:fs');

const { atomicWriteJson, readJson } = require('./io');

const EMPTY_DURATIONS = Object.freeze({
  chapter_extraction_ms: 0,
  merge_ms: 0,
  clean_ms: 0,
  targeted_recall_ms: 0,
  script_ms: 0,
  human_wait_ms: 0,
  total_ms: 0
});

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
  const mergeEnd = latestDone(progress, unit => unit === 'merge:book', chapterEnd, ended);
  const cleanEnd = latestDone(progress, unit => unit === 'clean:book', mergeEnd, ended);
  const recallEnd = latestDone(progress, unit => unit.startsWith('recall:'), chapterEnd, mergeEnd);
  const supplementEnd = latestDone(progress, unit => unit.startsWith('supplement:'), mergeEnd, cleanEnd);
  const mergeStart = recallEnd ?? chapterEnd;
  const cleanStart = supplementEnd ?? mergeEnd;

  return {
    ...existing,
    chapter_extraction_ms: chapterEnd === null ? existing.chapter_extraction_ms : elapsed(started, chapterEnd),
    merge_ms: mergeEnd === null || mergeStart === null ? existing.merge_ms : elapsed(mergeStart, mergeEnd),
    clean_ms: cleanEnd === null || cleanStart === null ? existing.clean_ms : elapsed(cleanStart, cleanEnd),
    targeted_recall_ms: (
      (recallEnd === null || chapterEnd === null ? 0 : elapsed(chapterEnd, recallEnd))
      + (supplementEnd === null || mergeEnd === null ? 0 : elapsed(mergeEnd, supplementEnd))
    ),
    total_ms: ended === null ? existing.total_ms : elapsed(started, ended)
  };
}

function recordScriptDuration(runJson, elapsedMs) {
  if (!runJson || !fs.existsSync(runJson)) return;
  const metadata = readJson(runJson);
  const durations = { ...EMPTY_DURATIONS, ...(metadata.phase_durations || {}) };
  const increment = Math.max(1, Math.ceil(Number(elapsedMs) || 0));
  atomicWriteJson(runJson, {
    ...metadata,
    phase_durations: {
      ...durations,
      script_ms: durations.script_ms + increment
    }
  });
}

module.exports = { derivePhaseDurations, recordScriptDuration };
