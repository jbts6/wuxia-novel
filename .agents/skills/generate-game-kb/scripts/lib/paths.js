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
    quarantine: path.join(run, 'quarantine'),
    deferredTasks: path.join(run, 'deferred-tasks.json'),
    tasks: path.join(run, 'tasks'),
    overlays: path.join(run, 'overlays'),
    revisions: path.join(run, 'revisions'),
    sourceOriginal: path.join(run, 'source', 'original.txt'),
    sourceChapters: path.join(run, 'source', 'chapters'),
    semanticWork: path.join(run, 'work'),
    domainWork: path.join(run, 'work', 'domain'),
    staging: path.join(run, 'staging'),
    drafts: path.join(run, 'drafts'),
    accepted: path.join(run, 'accepted'),
    chapters: path.join(run, 'accepted', 'chapters'),
    candidateRegistry: path.join(run, 'accepted', 'candidate-registry.json'),
    domainDecisions: path.join(run, 'accepted', 'domain-decisions'),
    reports: path.join(run, 'reports'),
    runMetrics: path.join(run, 'reports', 'run-metrics.json'),
    finalRoot: path.join(run, 'final'),
    finalIdPlan: path.join(run, 'final', 'id_plan.json'),
    finalData: path.join(run, 'final', 'data'),
    finalReports: path.join(run, 'final', 'reports'),
    assemblyReport: path.join(run, 'final', 'reports', 'assembly-report.json'),
    verificationReport: path.join(run, 'final', 'reports', 'verification-report.json')
  };
}

function stagingPathFor(paths, unit, attempt) {
  const file = `${unit.replaceAll(':', '_')}_attempt_${String(attempt).padStart(2, '0')}.yaml`;
  return path.join(paths.staging, file);
}

function deferredPathsFor(novelDir, runId) {
  const novel = path.resolve(novelDir);
  const work = path.join(novel, '.game-kb-work');
  const id = assertRunId(runId);
  const run = path.join(novel, '_archive', 'generate-game-kb', id);
  const deferredRoot = path.join(work, 'deferred', id);
  return {
    novel,
    work,
    runId: id,
    run,
    runJson: path.join(run, 'run.json'),
    manifest: path.join(run, 'manifest.json'),
    artifactManifest: path.join(run, 'artifact-manifest.json'),
    archiveReceipt: path.join(run, 'archive-receipt.json'),
    candidateRegistry: path.join(run, 'accepted', 'candidate-registry.json'),
    sourceOriginal: path.join(run, 'source', 'original.txt'),
    sourceChapters: path.join(run, 'source', 'chapters'),
    chapters: path.join(run, 'accepted', 'chapters'),
    finalIdPlan: path.join(run, 'final', 'id_plan.json'),
    finalData: path.join(run, 'final', 'data'),
    finalReports: path.join(run, 'final', 'reports'),
    deferredRoot,
    deferredTasks: path.join(deferredRoot, 'deferred-tasks.json'),
    registryMap: path.join(deferredRoot, 'installed-registry-map.json'),
    tasks: path.join(deferredRoot, 'tasks'),
    overlays: path.join(deferredRoot, 'overlays'),
    revisions: path.join(deferredRoot, 'revisions')
  };
}

module.exports = { deferredPathsFor, pathsFor, stagingPathFor };
