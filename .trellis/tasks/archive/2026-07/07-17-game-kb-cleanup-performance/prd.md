# Remove legacy flow and optimize runtime

## Goal

Make the verified v4 path the only writable `generate-game-kb` workflow, remove superseded AI and projection stages, and keep a representative 20-21 chapter run within the 45-minute target without weakening deterministic verification.

## Background

- The YAML baseline, single `assemble`/`verify` boundary, atomic five-file install, and Dashboard migration are already implemented by sibling tasks.
- The controller still exposes the old merge/clean/build, coverage/recall/supplement, quality-sample, game-material, and format-conversion surfaces. Those paths account for the remaining legacy test failures and duplicate work already owned by `assemble` and `verify`.
- `createDomainWorkPlan` already creates stable registry-backed inputs for all four domains, and assembly resolves late-bound references only after every domain decision is accepted. The documented factions-first runtime dependency is therefore obsolete.

## Requirements

### R1. One writable lifecycle

- The only normal stage order is `prepare -> chapter accepts -> plan-domains -> four domain accepts -> assemble -> verify -> install -> archive-run`.
- Remove controller routes, production dependencies, prompts, paths, reports, and tests owned only by merge/clean/build, coverage/recall/supplement, quality sampling, game-material projection, removed categories, or YAML conversion.
- Retained modules must expose only v4 responsibilities; keeping an old module reachable under a new command name does not satisfy this requirement.

### R2. Two-submission AI budget

- Every chapter or domain AI unit receives at most two validated submissions: the initial draft and one validator-guided correction.
- YAML parse and semantic errors share the same budget. Repeated output, repeated validation errors, or a failed second submission moves the unit to `manual_review`.
- Wrong paths, missing drafts, symlink escapes, controller failures, and transport failures do not consume the AI submission budget.
- Remove `semantic_attempts`, `format_attempts`, targeted-recall budgets, and separate format-repair accounting from active v4 state and reports.

### R3. Deterministic recovery

- `status --json` returns exactly one deterministic `next_action` enum for the selected run: `accept-chapters`, `plan-domains`, `accept-domains`, `assemble`, `verify`, `install`, `archive-run`, or `manual-review`.
- When an action operates on AI units, the report also returns stable `next_units`; chapter order is numeric and domain order is `factions`, `characters`, `skills`, `items`.
- Manual review takes precedence over all executable actions. Hash-bound assembly, verification, and install artifacts decide later lifecycle actions; status never mutates state.

### R4. Four-domain parallelism

- All four registry-backed domain work items are independent and may be processed concurrently.
- Characters and skills keep late-bound faction references; the deterministic assembler resolves faction aliases/merges only after all four decisions exist.
- Concurrent completion order cannot affect accepted hashes, stable IDs, final YAML bytes, or `next_units` ordering.

### R5. Preserved safeguards and timing evidence

- Preserve source/input hash binding, accepted immutability, candidate closure, stable IDs, final reference closure, run isolation, atomic installation, receipts, rollback, full-run archive, and installed verification without workspace fallback.
- Chapter workers start and remain at concurrency `5` unless an explicit 429 batch falls back `5 -> 3`; a second distinct 429 at fallback `3` halts the pool, and transport failures consume no AI submission.
- Run metrics contain only current v4 phases and AI unit types, and a checked representative 20-21 chapter timing scenario must remain at or below 45 minutes.

## Acceptance Criteria

- [x] A production dependency test proves every removed command, module, prompt, report path, and conversion script is absent or unreachable.
- [x] The CLI rejects removed commands, and the three-chapter integration path invokes only the R1 lifecycle.
- [x] Attempt-budget tests cover valid first submission, one correction, repeated output/error, second failure, path rejection, reload/resume, reset, and transport backoff.
- [x] `status --json` recovery tests cover every lifecycle interruption point, stable concurrent-domain ordering, stale artifacts, and manual review.
- [x] Four-domain work produces byte-identical final YAML for different acceptance completion orders.
- [x] All production JavaScript passes syntax checks and the complete `generate-game-kb` test suite passes with no legacy-category or legacy-command expectations.
- [x] Representative timing evidence records at most two submissions per AI unit and a total at or below 45 minutes while all v4 verification/install gates remain enabled.
- [x] `CLAUDE.md` is unchanged; implementation remains uncommitted and unarchived unless the user later authorizes those actions.

## Out Of Scope

- Changing the comprehensive `generate-kb` workflow.
- Adding JSON/YAML dual-read compatibility or upgrading legacy runs in place.
- Removing deterministic safeguards solely to improve runtime.
- Dashboard bundle splitting or unrelated UI cleanup.
