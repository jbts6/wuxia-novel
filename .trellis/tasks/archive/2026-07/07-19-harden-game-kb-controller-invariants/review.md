# Controller Invariants Independent Review — 2026-07-19

## Verdict

**Rejected.** The repair checklist is marked complete, and both the focused and full test suites pass, but independent contract probes still reproduce multiple controller-invariant violations. The task must remain `in_progress`; do not archive it or begin `07-19-harden-lite-worker-reliability` until every blocker below has a failing regression, a root-cause fix, and fresh verification evidence.

This review is intentionally separate from `verification.md`. The latter records the implementation author's accepted verdict; this file records the independent re-verification result without overwriting that source evidence.

## Scope reviewed

- `prd.md`, `design.md`, `implement.md`, `repair-plan.md`, `verification.md`, and `task.json`
- Controller changes under `.agents/skills/generate-game-kb/scripts/`
- Focused regression tests and the complete game-KB test suite
- Original blocker-shaped dynamic probes for crash replay, rejection accounting, guard behavior, worker payload projection, and recovery safety
- Frozen JSON-as-YAML accepted-artifact hashes before and after the full suite
- Skip/TODO/debug/suppression scan and `git diff --check`

## Blocking findings

### 1. Worker-visible status still exposes the absolute staging path

`lite-status` emits the internal result of `resolveNextAction()` directly. Although `chapter-batching.js` defines `workerProjection()`, the production flow never calls it before returning `chapter_jobs`.

Fresh probe result:

```text
exit=0
next_action=accept-chapters
descriptor_keys=unit,number,title,source_file,input_hash,source_char_count,attempt,staging_path
has_staging_path=true
worker_write_paths=[]
```

The current status regression also explicitly asserts that `staging_path` is present. This contradicts PRD acceptance criterion 47 and the zero-write worker contract. An empty `worker_write_paths` array does not compensate for exposing the controller-owned output destination.

Relevant locations:

- `.agents/skills/generate-game-kb/scripts/flow.js:577-602`
- `.agents/skills/generate-game-kb/scripts/lib/chapter-batching.js:237-260`
- `.agents/skills/generate-game-kb/tests/status-next-action.test.js:67-69`
- `verification.md:70`

Required closure:

- Add a failing CLI regression proving no worker-visible status/job field contains `staging_path`, `staging_paths`, an output directory, an output filename, or another writable target.
- Apply the worker projection at the production boundary while retaining controller-internal paths where acceptance needs them.

### 2. A recorded worker-guard violation does not block scheduling

`unresolvedWorkerGuardReports()` can find violations, but neither `resolveNextAction()` nor the status/guard-open orchestration consumes those reports. The test named `unresolvedWorkerGuardReports blocks scheduling when violations exist` only asserts that a report exists; it never exercises scheduling.

Fresh probe result:

```text
violation_count=1
unresolved_reports=1
next_action=accept-chapters
chapter_jobs=1
```

This violates PRD criteria 52–54 and the repair-plan precedence contract, which requires worker-write review to outrank manual review, interrupted submission replay, and ordinary work.

Relevant locations:

- `.agents/skills/generate-game-kb/scripts/lib/next-action.js:105-124`
- `.agents/skills/generate-game-kb/scripts/flow.js:722-740`
- `.agents/skills/generate-game-kb/tests/worker-guard.test.js:280-300`
- `repair-plan.md:475-480`

Required closure:

- Add a real next-action/status regression with an unresolved guard violation.
- Return `worker-write-review`, expose the offending evidence, and emit no new chapter job or publication action until the report is resolved.

### 3. Recovery is not bound to a guard-discovered source

`recoverChapterDraft()` accepts `guardId`, stores it in the receipt, but never verifies that the guard exists or that its unresolved report discovered the exact source path. A completely nonexistent guard ID successfully recovered and accepted a draft in the independent probe.

The test titled `recoverChapterDraft rejects source not discovered by guard` does the opposite of its title: it asserts a successful recovery.

Relevant locations:

- `.agents/skills/generate-game-kb/scripts/lib/draft-recovery.js:86-179`
- `.agents/skills/generate-game-kb/tests/draft-recovery.test.js:253-269`
- `verification.md:51`

Required closure:

- Add RED cases for missing, clean, unrelated, resolved, and mismatched guard reports.
- Require the exact normalized source path to be present in the named unresolved guard report before any content read, staging write, receipt write, or attempt transition.

### 4. Recovery uses the novel directory instead of the Git repository root

The CLI passes `novelDir` as `repositoryRoot` instead of calling `repositoryRootFor(novelDir)`. A valid rogue draft placed beside the novel directory but inside a synthetic Git root was rejected as `RECOVERY_SOURCE_OUTSIDE`.

