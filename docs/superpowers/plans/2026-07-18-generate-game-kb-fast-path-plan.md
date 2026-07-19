# generate-game-kb Lite and Deferred Overlay Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current four-domain, correction-heavy normal path with a grounded high-recall build that supports two-chapter worker jobs, basic deduplication, and manually applied deferred overlay tasks.

**Architecture:** Chapter extraction remains the only required entity-discovery AI stage. A deterministic grounding and quarantine layer accepts valid records independently, then deterministic normalization plus one optional `basic-curate` decision set reduces obvious duplicates and generic action descriptions. Assembly and verification consume grounded candidates directly. Expensive semantic enrichment is represented as hash-bound overlay tasks that produce a new materialized revision only after explicit application.

**Tech Stack:** Node.js CommonJS, YAML/JSON artifacts, existing `flow.js` CLI, Node `assert` test files, existing run isolation, atomic I/O, artifact hashes, and worker-pool 5-to-3 429 backoff.

## Global Constraints

- All intermediate artifacts remain under `<novel>/.game-kb-work/runs/<run-id>/`.
- The published surface remains exactly five YAML files.
- Legacy runs and legacy semantic contracts remain read-only; never upgrade a legacy run in place.
- An entity reaches final data only when its source quote is located in the matching chapter and its name is present in that evidence.
- YAML parse, chapter identity, and source-hash failures may consume the existing bounded correction budget; individual ungrounded records are quarantined without retrying valid records.
- Transport failures consume no AI submission.
- Worker concurrency starts at five and falls back to three only after an explicit 429; a second distinct 429 at fallback three halts the pool.
- Deferred tasks never block publication of the grounded base run and cannot silently apply to a stale base artifact.
- Every implementation task ends with focused tests and a separate commit.

## File Map

### Existing files to modify

- `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`: establish semantic contract version 6 and remove domain-decision requirements from the Lite profile.
- `.agents/skills/generate-game-kb/scripts/lib/paths.js`: add run-scoped quarantine, deferred-task, task, overlay, and materialized-revision paths.
- `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`: make enrichment fields nullable, validate grounded evidence, and preserve structural checks.
- `.agents/skills/generate-game-kb/scripts/lib/accept.js`: accept chapter records independently, write quarantine artifacts, and remove active domain-decision acceptance.
- `.agents/skills/generate-game-kb/scripts/lib/source.js`: expose chapter character counts required by the packer.
- `.agents/skills/generate-game-kb/scripts/lib/worker-pool.js`: preserve existing backoff behavior while recording batch metrics.
- `.agents/skills/generate-game-kb/scripts/lib/assemble.js` and `domain-assembly.js`: assemble from grounded candidate registry plus basic decisions instead of four domain decisions.
- `.agents/skills/generate-game-kb/scripts/lib/verify.js`: verify grounding, candidate closure, final hashes, and receipts without domain decision files.
- `.agents/skills/generate-game-kb/scripts/lib/timing.js`: replace domain timing with basic-curate, batching, quarantine, deferred-task, and revision metrics.
- `.agents/skills/generate-game-kb/scripts/flow.js`: remove normal `plan-domains`/domain routes, add batch accept, `publish`, and deferred task commands.
- `.agents/skills/generate-game-kb-lite/SKILL.md` and `prompts/extract-chapters.md`: document the Lite path, dynamic two-to-three-chapter worker contract, nullable enrichment, and removal of domain distill from the normal path.

### New files

- `.agents/skills/generate-game-kb/scripts/lib/grounding.js`: source quote normalization and record-level grounding checks.
- `.agents/skills/generate-game-kb/scripts/lib/quarantine.js`: deterministic quarantine artifact writes and summaries.
- `.agents/skills/generate-game-kb/scripts/lib/chapter-batching.js`: contiguous chapter job packing and descriptor validation.
- `.agents/skills/generate-game-kb/scripts/lib/basic-curate.js`: constrained `keep`/`merge`/`drop` decision validation and application.
- `.agents/skills/generate-game-kb/scripts/lib/overlay.js`: task manifests, overlay validation, stale-base detection, and materialization.
- `.agents/skills/generate-game-kb/scripts/lib/deferred-task.js`: task registry and task lifecycle operations.
- `.agents/skills/generate-game-kb/tests/basic-normalization.test.js`: deterministic deduplication and generic-action filter coverage.
- `.agents/skills/generate-game-kb/tests/publish.test.js`: grounded publish and rollback coverage.

