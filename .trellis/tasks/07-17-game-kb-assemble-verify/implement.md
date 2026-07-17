# Build Single Assemble and Verify Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v4 normal-path merge/clean/build chain with deterministic `assemble` and authoritative workspace/installed verification.

**Architecture:** A new `lib/assemble.js` consumes accepted chapter/domain evidence and projects five YAML files once. `verify.js` separates portable five-file validation from run-scoped evidence validation, while `install.js` preserves atomic backup/swap recovery and binds installed bytes to the verified hash.

**Tech Stack:** Node.js CommonJS, `node:test`, `js-yaml`, SHA-256 controller receipts, Trellis Markdown specs.

## Global Constraints

- Do not restore `locations`, `dialogues`, `events`, or a top-level `techniques` category.
- Do not add JSON/YAML dual reads or old-domain aliases.
- Keep AI/accepted/final artifacts YAML and controller state/reports JSON.
- Do not add `source_refs` to the simplified final consumer fields; verify evidence from accepted artifacts.
- Preserve accepted-artifact hash checks, bounded attempts, run isolation, legacy fail-closed behavior, and atomic installation recovery.
- Do not modify `CLAUDE.md`.
- Do not commit, merge, or push; this explicit user constraint overrides generic per-task commit steps.

---

### Task 1: Lock The V4 Assembly Contract With Failing Tests

**Files:**
- Create: `.agents/skills/generate-game-kb/tests/assemble.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/domain-flow.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/helpers.js`

**Interfaces:**
- Consumes: `validChapterDraft`, `writeStagingDraft`, four `DOMAIN_UNITS`.
- Produces: tests for `assembleRun({ paths })` and the `plan-domains` / `assemble` CLI commands.

- [x] Add a fixture that prepares three chapters, accepts their YAML drafts, creates four domain decisions, and invokes `assemble` without clean/build commands.
- [x] Assert exact output filenames from `FINAL_FILES`, byte-identical results after a second assemble, and an `assembly-report.json` whose final hash matches the written YAML.
- [x] Add negative cases for missing decision, pending decision, merge cycle, mutated accepted chapter, and unresolved final reference.
- [x] Run `rtk node --test .agents/skills/generate-game-kb/tests/assemble.test.js` and confirm RED because `assembleRun` / `assemble` do not exist.

Expected test shape:

```js
const first = pass(runFlow(['assemble', novel, '--run', prepared.run_id, '--json']));
const bytes = readFinalYamlBytes(paths.finalData);
const second = pass(runFlow(['assemble', novel, '--run', prepared.run_id, '--json']));
assert.deepEqual(readFinalYamlBytes(paths.finalData), bytes);
assert.equal(second.final_data_hash, first.final_data_hash);
```

### Task 2: Implement One Deterministic Assembly Boundary

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/assemble.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-assembly.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/finalize.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`

**Interfaces:**
- Consumes: `assembleDomainMergedBook(...)`, `buildFinalData(book, manifest)`, accepted artifact hashes, and four domain decisions.
- Produces: `assembleRun({ paths }) -> { final_data_hash, counts, data_dir, report }` and `writeFinalDataAtomic(paths, result)`.

- [x] Move the four-category decision expansion behind a pure assembly function and validate exact `DOMAIN_UNITS`; keep the old cleaned-book export only until cleanup.
- [x] Make chapter summaries project only `{ chapter, title, summary }` while retaining accepted summary evidence for verification.
- [x] Change final projection input validation from the old nine-category cleaned-book contract to the v4 four-category assembled contract.
- [x] Implement a sibling `data.next-*` write, five-file validation, directory rename, and rollback so a failed write cannot partially replace `final/data`.
- [x] Write the deterministic controller report:

```js
{
  schema_version: 1,
  semantic_contract_version: 4,
  source_hash: manifest.source_hash,
  accepted_hashes,
  decision_hashes,
  candidate_count,
  candidate_resolution_count,
  final_data_hash,
  counts,
  warnings
}
```

- [x] Add `plan-domains` as the non-semantic normal spelling for current domain work-plan creation and add `assemble` routing. Keep `prepare-merge` only as a temporary deprecated entry for the later cleanup child.
- [x] Run the Task 1 tests and require GREEN.

### Task 3: Replace Legacy Report Gates With V4 Verification

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/verify.js`
- Create: `.agents/skills/generate-game-kb/tests/verify-v4.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`

