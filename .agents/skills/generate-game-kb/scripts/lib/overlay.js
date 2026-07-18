'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { atomicWriteJson, readJson, readYaml } = require('./io');

function validateOverlay(overlay, { baseRegistry, groundingContext = {} } = {}) {
  const errors = [];
  const allowed = new Set(Object.values(baseRegistry?.categories || {}).flatMap(rows => (rows || []).map(row => row.registry_key)));
  if (!overlay || !Array.isArray(overlay.operations)) return [{ code: 'OVERLAY_OPERATIONS_REQUIRED' }];
  for (const [index, operation] of overlay.operations.entries()) {
    if (!['keep', 'merge', 'drop', 'patch'].includes(operation?.action)) errors.push({ code: 'OVERLAY_ACTION_INVALID', index });
    if (!allowed.has(operation?.registry_key)) errors.push({ code: 'OVERLAY_ENTITY_UNKNOWN', index });
    if (operation?.source_refs || operation?.evidence) errors.push({ code: 'OVERLAY_EVIDENCE_INVENTED', index });
    if (operation?.action === 'merge' && !allowed.has(operation.target_registry_key)) errors.push({ code: 'OVERLAY_TARGET_UNKNOWN', index });
  }
  if (groundingContext.base_manifest_hash && overlay.base_manifest_hash !== groundingContext.base_manifest_hash) {
    errors.push({ code: 'OVERLAY_BASE_STALE' });
  }
  return errors;
}

function applyOverlay({ paths, taskId, task, overlay, baseRegistry, groundingContext }) {
  if (paths && taskId) {
    const state = fs.existsSync(paths.deferredTasks) ? readJson(paths.deferredTasks) : { tasks: [] };
    task = state.tasks.find(item => item.task_id === taskId);
    if (!task || task.status !== 'ready') throw new GameKbError('DEFERRED_TASK_NOT_READY', 'Deferred task is not ready to apply');
    overlay = task.draft;
    baseRegistry = readJson(paths.candidateRegistry);
    groundingContext = { base_manifest_hash: task.base_manifest_hash };
  }
  const errors = validateOverlay(overlay, { baseRegistry, groundingContext });
  if (errors.length) throw new GameKbError('OVERLAY_INVALID', 'Overlay failed validation', { errors });
  if (!paths) return { task_id: task.task_id, base_manifest_hash: groundingContext.base_manifest_hash, operations: overlay.operations };
  const revisionId = `revision-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const temp = path.join(paths.revisions, `${revisionId}.tmp`);
  const target = path.join(paths.revisions, revisionId);
  fs.mkdirSync(temp, { recursive: true });
  fs.cpSync(paths.finalData, path.join(temp, 'data'), { recursive: true });
  const receipt = { schema_version: 1, revision_id: revisionId, task_id: task.task_id,
    base_manifest_hash: task.base_manifest_hash, operations: overlay.operations };
  atomicWriteJson(path.join(temp, 'revision-receipt.json'), receipt);
  fs.renameSync(temp, target);
  return { ...receipt, revision_dir: target };
}

module.exports = { validateOverlay, applyOverlay };
