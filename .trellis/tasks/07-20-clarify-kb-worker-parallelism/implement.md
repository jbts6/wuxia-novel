# Game-KB Worker Parallelism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Claude Code Workflow that dynamically maintains the controller-issued chapter-worker limit while keeping every worker read-only and single-chapter, then codify the same orchestration and description-content contracts in Lite/full Skills and prompts.

**Architecture:** The main session selects the first five or three controller batches, opens one guard per batch, and invokes a project-scoped Workflow with the exact descriptors. The Workflow runs a fixed number of asynchronous queue consumers, each calling a `Read`-only custom agent for one chapter and returning a schema-validated envelope; the main session checks every guard and serially submits results. Other platforms follow the same rolling-pool semantics through native sub-agent APIs.

**Tech Stack:** Claude Code project workflows, Claude custom agents, JavaScript, Node.js `node:test`, `node:vm`, Markdown Skill contracts.

## Global Constraints

- Current Codex execution mode is inline; do not dispatch implementation or check sub-agents.
- Every worker handles exactly one chapter and returns exactly one envelope.
- Worker tools are restricted to `Read`; no worker/controller/file writes are allowed.
- Active worker count is exactly controller `worker_pool.concurrency_limit`: 5 normally, 3 after fallback, zero when halted.
- One Workflow window contains all descriptors from the first `concurrency_limit` distinct batch IDs: at most 15 descriptors at limit 5 and 9 at limit 3.
- Every represented guard is opened before extraction and checked before the first submission.
- The main session serializes and submits envelopes one at a time in stable descriptor order; Workflow workers never call controller commands.
- Existing installed knowledge bases and immutable run artifacts are not rewritten or invalidated for redundant `description` prefixes.
- Shell commands in this repository use the `rtk` prefix.
- Each independently testable task ends with its own commit.

## File Map

- Create `.claude/workflows/game-kb-chapter-extract.js`: validate Workflow args, enforce a five/three-lane rolling queue, call one structured-output agent per descriptor, preserve result order.
- Create `.claude/agents/game-kb-chapter-worker.md`: Claude project agent with `tools: Read` and a strict one-chapter/no-controller contract.
- Create `.agents/skills/generate-game-kb/tests/claude-workflow-contract.test.js`: execute the actual Workflow source in `node:vm` with a fake `agent()` and verify dynamic replenishment, limits, validation, schema, and agent frontmatter.
- Modify `.agents/skills/generate-game-kb-lite/SKILL.md`: document Claude Workflow preference and native rolling-pool fallback in English.
- Modify `.agents/skills/generate-game-kb-lite/SKILL-cn.md`: mirror the Lite orchestration contract in Chinese.
- Modify `.agents/skills/generate-game-kb/SKILL.md`: document the same full-workflow chapter orchestration in Chinese.
- Modify `.agents/skills/generate-game-kb/SKILL-cn.md`: keep the full Chinese reference contract aligned.
- Modify `.agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js`: assert Lite English/Chinese scheduling order and barriers.
- Modify `.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js`: assert Lite Workflow discovery, native fallback, one-chapter agent, and prompt content rules.
- Modify `.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js`: assert full Skill dynamic window and coordinator-only submission.
- Modify `.agents/skills/generate-game-kb/tests/skill-contract.test.js`: retain the cross-Skill bounded-concurrency contract.
- Modify `.agents/skills/generate-game-kb/prompts/extract-chapters.md`: forbid redundant labels in Chinese `description` values.
- Modify `.agents/skills/generate-game-kb-lite/prompts/extract-chapters.md`: forbid redundant labels in English Lite extraction.
- Modify `.agents/skills/generate-game-kb/prompts/distill-domain.md`: apply the same rule to domain patches.
- Modify `.agents/skills/generate-game-kb/tests/chapter-batching.test.js`: assert the full extraction prompt rule.

---

### Task 1: Executable Claude Workflow Pool

