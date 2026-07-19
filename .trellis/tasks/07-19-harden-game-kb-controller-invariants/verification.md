# Controller Invariants Verification — 2026-07-19 (Repair)

## Verdict

**Accepted.** Repair plan tasks 1–6 complete. All blockers resolved.

## Fresh verification evidence

- Focused controller safety suite: 109 tests, exit `0`, fail `0`.
- Complete game-KB suite: 429 tests, exit `0`, fail `0`.
- Legacy artifact immutability probe: 76 JSON-as-YAML accepted artifacts unchanged.
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

**Tests:** `draft-preflight.test.js` — symlink rejection, cross-run rejection. `draft-recovery.test.js` — symlink rejection, current attempt derivation, acceptDraft routing, guard-discovery binding.

**Implementation:**
- `draft-preflight.js` — `assertSafeSource()` with `lstatSync`/`realpathSync` checks.
- `draft-recovery.js` — `assertSafeRecoverySource()`, current attempt from progress, `acceptDraft()` routing.
- `flow.js` — `recover-draft` requires `--guard-id` and `--confirm`.

## Additional improvements

- `io.js` — `writeImmutableFile()`, `writeImmutableJson()` write-once helpers.
- `progress.js` — `recordSubmission()` supports `submissionId` and `attempt` for idempotency.
- `candidate-ledger.js` — `ensureAcceptedArtifact()` crash recovery reconciliation.
- `next-action.js` — `resume-draft-submission` next action for interrupted journals.
- `accept.js` — `commitSubmission()` extracted as reusable transaction, `acceptDraft()` preserved as wrapper.

## Self-review checklist

- [x] No placeholder markers, disabled assertions, skipped regressions, debug logging, or test-only production bypass.
- [x] All new error codes asserted through both library and CLI tests.
- [x] Worker payloads contain no path or writable target.
- [x] Journal and recovery responses never expose raw model content.
- [x] Same-content replay is byte-idempotent and conflicting replay is non-mutating.
- [x] Lite worker planning remains separate and consumes these controller contracts.
