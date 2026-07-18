'use strict';

const { GameKbError } = require('./errors');

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

function applyOverlay({ task, overlay, baseRegistry, groundingContext }) {
  const errors = validateOverlay(overlay, { baseRegistry, groundingContext });
  if (errors.length) throw new GameKbError('OVERLAY_INVALID', 'Overlay failed validation', { errors });
  return { task_id: task.task_id, base_manifest_hash: groundingContext.base_manifest_hash, operations: overlay.operations };
}

module.exports = { validateOverlay, applyOverlay };
