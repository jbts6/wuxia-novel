'use strict';

const path = require('node:path');

function assertRunId(runId) {
  if (typeof runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(runId)) {
    const error = new Error('A safe run id is required');
    error.code = 'RUN_REQUIRED';
    throw error;
  }
  return runId;
}

function pathsFor(novelDir, runId) {
  const novel = path.resolve(novelDir);
  const work = path.join(novel, '.game-kb-work');
  const runs = path.join(work, 'runs');
  const id = assertRunId(runId);
  const run = path.join(runs, id);
  return {
    novel,
    work,
    runs,
    runId: id,
    run,
    runJson: path.join(run, 'run.json'),
    manifest: path.join(run, 'manifest.json'),
    artifactManifest: path.join(run, 'artifact-manifest.json'),
    workerPool: path.join(run, 'worker-pool.json'),
    progress: path.join(run, 'progress.json'),
    manualReview: path.join(run, 'manual_review.json'),
    sourceOriginal: path.join(run, 'source', 'original.txt'),
    sourceChapters: path.join(run, 'source', 'chapters'),
    semanticWork: path.join(run, 'work'),
    domainWork: path.join(run, 'work', 'domain'),
    mergeWork: path.join(run, 'work', 'merge'),
    cleanWork: path.join(run, 'work', 'clean'),
    cleanObligations: path.join(run, 'work', 'clean', 'obligations.json'),
    staging: path.join(run, 'staging'),
    drafts: path.join(run, 'drafts'),
    accepted: path.join(run, 'accepted'),
    chapters: path.join(run, 'accepted', 'chapters'),
    recalls: path.join(run, 'accepted', 'recalls'),
    candidateRegistry: path.join(run, 'accepted', 'candidate-registry.json'),
    domainDecisions: path.join(run, 'accepted', 'domain-decisions'),
    domainBook: path.join(run, 'accepted', 'domain', 'book.json'),
    mergeDecisions: path.join(run, 'accepted', 'merge-decisions'),
    cleanDecisions: path.join(run, 'accepted', 'clean-decisions'),
    mergeCategories: path.join(run, 'accepted', 'merge-categories'),
    cleanCategories: path.join(run, 'accepted', 'clean-categories'),
    merged: path.join(run, 'accepted', 'merged', 'book.json'),
    supplements: path.join(run, 'accepted', 'supplements'),
    preCleanQuantity: path.join(run, 'accepted', 'merged', 'pre_clean_quantity.json'),
    cleaned: path.join(run, 'accepted', 'cleaned', 'book.json'),
    materialized: path.join(run, 'materialized'),
    materializedCandidates: path.join(run, 'materialized', 'candidates.json'),
    materializedMerged: path.join(run, 'materialized', 'merged-with-supplements.json'),
    reports: path.join(run, 'reports'),
    runMetrics: path.join(run, 'reports', 'run-metrics.json'),
    coverage: path.join(run, 'reports', 'coverage.json'),
    candidateResolution: path.join(run, 'reports', 'candidate-resolution.json'),
    finalRoot: path.join(run, 'final'),
    finalIdPlan: path.join(run, 'final', 'id_plan.json'),
    finalData: path.join(run, 'final', 'data'),
    finalReports: path.join(run, 'final', 'reports'),
    gameMaterials: path.join(run, 'final', 'reports', 'game_materials.json'),
    quantityReport: path.join(run, 'final', 'reports', 'quantity_report.json'),
    qualitySample: path.join(run, 'final', 'reports', 'quality_sample.json'),
    qualityReport: path.join(run, 'final', 'reports', 'quality_report.json')
  };
}

module.exports = { pathsFor };
