# V4-First Game KB and Lightweight V5 Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use test-driven development and execute this plan in order. This task is configured for inline Codex execution; do not dispatch subagents. Track progress with the checkbox (`- [ ]`) steps below.

**Goal:** Repair the canonical V4 controller and Skill contract first, prove it against the tracked Chinese novel `古龙/剑神一笑/剑神一笑.txt`, and only then derive the lightweight V5 and optional deep-skill contracts.

**Architecture:** The controller remains the single owner of unit attempts, current source/staging paths, acceptance, retry state, final YAML data, installation, archival, deferred tasks, and revisions. V4 defines the complete lifecycle. V5 reuses that lifecycle while omitting automatic domain distill, and each deep Skill is an explicit post-publication adapter over the shared deferred-task/overlay implementation.

**Tech Stack:** CommonJS Node.js, `node:test`, YAML drafts/data, Markdown Agent Skills, Python `quick_validate.py`, existing `flow.js` controller.

## Global Constraints

- V4 chapter jobs contain adjacent chapters and normally contain 2-3 chapters; a multi-chapter job contains at most 3 chapters and at most 36,000 CJK characters.
- A single-chapter job is allowed only for an individually oversized chapter or an unavoidable final remainder.
- Each chapter descriptor exposes exactly one controller-current `attempt` and `staging_path`; agents never choose from a path list.
- One bounded cycle permits the initial validated submission plus at most one automatic retry. A second rejection enters `manual_review` and preserves both rejected drafts.
- `retry-unit` is explicit and requires `--confirm`. It starts a fresh bounded cycle for only the requested unit. `reset-unit` remains compatible but is not the public recovery command in Skill prose.
- V4 and V5 knowledge drafts and the five consumer files are YAML. JSON is controller metadata, reports, state, manifests, and receipts only.
- Remove all user-facing promises or workflow discussion about event or dialogue processing from V4, V5, and deep Skill prose.
- Every user-facing command in the V4, V5, and deep Skill folders has a concrete example using `"C:\git\wuxia-novel\古龙\剑神一笑"`, `run-jian-shen-yi-xiao`, and a real unit/task identifier obtained from controller output.
- Preserve the current uncommitted overlay/deferred-task work and do not revert unrelated changes. Commit once after each completed stage, staging only that stage's files so every checkpoint remains independently reviewable and revertible.

---

### Task 1: Prove and implement V4 dynamic 2-3 chapter jobs

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/chapter-batching.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/worker-pool.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/worker-pool.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-batching.js`

**Interfaces:**
- Consumes: chapter descriptors with `number` and `source_char_count`.
- Produces: `packChapterJobs(manifest, options)` jobs with `MAX_CHAPTERS_PER_JOB === 3` and `MAX_CJK_CHARS_PER_JOB === 36000`.

- [ ] **Step 1: Write RED tests for the approved packing contract.** Replace two-chapter expectations with deterministic greedy three-chapter expectations; retain cases for an oversized singleton, a final singleton, adjacency, the CJK budget, and lower custom limits.
- [ ] **Step 2: Run the two focused test files.**
  - Run: `"C:/Program Files/nodejs/node.exe" --test .agents/skills/generate-game-kb/tests/chapter-batching.test.js .agents/skills/generate-game-kb/tests/worker-pool.test.js`
  - Expected RED: assertions report the current hard limit `2` and two-chapter job counts.
- [ ] **Step 3: Implement the minimum constant and greedy-packing changes.** Keep `MAX_CHAPTERS_PER_JOB` in `worker-pool.js` as the single exported absolute count limit; keep the existing deterministic sort and validation path in `chapter-batching.js`.
- [ ] **Step 4: Re-run the focused tests.** Expected: all chapter batching and worker-pool tests pass.
- [ ] **Step 5: Commit the green stage.** Commit only Task 1 files with message `feat(game-kb): support dynamic three-chapter jobs`.

### Task 2: Make chapter descriptors expose one controller-current path

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/chapter-batching.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/next-action.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/status-next-action.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/cli.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-batching.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/next-action.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js` only if a RED test proves accept does not enforce the issued current path.

**Interfaces:**
- Produces each job chapter as `{ unit, number, title, source_file, source_char_count, input_hash, attempt, staging_path }`.
- The current path is derived by the controller from the unit's current progress attempt; no `staging_paths` array crosses the controller/agent boundary.

- [ ] **Step 1: Write RED descriptor-shape tests.** Assert exact keys, `attempt: 1`, one `_attempt_01.yaml` path, path containment, and `accept` consumption of that exact issued path.
- [ ] **Step 2: Add RED retry projection coverage.** After one rejected submission, `status` must issue `attempt: 2` and `_attempt_02.yaml`; accepted siblings remain absent from the next job list.
- [ ] **Step 3: Run the focused descriptor/status tests.** Expected RED: current output contains `staging_paths` and lacks `attempt`/`staging_path`.
- [ ] **Step 4: Change the descriptor builder to consume current progress state.** Preserve canonical path derivation and validation in one controller function; reject extra/mismatched descriptor fields deterministically.
- [ ] **Step 5: Re-run focused tests.** Expected: exact descriptor contract and controller/main-agent/worker path equality pass.
- [ ] **Step 6: Commit the green stage.** Commit only Task 2 files with message `fix(game-kb): issue one current chapter staging path`.