**Files:**
- Create: `.claude/workflows/game-kb-chapter-extract.js`
- Create: `.claude/agents/game-kb-chapter-worker.md`
- Create: `.agents/skills/generate-game-kb/tests/claude-workflow-contract.test.js`

**Interfaces:**
- Consumes: Workflow `args = { run_id, concurrency_limit, prompt_file, descriptors }` where descriptors are unmodified projected `chapter_jobs` entries.
- Produces: `Promise<Array<Envelope|null>>` in descriptor order; each envelope has exactly `schema_version`, `batch_id`, `unit`, `attempt`, `input_hash`, and `draft`.

- [ ] **Step 1: Write the failing Workflow contract test**

Create the test with a VM runner that executes the real project Workflow source:

```js
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
      source_file: `C:\\repo\\source\\ch_${String(number).padStart(3, '0')}.txt`
    }],
    submissions: [{ unit, attempt: 1, input_hash: inputHash }]
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
    })
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
    draft: { schema_version: 6, chapter: chapter.number }
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
    /concurrency_limit must be 5 or 3/
  );
  const unsafe = structuredClone(config);
  unsafe.descriptors[0].worker_write_paths = ['C:\\repo\\out.yaml'];
  await assert.rejects(executeWorkflow(unsafe, async () => null), /worker_write_paths/);
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
```

- [ ] **Step 2: Run the new test and verify the expected failure**

Run:

```bash
rtk node --test ./.agents/skills/generate-game-kb/tests/claude-workflow-contract.test.js
```

Expected: FAIL because `.claude/workflows/game-kb-chapter-extract.js` and `.claude/agents/game-kb-chapter-worker.md` do not exist.

- [ ] **Step 3: Add the Read-only project agent**

Create `.claude/agents/game-kb-chapter-worker.md`:

```markdown
---
name: game-kb-chapter-worker
description: Use when the game-KB Claude Workflow assigns one controller-issued chapter for read-only extraction.
tools: Read
---

# Game-KB Chapter Worker

Process exactly one chapter descriptor. Read the extraction contract named in
the prompt, then read only the descriptor's absolute `source_file` as novel
source. Return exactly one JSON envelope through the Workflow structured-output
tool.

Do not create, modify, move, or delete files or directories. Do not call shell,
controller, guard, acceptance, or submission commands. Do not combine chapters,
copy evidence from another chapter, invent identity fields, or claim acceptance.

Copy `batch_id`, `unit`, `attempt`, and `input_hash` exactly from the supplied
controller job. The `draft` must follow the selected extraction contract. A
`description` value contains descriptive content only and must not begin with a
redundant label such as `概述：` or `描述：`.
```

- [ ] **Step 4: Add the project Workflow with an exact consumer-lane limit**

Create `.claude/workflows/game-kb-chapter-extract.js` with these core definitions and no imports:

