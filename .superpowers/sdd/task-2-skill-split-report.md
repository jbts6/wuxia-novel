# Task 2 Skill Split Report

Status: DONE_WITH_CONCERNS

## Scope

Implemented the isolated Lite skill surface and explicit profile routing from
`task-2-skill-split-brief.md`. The route marker is stored as `run.json.profile`
(`v4` or `lite`) so the existing semantic constants and Task 7 assembly draft
remain compatible until the later publish/verification task dispatches the
full profile contract.

This archived report has been normalized to the current Lite names. Its paths,
commands, tests, and commit label describe the corresponding Lite surface, not
the obsolete product spelling used during the original transition.

## Changed Files

- Created `.agents/skills/generate-game-kb-lite/SKILL.md` with only the grounded
  Lite base lifecycle and links to the deferred deep skills.
- Created `.agents/skills/generate-game-kb-lite/prompts/extract-chapters.md` with
  chapter-local YAML, quote, local-key, and named-technique constraints.
- Modified `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`
  with `PROFILE_V4`, `PROFILE_LITE`, and supported-profile metadata.
- Modified `.agents/skills/generate-game-kb/scripts/lib/run.js` to normalize
  profile options, persist profile metadata, and reject profile-mismatched
  writes with `PROFILE_MISMATCH`.
- Modified `.agents/skills/generate-game-kb/scripts/flow.js` with Lite command
  routes (`lite-prepare`, `lite-accept`, `lite-basic-curate`, `lite-publish`, and
  `lite-status`), profile-aware run resolution, and Lite status routing that does
  not return `plan-domains`.
- Added `.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js`.
- Added `.agents/skills/generate-game-kb/tests/lite-cli-contract.test.js`.

Existing Task 7 files, `package-lock.json`, `.trellis/tasks`, and
`.trellis/workspace` changes were left untouched and unstaged.

## TDD Evidence

Initial RED command:

```text
node --test .agents/skills/generate-game-kb/tests/lite-skill-contract.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js
```

Result: exit 1; 5 tests, 0 passed, 5 failed. The expected failures included
`COMMAND_UNKNOWN` for `lite-prepare`, missing Lite skill files, and the absence of
profile mismatch enforcement.

Final focused GREEN command:

```text
node --test .agents/skills/generate-game-kb/tests/lite-skill-contract.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js
```

Result: exit 0; 6 tests, 6 passed, 0 failed.

Focused regression command:

```text
node --test \
  .agents/skills/generate-game-kb/tests/semantic-contract.test.js \
  .agents/skills/generate-game-kb/tests/run-isolation.test.js \
  .agents/skills/generate-game-kb/tests/cli.test.js \
  .agents/skills/generate-game-kb/tests/status-next-action.test.js
```

Result: exit 0; 27 tests, 27 passed, 0 failed.

Combined final focused command:

```text
node --test \
  .agents/skills/generate-game-kb/tests/lite-skill-contract.test.js \
  .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js \
  .agents/skills/generate-game-kb/tests/semantic-contract.test.js \
  .agents/skills/generate-game-kb/tests/run-isolation.test.js \
  .agents/skills/generate-game-kb/tests/cli.test.js \
  .agents/skills/generate-game-kb/tests/status-next-action.test.js
```

Result: exit 0; 33 tests, 33 passed, 0 failed.

Syntax checks:

```text
node --check .agents/skills/generate-game-kb/scripts/flow.js
node --check .agents/skills/generate-game-kb/scripts/lib/run.js
node --check .agents/skills/generate-game-kb/scripts/lib/semantic-contract.js
```

Result: exit 0 for all three files.

Additional check:

```text
git diff --check
```

Result: exit 0.

No repository `quick_validate.py` skill validator is present in this
worktree, so the focused contract tests are the applicable skill-document
validation.

## Full Suite Result

```text
node --test .agents/skills/generate-game-kb/tests/*.test.js
```

Result: exit 1; 273 tests, 225 passed, 48 failed. The failures reproduce in
the pre-existing transitional Task 7 assembly/install fixtures and the older
v4 skill-document expectations (for example stale assembly decision hashes,
grounding fixture mismatches, and domain-stage status assertions). They are
outside the Task 2 files and were not changed or staged.

## Concerns / Incomplete Items

- `lite-publish` is a profile-routed entry point to the existing assembly
  boundary. Full assemble, verify, atomic install, installed verification, and
  archive orchestration remains Task 3 work as required by the brief; this task
  does not implement it early.
- The explicit route marker is separate from the existing semantic profile
  constant so current accept/domain fixtures and the uncommitted Task 7 draft
  remain compatible. Task 3 should make verification and publication consume
  the profile marker consistently.
- The complete suite remains red for the unrelated transitional fixtures noted
  above; the Task 2 focused and regression suites are green.

## Commit

The implementation was committed as an independent lightweight-Skill change;
this archived report now uses the current Lite label consistently.