Fresh probe result:

```text
source_inside_git_root=true
exit=1
code=RECOVERY_SOURCE_OUTSIDE
details.repositoryRoot=<novel directory>
```

Relevant location:

- `.agents/skills/generate-game-kb/scripts/flow.js:807-828`

Required closure:

- Route recovery through `repositoryRootFor(novelDir)`.
- Add an end-to-end CLI test using a sibling rogue path inside a temporary Git root.

### 5. Recovery receipt is mutable and changes during a failed retry

The receipt is written with overwrite-capable `atomicWriteJson()` to one unit-level filename before `acceptDraft()` completes. In the probe, the first recovery completed attempt 1. A second recovery returned `UNIT_ALREADY_DONE`, but before failing it overwrote the existing receipt with attempt 2, a different guard ID, source path, destination path, and timestamp.

Fresh probe result:

```text
first.status=done
first.attempt=1
second.code=UNIT_ALREADY_DONE
receipt_hash_changed=true
receipt.attempt=2
```

Relevant location:

- `.agents/skills/generate-game-kb/scripts/lib/draft-recovery.js:134-171`

Required closure:

- Reject already-done/manual-review/ineligible state before writing staging or receipt files.
- Give each recovery transaction an immutable attempt/content identity and use write-once helpers.
- Add a regression proving every failed or conflicting replay leaves the original receipt and staging evidence byte-identical.

### 6. The required `receipt-created` crash phase is absent

The repair plan and design require fault injection at:

1. `receipt-created`
2. `staging-written`
3. `submission-recorded`
4. `accepted-written`

The implementation instead names the first durable phase `binding`, and the regression loop only covers the final three phases. Passing `faultAt: 'receipt-created'` did not throw `SUBMISSION_FAULT_INJECTED`; it completed acceptance normally.

Fresh probe result:

```text
faultAt=receipt-created
returned.status=done
returned.attempts=1
```

Partial `binding.json` replay itself now succeeds, so the underlying replay work is partially repaired; the declared four-phase fault contract and its regression remain incomplete.

Relevant locations:

- `.agents/skills/generate-game-kb/scripts/lib/submission-journal.js:9-19`
- `.agents/skills/generate-game-kb/scripts/lib/draft-submission.js:213-230`
- `.agents/skills/generate-game-kb/tests/draft-submission.test.js:363-385`
- `repair-plan.md:226-249`
- `verification.md:16-18`

Required closure:

- Make the first required phase explicit and stable, or update every contract artifact losslessly if `binding` is intentionally the canonical name.
- Add the missing crash/replay regression and compare progress, archive, accepted artifact, journal, and result bytes with a no-fault control.

## Additional verification gaps

These gaps reinforce the rejected verdict even where the current implementation happened to pass an independent probe:

- Malformed JSON behavior currently works for attempt 1, attempt 2, and the no-attempt-3 boundary, but the committed regression covers only attempt 1.
- No designated next-action/status test covers interrupted submission journals or the required last-durable-phase projection.
- `pendingSubmissionJournals()` reads fields without the repair plan's schema/contradiction validation and does not raise the specified `SUBMISSION_JOURNAL_CORRUPT` error.
- Recovery has a file-symlink regression but no real directory-junction source regression.
- Broker journal binding stores `guard_id` but not the required immutable open/check receipt hashes.
- Direct `submitChapterEnvelope()` calls can complete without a guard. The CLI currently performs the guard assertion, so the intended enforcement boundary must be made explicit and tested rather than left as an accidental bypass.
- `.trellis/spec/backend/quality-guidelines.md` documents accepted-artifact immutability but does not yet capture the new broker, guard, journal, recovery, or worker-payload contracts.

## Verified passing evidence

### Focused repair suite

```text
tests=109
pass=109
fail=0
exit=0
```

Command:

```powershell
rtk node --test .agents/skills/generate-game-kb/tests/accepted-serialization.test.js .agents/skills/generate-game-kb/tests/artifact-immutability.test.js .agents/skills/generate-game-kb/tests/accept-retry.test.js .agents/skills/generate-game-kb/tests/draft-submission.test.js .agents/skills/generate-game-kb/tests/worker-guard.test.js .agents/skills/generate-game-kb/tests/draft-preflight.test.js .agents/skills/generate-game-kb/tests/draft-recovery.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js .agents/skills/generate-game-kb/tests/next-action.test.js .agents/skills/generate-game-kb/tests/status-next-action.test.js
```

### Complete game-KB suite

```text
tests=429
pass=429
fail=0
exit=0
duration_ms=87121.572
```