```js
export const meta = {
  name: 'game-kb-chapter-extract',
  description: 'Extract controller-issued game-KB chapters with a bounded read-only worker pool',
  phases: [{ title: 'Extract', detail: 'One read-only structured-output agent per chapter' }],
}

const ENVELOPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'batch_id', 'unit', 'attempt', 'input_hash', 'draft'],
  properties: {
    schema_version: { const: 1 },
    batch_id: { type: 'string', minLength: 1 },
    unit: { type: 'string', pattern: '^chapter:[0-9]{3}$' },
    attempt: { type: 'integer', minimum: 1, maximum: 2 },
    input_hash: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
    draft: { type: 'object' },
  },
}

function fail(message) {
  throw new Error(message)
}

function isAbsolute(file) {
  return typeof file === 'string' && /^(?:[A-Za-z]:[\\/]|\/)/.test(file)
}

function validateDescriptor(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) fail('descriptor must be an object')
  if (typeof job.batch_id !== 'string' || job.batch_id.length === 0) fail('descriptor batch_id is required')
  if (!Array.isArray(job.worker_write_paths) || job.worker_write_paths.length !== 0) {
    fail('descriptor worker_write_paths must be []')
  }
  if (!Array.isArray(job.chapters) || job.chapters.length !== 1) fail('descriptor must contain exactly one chapter')
  if (!Array.isArray(job.submissions) || job.submissions.length !== 1) fail('descriptor must contain exactly one submission')
  const chapter = job.chapters[0]
  const submission = job.submissions[0]
  if (!isAbsolute(chapter.source_file)) fail('chapter source_file must be absolute')
  for (const field of ['unit', 'attempt', 'input_hash']) {
    if (chapter[field] !== submission[field]) fail(`chapter/submission ${field} mismatch`)
  }
  return job
}

function validateArgs(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('workflow args must be an object')
  if (typeof value.run_id !== 'string' || value.run_id.length === 0) fail('run_id is required')
  if (![5, 3].includes(value.concurrency_limit)) fail('concurrency_limit must be 5 or 3')
  if (!isAbsolute(value.prompt_file)) fail('prompt_file must be absolute')
  if (!Array.isArray(value.descriptors) || value.descriptors.length === 0) fail('descriptors must be non-empty')
  const descriptors = value.descriptors.map(validateDescriptor)
  const batches = [...new Set(descriptors.map(job => job.batch_id))]
  if (batches.length > value.concurrency_limit) fail('window exceeds concurrency_limit distinct batches')
  if (descriptors.length > value.concurrency_limit * 3) fail('window exceeds controller chapter bound')
  return { ...value, descriptors }
}

const config = validateArgs(args)
phase('Extract')
const results = Array(config.descriptors.length).fill(null)
let cursor = 0

async function consume() {
  while (cursor < config.descriptors.length) {
    const index = cursor
    cursor += 1
    const job = config.descriptors[index]
    const chapter = job.chapters[0]
    const controllerJob = { run_id: config.run_id, ...job }
    const prompt = [
      `Read the extraction contract at ${config.prompt_file}.`,
      `Read only the chapter source at ${chapter.source_file}.`,
      'Process exactly one chapter and return exactly one envelope.',
      `CONTROLLER_JOB=${JSON.stringify(controllerJob)}`,
    ].join('\n')
    results[index] = await agent(prompt, {
      label: `extract:${chapter.unit}`,
      phase: 'Extract',
      agentType: 'game-kb-chapter-worker',
      schema: ENVELOPE_SCHEMA,
    })
  }
}

const lanes = Math.min(config.concurrency_limit, config.descriptors.length)
await Promise.all(Array.from({ length: lanes }, () => consume()))
return results
```

- [ ] **Step 5: Run the Workflow contract test and verify it passes**

Run:

```bash
rtk node --test ./.agents/skills/generate-game-kb/tests/claude-workflow-contract.test.js
```

Expected: PASS for dynamic five-lane refill, fallback three, unsafe input rejection, stable result order, schema options, and `Read`-only agent frontmatter.

- [ ] **Step 6: Commit the executable Workflow unit**

```bash
rtk git add ./.claude/workflows/game-kb-chapter-extract.js ./.claude/agents/game-kb-chapter-worker.md ./.agents/skills/generate-game-kb/tests/claude-workflow-contract.test.js
rtk git commit -m "feat(game-kb): add read-only Claude workflow pool"
```

---

