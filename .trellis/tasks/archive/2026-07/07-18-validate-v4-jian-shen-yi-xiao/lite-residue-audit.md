# Lite Migration V5 Residue Audit

## Decision

`Lite` is the only current lightweight product, Skill, CLI prefix, writable
profile, test, task, and documentation label. A V5 token may remain only when
it identifies immutable semantic-contract version 5 evidence, a read-only
legacy input, a negative assertion, or this audit record.

## Final Recheck

- Current runtime/CLI product residue: **0**.
- Current Lite/deep Skill product residue: **0**.
- Product-oriented residue in tracked plans, reports, task links, and session
  titles: **0**.
- Old product directories: **0**.
- After excluding the two audit records, two user-owned files, package-lock/hash
  substrings, and the `Lv5` level marker, the expanded scan (raw V5 substrings,
  `version[ -]5`, and explicit `semantic_contract_version: 5`) finds 15 files
  and 69 matching lines. Every in-scope match is an explicit compatibility,
  negative-guard, or immutable-evidence case.

The executable gate
`.agents/skills/generate-game-kb/tests/lite-residue-contract.test.js` passes
4/4 checks covering paths, runtime commands/symbols, the unique Lite Skill,
historical product narratives, archived task links, and Trellis session titles.

## Completed Migration

- `generate-game-kb-v5` became `generate-game-kb-lite`.
- Public `v5-*` routes became their `lite-*` counterparts.
- New writable runs use `profile: lite`; only `LEGACY_PROFILE_V5 = 'v5'`
  recognizes stored read-only input.
- V5-named tests, helpers, archived tasks, plans, reports, and task references
  were renamed to Lite.
- Lite uses semantic contract version 6, derived from the verified V4 contract.

## Intentional V5 Matches

- Four runtime files, 14 lines: read-only legacy profile recognition,
  migration, and write rejection.
- Five test files, 32 lines: removed-command guards, legacy-profile rejection,
  compatibility migration, and real V5-to-V6 chapter import evidence.
- Six archived-plan/spec/task/journal files, 23 lines: semantic-contract version 5 source
  shape, controlled import, and immutable old-run facts.

The most important immutable evidence is retained at:

- `.trellis/spec/backend/quality-guidelines.md:259,275`
- Current task `design.md:97`
- Current task `implement.md:7,217,218`
- `.trellis/workspace/jbts6/journal-1.md:58`

Changing those facts to Lite would falsify the imported run version, source
shape, or unchanged-tree-hash evidence.

## Exclusions

- This English audit and its Chinese counterpart quote removed names as audit
  evidence.
- `dashboard/package-lock.json` matches are integrity/hash substrings.
- `Lv5` in the May pipeline design means level 5.
- `.workbuddy/memory/2026-07-19.md` and
  `docs/wuxia-kb-build-priority.md` are user-owned untracked files. The final
  sweep corrected only five stale product labels/commands and left both files
  untracked and uncommitted.
- Ignored SDD task briefs/reports and review diffs are historical snapshots and
  were not modified.
- Thirteen version-5 contract fields inside the real ignored Jian Shen Yi Xiao
  legacy run are immutable evidence and were not modified.

## Completion Gate

The migration is complete when no current product path, public command,
writable profile, current runtime symbol, test path, task link, or narrative
uses V5; the residue test passes; and every remaining lexical match is an
allowlisted compatibility fact, negative assertion, audit quote, or false
positive. The current worktree satisfies that gate.
