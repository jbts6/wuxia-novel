'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson, readYaml } = require('./io');

const TASK_TYPES = Object.freeze({
  'characters-deep': 'characters',
  'skills-deep': 'skills',
  'items-deep': 'items',
  'factions-deep': 'factions'
});

function hashFile(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function loadState(paths) {
  if (!fs.existsSync(paths.deferredTasks)) return { schema_version: 1, tasks: [] };
  const state = readJson(paths.deferredTasks);
  if (!state || !Array.isArray(state.tasks)) throw new GameKbError('DEFERRED_TASKS_INVALID', 'Deferred task registry is invalid');
  return state;
}

function saveState(paths, state) {
  atomicWriteJson(paths.deferredTasks, state);
}

function addDeferredTask({ paths, type, scope, requestedBy = 'manual' }) {
  if (!TASK_TYPES[type] || scope !== TASK_TYPES[type]) {
    throw new GameKbError('DEFERRED_TASK_TYPE_INVALID', 'Unknown deferred task type or scope', { type, scope });
  }
  const state = loadState(paths);
  const baseHash = hashFile(paths.artifactManifest);
  const task = {
    task_id: `${type}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    type,
    scope,
    requested_by: requestedBy,
    base_manifest_hash: baseHash,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  state.tasks.push(task);
  saveState(paths, state);
  return task;
}

function runDeferredTask({ paths, taskId, draftPath }) {
  const state = loadState(paths);
  const task = state.tasks.find(item => item.task_id === taskId);
  if (!task) throw new GameKbError('DEFERRED_TASK_MISSING', 'Deferred task does not exist', { task_id: taskId });
  if (hashFile(paths.artifactManifest) !== task.base_manifest_hash) {
    task.status = 'failed';
    task.error = 'STALE_BASE';
    saveState(paths, state);
    throw new GameKbError('DEFERRED_TASK_STALE', 'Deferred task is bound to a stale base manifest', { task_id: taskId });
  }
  let draft;
  try { draft = readYaml(draftPath); } catch (error) {
    task.status = 'failed'; task.error = 'DRAFT_INVALID'; saveState(paths, state);
    throw new GameKbError('DEFERRED_DRAFT_INVALID', 'Deferred overlay draft is invalid', { cause: error.message });
  }
  task.draft_path = draftPath;
  task.draft_hash = hashFile(draftPath);
  task.draft = draft;
  task.status = 'ready';
  saveState(paths, state);
  return task;
}

module.exports = { TASK_TYPES, addDeferredTask, runDeferredTask, loadState };