### Tests to add or modify

- Add `grounding.test.js`, `quarantine.test.js`, `chapter-batching.test.js`, `basic-curate.test.js`, `overlay.test.js`, and `deferred-task.test.js`.
- Modify `chapter-contract.test.js`, `assemble.test.js`, `verify-v4.test.js`, `cli.test.js`, `next-action.test.js`, `performance-budget.test.js`, `worker-pool.test.js`, `skill-contract.test.js`, and `cleanup-contract.test.js`.

---

### Task 1: Establish the Lite v6 contract and add run paths

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/tests/semantic-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/run-isolation.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`

**Interfaces:**
- `SEMANTIC_CONTRACT_VERSION` becomes `6` for the shared V4/Lite entity contract.
- `pathsFor(novel, runId)` exposes `quarantine`, `deferredTasks`, `tasks`, `overlays`, and `revisions` paths inside the selected run.
- Legacy domain constants remain readable only where legacy-run detection requires them; new runs do not require domain decision units.

- [ ] **Step 1: Write failing tests** for semantic contract version 6, all new paths being descendants of the run directory, and legacy runs rejecting writes with `LEGACY_SEMANTIC_CONTRACT`.

```js
test('Lite run paths stay inside the run directory', () => {
  const paths = pathsFor(novelDir, 'run-lite');
  for (const key of ['quarantine', 'deferredTasks', 'tasks', 'overlays', 'revisions']) {
    assert.equal(isWithin(paths.run, paths[key]), true, key);
  }
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**.

```bash
rtk node --test .agents/skills/generate-game-kb/tests/semantic-contract.test.js .agents/skills/generate-game-kb/tests/run-isolation.test.js
```

Expected: failures for the missing version and path properties.

- [ ] **Step 3: Implement the version-6 contract and path additions** without changing legacy path resolution or writing outside `paths.run`.
- [ ] **Step 4: Run the focused tests and verify they pass**.
- [ ] **Step 5: Update the Skill contract assertions** to describe version 6 and removed normal domain stages.
- [ ] **Step 6: Commit** `rtk git add .agents/skills/generate-game-kb/scripts/lib/semantic-contract.js .agents/skills/generate-game-kb/scripts/lib/paths.js .agents/skills/generate-game-kb/tests/semantic-contract.test.js .agents/skills/generate-game-kb/tests/run-isolation.test.js .agents/skills/generate-game-kb/tests/skill-contract.test.js && rtk git commit -m "refactor: establish Lite v6 game-kb contract and run paths"`.

### Task 2: Add exact source grounding and record-level quarantine

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/grounding.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/quarantine.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Add: `.agents/skills/generate-game-kb/tests/grounding.test.js`
- Add: `.agents/skills/generate-game-kb/tests/quarantine.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/chapter-contract.test.js`

**Interfaces:**
- `normalizeEvidenceText(text) -> string` normalizes BOM, line endings, Unicode NFKC, and whitespace.
- `validateGroundedRecord(record, { chapterNumber, chapterText, label }) -> { errors, normalizedRefs }` checks quote location, chapter number, and candidate-name presence.
- `quarantineRecord(paths, { unit, category, record, errors, inputHash }) -> string` writes an immutable YAML record under the run quarantine directory and returns its path.
- `validateChapterDraft(draft, expected)` continues returning structural errors but delegates source evidence checks to the grounding module.
- `acceptDraft({ paths, unit, draftPath })` accepts valid records from a chapter draft and quarantines invalid records instead of rejecting the entire chapter for record-level grounding failures.

- [ ] **Step 1: Write failing tests** for a matching quote, a fake quote, a quote from another chapter, a candidate name absent from the quote, and a chapter containing both valid and invalid records.

```js
test('a fake source quote is rejected', () => {
  const result = validateGroundedRecord(record, {
    chapterNumber: 3,
    chapterText: '第三章，甲拔剑。',
    label: 'characters[0]'
  });
  assert.deepEqual(result.errors.map(error => error.code), ['SOURCE_QUOTE_NOT_FOUND']);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**.

```bash
rtk node --test .agents/skills/generate-game-kb/tests/grounding.test.js .agents/skills/generate-game-kb/tests/quarantine.test.js .agents/skills/generate-game-kb/tests/chapter-contract.test.js
```

- [ ] **Step 3: Implement the grounding and quarantine modules**. Match normalized quotes against the prepared `sourceChapters/ch_NNN.txt`; never accept a paraphrase as evidence. Keep quarantined source text and validator codes under the run directory.
- [ ] **Step 4: Update chapter acceptance** so valid records and chapter summaries can be accepted while invalid records are quarantined. YAML parse, chapter mismatch, and source-hash mismatch remain document-level rejection errors.
- [ ] **Step 5: Run the focused tests and verify they pass**.
- [ ] **Step 6: Commit** `rtk git add .agents/skills/generate-game-kb/scripts/lib/grounding.js .agents/skills/generate-game-kb/scripts/lib/quarantine.js .agents/skills/generate-game-kb/scripts/lib/chapter-contract.js .agents/skills/generate-game-kb/scripts/lib/accept.js .agents/skills/generate-game-kb/tests/grounding.test.js .agents/skills/generate-game-kb/tests/quarantine.test.js .agents/skills/generate-game-kb/tests/chapter-contract.test.js && rtk git commit -m "feat: enforce source grounding with record quarantine"`.

### Task 3: Pack adjacent chapters without changing chapter units

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/chapter-batching.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/source.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/worker-pool.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/next-action.js`
- Add: `.agents/skills/generate-game-kb/tests/chapter-batching.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/worker-pool.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/next-action.test.js`

**Interfaces:**
- `packChapterJobs(manifest, { maxChapters = 2, maxCjkChars = 36000 }) -> Array<{ batch_id, chapters }>` packs adjacent descriptors without splitting a chapter.
- `validateChapterJob(job, manifest) -> []` returns deterministic descriptor errors.
- Each `chapters` descriptor contains `unit`, `number`, `title`, `source_file`, `input_hash`, `source_char_count`, and `staging_paths`.

- [ ] **Step 1: Write failing tests** for 50 short chapters producing 25 jobs, a long chapter running alone, no job exceeding two chapters or 36k CJK characters, and deterministic packing independent of completion order.
- [ ] **Step 2: Run the focused tests and verify they fail**.

```bash
rtk node --test .agents/skills/generate-game-kb/tests/chapter-batching.test.js .agents/skills/generate-game-kb/tests/worker-pool.test.js
```

- [ ] **Step 3: Implement `packChapterJobs`** using prepared manifest character counts and preserve the existing `recordWorkerBackoff` 5-to-3 behavior.
- [ ] **Step 4: Return job descriptors from `next_action`** while keeping `chapter:NNN` as the persistent progress and accept unit. A failed descriptor only schedules its own chapter.
- [ ] **Step 5: Update the extraction prompt** to require one YAML file per chapter in the job and forbid cross-chapter evidence.
- [ ] **Step 6: Run the focused tests and verify they pass**.
- [ ] **Step 7: Commit** `rtk git add .agents/skills/generate-game-kb/scripts/lib/chapter-batching.js .agents/skills/generate-game-kb/scripts/lib/source.js .agents/skills/generate-game-kb/scripts/lib/worker-pool.js .agents/skills/generate-game-kb/scripts/lib/next-action.js .agents/skills/generate-game-kb/tests/chapter-batching.test.js .agents/skills/generate-game-kb/tests/worker-pool.test.js .agents/skills/generate-game-kb/tests/next-action.test.js .agents/skills/generate-game-kb/prompts/extract-chapters.md && rtk git commit -m "feat: batch adjacent chapter extraction jobs"`.

### Task 4: Make enrichment nullable and remove domain-decision requirements

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- Modify: `.agents/skills/generate-game-kb/tests/chapter-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/domain-contract.test.js`

**Interfaces:**
- `validateChapterDraft` requires evidence and structural fields but accepts `null` for `rank`, `level`, `faction`, biographies, and descriptions.
- The new active contract has no requirement for four domain decision files.
- Legacy domain drafts remain readable only for legacy-run inspection.

- [ ] **Step 1: Write failing tests** showing a grounded character with `rank: null`, a grounded skill with no description, and an item with no inferred inclusion reason can pass chapter acceptance, while missing name or source evidence still fails.
- [ ] **Step 2: Run the focused contract tests and verify they fail**.
- [ ] **Step 3: Remove hard domain-patch requirements from the active path** and update prompts to say that uncertain enrichment must be null or omitted, never invented.
- [ ] **Step 4: Run the focused tests and verify they pass**.
- [ ] **Step 5: Commit** `rtk git add .agents/skills/generate-game-kb/scripts/lib/chapter-contract.js .agents/skills/generate-game-kb/scripts/lib/domain-contract.js .agents/skills/generate-game-kb/scripts/lib/semantic-contract.js .agents/skills/generate-game-kb/prompts/extract-chapters.md .agents/skills/generate-game-kb/prompts/distill-domain.md .agents/skills/generate-game-kb/tests/chapter-contract.test.js .agents/skills/generate-game-kb/tests/domain-contract.test.js && rtk git commit -m "refactor: allow unresolved enrichment in grounded candidates"`.

### Task 5: Implement deterministic normalization, deduplication, and action filtering

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/candidate-registry.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-assembly.js`
- Add: `.agents/skills/generate-game-kb/tests/basic-normalization.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/candidate-registry.test.js`

**Interfaces:**
- `normalizeCandidateName(value) -> string` applies Unicode NFKC, whitespace, and punctuation normalization without fuzzy deletion.
- `isGenericActionDescription(name) -> boolean` rejects strong motion-plus-generic-measure patterns such as `挥手一击`, `反手一掌`, and `随手一刀`.
- `buildBasicCandidateRegistry(chapters) -> { registry, quarantine, warnings }` exact-deduplicates records by category and normalized name, unions evidence, and records conflicts.

- [ ] **Step 1: Write failing tests** for exact duplicate merging, same-name category isolation, source-reference union, conflict warnings, preservation of named techniques containing ordinary verbs, and rejection of generic action descriptions.
- [ ] **Step 2: Run the focused tests and verify they fail**.
- [ ] **Step 3: Implement normalization and filtering**. Use a small explicit pattern set for generic actions; do not use broad verb deletion that would remove named wuxia techniques.
- [ ] **Step 4: Make candidate registry output deterministic** by sorting categories, normalized names, source chapters, and source references.
- [ ] **Step 5: Run the focused tests and verify they pass**.
- [ ] **Step 6: Commit** `rtk git add .agents/skills/generate-game-kb/scripts/lib/candidate-registry.js .agents/skills/generate-game-kb/scripts/lib/domain-assembly.js .agents/skills/generate-game-kb/tests/basic-normalization.test.js .agents/skills/generate-game-kb/tests/candidate-registry.test.js && rtk git commit -m "feat: add deterministic basic dedup and action filtering"`.

### Task 6: Add the constrained basic-curate unit

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/basic-curate.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/progress.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Add: `.agents/skills/generate-game-kb/tests/basic-curate.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/progress.test.js`

**Interfaces:**
- `validateBasicCurateDraft(draft, registry) -> errors[]` permits only `keep`, `merge`, and `drop`; references must point to existing registry entries.
- `applyBasicCurate(registry, decisions) -> registry` applies deterministic sorted decisions without creating new records or evidence.
- A failed or skipped basic-curate leaves the deterministic registry publishable.

- [ ] **Step 1: Write failing tests** for valid keep/merge/drop decisions, unknown references, invented entities, changed source references, duplicate decisions, and skipped-curate fallback.
- [ ] **Step 2: Run the focused tests and verify they fail**.
- [ ] **Step 3: Implement the decision validator and deterministic application**. Do not allow descriptions, rank patches, biography text, or new source refs in this unit.
- [ ] **Step 4: Add the optional unit state** so status can report a failed or skipped curate without blocking assembly.
- [ ] **Step 5: Run the focused tests and verify they pass**.
- [ ] **Step 6: Commit** `rtk git add .agents/skills/generate-game-kb/scripts/lib/basic-curate.js .agents/skills/generate-game-kb/scripts/lib/progress.js .agents/skills/generate-game-kb/scripts/flow.js .agents/skills/generate-game-kb/tests/basic-curate.test.js .agents/skills/generate-game-kb/tests/progress.test.js && rtk git commit -m "feat: add optional constrained basic curation"`.

### Task 7: Replace domain assembly with grounded publish and hard verification

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/assemble.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-assembly.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/verify.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/install.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Add: `.agents/skills/generate-game-kb/tests/publish.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/assemble.test.js`, `assemble-flow.test.js`, `verify-v4.test.js`, `install-v4.test.js`, and `finalize.test.js`

**Interfaces:**
- `assembleRun({ paths })` consumes accepted grounded chapters, the candidate registry, and optional basic-curate decisions; it no longer requires four domain decision files.
- `verifyFinal(paths)` checks grounding, candidate-to-final closure, stable IDs, five-file schema, assembly hashes, and install receipt bindings.
- `publishRun({ paths })` performs assemble, verify, atomic install, installed verification, and archive through existing authoritative functions; a failed sub-step resumes at its own boundary.

- [ ] **Step 1: Write failing integration tests** for a three-chapter grounded run with no domain artifacts, skipped basic-curate, quarantined records, successful publish, and rollback after installed verification failure.
- [ ] **Step 2: Run the focused integration tests and verify they fail** because `assembleRun` still requires domain work and decisions.
- [ ] **Step 3: Implement grounded assembly** with stable category/name IDs, nullable enrichment, merged source refs, and deterministic chapter-summary projection.
- [ ] **Step 4: Remove domain-decision checks from active verification** while retaining legacy-run verification branches and all hash/receipt checks.
- [ ] **Step 5: Add `publishRun` to the normal CLI path**. Keep atomic install and installed verification inside the publish operation; do not weaken rollback.
- [ ] **Step 6: Run the focused integration tests and verify they pass**.
- [ ] **Step 7: Commit** `rtk git add .agents/skills/generate-game-kb/scripts/lib/assemble.js .agents/skills/generate-game-kb/scripts/lib/domain-assembly.js .agents/skills/generate-game-kb/scripts/lib/verify.js .agents/skills/generate-game-kb/scripts/lib/install.js .agents/skills/generate-game-kb/scripts/flow.js .agents/skills/generate-game-kb/tests/publish.test.js .agents/skills/generate-game-kb/tests/assemble.test.js .agents/skills/generate-game-kb/tests/assemble-flow.test.js .agents/skills/generate-game-kb/tests/verify-v4.test.js .agents/skills/generate-game-kb/tests/install-v4.test.js .agents/skills/generate-game-kb/tests/finalize.test.js && rtk git commit -m "refactor: publish grounded candidates without domain distill"`.

### Task 8: Implement deferred task registry and overlay application

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/overlay.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/deferred-task.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/verify.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/assemble.js`
- Add: `.agents/skills/generate-game-kb/tests/overlay.test.js`
- Add: `.agents/skills/generate-game-kb/tests/deferred-task.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/cli.test.js`

**Interfaces:**
- `addDeferredTask({ paths, type, scope, requestedBy }) -> task` writes a pending task bound to the current base artifact manifest hash.
- `runDeferredTask({ paths, taskId, draftPath }) -> report` validates a task draft and produces an overlay candidate or `manual_review` state.
- `validateOverlay(overlay, { baseRegistry, groundingContext }) -> errors[]` permits only `keep`, `merge`, `drop`, and constrained `patch` operations against existing entities.
- `applyOverlay({ paths, taskId }) -> revisionReceipt` rejects stale base hashes, materializes a byte-stable new five-file revision, verifies it, and atomically installs it.

- [ ] **Step 1: Write failing tests** for task creation, task input hash binding, allowed task types, invalid overlay operations, invented entity rejection, stale overlay rejection, deterministic operation order, and rollback on materialization failure.
- [ ] **Step 2: Run the focused tests and verify they fail**.
- [ ] **Step 3: Implement task manifests and the task registry** under `deferred-tasks.json`; pending tasks must not change normal `next_action`.
- [ ] **Step 4: Implement overlay validation and application**. Overlay patches may add only evidence already present in the base run or evidence that passes `validateGroundedRecord`; base artifacts are immutable.
- [ ] **Step 5: Add CLI routes**:

```text
task-add    <novel> --type <task-type> --scope <scope>
task-run    <novel> --task-id <task-id>
task-apply  <novel> --task-id <task-id>
```

- [ ] **Step 6: Run the focused tests and verify they pass**.
- [ ] **Step 7: Commit** `rtk git add .agents/skills/generate-game-kb/scripts/lib/overlay.js .agents/skills/generate-game-kb/scripts/lib/deferred-task.js .agents/skills/generate-game-kb/scripts/flow.js .agents/skills/generate-game-kb/scripts/lib/verify.js .agents/skills/generate-game-kb/scripts/lib/assemble.js .agents/skills/generate-game-kb/tests/overlay.test.js .agents/skills/generate-game-kb/tests/deferred-task.test.js .agents/skills/generate-game-kb/tests/cli.test.js && rtk git commit -m "feat: add deferred hash-bound overlay tasks"`.

### Task 9: Update timing, status, prompts, and documentation contracts

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/timing.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/next-action.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- Modify: `.agents/skills/generate-game-kb/tests/performance-budget.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/status-next-action.test.js`, `next-action.test.js`, `cleanup-contract.test.js`, and `skill-contract.test.js`

**Interfaces:**
- `buildRunMetrics` reports source CJK count, batch count, chapter extraction, basic-curate, assemble, verify, install, archive, quarantine, overlay, and total durations.
- `next_action` exposes only normal lifecycle actions and manual-review boundaries; pending deferred tasks are reported separately and never block the base run.

- [ ] **Step 1: Write failing timing and status tests** for a representative 21-chapter source-size fixture, a 50-chapter packing fixture, skipped basic-curate, deferred-task elapsed time, and pending tasks that do not block publication.
- [ ] **Step 2: Run the focused tests and verify they fail** against the old domain phase and unit types.
- [ ] **Step 3: Implement the new metrics and status fields** while preserving stable chapter ordering and manual-review precedence for actual blocking units.
- [ ] **Step 4: Rewrite the Skill and prompts** so they describe Lite, nullable enrichment, grounding requirements, quarantine behavior, and overlay commands. Remove active instructions that require `plan-domains` or four domain accepts.
- [ ] **Step 5: Run the focused tests and verify they pass**.
- [ ] **Step 6: Commit** `rtk git add .agents/skills/generate-game-kb/scripts/lib/timing.js .agents/skills/generate-game-kb/scripts/lib/next-action.js .agents/skills/generate-game-kb/scripts/flow.js .agents/skills/generate-game-kb/SKILL.md .agents/skills/generate-game-kb/prompts/extract-chapters.md .agents/skills/generate-game-kb/prompts/distill-domain.md .agents/skills/generate-game-kb/tests/performance-budget.test.js .agents/skills/generate-game-kb/tests/status-next-action.test.js .agents/skills/generate-game-kb/tests/next-action.test.js .agents/skills/generate-game-kb/tests/cleanup-contract.test.js .agents/skills/generate-game-kb/tests/skill-contract.test.js && rtk git commit -m "docs: align game-kb contracts with Lite and overlays"`.

### Task 10: Run the complete regression and performance gates

**Files:**
- Modify only failing tests or implementation files identified by the focused gates above.
- Test: `.agents/skills/generate-game-kb/tests/*.test.js`

- [ ] **Step 1: Run syntax checks** for every production JavaScript file.

```bash
rtk node --check .agents/skills/generate-game-kb/scripts/flow.js
rtk node --check .agents/skills/generate-game-kb/scripts/lib/grounding.js
rtk node --check .agents/skills/generate-game-kb/scripts/lib/overlay.js
rtk node --check .agents/skills/generate-game-kb/scripts/lib/deferred-task.js
```

Expected: all commands exit 0.

- [ ] **Step 2: Run the complete generate-game-kb test suite**.

```bash
rtk node --test .agents/skills/generate-game-kb/tests/*.test.js
```

Expected: all tests pass with no legacy-domain expectations on the active path.

- [ ] **Step 3: Run repository validation and dependency scans**.

```bash
rtk python tools/quick_validate.py
rtk python .agents/skills/generate-game-kb/scripts/production-dependency-scan.py
rtk git diff --check HEAD~10..HEAD
```

Expected: no validation errors, no removed active-route dependencies, and no whitespace errors.

- [ ] **Step 4: Verify a three-chapter end-to-end run** through prepare, batched extraction descriptors, grounded accept, basic normalization, skipped basic-curate, publish, and archive.
- [ ] **Step 5: Verify a deferred overlay run** that adds a task, creates a candidate overlay, rejects a stale base, applies a fresh overlay, and confirms the previous revision remains recoverable.
- [ ] **Step 6: Record exact test counts, timing evidence, quarantine counts, and overlay timing in the developer journal**.
- [ ] **Step 7: Commit any verification-only fixes separately** with a message that names the failing gate.

## Self-review checklist

- [ ] Every design requirement has a task: grounding, quarantine, two-chapter packing, nullable enrichment, basic dedup, action filtering, optional basic-curate, grounded assembly, publish, overlays, stale-base rejection, metrics, and documentation.
- [ ] No task requires four domain decision files on the active path.
- [ ] No overlay can create an entity or bypass grounding.
- [ ] No pending deferred task blocks a valid base publication.
- [ ] All names and interfaces used by later tasks are defined in an earlier task or in the existing file map.
- [ ] All generated artifacts remain inside the selected novel run directory.
