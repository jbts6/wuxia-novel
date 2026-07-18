# Task 2 Skill Split Report

Status: DONE_WITH_CONCERNS

## Scope

Implemented the isolated v5 skill surface and explicit profile routing from
`task-2-skill-split-brief.md`. The route marker is stored as `run.json.profile`
(`v4` or `v5`) so the existing semantic constants and Task 7 assembly draft
remain compatible until the later publish/verification task dispatches the
full profile contract.

## Changed Files

- Created `.agents/skills/generate-game-kb-v5/SKILL.md` with only the grounded
  v5 base lifecycle and links to the deferred deep skills.
- Created `.agents/skills/generate-game-kb-v5/prompts/extract-chapters.md` with
  chapter-local YAML, quote, local-key, and named-technique constraints.
- Modified `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`
  with `PROFILE_V4`, `PROFILE_V5`, and supported-profile metadata.
- Modified `.agents/skills/generate-game-kb/scripts/lib/run.js` to normalize
  profile options, persist profile metadata, and reject profile-mismatched
  writes with `PROFILE_MISMATCH`.
- Modified `.agents/skills/generate-game-kb/scripts/flow.js` with v5 command
  aliases (`v5-prepare`, `v5-accept`, `v5-basic-curate`, `v5-publish`, and
  `v5-status`), profile-aware run resolution, and v5 status routing that does
  not return `plan-domains`.
- Added `.agents/skills/generate-game-kb/tests/v5-skill-contract.test.js`.
- Added `.agents/skills/generate-game-kb/tests/v5-cli-contract.test.js`.

Existing Task 7 files, `package-lock.json`, `.trellis/tasks`, and
`.trellis/workspace` changes were left untouched and unstaged.

## TDD Evidence

Initial RED command:

```text
node --test .agents/skills/generate-game-kb/tests/v5-skill-contract.test.js .agents/skills/generate-game-kb/tests/v5-cli-contract.test.js
```

Result: exit 1; 5 tests, 0 passed, 5 failed. The expected failures included
`COMMAND_UNKNOWN` for `v5-prepare`, missing v5 skill files, and the absence of
profile mismatch enforcement.

Final focused GREEN command:

```text
node --test .agents/skills/generate-game-kb/tests/v5-skill-contract.test.js .agents/skills/generate-game-kb/tests/v5-cli-contract.test.js
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
  .agents/skills/generate-game-kb/tests/v5-skill-contract.test.js \
  .agents/skills/generate-game-kb/tests/v5-cli-contract.test.js \
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

- `v5-publish` is a profile-routed entry point to the existing assembly
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

The implementation is committed as the independent
`feat: add isolated generate-game-kb-v5 skill` change.