**Interfaces:**
- Produces: `verifyDataRoot(dataRoot, { chapters, expectedHash })` and `verifyFinal(paths)`.
- `verifyDataRoot` returns `{ passed, final_data_hash, counts, blocking_errors, warnings }` without reading run-only files.
- `verifyFinal` adds accepted-evidence and assembly-report checks to the same result shape.

- [x] Write RED tests for exact final fields, missing/malformed YAML, invalid IDs/enums, duplicate/missing summaries, nested technique names, and unresolved character/skill/faction/item references.
- [x] Write RED workspace tests for missing/mutated accepted chapters, invalid chapter/domain source evidence, incomplete candidate decisions, ordinary-item keeps, stale assembly report hash, and unresolved manual review.
- [x] Remove quality-sample, quantity-report, and game-material requirements from the v4 verification path.
- [x] Validate final fields using `FINAL_FIELDS`, ranks using `POWER_RANKS`, levels using `CHARACTER_LEVELS`, and item types using `ITEM_TYPES`.
- [x] Persist `final/reports/verification-report.json` only after a passing workspace verification; a verifier does not alter final semantic data.
- [x] Run `rtk node --test .agents/skills/generate-game-kb/tests/verify-v4.test.js .agents/skills/generate-game-kb/tests/assemble.test.js` and require GREEN.

### Task 4: Bind Atomic Installation To The Five-File Gate

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/install.js`
- Create: `.agents/skills/generate-game-kb/tests/install-v4.test.js`

**Interfaces:**
- Consumes: `verifyFinal(workPaths)` before installation and `verifyDataRoot(installed.data, ...)` during staging/post-swap/installed checks.
- Produces: install receipt binding semantic version, source hash, five YAML filenames, final hash, verification-report hash, chapter list, and backup location.

- [x] Add RED tests for five-file install, installed hash mismatch, missing receipt, idempotent reinstall, pre-move failure, post-move rollback, and `verify --installed` not falling back to workspace data.
- [x] Replace quality/game-material report dependencies with `verification-report.json`.
- [x] Copy only `DATA_FILES` into the staged next directory; archive the previous whole data directory rather than preserving old JSON inside the new dataset.
- [x] Keep pending-receipt path validation and all existing fault-injection recovery points.
- [x] Run `rtk node --test .agents/skills/generate-game-kb/tests/install-v4.test.js` and require GREEN.

### Task 5: Prove The Three-Chapter Normal Path

**Files:**
- Create: `.agents/skills/generate-game-kb/tests/assemble-flow.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/schemas.md`
- Modify: `.trellis/spec/backend/quality-guidelines.md`

**Interfaces:**
- Exercises: `prepare -> chapter accepts -> plan-domains -> four domain accepts -> assemble -> verify -> install -> verify --installed`.

- [x] Add a three-chapter fixture with character/skill/item/faction merges, one nested named technique, one rejected ordinary item, and closed final references.
- [x] Assert no normal-path invocation of `assemble-merge`, `prepare-clean`, `assemble-clean`, `build-final`, recall/supplement, quality sampling, or game-material projection.
- [x] Align Skill, schemas, and the fast-profile spec with the new command and evidence boundaries; leave wholesale legacy-module deletion to cleanup.
- [x] Run the flow and Skill contract tests and require GREEN.

### Task 6: Assemble/Verify Quality Gate

- [x] Run `rtk node --check` for every production JavaScript file and require 0 failures.
- [x] Run the focused v4 test set and record exact pass/fail counts.
- [x] Run the complete generate-game-kb test set, classify remaining failures against the dashboard/cleanup children, and fix any failure owned by this child.
- [x] Run `rtk git diff --check HEAD` and verify `CLAUDE.md` is unchanged.
- [x] Append verification evidence and remaining later-child ownership to the Trellis journal.