### Task 3: Add the explicit bounded `retry-unit` cycle

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/accept-retry.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/cli.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/progress.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/next-action.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/progress.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/next-action.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`

**Interfaces:**
- New public command: `retry-unit <novel> --run <run-id> --unit <unit> --confirm`.
- Compatibility command: `reset-unit` continues to invoke the same controller reset primitive.
- Produces a fresh attempt-one input/staging path for one unit and does not mutate accepted siblings.

- [ ] **Step 1: Write RED CLI tests.** Require explicit confirmation, support both `chapter:001` and `distill:characters`, preserve sibling state, and reject an unknown unit/run without changing progress.
- [ ] **Step 2: Write RED state-machine tests.** Verify two failed submissions end at `manual_review`, status does not schedule a third attempt, both failed drafts remain reviewable, and one explicit retry starts a fresh two-attempt cycle.
- [ ] **Step 3: Run focused retry/progress/next-action tests.** Expected RED: `retry-unit` is an unknown command and recovery text still advertises `reset-unit`.
- [ ] **Step 4: Route `retry-unit` through the existing reset primitive.** Keep `--confirm` mandatory, update user-facing suggested recovery to `retry-unit`, and keep `reset-unit` accepted for compatibility.
- [ ] **Step 5: Re-run focused tests.** Expected: no automatic third attempt, one manual cycle reset, retained drafts, and compatibility all pass.
- [ ] **Step 6: Commit the green stage.** Commit only Task 3 files with message `feat(game-kb): add bounded manual unit retry`.

### Task 4: Repair and test the complete V4 Skill contract

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js` or create `.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js` if no focused V4 contract test exists.
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify other Markdown files under `.agents/skills/generate-game-kb/` only where they contain a user-facing command or forbidden event/dialogue workflow prose.

**Interfaces:**
- V4 Skill documents the complete path `prepare -> chapter accept -> plan-domains -> four domain accepts -> assemble -> verify -> install -> installed verify -> archive-run`.
- Public recovery documentation uses `retry-unit`; `unit` examples include `chapter:001` and `distill:characters`.

- [ ] **Step 1: Write RED structural contract tests.** Assert dynamic 2-3 chapter wording, 36,000 CJK cap, one current attempt/path, two-attempt bounded cycle, manual retry, five final YAML files, reports/receipts, and no event/dialogue workflow wording.
- [ ] **Step 2: Add a command-example scanner.** For every documented controller command, require an adjacent concrete `剑神一笑` example and require generated IDs/paths to be reused from shown controller output rather than invented.
- [ ] **Step 3: Run the V4 contract test.** Expected RED: old fixed chapter wording, path-list wording, missing `retry-unit`, missing examples, and forbidden prose are reported.
- [ ] **Step 4: Rewrite V4 Skill/prompt prose to match implemented behavior exactly.** Do not promise unimplemented extractors. Include concrete Windows examples for every command.
- [ ] **Step 5: Run the focused contract test and the standard skill validator.** Expected: both pass.
- [ ] **Step 6: Commit the green stage.** Commit only Task 4 files with message `docs(game-kb): align v4 skill with controller contract`.

### Task 5: Add the tracked `剑神一笑` V4 integration gate

**Files:**
- Create: `.agents/skills/generate-game-kb/tests/jian-shen-yi-xiao-integration.test.js`
- Modify production code only if the RED integration test exposes a real Chinese-path or source-manifest defect.

**Interfaces:**
- Consumes: `C:/git/wuxia-novel/古龙/剑神一笑/剑神一笑.txt` through the normal controller preparation path.
- Produces: 20 chapter descriptors and seven jobs with chapter counts `[3, 3, 3, 3, 3, 3, 2]`.

- [ ] **Step 1: Write the real-corpus test without copying the novel.** Assert the tracked file exists, paths retain Chinese directory names, all controller source/staging paths are absolute/current, and packing is stable across repeated status projection.
- [ ] **Step 2: Run the real-corpus test.** Expected RED before Tasks 1-2 are complete; after those tasks it must pass with exactly seven jobs.
- [ ] **Step 3: Extend the test through the practical V4 lifecycle boundary supported by deterministic fixtures.** Validate the same manifest/path contract used by accept, and keep model-generated content out of the automated test.
- [ ] **Step 4: Run the V4 focused gate:** chapter batching, worker pool, next action, status, progress, retry, CLI, domain flow, semantic work, and the real corpus test. Expected: zero failures.
- [ ] **Step 5: Commit the green stage.** Commit only Task 5 files with message `test(game-kb): cover Jian Shen Yi Xiao corpus`.

