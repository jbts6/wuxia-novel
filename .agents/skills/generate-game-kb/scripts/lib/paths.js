'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');

function assertRunId(runId) {
  if (typeof runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(runId)) {
    const error = new Error('A safe run id is required');
    error.code = 'RUN_REQUIRED';
    throw error;
  }
  return runId;
}

function pathsFor(novelDir, runId, options = {}) {
  const novel = path.resolve(novelDir);
  const work = options.workRoot
    ? path.resolve(options.workRoot)
    : path.join(novel, '.game-kb-work');
  const runs = path.join(work, 'runs');
  const id = assertRunId(runId);
  const run = path.join(runs, id);
  const semanticWork = path.join(run, 'work');
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
    semanticWork,
    domainWork: path.join(semanticWork, 'domain'),
    workerGuards: path.join(semanticWork, 'worker-guards'),
    draftSubmissions: path.join(semanticWork, 'draft-submissions'),
    draftRecoveries: path.join(semanticWork, 'draft-recoveries'),
    staging: path.join(run, 'staging'),
    drafts: path.join(run, 'drafts'),
    accepted: path.join(run, 'accepted'),
    chapters: path.join(run, 'accepted', 'chapters'),
    candidateRegistry: path.join(run, 'accepted', 'candidate-registry.json'),
    domainDecisions: path.join(run, 'accepted', 'domain-decisions'),
    reports: path.join(run, 'reports'),
    migrationReceipt: path.join(run, 'reports', 'migration-receipt.json'),
    chapterImportReceipt: path.join(run, 'reports', 'chapter-import-receipt.json'),
    runMetrics: path.join(run, 'reports', 'run-metrics.json'),
    finalRoot: path.join(run, 'final'),
    finalIdPlan: path.join(run, 'final', 'id_plan.json'),
    finalData: path.join(run, 'final', 'data'),
    finalReports: path.join(run, 'final', 'reports'),
    assemblyReport: path.join(run, 'final', 'reports', 'assembly-report.json'),
    verificationReport: path.join(run, 'final', 'reports', 'verification-report.json')
  };
}

function comparisonPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isWithin(parent, candidate) {
  const relative = path.relative(comparisonPath(parent), comparisonPath(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertStagingIdentity(paths, candidate) {
  const resolved = path.resolve(candidate);
  if (!isWithin(paths.staging, resolved)) {
    throw new GameKbError('STAGING_PATH_ESCAPE', 'Controller staging identity escaped the selected run', {
      run: path.resolve(paths.run),
      staging: path.resolve(paths.staging),
      candidate: resolved
    });
  }
  if (fs.existsSync(paths.run) && fs.existsSync(paths.staging)) {
    const realRun = fs.realpathSync(paths.run);
    const realStaging = fs.realpathSync(paths.staging);
    if (!isWithin(realRun, realStaging)) {
      throw new GameKbError('STAGING_PATH_ESCAPE', 'Controller staging directory escaped through a junction', {
        run: realRun,
        staging: realStaging,
        candidate: resolved
      });
    }
  }
  return resolved;
}

function stagingPathFor(paths, unit, attempt) {
  const file = `${unit.replaceAll(':', '_')}_attempt_${String(attempt).padStart(2, '0')}.yaml`;
  return assertStagingIdentity(paths, path.join(paths.staging, file));
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
    migrationReceipt: path.join(run, 'reports', 'migration-receipt.json'),
    chapterImportReceipt: path.join(run, 'reports', 'chapter-import-receipt.json'),
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

function repositoryRootFor(novelDir) {
  let dir = path.resolve(novelDir);
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  // Fallback to novelDir itself if no .git found
  return path.resolve(novelDir);
}

module.exports = { assertStagingIdentity, deferredPathsFor, pathsFor, repositoryRootFor, stagingPathFor };
