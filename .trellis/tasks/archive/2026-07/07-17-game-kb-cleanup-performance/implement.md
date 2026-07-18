# Remove Legacy Flow And Optimize Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the verified v4 lifecycle the only writable fast workflow, cap AI work at two submissions, provide deterministic recovery, and remove redundant runtime stages.

**Architecture:** `progress.js` owns a single two-submission state machine, a focused lifecycle resolver derives `status.next_action`, and `flow.js` exposes only the v4 commands. Domain inputs remain registry-bound and parallel, while legacy modules/prompts/tests are deleted after any retained v4 helpers move to their final owners.

**Tech Stack:** Node.js CommonJS, `node:test`, `js-yaml`, SHA-256 evidence receipts, Trellis Markdown specs.

## Global Constraints

- Work only in `C:\git\wuxia-novel\.worktrees\game-kb-yaml-flow` on `feat/game-kb-yaml-flow`.
- Do not modify `CLAUDE.md`, commit, merge, push, or archive Trellis tasks.
- Preserve accepted-artifact immutability, candidate/reference closure, atomic install rollback, receipt binding, run isolation, and installed verification.
- Final storage remains exactly five `.yaml` files; controller state and reports remain JSON.
- Use TDD: every behavior change starts with a focused failing test and ends with focused GREEN evidence.

---

### Task 1: Lock Attempt And Recovery Contracts

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/progress.test.js`
- Create: `.agents/skills/generate-game-kb/tests/next-action.test.js`
- Create: `.agents/skills/generate-game-kb/tests/status-next-action.test.js`

**Interfaces:**
- Consumes: current `freshUnit`, `recordSubmission`, `statusReport`, and CLI `status --json`.
- Produces: executable tests for the two-submission budget and `next_action`/`next_units` precedence.

- [ ] Add RED progress cases for one correction, second failure, repeated output/error, resume after reload, explicit reset, and path/transport failures that spend no attempt.
- [ ] Add RED lifecycle cases for all eight actions, stable numeric chapter/domain ordering, manual-review precedence, and stale assembly/verification/install evidence.
- [ ] Add an isolated status CLI test that requires exactly one lifecycle action without mutating any file or directory below the novel root; also prove 429 backoff does not mutate progress attempts.
- [ ] Run `rtk node --test .agents/skills/generate-game-kb/tests/progress.test.js .agents/skills/generate-game-kb/tests/next-action.test.js .agents/skills/generate-game-kb/tests/status-next-action.test.js` and confirm RED only on the new contracts.

### Task 2: Implement Unified Attempts And Deterministic Status

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/progress.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/next-action.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/install.js`

**Interfaces:**
- Produces: `resolveNextAction({ paths, manifest, progress, installed }) -> { next_action, next_units }`.
- Produces: `recordSubmission(...)` with a maximum of two validator-observed attempts.

- [ ] Remove active semantic/format counters and targeted-recall submission logic; keep one `attempts` counter and two-entry output/error histories.
- [ ] Make `acceptDraft` report `remaining_attempts` from the shared limit of two and preserve staging/path validation before budget mutation.
- [ ] Implement the pure lifecycle precedence from `design.md`; compare installed receipt source/chapter/final hashes to the selected run rather than accepting another run's valid install.
- [ ] Add lifecycle results to `statusReport` while keeping status read-only.
- [ ] Run the Task 1 tests and require GREEN.

