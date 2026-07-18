'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { stableHash } = require('./accept');
const {
  assertTaskFresh,
  hashFile,
  loadRegistryMap,
  loadState,
  saveState
} = require('./deferred-task');
const { GameKbError } = require('./errors');
const { CATEGORY_FILES } = require('./finalize');
const { promoteVerifiedData } = require('./install');
const { atomicWriteFile, atomicWriteJson, readJson, readYaml } = require('./io');
const { verifyDataRoot } = require('./verify');

const ACTIONS = new Set(['keep', 'merge', 'drop', 'patch']);
const PATCH_FIELDS = Object.freeze({
  characters: new Set(['name', 'aliases', 'identity', 'level', 'rank', 'biography', 'faction', 'skills', 'items']),
  skills: new Set(['name', 'type', 'faction', 'rank', 'description', 'techniques']),
  items: new Set(['name', 'type', 'description']),
  factions: new Set(['name', 'type', 'description'])
});

function containsForbiddenEvidence(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenEvidence);
  return Object.entries(value).some(([key, nested]) => (
    ['source_refs', 'source_ref', 'evidence', 'quote'].includes(key)
    || containsForbiddenEvidence(nested)
  ));
}

function validatePatch(patch, scope, index, errors) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    errors.push({ code: 'OVERLAY_PATCH_REQUIRED', index });
    return;
  }
  for (const field of Object.keys(patch)) {
    if (!PATCH_FIELDS[scope]?.has(field)) {
      errors.push({ code: 'OVERLAY_PATCH_FIELD_INVALID', index, field });
    }
  }
  if (containsForbiddenEvidence(patch)) errors.push({ code: 'OVERLAY_EVIDENCE_INVENTED', index });
}

function validateOverlay(overlay, { baseRegistry, groundingContext = {} } = {}) {
  const errors = [];
  if (!overlay || overlay.schema_version !== 1 || !Array.isArray(overlay.operations)) {
    return [{ code: 'OVERLAY_OPERATIONS_REQUIRED' }];
  }
  if (groundingContext.base_manifest_hash
    && overlay.base_manifest_hash !== groundingContext.base_manifest_hash) {
    errors.push({ code: 'OVERLAY_BASE_STALE' });
  }
  if (groundingContext.base_data_hash && overlay.base_data_hash !== groundingContext.base_data_hash) {
    errors.push({ code: 'OVERLAY_DATA_STALE' });
  }
  const scope = groundingContext.scope;
  const mapping = groundingContext.registry_map?.categories?.[scope] || {};
  const registryEntries = baseRegistry?.categories?.[scope] || [];
  const knownRegistryKeys = new Set(registryEntries.map(entry => entry.registry_key));
  const seenKeys = new Set();
  const seenIds = new Set();
  const byKey = new Map(overlay.operations.map(operation => [operation?.registry_key, operation]));
  for (const [index, operation] of overlay.operations.entries()) {
    if (!ACTIONS.has(operation?.action)) errors.push({ code: 'OVERLAY_ACTION_INVALID', index });
    const registryKey = operation?.registry_key;
    const currentId = mapping[registryKey];
    if (!knownRegistryKeys.has(registryKey) || typeof currentId !== 'string') {
      errors.push({ code: 'OVERLAY_ENTITY_UNKNOWN', index });
    }
    if (seenKeys.has(registryKey)) errors.push({ code: 'OVERLAY_ENTITY_DUPLICATE', index });
    seenKeys.add(registryKey);
    if (typeof currentId === 'string' && seenIds.has(currentId)) {
      errors.push({ code: 'OVERLAY_CURRENT_ENTITY_DUPLICATE', index });
    }
    if (typeof currentId === 'string') seenIds.add(currentId);
    if (containsForbiddenEvidence(operation)) errors.push({ code: 'OVERLAY_EVIDENCE_INVENTED', index });
    if (operation?.action === 'patch') validatePatch(operation.patch, scope, index, errors);
    if (operation?.action === 'merge') {
      const targetId = mapping[operation.target_registry_key];
      if (!knownRegistryKeys.has(operation.target_registry_key) || typeof targetId !== 'string') {
        errors.push({ code: 'OVERLAY_TARGET_UNKNOWN', index });
      } else if (targetId === currentId) {
        errors.push({ code: 'OVERLAY_TARGET_SAME_ENTITY', index });
      }
      if (operation.patch !== undefined) validatePatch(operation.patch, scope, index, errors);
      const targetOperation = byKey.get(operation.target_registry_key);
      if (targetOperation && !['keep', 'patch'].includes(targetOperation.action)) {
        errors.push({ code: 'OVERLAY_TARGET_CHANGED', index });
      }
    }
  }
  return errors;
}