### Task 2: Lite Skill Orchestration Contract

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb-lite/SKILL.md`
- Modify: `.agents/skills/generate-game-kb-lite/SKILL-cn.md`

**Interfaces:**
- Consumes: named Workflow `game-kb-chapter-extract` and `worker_pool.concurrency_limit` from `lite-status`.
- Produces: platform contract for first-N-batch window selection, guard opening, Workflow/native pool extraction, all-guard barrier, and serial Lite submission.

- [ ] **Step 1: Add failing Lite scheduling assertions**

Add assertions that both English and Chinese Skills contain these concepts in order:

```js
test('Lite Skills define a cross-batch rolling pool with a guarded serial broker barrier', () => {
  const english = read('SKILL.md');
  const chinese = read('SKILL-cn.md');
  for (const [label, contract] of [['English', english], ['Chinese', chinese]]) {
    assert.match(contract, /game-kb-chapter-extract/iu, `${label}: Claude workflow`);
    assert.match(contract, /(?:first|前)[^\r\n]*(?:concurrency_limit|并发上限)[^\r\n]*(?:distinct|不同)[^\r\n]*batch/iu, `${label}: window`);
    assert.match(contract, /(?:one|一个)[^\r\n]*(?:sub-agent|子代理)[^\r\n]*(?:one|一)[^\r\n]*(?:chapter|章)/iu, `${label}: one chapter`);
    assert.match(contract, /(?:slot|槽位)[^\r\n]*(?:free|释放)[^\r\n]*(?:next|下一)/iu, `${label}: refill`);
    assert.match(contract, /(?:all|全部)[^\r\n]*guard[^\r\n]*(?:before|之后|以前|前)[^\r\n]*(?:submit|提交)/iu, `${label}: guard barrier`);
    assert.match(contract, /(?:serial|串行)[^\r\n]*(?:descriptor|描述符|chapter_jobs)[^\r\n]*(?:order|顺序)/iu, `${label}: serial order`);
    assert.match(contract, /(?:other platforms|其他平台)[^\r\n]*(?:native|原生)[^\r\n]*(?:pool|池)/iu, `${label}: fallback`);
    assert.doesNotMatch(contract, /(?:one|每个)[^\r\n]*(?:sub-agent|子代理)[^\r\n]*(?:2|2\s*(?:-|至|到)\s*3)[^\r\n]*(?:chapter|章)/iu);
  }
});
```

- [ ] **Step 2: Run focused Lite tests and verify they fail**

```bash
rtk node --test ./.agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js ./.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js
```

Expected: FAIL because current Lite Skills name neither the Workflow nor the cross-batch replenishing window.

- [ ] **Step 3: Replace the ambiguous Lite lifecycle with the explicit scheduler protocol**

In `SKILL.md`, describe this exact sequence:

```text
lite-status
-> if worker_pool.halted, stop
-> select all descriptors from the first concurrency_limit distinct batch_id values
-> open one guard per selected batch before extraction
-> Claude Code: run game-kb-chapter-extract with run_id, prompt_file, descriptors, concurrency_limit
-> other platforms: maintain an equivalent native rolling pool
-> wait for the bounded window to finish
-> check every opened guard before any submission
-> submit valid envelopes serially in original chapter_jobs order via stdin
-> stop on broker failure
-> lite-status
```

State explicitly that a returned worker frees a slot and the next queued
single-chapter descriptor starts immediately. Explain the maximum window sizes
15 and 9, per-batch guard mapping, null-result skip semantics, explicit-only 429
backoff, and controller-only acceptance.

Mirror the same semantics in `SKILL-cn.md` using Chinese wording and the same
command/Workflow identifiers.

- [ ] **Step 4: Run focused Lite tests and verify they pass**

```bash
rtk node --test ./.agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js ./.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js ./.agents/skills/generate-game-kb/tests/claude-workflow-contract.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the Lite contract**

```bash
rtk git add ./.agents/skills/generate-game-kb-lite/SKILL.md ./.agents/skills/generate-game-kb-lite/SKILL-cn.md ./.agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js ./.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js
rtk git commit -m "docs(game-kb-lite): define workflow-backed worker pool"
```

---

