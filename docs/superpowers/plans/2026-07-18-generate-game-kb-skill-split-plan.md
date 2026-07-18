# generate-game-kb Skill Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to implement this plan task-by-task with a fresh review gate after each task.

**Goal:** Ship a repaired v4 audit skill, an isolated v5 fast base skill, and four independent deep-enrichment skills that operate only through hash-bound overlays.

**Architecture:** Keep the existing v4 controller and semantic contract as a read/write audit path, but make worker staging paths controller-owned and rejected drafts reviewable. Add an explicit v5 profile and skill that publishes grounded candidates without domain distillation. Deep skills submit constrained deferred tasks and materialize immutable revisions through the overlay registry.

**Tech Stack:** Node.js, YAML, JSON controller artifacts, `node:test`, existing run/ledger/install helpers, project-local `.agents/skills`.

## Global Constraints

- v4 semantic contract and legacy fixtures remain readable and verifiable; v4 runs are never upgraded in place.
- v5 uses semantic contract version 5 and never requires four domain decision artifacts.
- Every worker receives a controller-allocated `staging_path`; workers never infer attempt filenames.
- Each unit has at most two submissions; a second failure becomes `manual_review` and never restarts a worker automatically.
- Rejected drafts remain in run-scoped reviewable storage with validator errors and attempt metadata.
- Basic v5 deduplication/action filtering remains deterministic; generic action records stay in quarantine.
- Deep skills may keep, merge, drop, or constrained-patch existing grounded records only; they cannot invent entities, evidence, or source references.
- Published base artifacts are immutable. Overlay application is hash-bound, atomic, and rollback-safe.
- Final published surface remains exactly five YAML files.

---

### Task 1: Repair v4 staging ownership and bounded retry

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-work.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-work.js`
- Modify: `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Add: `.agents/skills/generate-game-kb/tests/accept-retry.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/domain-flow.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/semantic-work.test.js`

**Interfaces:**
- `writeWorkPlan()` and `writeWorkItem()` include `staging_path` and `attempt` in each worker input.
- `acceptDraft({ paths, unit, draftPath })` rejects paths other than the controller-provided next path without consuming an attempt.
- A rejected submission writes an immutable archive/error record and leaves the submitted staging file reviewable; a successful submission writes accepted evidence and records the consumed path.

- [ ] **Step 1: Write RED tests** for missing staging metadata, wrong-attempt path rejection, rejected-draft retention, second-failure `manual_review`, and no automatic resubmission.
- [ ] **Step 2: Run the focused tests** and confirm failures are caused by missing staging ownership/retention.
- [ ] **Step 3: Implement the controller-owned path contract**. Derive the next path once in the controller, persist it in the work item, and pass it to the prompt payload. Preserve rejected drafts under the run directory and keep their error report and archive hash.
- [ ] **Step 4: Run focused v4 tests** and confirm the old strict domain validation still rejects invalid records without looping.
- [ ] **Step 5: Commit** `fix: bound v4 staging retries and preserve rejected drafts`.

### Task 2: Add the isolated v5 skill and explicit profile routes

**Files:**
- Create: `.agents/skills/generate-game-kb-v5/SKILL.md`
- Create: `.agents/skills/generate-game-kb-v5/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`
- Add: `.agents/skills/generate-game-kb/tests/v5-skill-contract.test.js`
- Add: `.agents/skills/generate-game-kb/tests/v5-cli-contract.test.js`

**Interfaces:**
- `createOrResumeRun(novel, { profile: 'v5' })` creates a v5 run namespace and records contract/profile metadata.
- `flow.js` exposes `v5-prepare`, `v5-accept`, `v5-basic-curate`, `v5-publish`, and `v5-status`; v4 commands remain available for v4 runs.
- `generate-game-kb-v5/SKILL.md` documents only the fast base flow and links to deep skills for enrichment.

- [ ] **Step 1: Write RED contract tests** proving the v5 skill exists, v5 commands select profile v5, v5 status does not plan domains, and v4 commands reject a v5 run instead of mutating it.
- [ ] **Step 2: Run the tests** and confirm the old shared-command behavior fails these isolation checks.
- [ ] **Step 3: Implement the profile dispatcher and v5 skill wrapper**. Keep the existing v5 normalization, grounding, quarantine, and basic-curate interfaces; do not duplicate controller logic in the skill document.
- [ ] **Step 4: Validate the skill document** with the repository skill contract tests and run `node --check` on changed controller files.
- [ ] **Step 5: Commit** `feat: add isolated generate-game-kb-v5 skill`.