function replaceReferences(data, scope, sourceId, targetId) {
  for (const character of data['characters.yaml']) {
    if (scope === 'factions' && character.faction === sourceId) character.faction = targetId;
    if (scope === 'skills') {
      character.skills = character.skills.map(id => (id === sourceId ? targetId : id))
        .filter((id, index, values) => id && values.indexOf(id) === index)
        .sort();
    }
    if (scope === 'items') {
      character.items = character.items.map(id => (id === sourceId ? targetId : id))
        .filter((id, index, values) => id && values.indexOf(id) === index)
        .sort();
    }
  }
  if (scope === 'factions') {
    for (const skill of data['skills.yaml']) {
      if (skill.faction === sourceId) skill.faction = targetId;
    }
  }
}

function applyOperations(data, mapping, scope, operations) {
  const filename = CATEGORY_FILES[scope];
  const records = data[filename];
  const byId = new Map(records.map(record => [record.id, structuredClone(record)]));
  const nextMapping = structuredClone(mapping);
  for (const operation of [...operations].sort((left, right) => left.registry_key.localeCompare(right.registry_key))) {
    const sourceId = nextMapping.categories[scope][operation.registry_key];
    const source = byId.get(sourceId);
    if (!source) throw new GameKbError('OVERLAY_ENTITY_UNKNOWN', 'Overlay entity is absent from current data');
    if (operation.action === 'patch') {
      byId.set(sourceId, { ...source, ...structuredClone(operation.patch), id: sourceId });
    } else if (operation.action === 'drop') {
      byId.delete(sourceId);
      replaceReferences(data, scope, sourceId, null);
      for (const [registryKey, id] of Object.entries(nextMapping.categories[scope])) {
        if (id === sourceId) nextMapping.categories[scope][registryKey] = null;
      }
    } else if (operation.action === 'merge') {
      const targetId = nextMapping.categories[scope][operation.target_registry_key];
      const target = byId.get(targetId);
      if (!target) throw new GameKbError('OVERLAY_TARGET_UNKNOWN', 'Overlay merge target is absent from current data');
      byId.delete(sourceId);
      byId.set(targetId, operation.patch
        ? { ...target, ...structuredClone(operation.patch), id: targetId }
        : target);
      replaceReferences(data, scope, sourceId, targetId);
      for (const [registryKey, id] of Object.entries(nextMapping.categories[scope])) {
        if (id === sourceId) nextMapping.categories[scope][registryKey] = targetId;
      }
    }
  }
  data[filename] = [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
  return nextMapping;
}

function removeEmptyRevisionRoot(paths) {
  if (fs.existsSync(paths.revisions) && fs.readdirSync(paths.revisions).length === 0) {
    fs.rmdirSync(paths.revisions);
  }
}

function applyOverlay({ paths, taskId, faultAt, injectFault }) {
  const state = loadState(paths);
  const task = state.tasks.find(item => item.task_id === taskId);
  if (!task || task.status !== 'ready') {
    throw new GameKbError('DEFERRED_TASK_NOT_READY', 'Deferred task is not ready to apply');
  }
  try {
    assertTaskFresh(paths, task);
  } catch (error) {
    task.status = 'failed';
    task.error = error.code || 'DEFERRED_TASK_STALE';
    saveState(paths, state);
    throw error;
  }
  if (!fs.existsSync(task.overlay_path) || hashFile(task.overlay_path) !== task.overlay_hash) {
    throw new GameKbError('DEFERRED_OVERLAY_MUTATED', 'Accepted overlay bytes changed after validation');
  }
  const overlay = readYaml(task.overlay_path);
  const mapping = loadRegistryMap(
    paths,
    task.base_manifest_hash,
    { final_data_hash: task.base_data_hash }
  );
  const errors = validateOverlay(overlay, {
    baseRegistry: readJson(paths.candidateRegistry),
    groundingContext: {
      base_manifest_hash: task.base_manifest_hash,
      base_data_hash: task.base_data_hash,
      registry_map: mapping,
      scope: task.scope
    }
  });
  if (errors.length) throw new GameKbError('OVERLAY_INVALID', 'Overlay failed validation', { errors });

  const data = Object.fromEntries(Object.values(CATEGORY_FILES).map(filename => [
    filename,
    readYaml(path.join(paths.novel, 'data', filename))
  ]));
  const nextMapping = applyOperations(data, mapping, task.scope, overlay.operations);
  const revisionId = `revision-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const temp = path.join(paths.revisions, `${revisionId}.tmp`);
  const target = path.join(paths.revisions, revisionId);
  const revisionData = path.join(temp, 'data');
  fs.mkdirSync(revisionData, { recursive: true });
  for (const filename of Object.values(CATEGORY_FILES)) {
    fs.writeFileSync(
      path.join(revisionData, filename),
      yaml.dump(data[filename], { noRefs: true, lineWidth: -1 }),
      'utf8'
    );
  }
  const manifest = readJson(paths.manifest);
  const verification = verifyDataRoot(revisionData, { chapters: manifest.chapters });
  if (!verification.passed) {
    fs.rmSync(temp, { recursive: true, force: true });
    removeEmptyRevisionRoot(paths);
    throw new GameKbError('OVERLAY_REVISION_VERIFICATION_FAILED', 'Overlay revision failed verification', verification);
  }
  nextMapping.final_data_hash = verification.final_data_hash;
  nextMapping.updated_at = new Date().toISOString();
  const verificationReport = {
    ...verification,
    source_hash: manifest.source_hash,
    profile: 'v5',
    scope: 'revision',
    base_manifest_hash: task.base_manifest_hash,
    previous_final_data_hash: task.base_data_hash,
    task_id: task.task_id,
    revision_id: revisionId,
    verified_at: new Date().toISOString()
  };
  const previousState = fs.existsSync(paths.deferredTasks) ? fs.readFileSync(paths.deferredTasks, 'utf8') : null;
  const previousMapping = fs.existsSync(paths.registryMap) ? fs.readFileSync(paths.registryMap, 'utf8') : null;
  let revisionPromoted = false;
  let revisionReceipt;
  try {
    promoteVerifiedData(paths.novel, {
      sourceData: revisionData,
      sourceHash: manifest.source_hash,
      finalDataHash: verification.final_data_hash,
      chapters: manifest.chapters.map(chapter => ({
        number: chapter.number,
        title: chapter.title,
        input_hash: chapter.input_hash
      })),
      profile: 'v5',
      expectedPreviousHash: task.base_data_hash,
      faultAt,
      injectFault,
      verificationReportContent: `${JSON.stringify(verificationReport, null, 2)}\n`,
      receiptExtras: {
        base_run_id: paths.runId,
        base_manifest_hash: task.base_manifest_hash,
        registry_map_hash: stableHash(nextMapping),
        revision_id: revisionId,
        task_id: task.task_id
      },
      commit(installReceipt) {
        revisionReceipt = {
          schema_version: 1,
          revision_id: revisionId,
          task_id: task.task_id,
          base_run_id: paths.runId,
          base_manifest_hash: task.base_manifest_hash,
          previous_final_data_hash: task.base_data_hash,
          final_data_hash: verification.final_data_hash,
          backup_path: installReceipt.backup_path,
          backup_final_data_hash: installReceipt.backup_final_data_hash,
          installed_data_path: path.join(paths.novel, 'data'),
          operations_hash: stableHash(overlay.operations),
          operations: overlay.operations,
          registry_map_hash: stableHash(nextMapping),
          applied_at: installReceipt.installed_at,
          revision_dir: target
        };
        atomicWriteJson(path.join(temp, 'revision-receipt.json'), revisionReceipt);
        fs.renameSync(temp, target);
        revisionPromoted = true;
        atomicWriteJson(paths.registryMap, nextMapping);
        task.status = 'applied';
        task.revision_id = revisionId;
        task.revision_dir = target;
        task.final_data_hash = verification.final_data_hash;
        task.applied_at = installReceipt.installed_at;
        saveState(paths, state);
      },
      rollbackCommit() {
        if (revisionPromoted) fs.rmSync(target, { recursive: true, force: true });
        else fs.rmSync(temp, { recursive: true, force: true });
        if (previousMapping === null) fs.rmSync(paths.registryMap, { force: true });
        else atomicWriteFile(paths.registryMap, previousMapping);
        if (previousState === null) fs.rmSync(paths.deferredTasks, { force: true });
        else atomicWriteFile(paths.deferredTasks, previousState);
        removeEmptyRevisionRoot(paths);
      }
    });
    return revisionReceipt;
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    if (revisionPromoted) fs.rmSync(target, { recursive: true, force: true });
    removeEmptyRevisionRoot(paths);
    throw error;
  }
}

module.exports = { applyOverlay, validateOverlay };