### Task 3: Full Skill Orchestration Contract

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/SKILL-cn.md`

**Interfaces:**
- Consumes: the Workflow/agent files from Task 1 and the same controller `chapter_jobs`/worker-pool fields used by Lite.
- Produces: full-workflow chapter scheduling contract; domain workers remain four independent read-only units with coordinator-only submission.

- [ ] **Step 1: Add failing full Skill assertions**

Add one contract test that checks both full Skill references:

```js
test('V4 Skills use the Claude workflow rolling pool without multi-chapter workers', () => {
  for (const [label, contract] of [['primary', skill], ['Chinese reference', skillCn]]) {
    assert.match(contract, /game-kb-chapter-extract/iu, `${label}: workflow`);
    assert.match(contract, /(?:first|前)[^\r\n]*(?:concurrency_limit|并发上限)[^\r\n]*(?:distinct|不同)[^\r\n]*batch/iu, `${label}: bounded window`);
    assert.match(contract, /(?:5|五)[^\r\n]*(?:3|三)[^\r\n]*(?:429|rate)/iu, `${label}: fallback`);
    assert.match(contract, /(?:all|全部)[^\r\n]*guard[^\r\n]*(?:before|前)[^\r\n]*(?:submit|提交)/iu, `${label}: barrier`);
    assert.match(contract, /(?:serial|串行)[^\r\n]*(?:submit|提交)/iu, `${label}: broker`);
    assert.doesNotMatch(contract, /(?:worker|子代理)[^\r\n]*(?:2|2\s*(?:-|至|到)\s*3)[^\r\n]*(?:chapter|章)/iu);
  }
});
```

Keep the existing domain-worker contract unchanged and add an assertion that
the chapter Workflow does not authorize domain workers or broker calls.

- [ ] **Step 2: Run focused full Skill tests and verify they fail**

```bash
rtk node --test ./.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js ./.agents/skills/generate-game-kb/tests/skill-contract.test.js
```

Expected: FAIL on missing Workflow/window/refill wording.

- [ ] **Step 3: Update both full Skill documents**

Replace the current same-`batch_id` chapter dispatch bullet with the same
first-N-distinct-batches rolling window used by Lite. Name the Claude Workflow,
state the native fallback, require one chapter per sub-agent, open all batch
guards before extraction, check all guards before submitting, and serialize
submissions through the main agent only.

Keep domain distillation separate:

```text
chapter extraction: game-kb-chapter-extract rolling pool, one chapter per agent
domain distillation: four read-only domain workers may generate concurrently
all controller submit-draft calls: main session only, serial
```

Document explicit 429-only backoff and halt behavior without changing the
controller command contract.

- [ ] **Step 4: Run focused full Skill tests and verify they pass**

```bash
rtk node --test ./.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js ./.agents/skills/generate-game-kb/tests/skill-contract.test.js ./.agents/skills/generate-game-kb/tests/claude-workflow-contract.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the full Skill contract**

```bash
rtk git add ./.agents/skills/generate-game-kb/SKILL.md ./.agents/skills/generate-game-kb/SKILL-cn.md ./.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js ./.agents/skills/generate-game-kb/tests/skill-contract.test.js
rtk git commit -m "docs(game-kb): define workflow-backed chapter pool"
```

---

### Task 4: Description Content Contract

**Files:**
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb-lite/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- Modify: `.agents/skills/generate-game-kb/tests/chapter-batching.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js`

**Interfaces:**
- Consumes: existing `description` fields in chapter and domain schemas.
- Produces: prompt-only prevention for redundant labels; runtime validators and historical data remain compatible.

- [ ] **Step 1: Add failing prompt-contract assertions**

Use literal, low-ambiguity assertions:

