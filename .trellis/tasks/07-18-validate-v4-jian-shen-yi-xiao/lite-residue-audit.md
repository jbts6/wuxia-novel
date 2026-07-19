# Lite Migration V5 Residue Audit

## Decision

`Lite` is the only current lightweight product name, Skill name, CLI prefix,
profile value, runtime helper name, test name, and documentation label.

`v5` may remain only when it identifies immutable semantic-contract version 5
evidence or an explicit legacy-input compatibility boundary. It must not remain
as a public command alias, writable profile, new run label, or current Skill
name.

## Current Worktree Recheck

The recheck scans tracked files plus non-ignored worktree additions. It does not
treat every lexical `v5` match as product residue.

| Scope | Classification | Files | Matching lines | Occurrences | Action |
| --- | --- | ---: | ---: | ---: | --- |
| `.agents/skills/generate-game-kb*` | Obsolete Lite-product residue | 17 | 92 | 104 | Rename or replace; includes all three V5 path hits |
| `.agents/skills/generate-game-kb*` | Intentional compatibility/evidence | 5 | 26 | 31 | Keep under an explicit test allowlist |
| Tracked task/spec/history outside those Skills | Mixed product/history contract | 19 | occurrence-level | occurrence-level | Rewrite only product meanings; preserve immutable version-5 facts |
| Tracked lexical false positives | Incidental | 2 | 26 | 26 | Ignore (`package-lock` hashes and `Lv5` meaning level 5) |
| Untracked user-owned files | Out of scope | 2 | 5 | 6 | Do not edit without separate scope |

The 17 obsolete active files are six runtime files, the three files in the
candidate lightweight Skill, and eight English/Chinese deep-Skill documents.
The five intentional test files are `chapter-import.test.js`,
`lite-cli-contract.test.js`, `lite-residue-contract.test.js`,
`lite-skill-contract.test.js`, and `semantic-contract.test.js`.

The current Lite prompt's `semantic_contract_version: 5` is obsolete even
though that line does not contain the token `v5`; it must become version 6.
Conversely, version 5 in `import-chapters` source-run evidence is immutable and
must remain version 5.

## Pre-Migration Tracked Repository Scan

The initial audit scanned all 2,952 Git-tracked paths and every tracked text
line before the test files were renamed in the worktree. These numbers are a
baseline, not the current worktree inventory.

| Scope | Files | Matching lines | Action |
| --- | ---: | ---: | --- |
| Active Skill/runtime/test surface | 26 | 138 | Rename or replace with Lite, except explicit legacy-input checks |
| Current Trellis task | 4 | 32 | Rewrite lightweight-product references to Lite; retain semantic-version-5 migration facts |
| Active backend spec | 1 | 3 | Rewrite lightweight-product reference; retain semantic-version-5 migration facts |
| Journal/history index | 2 | 5 | Preserve facts about the immutable old run; label the derived product Lite where applicable |
| Archived design/task history | 13 | 153 | Rename lightweight-product paths and terminology to Lite; retain true semantic-version-5 facts |

## Active Paths That Must Be Renamed

- `.agents/skills/generate-game-kb-v5/` to
  `.agents/skills/generate-game-kb-lite/`
- `.agents/skills/generate-game-kb/tests/v5-cli-contract.test.js` to
  `lite-cli-contract.test.js`
- `.agents/skills/generate-game-kb/tests/v5-published-helper.js` to
  `lite-published-helper.js`
- `.agents/skills/generate-game-kb/tests/v5-skill-contract.test.js` to
  `lite-skill-contract.test.js`
- `.trellis/tasks/archive/2026-07/07-18-game-kb-v5-skill-contracts/` to a
  corresponding `...-lite-skill-contracts/` archive path.

## Active Content That Must Become Lite

- Public CLI routes: `v5-prepare`, `v5-status`, `v5-accept`,
  `v5-basic-curate`, and `v5-publish`.
- Writable profile and runtime symbols: `profile: v5`, `PROFILE_V5`,
  `resolvePublishedV5Paths`, `assembleRunV5`, `verifyFinalV5`, V5-named
  published-run helpers, and overlay or verification receipts that write
  `profile: v5`.
- The lightweight Skill frontmatter, prompt heading, English/Chinese docs,
  real command examples, deep-Skill prerequisites, tests, fixtures, current
  Task 8 wording, active spec wording, and product-oriented historical plans.
- The chapter prompt's stale `semantic_contract_version: 5`; Lite derives from
  the proven V4 contract and therefore uses semantic contract version 6.

No `v5-*` public compatibility aliases will remain. New runs persist
`profile: lite`. Legacy `profile: v5` is accepted only as stored input at the
compatibility boundary and is normalized to Lite by current code.

## V5 Text That Must Remain Historically Accurate

- `semantic_contract_version: 5` and “version-5” references that identify the
  immutable source run used by `import-chapters`.
- Migration tests, receipts, and audit statements proving that old accepted
  version-5 chapters were read without modifying the old run.
- Stored legacy `profile: v5` fixtures used only to prove compatibility input
  normalization. These tests must also prove that no new run can persist that
  profile.
- Journal evidence recording the old run's unchanged file count and tree hash.

The active compatibility constant is named `LEGACY_PROFILE_V5`; the obsolete
current-profile symbol `PROFILE_V5` must not survive.

Changing these facts to Lite would falsify historical evidence or break
receipt/hash meaning, so they are compatibility exceptions rather than naming
residue.

## Historical And Scan Exceptions

- Rename the archived lightweight-product task directory
  `.trellis/tasks/archive/2026-07/07-18-game-kb-v5-skill-contracts/` to the
  corresponding Lite path. Update both its inbound archived `task.json`
  reference and the current task's `implement.jsonl` reference.
- Rewrite product meanings in the current task, active backend spec,
  `.superpowers` report, Superpowers plans/spec, and journal titles. Files that
  also contain immutable migration evidence require occurrence-level edits.
- Ignore `dashboard/package-lock.json` integrity/hash substrings and the `Lv5`
  level marker in the May pipeline design. They are not product names.
- Exclude ignored/generated dependency and build trees from the gate.
- Preserve the unrelated untracked `.workbuddy/memory/2026-07-19.md` and
  `docs/wuxia-kb-build-priority.md` files.
- This audit is an intentional pre-migration record and may quote removed
  product tokens. It is not a shipped Skill, CLI, runtime symbol, or profile.

## Completion Gate

After migration, a tracked-plus-worktree scan must find no
`generate-game-kb-v5` product path, no `v5-*` public command, no `PROFILE_V5`
current runtime symbol, and no newly written `profile: v5`. Every remaining
runtime/test `v5` occurrence must be allowlisted as immutable
semantic-version-5 evidence, legacy-input compatibility, or a negative guard.
The scan must separately exclude ignored/generated dependencies, lexical hash
false positives, the `Lv5` level marker, unrelated untracked user content, and
this audit's quoted removal record.