### Task 6: Derive the lightweight V5 Skill from verified V4

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/v5-skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/v5-cli-contract.test.js`
- Modify: `.agents/skills/generate-game-kb-v5/SKILL.md`
- Modify: `.agents/skills/generate-game-kb-v5/prompts/extract-chapters.md`

**Interfaces:**
- V5 reuses the V4 descriptor/retry/publication contract and omits only automatic `plan-domains` plus four domain accepts.
- Lifecycle: `v5-prepare -> repeated v5-status/v5-accept -> v5-basic-curate -> v5-publish`.

- [ ] **Step 1: Extend V5 RED contract tests to compare inherited V4 clauses.** Require 2-3 chapter jobs, one current path, `retry-unit`, YAML-only knowledge data, exact five files, verification/install/archive evidence, and explicit omission of base domain distill.
- [ ] **Step 2: Require concrete `剑神一笑` examples for every V5 command.** Generated run/path values must come from shown controller output.
- [ ] **Step 3: Rewrite the V5 Skill and extraction adapter as a lightweight V4 specialization.** Keep discovery frontmatter valid and do not fork a second scheduling/retry contract.
- [ ] **Step 4: Run V5 skill/CLI tests and the standard validator.** Expected: all pass after V4 gates are green.
- [ ] **Step 5: Commit the green stage.** Commit only Task 6 files with message `docs(game-kb): derive lightweight v5 from v4`.

### Task 7: Finish and verify all four on-demand deep Skills

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/v5-skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/deferred-task.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/overlay.test.js`
- Modify: `.agents/skills/generate-game-kb-deep-characters/SKILL.md`
- Modify: `.agents/skills/generate-game-kb-deep-skills/SKILL.md`
- Modify: `.agents/skills/generate-game-kb-deep-items/SKILL.md`
- Modify: `.agents/skills/generate-game-kb-deep-factions/SKILL.md`
- Preserve and finish current changes in `.agents/skills/generate-game-kb/scripts/lib/{deferred-task,overlay,install,paths,finalize,domain-assembly}.js` and `.agents/skills/generate-game-kb/scripts/flow.js` only where tests require it.

**Interfaces:**
- Commands: `task-add`, `task-run`, and `task-apply` using a controller-returned `task-id` and overlay path.
- Each successful apply backs up current `<novel>/data/`, verifies a cumulative five-YAML revision, atomically installs it for Dashboard, and writes hash-bound receipts.

- [ ] **Step 1: Extend deep-skill RED tests for concrete examples and generated-ID reuse.** Each skill must show `task-add` output before `task-run`/`task-apply`; no guessed `task-id` or overlay path.
- [ ] **Step 2: Keep each deep Skill user-invoked, non-blocking, domain-specific, source-grounded, and valid Agent Skills YAML frontmatter.** Do not add event/dialogue workflow content.
- [ ] **Step 3: Re-run deferred-task/overlay tests.** Require archived-base task creation, artifact/registry/current-data hash binding, cumulative revisions, distinct backups, atomic install, and stale-task rejection.
- [ ] **Step 4: Run all four standard skill validators plus the V5/deep contract test.** Expected: zero failures.
- [ ] **Step 5: Commit the green stage.** Commit only Task 7 files with message `feat(game-kb): complete on-demand deep overlays`.

### Task 8: Run final ordered verification and inspect the diff

**Files:**
- Verify only; update task checklists with observed results.

**Interfaces:**
- Produces fresh evidence for V4, real-corpus, V5, deep overlay, Skill format, syntax, and repository hygiene.

- [ ] **Step 1: Run `node --check` for every changed JavaScript file.** Expected: exit 0 for all files.
- [ ] **Step 2: Run the complete relevant `.agents/skills/generate-game-kb/tests/*.test.js` suite.** Report exact pass/fail counts and separate the known baseline `run-archive.test.js` fixture issue if it remains unrelated.
- [ ] **Step 3: Run `quick_validate.py` for V4, V5, and all four deep Skill directories.** Expected: all six validators pass.
- [ ] **Step 4: Scan all six Skill trees for forbidden event/dialogue workflow wording, `staging_paths` in agent-facing descriptors, fixed two-chapter wording, and undocumented commands.** Expected: no contract residue.
- [ ] **Step 5: Run `rtk git diff --check` and inspect `rtk git diff --stat` plus the scoped diff.** Expected: no whitespace errors and no unrelated files changed by this task.
- [ ] **Step 6: Commit final verification artifacts.** If Task 8 changes only Trellis checklists or reports, commit those files with message `chore(game-kb): record v4-first verification`.

## Self-Review

- Spec coverage: every approved V4 scheduling/retry/path decision, real Chinese corpus requirement, V5 inheritance rule, deep overlay lifecycle, and concrete command example is mapped to an ordered task.
- Placeholder scan: no `TBD`, generic “add tests,” or undefined later work remains.
- Type consistency: `unit` is used for V4/V5 controller work (`chapter:001`, `distill:characters`); deep work consistently uses controller-generated `task-id`.
- Dependency check: V5 work cannot start until Tasks 1-5 provide a green V4 gate; deep verification follows V5; final verification runs last.
