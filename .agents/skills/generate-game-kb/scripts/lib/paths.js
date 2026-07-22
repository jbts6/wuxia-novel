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
  return {
    novel,
    work,
    runs,
    runId: id,
    run,
    runJson: path.join(run, 'run.json'),
    manifest: path.join(run, 'manifest.json'),
    artifactManifest: path.join(run, 'artifact-manifest.json'),
    progress: path.join(run, 'progress.json'),
    manualReview: path.join(run, 'manual_review.json'),
    tasks: path.join(run, 'tasks'),
    revisions: path.join(run, 'revisions'),
    sourceOriginal: path.join(run, 'source', 'original.txt'),
    sourceChapters: path.join(run, 'source', 'chapters'),
    staging: path.join(run, 'staging'),
    drafts: path.join(run, 'drafts'),
    accepted: path.join(run, 'accepted'),
    chapters: path.join(run, 'accepted', 'chapters'),
    candidateRegistry: path.join(run, 'accepted', 'candidate-registry.json'),
    reports: path.join(run, 'reports'),
    migrationReceipt: path.join(run, 'reports', 'migration-receipt.json'),
    chapterImportReceipt: path.join(run, 'reports', 'chapter-import-receipt.json'),
    runMetrics: path.join(run, 'reports', 'run-metrics.json'),
    referenceRecovery: path.join(run, 'reports', 'reference-recovery.json'),
    finalRoot: path.join(run, 'final'),
    finalIdPlan: path.join(run, 'final', 'id_plan.json'),
    finalData: path.join(run, 'final', 'data'),
    finalReports: path.join(run, 'final', 'reports'),
    assemblyReport: path.join(run, 'final', 'reports', 'assembly-report.json'),
    verificationReport: path.join(run, 'final', 'reports', 'verification-report.json'),
    reviewReport: path.join(run, 'final', 'reports', 'game-kb-review.json')
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
  return assertManagedPath(paths, paths.staging, candidate, 'STAGING_PATH_ESCAPE', 'staging');
}

function assertManagedPath(paths, root, candidate, code, label) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  if (!isWithin(resolvedRoot, resolved) || !isWithin(paths.run, resolvedRoot)) {
    throw new GameKbError(code, `Controller ${label} identity escaped the selected run`, {
      run: path.resolve(paths.run),
      root: resolvedRoot,
      candidate: resolved
    });
  }

  if (fs.existsSync(paths.run)) {
    const realRun = fs.realpathSync(paths.run);
    let existing = fs.existsSync(resolved) ? resolved : path.dirname(resolved);
    while (!fs.existsSync(existing) && path.dirname(existing) !== existing) {
      existing = path.dirname(existing);
    }
    if (fs.existsSync(existing) && !isWithin(realRun, fs.realpathSync(existing))) {
      throw new GameKbError(code, `Controller ${label} path escaped through a junction`, {
        run: realRun,
        root: resolvedRoot,
        candidate: resolved,
        existing: fs.realpathSync(existing)
      });
    }
  }
  return resolved;
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

function chapterAttemptPaths(paths, unit, cycle, attempt) {
  if (typeof unit !== 'string' || !/^chapter:\d{3,}$/.test(unit)) {
    throw new GameKbError('ACTIVE_WINDOW_INVALID', 'Chapter unit is invalid', { unit });
  }
  if (!Number.isInteger(cycle) || cycle < 1 || !Number.isInteger(attempt) || attempt < 1 || attempt > 2) {
    throw new GameKbError('ACTIVE_WINDOW_INVALID', 'Chapter cycle or attempt is invalid', {
      unit, cycle, attempt
    });
  }
  const safe = unit.replaceAll(':', '_');
  const cycleDir = `cycle_${String(cycle).padStart(2, '0')}`;
  const inputDir = path.join(paths.tasks, safe, cycleDir);
  const outputDir = path.join(paths.staging, safe, cycleDir);
  return {
    inputDir,
    outputDir,
    input: assertManagedPath(
      paths,
      paths.tasks,
      path.join(inputDir, `attempt_${String(attempt).padStart(2, '0')}.json`),
      'ACTIVE_WINDOW_INVALID',
      'task'
    ),
    output: assertStagingIdentity(
      paths,
      path.join(outputDir, `attempt_${String(attempt).padStart(2, '0')}.yaml`)
    )
  };
}

module.exports = { assertStagingIdentity, chapterAttemptPaths, deferredPathsFor, pathsFor, repositoryRootFor };
