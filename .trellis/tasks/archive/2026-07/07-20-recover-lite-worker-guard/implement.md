# Lite Worker Recovery And Controller Routing Implementation Plan

## Global Constraints

- Work inline; do not dispatch implementation or check sub-agents.
- Follow RED-GREEN-REFACTOR for every behavior change.
- Preserve all existing user files and immutable run receipts.
- Keep `dashboard/pnpm-lock.yaml` untracked and out of commits.
- Produce one independently reviewable commit per task below.

## Task 1: Recover Guards After Rogue Child Removal

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/worker-guard.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/worker-guard.js`

- [ ] Add a failing test that opens a guard over an existing run directory,
      creates a child file, records the check, deletes the child, and expects
      `unresolvedWorkerGuardReports()` to return an empty list without changing
      check-receipt bytes.
- [ ] Add a failing assertion that future check results omit modified-directory
      entries caused only by child writes.
- [ ] Run the focused test and confirm the expected RED failure.
- [ ] Ignore size/mtime-only directory modifications in diff creation and in
      historical unresolved evaluation while preserving type/deletion checks.
- [ ] Run worker guard and Lite worker-safety tests to GREEN.
- [ ] Verify the real original White Horse status exits `worker-write-review`.
- [ ] Commit as `fix(game-kb): unblock remediated worker guard directories`.

## Task 2: Make Claude Chapter Execution Fail Closed

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/v4-skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb-lite/SKILL.md`
- Modify: `.agents/skills/generate-game-kb-lite/SKILL-cn.md`
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/SKILL-cn.md`

- [ ] Add failing bilingual contract assertions for mandatory Workflow use with
      one chapter, forbidden generic Agent/Task and main extraction, fail-closed
      Workflow errors, controller-authorized new runs only, and no filesystem
      envelope including `%TEMP%` and `/tmp`.
- [ ] Add assertions for a direct stdin-only `lite-submit-draft` recipe.
- [ ] Run focused Skill tests and confirm RED.
- [ ] Add the minimal hard-gate sections to all four Skill files without
      duplicating the worker extraction contract.
- [ ] Run focused Skill tests and both `quick_validate.py` checks to GREEN.
- [ ] Commit as `docs(game-kb): require read-only Claude chapter workflow`.

## Task 3: Restore Lite Candidate Registry Planning

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/lite-cli-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/status-next-action.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/next-action.js`
- Modify: `.agents/skills/generate-game-kb-lite/SKILL.md`
- Modify: `.agents/skills/generate-game-kb-lite/SKILL-cn.md`

- [ ] Add a failing CLI contract test for `lite-plan-domains`.
- [ ] Add a failing status regression proving an accepted Lite chapter returns
      `lite-plan-domains`, not `lite-publish`, while the registry is absent.
- [ ] Extend the regression to execute the returned command, assert the
      controller-created immutable registry, and expect `lite-publish` next.
- [ ] Run the focused tests and confirm RED.
- [ ] Add the Lite command alias and pass profile-required domain units into
      `resolveNextAction()` without changing the V4 default.
- [ ] Replace the one-off Lite status rewrite with explicit pre/post-planning
      action projection.
- [ ] Add the exact `lite-plan-domains` command and lifecycle order to both Lite
      Skill files.
- [ ] Run CLI, status, publication, and Skill contract tests to GREEN.
- [ ] Commit as `fix(game-kb): restore Lite candidate registry planning`.

## Task 4: Extend Canonical Item Types

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/semantic-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/legacy-map.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/verify-v4.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/legacy-map.js`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb-lite/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb-deep-items/SKILL.md`
- Modify: `.agents/skills/generate-game-kb-deep-items/SKILL-cn.md`

- [ ] Add failing assertions that the canonical enum contains `坐骑`, `异兽`,
      and `饰品`, final verification accepts each, and an unknown value still
      fails.
- [ ] Add failing legacy-map cases for explicit mount, exotic-beast, and
      accessory labels.
- [ ] Add failing prompt/Skill contract assertions for the complete enum and
      named/rare/plot-relevant inclusion boundary.
- [ ] Run focused tests and confirm RED.
- [ ] Extend `ITEM_TYPES`, legacy normalization rules, bilingual extraction
      prompts, and bilingual deep-item guidance.
- [ ] Run semantic, legacy, verification, and Skill tests to GREEN.
- [ ] Commit as `feat(game-kb): extend canonical item types`.

## Task 5: Full Verification And Documentation

**Files:**
- Modify if needed: `.trellis/spec/backend/quality-guidelines.md`
- Modify: `.trellis/tasks/07-20-recover-lite-worker-guard/verification.md`

- [ ] Run the complete `.agents/skills/generate-game-kb/tests/*.test.js` suite.
- [ ] Run both Lite and V4 Skill validators.
- [ ] Re-run read-only White Horse installed verification, recompute the archived
      v4 candidate registry, and confirm all installed product bytes are
      unchanged from the pre-task baseline.
- [ ] Run `git diff --check` and inspect the final dirty-file set.
- [ ] Record commands, counts, real-run status, and residual risks in
      `verification.md`.
- [ ] Update backend quality guidance with the directory-metadata and Lite
      next-action executability contracts if they are not already explicit.
- [ ] Commit verification/spec changes separately, then archive the task and
      record the session journal.
