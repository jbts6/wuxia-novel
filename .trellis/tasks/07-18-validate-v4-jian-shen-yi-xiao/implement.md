# Jian Shen Yi Xiao V4 Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` for independent chapter/domain draft generation. The controller/main agent retains all state transitions and accepts.

**Goal:** Produce reproducible repository and operational evidence that the complete V4 workflow works on the tracked `剑神一笑` text.

**Architecture:** Add one deterministic real-corpus integration gate, then execute the production V4 controller against the same source. Workers generate only controller-issued YAML drafts; the main agent serializes all accepts and lifecycle transitions.

**Tech Stack:** Node.js test runner, production `flow.js` controller, YAML knowledge drafts, Trellis task evidence.

## Global Constraints

- Do not replace real source input with fixtures.
- Do not guess run, unit, attempt, source, or staging paths.
- Do not manually edit controller state or accepted/final artifacts.
- Keep one implementation commit for the real-corpus regression gate and one evidence commit after the operational run.

### Task 1: Add The Missing Real-Corpus Integration Gate

**Files:**
- Create: `.agents/skills/generate-game-kb/tests/jian-shen-yi-xiao-integration.test.js`
- Modify production controller files only if the new test exposes a reproducible defect.

- [ ] Write a test that calls the same production preparation/status APIs used by `flow.js` with the tracked Chinese path.
- [ ] Assert the source exists and preparation retains the original absolute Chinese path.
- [ ] Assert 20 chapter descriptors and seven jobs with counts `[3, 3, 3, 3, 3, 3, 2]`.
- [ ] Assert adjacency, the 36,000-CJK cap, stable repeated status output, and exact current `attempt`/`staging_path` ownership.
- [ ] Run the focused test and observe the actual result before changing production code.
- [ ] Fix only real defects found by the RED test, then rerun the focused and controller suites.
- [ ] Commit the regression gate and any proven fix.

### Task 2: Prepare The Real Operational Run

- [ ] Confirm the worktree is clean except for Task 1 and Trellis files.
- [ ] Run `archive-existing` with an explicit pre-run archive ID.
- [ ] Run `prepare` with run ID `run-jian-shen-yi-xiao-v4-real-20260718`.
- [ ] Read `status --json` and record semantic contract, chapter count, job count, job sizes, attempts, source paths, and staging paths.
- [ ] Stop if the controller result differs from the real-corpus gate.

### Task 3: Generate And Accept All Chapter Units

- [ ] Dispatch independent jobs from the controller's current `next_units`, preserving exact descriptors.
- [ ] Each worker reads every complete assigned chapter and writes one YAML file per chapter at its issued staging path.
- [ ] Main agent accepts drafts serially using each exact unit/path pair.
- [ ] After each accept batch, read `status --json` and dispatch only the newly current descriptors.
- [ ] On one validation failure, dispatch the controller-issued retry descriptor; on a second failure stop at manual review.
- [ ] Record accepted chapter count and attempt history when all 20 chapters close.

### Task 4: Generate And Accept Four Domain Units

- [ ] Run optional `basic-curate --skip` only when status requests it.
- [ ] Run `plan-domains` only when status requests it.
- [ ] Dispatch the four controller-issued domain work units, allowing parallel draft generation.
- [ ] Main agent accepts domains serially in controller presentation order.
- [ ] Record decision counts, attempts, and any rejected drafts.

### Task 5: Assemble, Verify, Install, And Archive

- [ ] Run `assemble` and record exact filenames and `final_data_hash`.
- [ ] Run workspace `verify`; stop on any blocking evidence, schema, candidate, or reference error.
- [ ] Run `install` and record backup/install receipt details.
- [ ] Run `verify --installed` using installed artifacts only.
- [ ] Run `archive-run` and record the archive receipt and bound hashes.
- [ ] Confirm Dashboard-facing `data/` contains exactly the five verified YAML files.

### Task 6: Final Verification And Evidence Commit

- [ ] Run the focused real-corpus test.
- [ ] Run the complete `.agents/skills/generate-game-kb/tests/*.test.js` suite.
- [ ] Run `node --check` on every production JavaScript file.
- [ ] Run `quick_validate.py` for `generate-game-kb` with UTF-8 mode.
- [ ] Run `git diff --check` and inspect the scoped diff.
- [ ] Append exact run evidence to the Trellis journal and commit task-owned tracked files.
- [ ] Do not archive this task until every PRD acceptance criterion is evidenced.
