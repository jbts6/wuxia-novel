'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { packChapterJobs } = require('./chapter-batching');
const { pendingSubmissionJournals } = require('./submission-journal');
const { unresolvedWorkerGuardReports } = require('./worker-guard');
const { inspectWorkspaceFinal } = require('./verify');

const DOMAIN_UNITS = Object.freeze([
  'distill:factions',
  'distill:characters',
  'distill:skills',
  'distill:items'
]);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function chapterUnit(number) {
  return `chapter:${String(number).padStart(3, '0')}`;
}

function compareUnits(left, right) {
  const leftChapter = /^chapter:(\d+)$/.exec(left);
  const rightChapter = /^chapter:(\d+)$/.exec(right);
  if (leftChapter && rightChapter) return Number(leftChapter[1]) - Number(rightChapter[1]);
  if (leftChapter) return -1;
  if (rightChapter) return 1;

  const leftDomain = DOMAIN_UNITS.indexOf(left);
  const rightDomain = DOMAIN_UNITS.indexOf(right);
  if (leftDomain !== -1 && rightDomain !== -1) return leftDomain - rightDomain;
  if (leftDomain !== -1) return -1;
  if (rightDomain !== -1) return 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function currentDomainPlan(paths, manifest) {
  const plan = readJson(path.join(paths.domainWork, 'plan.json'));
  if (!plan || plan.source_hash !== manifest.source_hash || !Array.isArray(plan.units)) return null;

  const inputs = new Map();
  for (const input of plan.units) {
    if (!DOMAIN_UNITS.includes(input?.unit) || typeof input?.input_hash !== 'string' || inputs.has(input.unit)) {
      return null;
    }
    inputs.set(input.unit, input.input_hash);
  }
  return inputs.size === DOMAIN_UNITS.length ? inputs : null;
}

function currentAssembly(paths, manifest) {
  const report = readJson(paths.assemblyReport);
  if (!report
    || report.source_hash !== manifest.source_hash
    || typeof report.final_data_hash !== 'string'
    || report.final_data_hash === '') {
    return null;
  }
  const workspace = inspectWorkspaceFinal(paths, {
    chapters: manifest.chapters,
    expectedHash: report.final_data_hash
  });
  return workspace.passed ? report : null;
}

function currentVerification(paths, manifest, assembly) {
  const report = readJson(paths.verificationReport);
  return report
    && report.passed === true
    && report.source_hash === manifest.source_hash
    && report.final_data_hash === assembly.final_data_hash
    ? report
    : null;
}

function chaptersMatch(installed, manifest) {
  if (!Array.isArray(installed?.chapters) || installed.chapters.length !== manifest.chapters.length) return false;
  const actual = installed.chapters
    .map(chapter => ({ number: chapter?.number, input_hash: chapter?.input_hash }))
    .sort((left, right) => left.number - right.number);
  const expected = manifest.chapters
    .map(chapter => ({ number: chapter.number, input_hash: chapter.input_hash }))
    .sort((left, right) => left.number - right.number);
  return actual.every((chapter, index) => Number.isInteger(chapter.number)
    && typeof chapter.input_hash === 'string'
    && chapter.number === expected[index].number
    && chapter.input_hash === expected[index].input_hash);
}

function installationMatches(installed, manifest, verification) {
  return installed?.passed === true
    && installed.source_hash === manifest.source_hash
    && installed.final_data_hash === verification.final_data_hash
    && chaptersMatch(installed, manifest);
}

function resolveNextAction({ paths, manifest, progress, installed }) {
  const units = progress?.units || {};

  // Check for unresolved worker-guard violations (highest priority)
  if (paths?.workerGuards) {
    const violations = unresolvedWorkerGuardReports(paths);
    if (violations.length > 0) {
      return {
        next_action: 'worker-write-review',
        next_units: [],
        worker_guard_reports: violations
      };
    }
  }

  const manualReview = Object.keys(units)
    .filter(unit => units[unit]?.status === 'manual_review')
    .sort(compareUnits);
  if (manualReview.length > 0) {
    return { next_action: 'manual-review', next_units: manualReview };
  }

  // Check for non-terminal submission journals (interrupted broker)
  if (paths?.draftSubmissions) {
    const pending = pendingSubmissionJournals(paths);
    if (pending.length > 0) {
      return {
        next_action: 'resume-draft-submission',
        next_units: pending.map(j => j.unit),
        pending_submissions: pending
      };
    }
  }

  const unfinishedChapters = [...manifest.chapters]
    .sort((left, right) => left.number - right.number)
    .filter(chapter => units[chapterUnit(chapter.number)]?.status !== 'done');
  if (unfinishedChapters.length > 0) {
    return {
      next_action: 'accept-chapters',
      next_units: unfinishedChapters.map(chapter => chapterUnit(chapter.number)),
      chapter_jobs: packChapterJobs({ ...manifest, chapters: unfinishedChapters }, { progress })
    };
  }

  const domainPlan = currentDomainPlan(paths, manifest);
  if (!domainPlan) return { next_action: 'plan-domains', next_units: [] };

  const unfinishedDomains = DOMAIN_UNITS.filter(unit => (
    units[unit]?.status !== 'done' || units[unit]?.input_hash !== domainPlan.get(unit)
  ));
  if (unfinishedDomains.length > 0) {
    return { next_action: 'accept-domains', next_units: unfinishedDomains };
  }

  const assembly = currentAssembly(paths, manifest);
  if (!assembly) return { next_action: 'assemble', next_units: [] };

  const verification = currentVerification(paths, manifest, assembly);
  if (!verification) return { next_action: 'verify', next_units: [] };

  if (!installationMatches(installed, manifest, verification)) {
    return { next_action: 'install', next_units: [] };
  }
  return { next_action: 'archive-run', next_units: [] };
}

module.exports = {
  resolveNextAction
};
