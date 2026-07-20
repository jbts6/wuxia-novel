# Verification

## Scope

Verified branch `feature/recover-lite-worker-guard` after these implementation
commits:

- `880260c4` `fix(game-kb): unblock remediated worker guard directories`
- `85754b91` `docs(game-kb): require read-only Claude chapter workflow`
- `93ad659c` `fix(game-kb): restore Lite candidate registry planning`
- `97c1e6c6` `feat(game-kb): extend canonical item types`

No installed or archived White Horse product file was edited. The new item enum
applies to future runs only.

## Automated Results

| Check | Result |
| --- | --- |
| Worker guard focused suite | 37 tests, 37 passed |
| Lite worker safety plus next-action regressions | 29 tests, 29 passed |
| Workflow Skill contracts | 16 tests, 16 passed |
| Lite CLI and status routing | 25 tests, 25 passed |
| Item enum, legacy mapping, verification, and Skill contracts | 32 tests, 32 passed |
| All non-fixture `generate-game-kb` tests | 58 files, 537 tests, 537 passed |
| Complete `generate-game-kb` suite | 59 files, 541 tests, 538 passed, 3 known fixture failures |
| Lite Skill `quick_validate.py` | `Skill is valid!` |
| V4 Skill `quick_validate.py` | `Skill is valid!` |
| `git diff --check` | Passed |

The complete suite used:

```text
node --test ".agents/skills/generate-game-kb/tests/*.test.js"
```

The green non-fixture pass enumerated all `*.test.js` files except
`chapter-import.test.js` and executed them in one Node test run.

## Known Fixture Failures

The three failures are all in `chapter-import.test.js`:

- `import-chapters converts the real 20-chapter v5 run into a fresh v6 run`
- `import-chapters rolls back all target bytes after an injected write failure`
- `import-chapters rejects malformed target progress without repairing target bytes`

All three stop at the same pre-existing real-fixture source check:

```text
CHAPTER_IMPORT_SOURCE_CHANGED
expected sha256:e22d8017ed92b999a2da0f5fbb4ac063b318b13a55918d8a9f12f041e0d04c36
actual   sha256:0e2caceb3e511ba5d78f82a7b4e3f823fd9569f9bffcc68a05fbd09153d859e8
```

The ignored real run fixture binds an absolute path in the main workspace to an
older source hash. It was absent from the isolated worktree at baseline; copying
it made the path/hash mismatch observable. The task does not alter the fixture,
the main-workspace novel source, or the import implementation. The other 537
tests pass together.

## White Horse Read-Only Verification

Installed verification against `C:\git\wuxia-novel\金庸\白马啸西风` passed:

```text
final_data_hash: sha256:f1fa45d379f9d2ca01db19c4a851a6cacf34e86b8eea4cb2d539187d91b41ecb
characters: 4
skills: 1
items: 2
factions: 1
chapter_summaries: 1
```

Installed and archived product bytes are identical:

| File | SHA-256 |
| --- | --- |
| `characters.yaml` | `02439e267d706b349470feeefda0a6a62baefbbf32e2a24febe7cdbd9f34f55e` |
| `skills.yaml` | `c6f4a4e562899f98f8db6acff6a71a1aa5c229c245bf14734590551a719e73ef` |
| `items.yaml` | `9118c3ece31efdaac42d4c5fd9faa771aabc32f197fbd86ad290533cfe497d81` |
| `factions.yaml` | `f10014b34af5bca53b89569c0ecd8b240a33a60496cf86b7af19434f9268accb` |
| `chapter_summaries.yaml` | `2d47dded3fa2c0734968523c47d0e08b04c943b437362300763a929a27a856c1` |

Rebuilding the archived candidate registry from accepted chapter YAML produced
the same hash as the stored registry:

```text
sha256:f45df18361c68b6eeab9e1503e5af58e369867faa817f51f17955758075495db
```

The original interrupted run `run-bai-ma-xiao-xi-feng-lite` now reports
`next_action: accept-chapters`, not `worker-write-review`. Its immutable guard
receipts and progress were not changed.

## Acceptance Review

- Existing-directory size/mtime-only changes are ignored, while file and
  directory add/delete/type changes remain guarded.
- Status and broker submission use the same dynamic unresolved-violation rule;
  check receipt bytes remain immutable.
- Claude chapter execution is mandatory even for one chapter, generic
  `Agent/Task` fallback and main-session extraction are forbidden, and workflow
  failures stop without envelope repair or filesystem handoff.
- Lite status returns `lite-plan-domains` before registry creation and
  `lite-publish` only after the controller-owned plan exists; no full-book domain
  worker is dispatched for Lite.
- Canonical item types include `坐骑`, `异兽`, and `饰品`; unknown values still
  fail final verification.