```js
// chapter-batching.test.js
assert.match(prompt, /description[^\r\n]*只包含描述正文[^\r\n]*概述：[^\r\n]*描述：/);

// v4-skill-contract.test.js
assert.match(extraction, /description[^\r\n]*只包含描述正文[^\r\n]*概述：[^\r\n]*描述：/);
assert.match(distill, /description[^\r\n]*只包含描述正文[^\r\n]*概述：[^\r\n]*描述：/);

// lite-skill-contract.test.js
assert.match(extraction, /description`?\s+value contains descriptive content only[^\r\n]*概述：[^\r\n]*描述：/i);
```

Do not add a validator test that rejects existing files.

- [ ] **Step 2: Run prompt contract tests and verify they fail**

```bash
rtk node --test ./.agents/skills/generate-game-kb/tests/chapter-batching.test.js ./.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js ./.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js
```

Expected: FAIL because current prompts do not forbid the redundant labels.

- [ ] **Step 3: Add exact prompt rules**

Append to the full extraction field rules:

```markdown
- `description` 值只包含描述正文，不得添加“概述：”“描述：”等重复字段标签。
```

Append to each relevant domain rule in `distill-domain.md`, or once before the
domain-specific subsections so it applies to all domains:

```markdown
- 所有 patch 中的 `description` 值只包含描述正文，不得添加“概述：”“描述：”等重复字段标签。
```

Add to the Lite extraction prose after the evidence/null rules:

```markdown
A `description` value contains descriptive content only. Do not prefix it with
a redundant field label such as `概述：` or `描述：`.
```

- [ ] **Step 4: Run prompt contract tests and verify they pass**

```bash
rtk node --test ./.agents/skills/generate-game-kb/tests/chapter-batching.test.js ./.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js ./.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js ./.agents/skills/generate-game-kb/tests/claude-workflow-contract.test.js
```

Expected: PASS, including the `Read`-only agent rule from Task 1.

- [ ] **Step 5: Commit the description contract**

```bash
rtk git add ./.agents/skills/generate-game-kb/prompts/extract-chapters.md ./.agents/skills/generate-game-kb-lite/prompts/extract-chapters.md ./.agents/skills/generate-game-kb/prompts/distill-domain.md ./.agents/skills/generate-game-kb/tests/chapter-batching.test.js ./.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js ./.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js
rtk git commit -m "docs(game-kb): forbid redundant description labels"
```

---

### Task 5: Integration Verification And Task Evidence

**Files:**
- Create: `.trellis/tasks/07-20-clarify-kb-worker-parallelism/verification.md`
- Modify: `.trellis/tasks/07-20-clarify-kb-worker-parallelism/task.json` through Trellis lifecycle commands only.

**Interfaces:**
- Consumes: all implementation commits and the existing controller test suite.
- Produces: reproducible verification evidence and an implementation-ready completion record.

- [ ] **Step 1: Run all focused contract tests together**

```bash
rtk node --test ./.agents/skills/generate-game-kb/tests/claude-workflow-contract.test.js ./.agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js ./.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js ./.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js ./.agents/skills/generate-game-kb/tests/skill-contract.test.js ./.agents/skills/generate-game-kb/tests/chapter-batching.test.js
```

Expected: all focused tests PASS with zero failures.

- [ ] **Step 2: Run the complete game-KB regression suite**

```bash
rtk node --test ./.agents/skills/generate-game-kb/tests/*.test.js
```

Expected: all tests PASS. No historical knowledge-base file is rewritten.

- [ ] **Step 3: Run repository consistency checks**

```bash
rtk git diff --check
rtk git status --short
```

Expected: `git diff --check` exits zero. Status contains only the intended task
evidence file before its final commit.

- [ ] **Step 4: Record verification evidence**

Create `verification.md` with:

```markdown
# Verification

## Focused Contracts

- Command: `node --test <six focused test files>`
- Result: PASS

## Full Game-KB Suite

- Command: `node --test ./.agents/skills/generate-game-kb/tests/*.test.js`
- Result: PASS

## Invariants Reviewed

- Claude Workflow maintains controller limit 5 or 3 with rolling replenishment.
- Claude chapter agent exposes `Read` only and processes one chapter.
- All represented guards are checked before serial broker submission.
- Prompts forbid redundant `description` field labels for new products.
- Historical installed/run artifacts remain untouched and validator-compatible.
```

- [ ] **Step 5: Commit verification evidence**

```bash
rtk git add ./.trellis/tasks/07-20-clarify-kb-worker-parallelism/verification.md
rtk git commit -m "chore(task): verify game-kb workflow parallelism"
```

- [ ] **Step 6: Run Trellis finish and archive flow after review**

Use `trellis-check` and `trellis-finish-work`. Archive only after the task's
acceptance criteria are checked against the final files and all required tests
remain green.
