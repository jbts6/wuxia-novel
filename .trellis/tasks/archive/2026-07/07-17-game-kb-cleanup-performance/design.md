# Remove legacy flow and optimize runtime - Design

## Decision

Delete the superseded workflow instead of preserving diagnostic write paths. Keep the v4 evidence and installation boundaries, reduce every AI unit to two validator-observed submissions, derive one lifecycle action from durable state, and allow all four domain units to run concurrently because their inputs are registry-bound and their cross-domain references are late-bound until assembly.

## Boundaries

### Controller lifecycle

`flow.js` remains the only writable controller and routes only preparation, worker backoff, status/reset/accept, domain planning, assembly, verification, installation, and archival. The compatibility routes `prepare-merge`, `assemble-merge`, `prepare-clean`, `assemble-clean`, `build-final`, `check-coverage`, and `check-resolution` are removed rather than aliased.

The active path is:

```text
prepare
  -> accept chapter:* (parallel worker pool, 5 -> 3 on first 429)
  -> plan-domains
  -> accept distill:{factions,characters,skills,items} (parallel)
  -> assemble
  -> verify
  -> install
  -> archive-run
```

### Attempt state

`progress.js` has one counter, `attempts`, for validator-observed AI submissions. `recordSubmission` moves a failing first submission to `pending`; the second failure, repeated output, or repeated error fingerprint moves it to `manual_review`. A successful first or second submission moves it to `done`. Path and transport validation happen before `recordSubmission`, so those failures cannot spend the budget.

Targeted recall/supplement units and their special semantic/format counters are deleted. Existing semantic v4 runs are not upgraded in place; the established semantic-version write guard continues to reject legacy state.

### Status recovery contract

A focused lifecycle resolver consumes `paths`, `manifest`, `progress`, current assembly/verification evidence, and the installed receipt result. It returns:

```text
next_action: accept-chapters | plan-domains | accept-domains | assemble |
             verify | install | archive-run | manual-review
next_units:  [] | [stable unit names]
```

Precedence is manual review, unfinished chapters, missing domain plan, unfinished domains, missing/stale assembly, missing/stale verification, missing/mismatched installation, then archive. The resolver is pure and `status` stays observational. `next_units` may contain several units, but `next_action` is always one phase action.

### Domain concurrency

`plan-domains` writes all four work items from the same candidate registry and accepted chapter hash set. No domain input includes another domain's accepted output. Faction references in character/skill decisions remain registry refs until `assemble`, where alias and merge resolution is applied once. Stable reporting order remains factions, characters, skills, items regardless of completion order.

### Legacy deletion

Delete the old merge/clean, coverage/gap, recall/supplement, quality, game-material, quantity/priority, and YAML-conversion modules and prompts after their remaining v4 helpers are moved into focused owners. In particular:

- move stable local-key assignment into `domain-assembly.js`, then remove `book-assembly.js`;
- retain accepted-artifact hashing/writes in `candidate-ledger.js`, but remove old candidate-ledger/clean replacement behavior and its coverage dependency;
- retain the generic domain work-plan store in `semantic-work.js`, but remove merge/clean/material work builders;
- remove old unit contexts from `accept.js`, old directories/reports from `paths.js` and `run.js`, and old phase/accounting fields from `timing.js`.

A dependency contract test scans production entry points and fails if deleted filenames, commands, removed category concepts, or normal-path report names return.

## Data Flow

```text
source chapters
  -> accepted chapter YAML + artifact hashes
  -> candidate registry + four independent domain work items
  -> accepted domain decision YAML + artifact hashes
  -> deterministic assemble -> five YAML + assembly report
  -> deterministic verify -> verification report
  -> atomic install -> install receipt
  -> complete run archive + v4 run metrics
```

No recall, supplement, format-conversion, quality-sample, or secondary game-material data enters this flow.

## Failure And Recovery

- A failed validator submission preserves its archived draft and exact structured errors.
- The second failed submission or repeated output/error requires explicit manual review/reset.
- Invalid staging paths and symlink escapes fail before progress changes.
- Stale accepted bytes, assembly reports, verification reports, or install receipts move `next_action` back to their authoritative rebuild/recheck boundary.
- Assembly and installation retain sibling-directory writes and rollback; cleanup does not weaken either mechanism.
- Without a 429 the chapter pool remains at five. The first explicit 429 batch records one incident and reduces `5 -> 3` without changing unit attempts; a second distinct 429 at fallback three persists a halt and reports external rate limiting.

## Timing Evidence

`run-metrics.json` reports only prepare, chapter extraction, domain distillation, assemble, verify, install, archive, script, human-wait, and total duration. AI workload metrics report planned/done/attempt counts and corrections for chapter/domain units only. A representative 20-21 chapter fixture uses persisted timestamps and the real metrics builder to prove the 45-minute budget; it is evidence of the orchestration budget, not a substitute for source/evidence validation, which remains covered by the three-chapter integration test.

## Testing

- TDD at each boundary: attempt state, lifecycle resolver, removed route/dependency contract, domain completion-order determinism, and timing metrics.
- Preserve the existing v4 assembly, verification, installation, immutability, run isolation, archive, and worker-pool suites.
- Delete legacy-only tests and rewrite mixed suites around the one v4 path; do not leave skipped compatibility expectations.
- Finish with syntax checks, the complete skill suite, the installer regression, dependency scans, `git diff --check`, and an independent final review.

## Rollback Shape

All work remains in the isolated worktree. File deletion and retained-module pruning are separate reviewable tasks, so a failing task can be reverted without touching accepted/final/install safeguards. No commit, merge, push, or task archive occurs without later user authorization.