### Task 3: Complete grounded v5 assembly and publish

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/assemble.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-assembly.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/verify.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/install.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Add: `.agents/skills/generate-game-kb/tests/publish-v5.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/assemble.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/verify-v4.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/install-v4.test.js`

**Interfaces:**
- `assembleRun({ paths, profile: 'v5' })` consumes accepted grounded chapters, the deterministic candidate registry, and optional curate output; it does not consume v4 domain decisions.
- `verifyFinal(paths, { profile })` dispatches to v4 or v5 validation and recomputes accepted, registry, resolution, final, and receipt hashes.
- `publishRun({ paths, profile: 'v5' })` performs assemble, workspace verify, atomic install with installed verification, and archive; each boundary is resumable.

- [ ] **Step 1: Extend RED integration tests** for three chapters with no domain artifacts, skipped curate, quarantined records, missing-summary blocking, registry/final/report drift, successful five-file publish, and installer rollback.
- [ ] **Step 2: Run the focused tests** and record the old four-domain gate and placeholder-summary failures.
- [ ] **Step 3: Implement v5 grounded projection** with nullable enrichment, stable IDs, deterministic source-reference union, and a hard missing-summary error.
- [ ] **Step 4: Implement profile-dispatched verification and publish** while retaining v4 domain/receipt verification as a read-only branch.
- [ ] **Step 5: Run v5 and v4 focused suites** and confirm installed verification never falls back to worktree files.
- [ ] **Step 6: Commit** `refactor: publish grounded v5 candidates without domain distill`.

### Task 4: Add the deferred overlay registry

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/deferred-task.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/overlay.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Add: `.agents/skills/generate-game-kb/tests/deferred-task.test.js`
- Add: `.agents/skills/generate-game-kb/tests/overlay.test.js`

**Interfaces:**
- `addDeferredTask({ paths, type, scope, requestedBy }) -> task` binds a pending task to the current v5 base manifest hash.
- `runDeferredTask({ paths, taskId, draftPath }) -> report` validates a task draft and records `pending`, `failed`, or `ready` without changing the base.
- `validateOverlay(overlay, { baseRegistry, groundingContext }) -> errors[]` permits only constrained operations over existing grounded records.
- `applyOverlay({ paths, taskId }) -> revisionReceipt` rejects stale bases and atomically materializes/verifies a new five-file revision.

- [ ] **Step 1: Write RED tests** for task creation, input hash binding, unknown task type, invented entity/evidence rejection, stale-base rejection, deterministic operation order, and rollback.
- [ ] **Step 2: Run the tests** and confirm the registry/overlay modules are absent or permissive.
- [ ] **Step 3: Implement the task registry and overlay validator/application** with immutable base artifacts and explicit revision receipts.
- [ ] **Step 4: Add CLI routes** `task-add`, `task-run`, and `task-apply`; pending tasks must not alter v5 `next_action`.
- [ ] **Step 5: Run focused overlay tests and commit** `feat: add hash-bound deferred overlays`.

### Task 5: Create and validate the deep characters skill

**Files:**
- Create: `.agents/skills/generate-game-kb-deep-characters/SKILL.md`
- Add: `.agents/skills/generate-game-kb/tests/deep-characters-skill.test.js`

**Interfaces:**
- The skill accepts a published v5 run and character scope, then invokes the `characters-deep` deferred task type.
- It produces overlay drafts only and never writes final YAML, accepted evidence, or the base registry.

- [ ] **Step 1: Write RED contract tests** for the skill directory, trigger description, character scope, overlay-only output, and no v4 command references.
- [ ] **Step 2: Run the tests** and confirm the skill is absent.
- [ ] **Step 3: Create the skill** with its character prompt, shared overlay constraints, and direct link to the v5 base contract.
- [ ] **Step 4: Run `quick_validate.py` and the focused contract test**; record the result before moving to the next skill.
- [ ] **Step 5: Commit** `feat: add deep characters skill`.

### Task 6: Create and validate the deep skills skill

**Files:**
- Create: `.agents/skills/generate-game-kb-deep-skills/SKILL.md`
- Add: `.agents/skills/generate-game-kb/tests/deep-skills-skill.test.js`

**Interfaces:**
- The skill accepts a published v5 run and skills scope, then invokes the `skills-deep` deferred task type.
- It produces overlay drafts only and never writes final YAML, accepted evidence, or the base registry.