### Task 3: Remove Legacy Commands, Modules, Prompts, And Paths

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-assembly.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-work.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/timing.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/book-assembly.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/category-contract.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/clean-obligations.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/coverage.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/game-materials.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/gaps.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/priority.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/quality.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/quantity.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/supplements.js`
- Delete: `.agents/skills/generate-game-kb/scripts/yaml2json.js`
- Delete: `.agents/skills/generate-game-kb/prompts/clean-category.md`
- Delete: `.agents/skills/generate-game-kb/prompts/sample-quality.md`
- Delete: `.agents/skills/generate-game-kb/prompts/select-materials.md`
- Delete: `.agents/skills/generate-game-kb/prompts/supplement-category.md`
- Create: `.agents/skills/generate-game-kb/tests/cleanup-contract.test.js`

**Interfaces:**
- Consumes: v4 `assembleRun`, `verifyFinal`, `installVerifiedData`, accepted-artifact helpers, and generic domain work-plan storage.
- Produces: a production graph with no legacy write path or projection dependency.

- [ ] Add RED dependency/CLI tests for removed commands, filenames, prompts, report paths, and conversion entry points.
- [ ] Move stable local-key assignment into `domain-assembly.js`; remove its obsolete cleaned-book/game-material projection.
- [ ] Trim `candidate-ledger.js` to accepted-artifact ownership and `semantic-work.js` to generic/domain work-plan storage before deleting their old dependencies.
- [ ] Remove legacy functions/imports/routes from `flow.js`, legacy contexts from `accept.js`, and legacy directories/report paths from `paths.js`/`run.js`.
- [ ] Delete legacy-only test files and rewrite mixed CLI/archive/isolation/domain tests to preserve their v4 safeguards; do not skip obsolete assertions.
- [ ] Run the cleanup contract plus all touched suites and require GREEN.

### Task 4: Enable Four-Domain Parallelism And Current Metrics

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-work.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/timing.js`
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/schemas.md`
- Modify: `.agents/skills/generate-game-kb/tests/domain-work.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/domain-flow.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/run-archive.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`
- Modify: `.trellis/spec/backend/quality-guidelines.md`

**Interfaces:**
- Produces: four independent work items with stable display/report order and late-bound refs.
- Produces: v4-only phase and AI workload metrics.

- [x] Add RED tests accepting the four domain decisions in different completion orders and require byte-identical assembly output and stable status ordering.
- [x] Remove factions-first dependency language and document four-domain concurrency; keep the canonical order only for deterministic presentation.
- [x] Remove merge/clean/recall/quality and format-repair metric fields; count one optional correction as `max(0, attempts - 1)`.
- [x] Synchronize Skill and backend executable contracts with two submissions, one lifecycle action, removed stages, and chapter-worker `5 -> 3` fallback followed by a halt on a second distinct 429 at fallback.
- [x] Run domain, archive/timing, worker-pool, Skill contract, and assemble tests and require GREEN.

### Task 5: Prove The Only Normal Path And Timing Budget

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/assemble-flow.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/integration.test.js`
- Create: `.agents/skills/generate-game-kb/tests/performance-budget.test.js`
- Create: `.agents/skills/generate-game-kb/tests/fixtures/representative-21-chapter-timing.json`

**Interfaces:**
- Consumes: the v4 CLI lifecycle and real `buildRunMetrics` implementation.
- Produces: three-chapter end-to-end evidence and representative 21-chapter orchestration timing evidence.

- [x] Rewrite the integration fixture to run only prepare, chapter accepts, plan-domains, four domain accepts, assemble, verify, install, installed verify, and archive.
- [x] Assert no removed command, report, prompt, projection, top-level category, or format-conversion process is invoked.
- [x] Feed a checked 21-chapter timestamp/attempt fixture through `buildRunMetrics`; require total `<= 45 * 60 * 1000`, no unit over two attempts, and all verification/install phases present.
- [x] Run the integration and performance-budget tests and require GREEN.

### Task 6: Cleanup/Performance Quality Gate

- [x] Run `rtk node --check` for every remaining production JavaScript file and require zero failures.
- [x] Run the complete `.agents/skills/generate-game-kb/tests/*.test.js` suite and require zero failures/skips owned by this task.
- [x] Run `quick_validate.py`, the v4 installer regression, the production dependency scan, and `rtk git diff --check HEAD`.
- [x] Verify `CLAUDE.md` is unchanged and record exact pass/fail counts plus timing evidence in the developer journal.
- [x] Obtain an independent final code/spec review; resolve every critical or important finding before declaring the task ready.
