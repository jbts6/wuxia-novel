'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { atomicWriteFile, readJson } = require('./io');
const { stagingPathFor } = require('./paths');
const { DOMAIN_UNITS, SEMANTIC_CONTRACT_VERSION } = require('./semantic-contract');

const WORK_CONTRACT_VERSION = SEMANTIC_CONTRACT_VERSION;
const DOMAIN_UNIT_SET = new Set(DOMAIN_UNITS);
const DOMAIN_INPUT_HASH_CONTRACT = 'domain-input-v1';

function serializedInputBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function workItemError(code, message, details = {}) {
  return new GameKbError(code, message, details);
}

function workRoot(paths, stage) {
  if (stage === 'domain') return paths.domainWork;
  throw workItemError('WORK_PLAN_INVALID', 'Unknown semantic work-plan stage', { stage });
}

function unitDirectory(root, unit) {
  if (typeof unit !== 'string' || !DOMAIN_UNIT_SET.has(unit)) {
    throw workItemError('WORK_UNIT_INVALID', 'Semantic work unit is invalid', { unit });
  }
  return path.join(root, unit.replaceAll(':', '_'));
}

function jsonBytes(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function workerInput(paths, input, attempt = 1) {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 2) {
    throw workItemError('WORK_ITEM_INVALID', 'Worker attempt must use the bounded submission budget', {
      unit: input?.unit,
      attempt
    });
  }
  return {
    ...input,
    staging_path: stagingPathFor(paths, input.unit, attempt),
    attempt
  };
}

function inputWithoutWorkerMetadata(input) {
  const { staging_path: stagingPath, attempt, ...semanticInput } = input || {};
  return semanticInput;
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => (
    String(left).localeCompare(String(right), 'zh-Hans-CN')
  )));
}