- [ ] **Step 1: Write RED contract tests** for the skill directory, trigger description, skills scope, overlay-only output, and no v4 command references.
- [ ] **Step 2: Run the tests** and confirm the skill is absent.
- [ ] **Step 3: Create the skill** with its skills/techniques prompt, shared overlay constraints, and direct link to the v5 base contract.
- [ ] **Step 4: Run `quick_validate.py` and the focused contract test**; record the result before moving to the next skill.
- [ ] **Step 5: Commit** `feat: add deep skills skill`.

### Task 7: Create and validate the deep items skill

**Files:**
- Create: `.agents/skills/generate-game-kb-deep-items/SKILL.md`
- Add: `.agents/skills/generate-game-kb/tests/deep-items-skill.test.js`

**Interfaces:**
- The skill accepts a published v5 run and items scope, then invokes the `items-deep` deferred task type.
- It produces overlay drafts only and never writes final YAML, accepted evidence, or the base registry.

- [ ] **Step 1: Write RED contract tests** for the skill directory, trigger description, items scope, overlay-only output, and no v4 command references.
- [ ] **Step 2: Run the tests** and confirm the skill is absent.
- [ ] **Step 3: Create the skill** with its item-enrichment prompt, shared overlay constraints, and direct link to the v5 base contract.
- [ ] **Step 4: Run `quick_validate.py` and the focused contract test**; record the result before moving to the next skill.
- [ ] **Step 5: Commit** `feat: add deep items skill`.

### Task 8: Create and validate the deep factions skill

**Files:**
- Create: `.agents/skills/generate-game-kb-deep-factions/SKILL.md`
- Add: `.agents/skills/generate-game-kb/tests/deep-factions-skill.test.js`

**Interfaces:**
- The skill accepts a published v5 run and factions scope, then invokes the `factions-deep` deferred task type.
- It produces overlay drafts only and never writes final YAML, accepted evidence, or the base registry.

- [ ] **Step 1: Write RED contract tests** for the skill directory, trigger description, factions scope, overlay-only output, and no v4 command references.
- [ ] **Step 2: Run the tests** and confirm the skill is absent.
- [ ] **Step 3: Create the skill** with its faction-enrichment prompt, shared overlay constraints, and direct link to the v5 base contract.
- [ ] **Step 4: Run `quick_validate.py` and the focused contract test**; record the result before the documentation task.
- [ ] **Step 5: Commit** `feat: add deep factions skill`.

### Task 9: Align status, timing, prompts, and documentation

**Files:**
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/next-action.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/timing.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Add: `.agents/skills/generate-game-kb-v5/prompts/publish.md`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/status-next-action.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/performance-budget.test.js`

**Interfaces:**
- v4 documentation describes strict domain distill and bounded retries; v5 documentation describes the fast base and explicitly excludes domain distill.
- `next_action` never exposes a pending deep task as a blocking base action.
- `buildRunMetrics` reports batching, quarantine, basic-curate, publish, overlay, and total durations by profile.

- [ ] **Step 1: Write RED documentation/status tests** for profile-specific commands, non-blocking deep tasks, and the 45-minute budget fixture.
- [ ] **Step 2: Run the tests** and capture old v4-only wording/status behavior.
- [ ] **Step 3: Update the two skill surfaces, prompts, status, and timing metrics** without changing validator semantics.
- [ ] **Step 4: Run skill-contract, status, timing, and prompt tests; commit** `docs: separate v4 v5 and deep skill contracts`.

### Task 10: Full regression, E2E, and performance gate

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Add: `.agents/skills/generate-game-kb/tests/e2e-v5-skill-split.test.js`
- Add: `.agents/skills/generate-game-kb/tests/e2e-v4-retry.test.js`

- [ ] **Step 1: Run syntax checks** for all changed controller files and quick-validate every new skill.
- [ ] **Step 2: Run focused v4 retry, v5 publish, overlay, deep-skill, status, and timing suites.**
- [ ] **Step 3: Run the complete Node test suite** and record unrelated pre-existing fixture failures separately from regressions.
- [ ] **Step 4: Run the three-chapter v5 E2E flow** and assert exactly five YAML files, quarantine visibility, stable hashes, and no domain artifacts.
- [ ] **Step 5: Run the v4 retry E2E flow** and assert rejected staging retention, exact attempt progression, and terminal manual review without a loop.
- [ ] **Step 6: Run the representative 21/50-chapter packing and timing fixtures** and assert the v5 base remains within the 45-minute budget model.
- [ ] **Step 7: Update progress and commit** `test: verify v4 v5 and deep skill split`.
