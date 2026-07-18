'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { stableHash } = require('./accept');
const { GameKbError } = require('./errors');
const { CATEGORY_FILES } = require('./finalize');
const { atomicWriteJson, atomicWriteYaml, readJson, readYaml } = require('./io');
const { deferredPathsFor } = require('./paths');
const { PROFILE_V5, SEMANTIC_CONTRACT_VERSION } = require('./semantic-contract');

const TASK_TYPES = Object.freeze({
  'characters-deep': 'characters',
  'skills-deep': 'skills',
  'items-deep': 'items',
  'factions-deep': 'factions'
});

function hashFile(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function resolvePublishedV5Paths(novelDir, runId) {
  if (!runId) throw new GameKbError('RUN_REQUIRED', 'Deferred tasks require --run <published-run-id>');
  const paths = deferredPathsFor(novelDir, runId);
  for (const file of [paths.runJson, paths.manifest, paths.artifactManifest, paths.archiveReceipt]) {
    if (!fs.existsSync(file)) {
      throw new GameKbError('PUBLISHED_RUN_MISSING', 'Published v5 run does not exist', {
        run_id: runId,
        missing: file
      });
    }
  }
  const run = readJson(paths.runJson);
  const receipt = readJson(paths.archiveReceipt);
  const manifestHash = hashFile(paths.artifactManifest);
  if (run.run_id !== runId
    || run.status !== 'archived'
    || run.profile !== PROFILE_V5
    || run.semantic_contract_version !== SEMANTIC_CONTRACT_VERSION
    || receipt.run_id !== runId
    || receipt.status !== 'archived'
    || receipt.artifact_manifest_hash !== manifestHash) {
    throw new GameKbError('PUBLISHED_RUN_INVALID', 'Published v5 run metadata is invalid or stale', {
      run_id: runId
    });
  }
  return paths;
}

function loadState(paths) {
  if (!fs.existsSync(paths.deferredTasks)) {
    return { schema_version: 1, run_id: paths.runId, tasks: [] };
  }
  const state = readJson(paths.deferredTasks);
  if (!state || state.schema_version !== 1 || state.run_id !== paths.runId || !Array.isArray(state.tasks)) {
    throw new GameKbError('DEFERRED_TASKS_INVALID', 'Deferred task registry is invalid');
  }
  return state;
}

function saveState(paths, state) {
  atomicWriteJson(paths.deferredTasks, state);
}

function installedIdentity(paths, baseManifestHash) {
  const { verifyInstalled } = require('./install');
  const installed = verifyInstalled(paths.novel);
  if (!installed.passed) {
    throw new GameKbError('INSTALLED_VERIFICATION_REQUIRED', 'Installed data must verify before deep work', installed);
  }
  const run = readJson(paths.runJson);
  if (installed.source_hash !== run.source_hash) {
    throw new GameKbError('DEFERRED_INSTALLED_BASE_MISMATCH', 'Installed data belongs to another source', {
      run_id: paths.runId,
      expected_source_hash: run.source_hash,
      installed_source_hash: installed.source_hash
    });
  }
  if (installed.final_data_hash !== run.final_data_hash) {
    const receipt = readJson(path.join(paths.novel, 'reports', 'generate_game_kb_install.json'));
    if (receipt.base_run_id !== paths.runId || receipt.base_manifest_hash !== baseManifestHash) {
      throw new GameKbError('DEFERRED_INSTALLED_BASE_MISMATCH', 'Installed revision has no matching v5 lineage', {
        run_id: paths.runId,
        installed_final_data_hash: installed.final_data_hash
      });
    }
  }
  return installed;
}

function initialRegistryMap(paths, baseManifestHash, installed) {
  const run = readJson(paths.runJson);
  if (installed.final_data_hash !== run.final_data_hash) {
    throw new GameKbError(
      'DEFERRED_REGISTRY_MAP_MISSING',
      'Current installed revision cannot be mapped to the archived registry'
    );
  }
  const idPlan = readJson(paths.finalIdPlan);
  const categories = {};
  for (const category of Object.values(TASK_TYPES)) {
    categories[category] = {};
    for (const record of idPlan[category] || []) {
      if (typeof record.registry_key !== 'string' || typeof record.id !== 'string') {
        throw new GameKbError('DEFERRED_ID_PLAN_INVALID', 'Published id plan lacks registry bindings', {
          category
        });
      }
      categories[category][record.registry_key] = record.id;
    }
  }
  return {
    schema_version: 1,
    run_id: paths.runId,
    base_manifest_hash: baseManifestHash,
    final_data_hash: installed.final_data_hash,
    categories,
    updated_at: new Date().toISOString()
  };
}

function loadRegistryMap(paths, baseManifestHash, installed) {
  if (!fs.existsSync(paths.registryMap)) {
    const created = initialRegistryMap(paths, baseManifestHash, installed);
    atomicWriteJson(paths.registryMap, created);
    return created;
  }
  const mapping = readJson(paths.registryMap);
  if (mapping.schema_version !== 1
    || mapping.run_id !== paths.runId
    || mapping.base_manifest_hash !== baseManifestHash
    || mapping.final_data_hash !== installed.final_data_hash
    || !mapping.categories) {
    throw new GameKbError('DEFERRED_REGISTRY_MAP_STALE', 'Installed registry map is stale or invalid');
  }
  const run = readJson(paths.runJson);
  const receipt = readJson(path.join(paths.novel, 'reports', 'generate_game_kb_install.json'));
  if (installed.final_data_hash !== run.final_data_hash
    && typeof receipt.registry_map_hash !== 'string') {
    throw new GameKbError(
      'DEFERRED_REGISTRY_MAP_HASH_MISSING',
      'Installed revision receipt does not bind the registry map'
    );
  }
  if (receipt.registry_map_hash && stableHash(mapping) !== receipt.registry_map_hash) {
    throw new GameKbError(
      'DEFERRED_REGISTRY_MAP_HASH_MISMATCH',
      'Installed registry map does not match the current revision receipt'
    );
  }
  return mapping;
}

function buildTaskInput(paths, task, mapping) {
  const filename = CATEGORY_FILES[task.scope];
  const records = readYaml(path.join(paths.novel, 'data', filename));
  const recordsById = new Map(records.map(record => [record.id, record]));
  const keysById = new Map();
  for (const [registryKey, id] of Object.entries(mapping.categories[task.scope] || {})) {
    if (typeof id !== 'string' || !recordsById.has(id)) continue;
    if (!keysById.has(id)) keysById.set(id, []);
    keysById.get(id).push(registryKey);
  }
  const entities = [...keysById.entries()].map(([id, registryKeys]) => {
    registryKeys.sort((left, right) => left.localeCompare(right));
    return {
      registry_key: registryKeys[0],
      registry_keys: registryKeys,
      final_id: id,
      record: recordsById.get(id)
    };
  }).sort((left, right) => left.registry_key.localeCompare(right.registry_key));
  const inputPath = path.join(paths.tasks, task.task_id, 'input.json');
  atomicWriteJson(inputPath, {
    schema_version: 1,
    task_id: task.task_id,
    type: task.type,
    scope: task.scope,
    base_manifest_hash: task.base_manifest_hash,
    current_data_hash: task.base_data_hash,
    staging_path: task.staging_path,
    current_data_dir: path.join(paths.novel, 'data'),
    candidate_registry: paths.candidateRegistry,
    accepted_chapters: paths.chapters,
    source_chapters: paths.sourceChapters,
    entities
  });
  return inputPath;
}

function addDeferredTask({ paths, type, scope, requestedBy = 'manual' }) {
  if (!TASK_TYPES[type] || scope !== TASK_TYPES[type]) {
    throw new GameKbError('DEFERRED_TASK_TYPE_INVALID', 'Unknown deferred task type or scope', { type, scope });
  }
  const baseManifestHash = hashFile(paths.artifactManifest);
  const installed = installedIdentity(paths, baseManifestHash);
  const mapping = loadRegistryMap(paths, baseManifestHash, installed);
  const state = loadState(paths);
  const task = {
    task_id: `${type}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    type,
    scope,
    requested_by: requestedBy,
    base_manifest_hash: baseManifestHash,
    base_data_hash: installed.final_data_hash,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  task.staging_path = path.join(paths.tasks, task.task_id, 'overlay.yaml');
  task.input_path = buildTaskInput(paths, task, mapping);
  state.tasks.push(task);
  saveState(paths, state);
  return task;
}

function assertTaskFresh(paths, task) {
  const currentManifestHash = hashFile(paths.artifactManifest);
  const installed = installedIdentity(paths, currentManifestHash);
  if (currentManifestHash !== task.base_manifest_hash || installed.final_data_hash !== task.base_data_hash) {
    throw new GameKbError('DEFERRED_TASK_STALE', 'Deferred task is bound to stale installed data', {
      task_id: task.task_id,
      expected_data_hash: task.base_data_hash,
      installed_data_hash: installed.final_data_hash
    });
  }
  return installed;
}

function runDeferredTask({ paths, taskId, draftPath }) {
  const state = loadState(paths);
  const task = state.tasks.find(item => item.task_id === taskId);
  if (!task) throw new GameKbError('DEFERRED_TASK_MISSING', 'Deferred task does not exist', { task_id: taskId });
  if (task.status !== 'pending') {
    throw new GameKbError('DEFERRED_TASK_STATE_INVALID', 'Only a pending task can accept an overlay', {
      task_id: taskId,
      status: task.status
    });
  }
  const resolvedDraftPath = path.resolve(draftPath);
  const expectedDraftPath = path.resolve(task.staging_path);
  if (resolvedDraftPath !== expectedDraftPath) {
    throw new GameKbError(
      'DEFERRED_DRAFT_PATH_MISMATCH',
      'Deferred overlay must use the controller-issued staging path',
      { expected: expectedDraftPath, received: resolvedDraftPath }
    );
  }
  try {
    assertTaskFresh(paths, task);
  } catch (error) {
    task.status = 'failed';
    task.error = error.code || 'STALE_BASE';
    saveState(paths, state);
    throw error;
  }
  let draft;
  try {
    draft = readYaml(resolvedDraftPath);
  } catch (error) {
    task.status = 'failed';
    task.error = 'DRAFT_INVALID';
    saveState(paths, state);
    throw new GameKbError('DEFERRED_DRAFT_INVALID', 'Deferred overlay draft is invalid', {
      cause: error.message
    });
  }
  const mapping = loadRegistryMap(
    paths,
    task.base_manifest_hash,
    { final_data_hash: task.base_data_hash }
  );
  const { validateOverlay } = require('./overlay');
  const errors = validateOverlay(draft, {
    baseRegistry: readJson(paths.candidateRegistry),
    groundingContext: {
      base_manifest_hash: task.base_manifest_hash,
      base_data_hash: task.base_data_hash,
      registry_map: mapping,
      scope: task.scope
    }
  });
  if (errors.length > 0) {
    task.status = 'failed';
    task.error = 'OVERLAY_INVALID';
    saveState(paths, state);
    throw new GameKbError('OVERLAY_INVALID', 'Overlay failed validation', { errors });
  }
  const accepted = {
    ...draft,
    operations: [...draft.operations].sort((left, right) => (
      left.registry_key.localeCompare(right.registry_key)
    ))
  };
  const overlayPath = path.join(paths.overlays, `${task.task_id}.yaml`);
  atomicWriteYaml(overlayPath, accepted);
  task.draft_path = resolvedDraftPath;
  task.draft_hash = hashFile(resolvedDraftPath);
  task.overlay_path = overlayPath;
  task.overlay_hash = hashFile(overlayPath);
  task.status = 'ready';
  saveState(paths, state);
  return task;
}

module.exports = {
  TASK_TYPES,
  addDeferredTask,
  assertTaskFresh,
  hashFile,
  loadRegistryMap,
  loadState,
  resolvePublishedV5Paths,
  runDeferredTask,
  saveState
};
