'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const workflowFile = path.join(repoRoot, '.claude', 'workflows', 'game-kb-chapter-extract.js');
const agentFile = path.join(repoRoot, '.claude', 'agents', 'game-kb-chapter-worker.md');

function descriptor(number, batchStart) {
  const unit = `chapter:${String(number).padStart(3, '0')}`;
  const inputHash = `sha256:${String(number).padStart(64, '0')}`;
  return {
    batch_id: `chapter-batch-${String(batchStart).padStart(3, '0')}-${String(batchStart + 2).padStart(3, '0')}`,
    worker_write_paths: [],
    chapters: [{
      number,
      unit,
      title: `Chapter ${number}`,
      attempt: 1,
      input_hash: inputHash,
      source_file: `C:\\repo\\source\\ch_${String(number).padStart(3, '0')}.txt`,
    }],
    submissions: [{ unit, attempt: 1, input_hash: inputHash }],
  };
}

function argsFor(limit, count) {
  return {
    run_id: 'run-workflow-contract',
    concurrency_limit: limit,
    prompt_file: 'C:\\repo\\.agents\\skills\\generate-game-kb\\prompts\\extract-chapters.md',
    descriptors: Array.from({ length: count }, (_, index) => {
      const number = index + 1;
      const batchStart = Math.floor(index / 3) * 3 + 1;
      return descriptor(number, batchStart);
    }),
  };
}

function envelopeFor(job) {
  const chapter = job.chapters[0];
  return {
    schema_version: 1,
    batch_id: job.batch_id,
    unit: chapter.unit,
    attempt: chapter.attempt,
    input_hash: chapter.input_hash,
    draft: { schema_version: 6, chapter: chapter.number },
  };
}

function executeWorkflow(args, agent) {
  const source = fs.readFileSync(workflowFile, 'utf8')
    .replace(/^export const meta\s*=/, 'const meta =');
  const script = new vm.Script(`(async () => {\n${source}\n})()`);
  return script.runInNewContext({ args, agent, phase() {}, log() {}, Promise, Array, JSON, Set, Error });
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail('condition did not become true');
}

test('Claude workflow keeps five single-chapter agents active and refills freed slots', async () => {
  const config = argsFor(5, 12);
  const started = [];
  const resolvers = new Map();
  let active = 0;
  let maxActive = 0;
  const options = [];

  const run = executeWorkflow(config, (prompt, opts) => {
    const match = prompt.match(/CONTROLLER_JOB=(\{.*\})$/m);
    assert.ok(match, 'controller job marker');
    const job = JSON.parse(match[1]);
    const unit = job.chapters[0].unit;
    started.push(unit);
    options.push(opts);
    active += 1;
    maxActive = Math.max(maxActive, active);
    return new Promise(resolve => {
      resolvers.set(unit, () => {
        active -= 1;
        resolve(envelopeFor(job));
      });
    });
  });

  await waitFor(() => started.length === 5);
  resolvers.get('chapter:001')();
  await waitFor(() => started.length === 6);
  assert.equal(active, 5, 'sixth chapter replaces the completed first chapter');

  const resolved = new Set(['chapter:001']);
  while (resolved.size < config.descriptors.length) {
    for (const unit of [...started]) {
      if (resolved.has(unit)) continue;
      resolved.add(unit);
      resolvers.get(unit)();
    }
    await new Promise(resolve => setImmediate(resolve));
  }

  const results = await run;
  assert.equal(maxActive, 5);
  assert.deepEqual(results.map(result => result.unit), config.descriptors.map(job => job.chapters[0].unit));
  assert.ok(options.every(opts => opts.agentType === 'game-kb-chapter-worker'));
  assert.ok(options.every(opts => opts.schema?.additionalProperties === false));
});

test('Claude workflow enforces fallback three and rejects unsafe descriptors', async () => {
  const config = argsFor(3, 7);
  let active = 0;
  let maxActive = 0;
  const results = await executeWorkflow(config, async prompt => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setImmediate(resolve));
    active -= 1;
    const job = JSON.parse(prompt.match(/CONTROLLER_JOB=(\{.*\})$/m)[1]);
    return envelopeFor(job);
  });
  assert.equal(maxActive, 3);
  assert.equal(results.length, 7);

  await assert.rejects(
    executeWorkflow({ ...config, concurrency_limit: 4 }, async () => null),
    /concurrency_limit must be 5 or 3/,
  );
  const unsafe = structuredClone(config);
  unsafe.descriptors[0].worker_write_paths = ['C:\\repo\\out.yaml'];
  await assert.rejects(executeWorkflow(unsafe, async () => null), /worker_write_paths/);

  const leakedPath = structuredClone(config);
  leakedPath.descriptors[0].chapters[0].staging_path = 'C:\\repo\\private\\chapter.yaml';
  await assert.rejects(executeWorkflow(leakedPath, async () => null), /chapter field staging_path is forbidden/);

  const shadowedRun = structuredClone(config);
  shadowedRun.descriptors[0].run_id = 'run-shadowed';
  await assert.rejects(executeWorkflow(shadowedRun, async () => null), /descriptor field run_id is forbidden/);
});

test('Claude chapter agent is Read-only and the workflow owns no controller operations', () => {
  const agent = fs.readFileSync(agentFile, 'utf8');
  const workflow = fs.readFileSync(workflowFile, 'utf8');
  assert.match(agent, /^tools:\s*Read\s*$/m);
  assert.doesNotMatch(agent, /\b(?:Write|Edit|Bash|Glob|Grep)\b/);
  assert.match(agent, /exactly one chapter/i);
  assert.match(agent, /exactly one JSON envelope/i);
  assert.doesNotMatch(workflow, /lite-(?:guard|submit|accept)|child_process|node:fs|Write|Edit|Bash/);
  assert.doesNotMatch(workflow, /\b(?:parallel|pipeline)\s*\(/);
});