Command:

```powershell
rtk node --test .agents/skills/generate-game-kb/tests/*.test.js
```

### Frozen accepted-artifact immutability

```text
legacy_artifacts_before=76
legacy_artifacts_after=76
changed=0
aggregate_sha256_before=06625733587e5f880c595ed3f87549d18505fd4d693832a415b4b58f69b965e6
aggregate_sha256_after=06625733587e5f880c595ed3f87549d18505fd4d693832a415b4b58f69b965e6
```

### Other passing checks

- UTF-8 transport bounds use `Buffer.byteLength(rawInput, 'utf8')`.
- Malformed attempts independently produced attempt 1 `pending`, attempt 2 `manual_review`, and attempt 3 `UNIT_MANUAL_REVIEW`.
- A manually created partial journal binding replayed to one terminal result with one consumed attempt.
- Git-root guard-open/check tests detect sibling rogue paths.
- No new skipped tests, placeholder markers, TODO/FIXME markers, debug logging, or warning suppressions were found in the reviewed files.
- `git diff --check` passed.
- No repository-root lint or type-check command applies to this CommonJS controller package; the full Node suite imports and executes the changed modules.
- Independent probes used temporary directories and left no probe artifacts in the repository.

## Required re-verification gate

Do not replace this rejected verdict until all of the following are true in one fresh review turn:

- Every blocking probe above has an automated RED-to-GREEN regression.
- Worker-visible status/jobs contain no writable target or staging path.
- Unresolved worker writes deterministically block jobs and publication.
- Broker submission and recovery bind an exact guard proof at the real Git root.
- Recovery rejects undiscovered sources and is non-mutating on every failure or replay conflict.
- All four declared crash phases replay byte-identically.
- Interrupted/corrupt journal state is projected or rejected according to the repair plan.
- Focused and complete suites pass again.
- All 76 frozen accepted artifacts retain the same aggregate SHA-256.
- `prd.md`, `design.md`, `repair-plan.md`, `verification.md`, and applicable backend specs describe the implementation and test evidence without contradiction.

## Follow-up closure — 2026-07-19

### Verdict

**Accepted for the independent-review scope.** The original rejected verdict and its evidence above remain preserved as the historical review record. Every blocking finding and additional verification gap now has implementation coverage and fresh regression evidence.

### Closure summary

- Worker-visible status uses a fail-closed projection and exposes no staging or writable target.
- Unresolved worker writes take precedence in status and block assembly, publication, installation, and workspace verification.
- Recovery uses the real Git root, requires the exact path from the named unresolved guard, rejects conflicts before mutation, and preserves immutable binding/result/receipt files. Accepted-written crash replay uses the binding timestamp and re-enters the shared submission transaction, so archive and submission-record bytes are verified instead of reconstructed manually.
- Guard open/check receipts are immutable and hash-bound; broker bindings retain both hashes and enforce the guard at the internal submission boundary.
- Guard receipt parsing is fail closed: malformed JSON, schema-invalid paths, orphan checks, and proofs scoped below the real Git root return `GUARD_PROOF_MISMATCH`.
- Submission journals use one schema decoder for status and replay, validate durable phase order and cross-phase identity, and reject corrupt terminal journals.
- Both accepted and rejected same-content submissions reach an immutable terminal result. Replaying a rejected envelope restores the same controller error without consuming another attempt.
- `verify --installed` is intentionally not gated by an active-run guard: it reads already installed data and has no active run mutation or publication path.
- Backend quality guidance and task design/implementation artifacts describe the final broker, guard, journal, recovery, and worker-projection contracts.

### Fresh re-verification evidence

```text
focused_files=11
focused_tests=143
focused_pass=143
focused_fail=0
focused_exit=0

complete_files=51
complete_tests=463
complete_pass=463
complete_fail=0
complete_exit=0
complete_duration_ms=64553.9209

legacy_artifacts_before=76
legacy_artifacts_after=76
aggregate_sha256_before=06625733587e5f880c595ed3f87549d18505fd4d693832a415b4b58f69b965e6
aggregate_sha256_after=06625733587e5f880c595ed3f87549d18505fd4d693832a415b4b58f69b965e6

changed_js_node_check_failures=0
suspicious_added_lines=0
git_diff_check_exit=0
```

Additional TDD evidence after the first closure:

- Restoring the old existing-phase early return made the immutable phase-conflict regression fail with exit `1`; restoring content comparison returned exit `0`.
- Before the recovery refactor, both the accepted-written crash and mutated-archive regressions failed because no exception was raised; after routing recovery through `commitSubmission()`, `draft-recovery.test.js` passes `13/13`.
