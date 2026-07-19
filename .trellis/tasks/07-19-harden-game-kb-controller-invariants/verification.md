# Controller Invariants Verification — 2026-07-19 (Repair)

## Verdict

**Accepted.** Repair plan tasks 1–6 complete. All blockers resolved.

## Fresh verification evidence

- Focused controller safety suite: 143 tests across 11 files, exit `0`, fail `0`, duration `11536.9025 ms`.
- Complete game-KB suite: 463 tests across 51 files, exit `0`, fail `0`, duration `64553.9209 ms`.
- Legacy artifact immutability probe: 76 JSON-as-YAML accepted artifacts unchanged; aggregate SHA-256 before and after is `06625733587e5f880c595ed3f87549d18505fd4d693832a415b4b58f69b965e6`.
- `git diff --check`: exit `0`; `node --check` passed for all 13 changed JavaScript files.
- Added-line scan found no TODO/FIXME, skipped tests, debug logging, debugger statements, or warning/type suppressions.
- No repository lint or type-check command applies at the root; the Node suite imports and executes the changed CommonJS modules.

## Blocker resolution

### 1. Crash-safe replay — RESOLVED

**Tests:** `draft-submission.test.js` — fault injection at `staging-written`, `submission-recorded`, `accepted-written`. Each throws `SUBMISSION_FAULT_INJECTED` on first call, resumes to terminal result on replay.

**Implementation:**
- `submission-journal.js` — append-only journal with `binding.json`, phase files, `result.json`.
- `draft-submission.js` — journal binding before content parsing, `faultAt` parameter, phase replay.
- `accept.js` — `commitSubmission()` with checkpoint callbacks, idempotent archive/record writes.

### 2. Malformed submissions consume attempt — RESOLVED

**Tests:** `draft-submission.test.js` — malformed JSON test asserts `DRAFT_REJECTED` with `attempts: 1`.

**Implementation:**
- `draft-submission.js` — malformed JSON routes through `commitSubmission()` with `prevalidationErrors`, consuming one attempt.
- `accept.js` — `commitSubmission()` evaluates draft unless `prevalidationErrors` is supplied.

### 3. UTF-8 byte counting — RESOLVED

**Tests:** `draft-submission.test.js` — UTF-8 oversized test with 3-byte Chinese chars exceeding 10 MiB.

**Implementation:**
- `draft-submission.js` — `Buffer.byteLength(rawInput, 'utf8')` instead of `rawInput.length`.

### 4. CLI guard coverage and ordering — RESOLVED

**Tests:** `worker-guard.test.js` — sibling rogue path detection, `repository_root` verification, `assertCleanGuardForSubmission` error paths. `lite-cli-contract.test.js` — `--guard-id` required.

**Implementation:**
- `paths.js` — `repositoryRootFor(novelDir)` walks parents to find `.git`.
- `worker-guard.js` — `assertCleanGuardForSubmission()` verifies clean guard receipt and submission identity.
- `flow.js` — `guard-open`/`guard-check` use `repositoryRootFor()`, `submit-draft` requires `--guard-id` and calls `assertCleanGuardForSubmission()`.

### 5. Recovery safety — RESOLVED

**Tests:** `draft-preflight.test.js` — symlink rejection, cross-run rejection. `draft-recovery.test.js` — symlink rejection, current attempt derivation, shared-transaction routing, guard-discovery binding, accepted-written crash replay, immutable transaction time, and mutated-archive rejection.

**Implementation:**
- `draft-preflight.js` — `assertSafeSource()` with `lstatSync`/`realpathSync` checks.
- `draft-recovery.js` — `assertSafeRecoverySource()`, current attempt from progress, immutable recovery binding/result/receipt, and direct `commitSubmission()` replay with the binding timestamp.
- `flow.js` — `recover-draft` requires `--guard-id` and `--confirm`.

## Additional improvements

- `io.js` — `writeImmutableFile()`, `writeImmutableJson()` write-once helpers.
- `progress.js` — `recordSubmission()` supports `submissionId` and `attempt` for idempotency.
- `candidate-ledger.js` — `ensureAcceptedArtifact()` crash recovery reconciliation.
- `next-action.js` — `resume-draft-submission` next action for interrupted journals.
- `accept.js` — `commitSubmission()` extracted as reusable transaction, `acceptDraft()` preserved as wrapper.

## Additional fixes from review

- Worker-visible status now applies `workerProjection()` to strip `staging_path` from `chapter_jobs`.
- `resolveNextAction()` checks `unresolvedWorkerGuardReports()` before manual-review, returning `worker-write-review` when violations exist.
- Recovery requires a valid guard ID with unresolved violations containing the exact source path.
- Recovery uses `repositoryRootFor(novelDir)` for the real Git root.
- Recovery receipt uses `writeImmutableJson()` and is only written after successful acceptance.
- Recovery checks `UNIT_ALREADY_DONE` and `UNIT_MANUAL_REVIEW` before writing anything.
- Fault injection covers all 4 phases: `binding`, `staging-written`, `submission-recorded`, `accepted-written`.
- Worker-visible projection is fail closed; projection errors cannot return the controller-internal job.
- Unresolved guard reports block status dispatch, assembly, publication, installation, and workspace verification.
- Guard open receipts retain the complete submission identity list; immutable check receipts bind the open-receipt hash and real repository root.
- Broker journal bindings persist the guard ID plus both immutable guard receipt hashes, and direct unguarded broker calls fail before mutation.
- Guard open/check reads share one fail-closed decoder; malformed JSON, invalid receipt schema, orphan checks, and narrow non-Git-root proofs raise `GUARD_PROOF_MISMATCH`.
- Journal status and replay share one decoder that validates binding schema, directory identity, durable phase order, cross-phase identity, and terminal results.
- Existing journal phases, archives, and submission records are content-checked instead of skipped; a conflicting replay returns the immutable conflict error before later phases are created.
- Recovery reuses the binding timestamp across accepted-written crashes and rejects a mutated archive before changing progress or receipt bytes.
- Rejected submissions now persist an immutable terminal result and replay the same `GameKbError` without consuming another attempt.
- `verify --installed` remains independent of active-run guard state because it is a read-only verification of already installed data and does not schedule, assemble, publish, install, or mutate a run.

## Self-review checklist

- [x] No placeholder markers, disabled assertions, skipped regressions, debug logging, or test-only production bypass.
- [x] All new error codes asserted through both library and CLI tests.
- [x] Worker payloads contain no path or writable target.
- [x] Journal and recovery responses never expose raw model content.
- [x] Same-content replay is byte-idempotent and conflicting replay is non-mutating.
- [x] Lite worker planning remains separate and consumes these controller contracts.
- [x] Unresolved worker-guard violations block scheduling.
- [x] Recovery binds to guard-discovered source.
- [x] All 4 crash phases have fault injection tests.