function semanticInputHash(input, bindings = [], upstreamHashes = {}) {
  const { input_hash: inputHash, ...aiInput } = inputWithoutWorkerMetadata(input);
  void inputHash;
  const normalizedBindings = bindings.map(({ unit, input_hash: bindingHash, ...binding }) => {
    void bindingHash;
    return binding;
  });
  const bytes = JSON.stringify({
    semantic_contract_version: WORK_CONTRACT_VERSION,
    semantic_profile: aiInput.semantic_profile,
    stage: aiInput.stage,
    unit: aiInput.unit,
    accepted_hashes: sortedObject(upstreamHashes),
    ai_input: aiInput,
    bindings: normalizedBindings
  });
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function assertSourceFiles(paths, input) {
  if (!Object.hasOwn(input, 'source_files')) return;
  const manifest = readJson(paths.manifest);
  const expected = (manifest.chapters || []).map(chapter => ({
    chapter: chapter.number,
    title: chapter.title,
    source_file: chapter.file,
    input_hash: chapter.input_hash
  }));
  if (JSON.stringify(input.source_files) !== JSON.stringify(expected)) {
    throw workItemError('WORK_ITEM_STALE', 'Whole-book source descriptors differ from the run manifest', {
      unit: input.unit
    });
  }
  for (const descriptor of input.source_files) {
    const sourceFile = path.resolve(descriptor.source_file);
    if (!fs.existsSync(sourceFile)) {
      throw workItemError('WORK_ITEM_STALE', 'A signed source chapter is missing', {
        unit: input.unit,
        source_file: descriptor.source_file
      });
    }
    const normalized = fs.readFileSync(sourceFile, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const content = normalized.endsWith('\n') ? normalized : `${normalized}\n`;
    const hash = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
    if (hash !== descriptor.input_hash) {
      throw workItemError('WORK_ITEM_STALE', 'A signed source chapter hash has changed', {
        unit: input.unit,
        source_file: descriptor.source_file
      });
    }
  }
}

function assertWorkerInput(paths, input) {
  if (!Number.isInteger(input?.attempt) || input.attempt < 1 || input.attempt > 2) {
    throw workItemError('WORK_ITEM_INVALID', 'Semantic work item is missing a valid attempt', {
      unit: input?.unit,
      attempt: input?.attempt ?? null
    });
  }
  const expected = stagingPathFor(paths, input.unit, input.attempt);
  if (path.resolve(input.staging_path || '') !== path.resolve(expected)) {
    throw workItemError('WORK_ITEM_INVALID', 'Semantic work item has a non-canonical staging path', {
      unit: input.unit,
      staging_path: input.staging_path ?? null,
      expected
    });
  }
  return input;
}

function planDocument(plan) {
  return {
    schema_version: 1,
    semantic_contract_version: WORK_CONTRACT_VERSION,
    stage: plan.stage,
    source_hash: plan.source_hash,
    upstream_hashes: plan.upstream_hashes,
    units: plan.inputs.map(input => ({
      unit: input.unit,
      category: input.category,
      input_hash: input.input_hash,
      input_bytes: serializedInputBytes(input),
      staging_path: input.staging_path,
      attempt: input.attempt
    })),
    consolidations: plan.consolidations || []
  };
}

function planUnitDescriptor(input) {
  return {
    unit: input.unit,
    category: input.category,
    input_hash: input.input_hash,
    input_bytes: serializedInputBytes(input),
    staging_path: input.staging_path,
    attempt: input.attempt
  };
}

function bindingsDocument(plan, input) {
  return {
    schema_version: 1,
    semantic_contract_version: WORK_CONTRACT_VERSION,
    unit: input.unit,
    input_hash: input.input_hash,
    hash_contract: DOMAIN_INPUT_HASH_CONTRACT,
    upstream_hashes: sortedObject(plan.upstream_hashes),
    bindings: (plan.bindings || []).filter(binding => binding.unit === input.unit)
  };
}

function writeWorkPlan(paths, plan) {
  const root = workRoot(paths, plan?.stage);
  const inputs = (plan.inputs || []).map(input => workerInput(paths, input));
  const files = [{
    file: path.join(root, 'plan.json'),
    content: jsonBytes(planDocument({ ...plan, inputs }))
  }];
  for (const input of inputs) {
    const directory = unitDirectory(root, input.unit);
    files.push(
      { file: path.join(directory, 'input.json'), content: jsonBytes(input) },
      {
        file: path.join(directory, 'bindings.json'),
        content: jsonBytes(bindingsDocument(plan, input))
      }
    );
  }

  for (const entry of files) {
    if (fs.existsSync(entry.file) && fs.readFileSync(entry.file, 'utf8') !== entry.content) {
      throw workItemError('WORK_ITEM_STALE', 'Existing semantic work bytes differ', { file: entry.file });
    }
  }
  let written = false;
  for (const entry of files) {
    if (fs.existsSync(entry.file)) continue;
    atomicWriteFile(entry.file, entry.content);
    written = true;
  }
  return { written, plan: path.join(root, 'plan.json') };
}

function writeWorkItem(paths, stage, input, bindingsDocument, options = {}) {
  const root = workRoot(paths, stage);
  const storedInput = workerInput(paths, input, options.attempt ?? 1);
  const directory = unitDirectory(root, storedInput?.unit);
  const files = [
    { file: path.join(directory, 'input.json'), content: jsonBytes(storedInput) },
    { file: path.join(directory, 'bindings.json'), content: jsonBytes(bindingsDocument) }
  ];
  const stale = files.find(entry => fs.existsSync(entry.file) && fs.readFileSync(entry.file, 'utf8') !== entry.content);
  let rotated = null;
  if (stale) {
    const inputFile = path.join(directory, 'input.json');
    const bindingsFile = path.join(directory, 'bindings.json');
    if (options.advanceAttempt === true && fs.existsSync(inputFile) && fs.existsSync(bindingsFile)) {
      const previousInput = readJson(inputFile);
      const sameSemanticInput = JSON.stringify(inputWithoutWorkerMetadata(previousInput))
        === JSON.stringify(inputWithoutWorkerMetadata(storedInput));
      const sameBindings = fs.readFileSync(bindingsFile, 'utf8') === files[1].content;
      if (!sameSemanticInput || !sameBindings || storedInput.attempt !== previousInput.attempt + 1) {
        throw workItemError('WORK_ITEM_STALE', 'Semantic retry cannot change worker input bytes', {
          unit: storedInput.unit
        });
      }
      atomicWriteFile(inputFile, files[0].content);
      return { written: true, input: inputFile, bindings: bindingsFile, rotated: null };
    }
    if (options.rotateStale !== true) {
      throw workItemError('WORK_ITEM_STALE', 'Existing semantic work bytes differ', { file: stale.file });
    }
    if (!fs.existsSync(inputFile) || !fs.existsSync(bindingsFile)) {
      throw workItemError('WORK_ITEM_STALE', 'Existing semantic work item is incomplete', { unit: input?.unit });
    }
    const previousInput = readJson(inputFile);
    const previousBindings = readJson(bindingsFile);
    const oldInputHash = previousInput?.input_hash;
    if (previousInput?.unit !== input?.unit
      || previousBindings?.unit !== input?.unit
      || previousBindings?.input_hash !== oldInputHash
      || !/^sha256:[a-f0-9]{64}$/.test(oldInputHash || '')
      || input?.input_hash !== bindingsDocument?.input_hash
      || input?.input_hash === oldInputHash) {
      throw workItemError('WORK_ITEM_STALE', 'Existing semantic work item cannot be rotated safely', {
        unit: input?.unit
      });
    }
    const archiveDirectory = path.join(
      root,
      '_stale',
      input.unit.replaceAll(':', '_'),
      oldInputHash.slice('sha256:'.length)
    );
    if (fs.existsSync(archiveDirectory)) {
      throw workItemError('WORK_ITEM_STALE', 'Stale semantic work archive already exists', {
        unit: input.unit,
        archive_dir: archiveDirectory
      });
    }
    fs.mkdirSync(path.dirname(archiveDirectory), { recursive: true });
    fs.renameSync(directory, archiveDirectory);
    rotated = {
      unit: input.unit,
      old_input_hash: oldInputHash,
      new_input_hash: input.input_hash,
      archive_dir: archiveDirectory
    };
  }
  try {
    let written = false;
    for (const entry of files) {
      if (fs.existsSync(entry.file)) continue;
      atomicWriteFile(entry.file, entry.content);
      written = true;
    }
    return { written, input: files[0].file, bindings: files[1].file, rotated };
  } catch (error) {
    if (rotated) {
      fs.rmSync(directory, { recursive: true, force: true });
      fs.renameSync(rotated.archive_dir, directory);
    }
    throw error;
  }
}

function readWorkItem(paths, unit) {
  const directory = unitDirectory(workRoot(paths, 'domain'), unit);
  const inputFile = path.join(directory, 'input.json');
  const bindingsFile = path.join(directory, 'bindings.json');
  if (!fs.existsSync(inputFile) || !fs.existsSync(bindingsFile)) {
    throw workItemError('WORK_ITEM_MISSING', 'Semantic work item is incomplete', { unit });
  }
  const input = readJson(inputFile);
  const bindings = readJson(bindingsFile);
  if (input?.unit !== unit || bindings?.unit !== unit || input?.input_hash !== bindings?.input_hash) {
    throw workItemError('WORK_ITEM_STALE', 'Semantic input and private bindings disagree', { unit });
  }
  if (bindings.hash_contract !== DOMAIN_INPUT_HASH_CONTRACT) {
    throw workItemError('WORK_ITEM_STALE', 'Semantic work item uses an unsupported hash contract', {
      unit,
      hash_contract: bindings.hash_contract ?? null
    });
  }
  const actualHash = semanticInputHash(input, bindings.bindings || [], bindings.upstream_hashes || {});
  if (actualHash !== input.input_hash) {
    throw workItemError('WORK_ITEM_STALE', 'Semantic input hash does not match its signed bytes', { unit });
  }
  assertSourceFiles(paths, input);
  assertWorkerInput(paths, input);
  return { input, bindings, input_file: inputFile, bindings_file: bindingsFile };
}

function assertWorkMatchesDescriptor(work, descriptor) {
  if (JSON.stringify(planUnitDescriptor(work.input)) !== JSON.stringify(descriptor)) {
    throw workItemError('WORK_ITEM_STALE', 'Work item differs from its plan descriptor', {
      unit: descriptor?.unit ?? work.input?.unit ?? null
    });
  }
}

function refreshWorkPlanUnit(paths, nextPlan, unit, options = {}) {
  const root = workRoot(paths, nextPlan?.stage);
  const planFile = path.join(root, 'plan.json');
  if (!fs.existsSync(planFile)) {
    throw workItemError('WORK_PLAN_MISSING', 'Semantic work plan is missing', { stage: nextPlan?.stage });
  }
  const document = readJson(planFile);
  if (document?.stage !== nextPlan?.stage || !Array.isArray(document.units)) {
    throw workItemError('WORK_PLAN_INVALID', 'Semantic work plan is invalid', { stage: nextPlan?.stage });
  }
  const oldDescriptor = (document.units || []).find(descriptor => descriptor.unit === unit);
  const nextInput = (nextPlan.inputs || []).find(input => input.unit === unit);
  if (!oldDescriptor || !nextInput) {
    throw workItemError('WORK_UNIT_INVALID', 'Semantic work unit is not present in both plans', { unit });
  }
  const existingWork = readWorkItem(paths, unit);
  assertWorkMatchesDescriptor(existingWork, oldDescriptor);
  if (oldDescriptor.input_hash === nextInput.input_hash) {
    return {
      written: false,
      unit,
      old_input_hash: oldDescriptor.input_hash,
      new_input_hash: nextInput.input_hash,
      archive_dir: null
    };
  }

  const storedInput = workerInput(paths, nextInput, 1);
  const result = writeWorkItem(
    paths,
    nextPlan.stage,
    nextInput,
    bindingsDocument(nextPlan, storedInput),
    { rotateStale: true }
  );
  if (typeof options.afterWorkWrite === 'function') options.afterWorkWrite(result);
  const nextDocument = {
    ...document,
    source_hash: nextPlan.source_hash,
    upstream_hashes: nextPlan.upstream_hashes,
    units: document.units.map(descriptor => (
      descriptor.unit === unit ? planUnitDescriptor(storedInput) : descriptor
    ))
  };
  try {
    atomicWriteFile(planFile, jsonBytes(nextDocument));
    if (typeof options.afterPlanWrite === 'function') options.afterPlanWrite(nextDocument);
  } catch (error) {
    if (result.rotated) {
      const directory = unitDirectory(root, unit);
      fs.rmSync(directory, { recursive: true, force: true });
      fs.renameSync(result.rotated.archive_dir, directory);
    }
    throw error;
  }
  return {
    written: true,
    unit,
    old_input_hash: oldDescriptor.input_hash,
    new_input_hash: nextInput.input_hash,
    archive_dir: result.rotated?.archive_dir || null
  };
}

function syncWorkItemAttempt(paths, unit, attempt) {
  const work = readWorkItem(paths, unit);
  if (work.input.attempt === attempt) return { written: false, input: work.input_file };
  const input = workerInput(paths, work.input, attempt);
  atomicWriteFile(work.input_file, jsonBytes(input));
  return { written: true, input: work.input_file };
}

function readWorkPlan(paths, stage) {
  const root = workRoot(paths, stage);
  const file = path.join(root, 'plan.json');
  if (!fs.existsSync(file)) {
    throw workItemError('WORK_PLAN_MISSING', 'Semantic work plan is missing', { stage });
  }
  const document = readJson(file);
  if (document?.stage !== stage || !Array.isArray(document.units)) {
    throw workItemError('WORK_PLAN_INVALID', 'Semantic work plan is invalid', { stage });
  }
  const workItems = document.units.map(descriptor => readWorkItem(paths, descriptor.unit));
  for (let index = 0; index < workItems.length; index += 1) {
    assertWorkMatchesDescriptor(workItems[index], document.units[index]);
  }
  return {
    schema_version: document.schema_version,
    semantic_contract_version: document.semantic_contract_version,
    stage,
    source_hash: document.source_hash,
    upstream_hashes: document.upstream_hashes,
    inputs: workItems.map(work => work.input),
    bindings: workItems.flatMap(work => work.bindings.bindings || []),
    consolidations: document.consolidations || []
  };
}

module.exports = {
  WORK_CONTRACT_VERSION,
  readWorkPlan,
  readWorkItem,
  serializedInputBytes,
  semanticInputHash,
  refreshWorkPlanUnit,
  syncWorkItemAttempt,
  writeWorkItem,
  writeWorkPlan
};
