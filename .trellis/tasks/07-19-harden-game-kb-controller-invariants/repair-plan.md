# Game KB Controller Invariants Repair Implementation Plan

> **For the implementing AI:** Work on the existing Trellis task `07-19-harden-game-kb-controller-invariants`. REQUIRED SUB-SKILLS: use `trellis-before-dev`, `test-driven-development`, `systematic-debugging`, and `verification-before-completion`. Work inline; do not dispatch implementation or check sub-agents. Execute this plan task-by-task and keep every checkbox current.

**Goal:** Close the five blockers recorded in `verification.md` so broker submission, repository guarding, crash replay, and misplaced-draft recovery satisfy the existing PRD without changing Lite-worker behavior.

**Architecture:** Refactor acceptance into one explicit, idempotent submission transaction keyed by unit, attempt, input hash, and submission ID. Put an append-only broker journal in front of that transaction, require an exact clean guard receipt before binding a payload, and make recovery validate a guard-discovered regular file before passing it through the same acceptance transaction.

**Tech Stack:** Node.js CommonJS, Node built-ins (`fs`, `path`, `crypto`), `js-yaml`, `node:test`, Windows realpath/junction semantics, atomic JSON/YAML helpers already in `scripts/lib/io.js`.

## Current status

- The original Tasks 1–7 in `implement.md` are historical implementation notes, not proof of completion.
- Fresh verification: focused suite exit `0`; all 50 game-KB test files exit `0` with `fail 0`; 76 frozen JSON-as-YAML accepted artifacts remain unchanged.
- Five PRD-level failures remain reproducible. Read `verification.md` before editing code.
- This repair plan is the authoritative remaining-work plan. Do not start `07-19-harden-lite-worker-reliability` until every task below is green and the controller task is re-verified.

## Global constraints

- Preserve all 76 legacy accepted artifacts byte-for-byte; legacy runs stay readable and write-locked.
- Do not modify `古龙/凤舞九天`, `古龙/剑神一笑`, installed KB data, `.claude/skills/*`, or unrelated dirty paths.
- A worker-visible job has no output path and an empty `worker_write_paths` array.
- Identity/staleness/guard mismatches consume no attempt. Once current CLI identity is established, malformed JSON, wrong draft shape, schema failure, grounding failure, and hash failure consume exactly one attempt.
- Attempt 2 rejection enters `manual_review`; no attempt 3 is issued.
- Every durable replay file is write-once. Same bytes are idempotent; different bytes raise an explicit conflict and never overwrite evidence.
- Controller paths are derived internally, absolute, Windows-normalized, realpath-checked, and contained by the selected run or repository root as applicable.
- The repository guard covers the Git working tree root, including ignored and untracked paths; `.git/`, `node_modules/`, and guard-owned receipt files remain the only scan exclusions.
- Use `rtk` for every shell command. Route test/build output through context-mode and report exit code plus failure count.
- Use TDD for every task: add the named regression, run it and observe the intended failure, implement the smallest repair, then rerun the focused set.
- Do not create intermediate commits. Trellis Phase 3 owns the final commit after full verification.

## File responsibility map

- `.agents/skills/generate-game-kb/scripts/lib/accept.js` — shared validation and idempotent submission commit transaction; file-based `acceptDraft()` remains a wrapper.
- `.agents/skills/generate-game-kb/scripts/lib/progress.js` — explicit attempt/submission identity and idempotent progress transition.
- `.agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js` — exact-byte accepted-artifact reconciliation for replay; legacy immutability remains fail-closed.
- `.agents/skills/generate-game-kb/scripts/lib/io.js` — write-once byte/JSON helpers used by journals and transaction records.
- `.agents/skills/generate-game-kb/scripts/lib/submission-journal.js` — new append-only broker phase journal.
- `.agents/skills/generate-game-kb/scripts/lib/draft-submission.js` — input bounds, CLI/envelope identity, clean-guard binding, phase replay, and terminal result.
- `.agents/skills/generate-game-kb/scripts/lib/worker-guard.js` — clean-check proof and submission/recovery binding.
- `.agents/skills/generate-game-kb/scripts/lib/paths.js` — Git-root discovery and journal path derivation.
- `.agents/skills/generate-game-kb/scripts/lib/draft-preflight.js` — unique current-unit candidate classification without mutation.
- `.agents/skills/generate-game-kb/scripts/lib/draft-recovery.js` — regular-file/realpath checks and recovery through normal acceptance.
- `.agents/skills/generate-game-kb/scripts/flow.js` — exact CLI flags and real repository-root wiring.
- Existing `tests/*.test.js` files — regression coverage; do not create a second test framework.

## Acceptance coverage map

| Existing contract | Repair task | Required proof |
|---|---:|---|
| PRD 48: bounded UTF-8 stdin | 2 | multibyte payload over 10 MiB returns `SUBMISSION_INPUT_OVERSIZED` |
| PRD 50/59: malformed/invalid content consumes one bounded attempt | 1–2 | malformed attempt 1 remains retryable; attempt 2 enters `manual_review`; no attempt 3 |
| PRD 51: same-content crash replay and conflicting replay | 1–2, 5 | four fault phases resume byte-identically; conflict changes no artifact |
| PRD 30/53/54: repository-root empty-write guard before broker | 3 | sibling rogue path detected; no clean exact guard means zero-attempt rejection |
| PRD 56–58: non-mutating preflight and safe explicit recovery | 4 | symlink/cross-run/ambiguous/invalid rejected; valid current-attempt recovery is accepted |
| PRD 65–66: Lite worker consumes stable controller signals | 5–6 | interrupted journal is machine-visible; controller gate passes before Lite planning resumes |

---

### Task 1: Build an idempotent shared submission transaction

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/io.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/progress.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Modify: `.agents/skills/generate-game-kb/tests/accept-retry.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/accepted-serialization.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/progress.test.js`

**Interfaces:**
- Produce: `writeImmutableFile(file, bytes, conflictCode)` and `writeImmutableJson(file, value, conflictCode)` from `io.js`.
- Extend: `recordSubmission(progress, unit, inputHash, outputHash, errors, { attempt, submissionId, recordedAt })`.
- Produce: `ensureAcceptedArtifact(paths, file, inputHash, value, { acceptedAt })` from `candidate-ledger.js`.
- Produce: `commitSubmission({ paths, unit, attempt, inputHash, submissionId, evidenceText, evidenceExtension, stagingPath, draft, prevalidationErrors, checkpoint })` from `accept.js`.
- Preserve: `acceptDraft({ paths, unit, draftPath })` behavior and return/error codes for existing callers.

- [x] **Step 1: Add failing write-once and progress-idempotency tests**

Add tests proving:

```js
test('writeImmutableFile accepts identical replay and rejects different bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-write-once-'));
  const file = path.join(root, 'receipt.json');
  try {
    writeImmutableFile(file, 'same\n', 'SUBMISSION_REPLAY_CONFLICT');
    assert.doesNotThrow(() => writeImmutableFile(file, 'same\n', 'SUBMISSION_REPLAY_CONFLICT'));
    assert.throws(
      () => writeImmutableFile(file, 'different\n', 'SUBMISSION_REPLAY_CONFLICT'),
      error => error.code === 'SUBMISSION_REPLAY_CONFLICT'
    );
    assert.equal(fs.readFileSync(file, 'utf8'), 'same\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('recordSubmission is idempotent for one explicit submission id', () => {
  const unit = 'chapter:001';
  const inputHash = `sha256:${'1'.repeat(64)}`;
  const outputHash = `sha256:${'2'.repeat(64)}`;
  const errors = [{ code: 'SUBMISSION_ENVELOPE_INVALID', path: '$', target: 'invalid JSON' }];
  const progress = freshProgress();
  progress.units[unit] = freshUnit(inputHash);
  const once = recordSubmission(progress, unit, inputHash, outputHash, errors, {
    attempt: 1,
    submissionId: 'submission:chapter:001:attempt:1:sha256:fixture',
    recordedAt: '2026-07-19T00:00:00.000Z'
  });
  const replay = recordSubmission(once, unit, inputHash, outputHash, errors, {
    attempt: 1,
    submissionId: 'submission:chapter:001:attempt:1:sha256:fixture',
    recordedAt: '2026-07-19T00:00:00.000Z'
  });
  assert.deepEqual(replay, once);
  assert.equal(replay.units[unit].attempts, 1);
});
```

Also assert that a different `submissionId` for an already-recorded explicit attempt raises `SUBMISSION_ATTEMPT_CONFLICT` and leaves progress unchanged.

- [x] **Step 2: Add failing accepted-artifact replay tests**

Cover all four states:

1. file absent + manifest entry absent → write canonical YAML and entry;
2. exact file + exact entry present → return the existing entry without changing bytes;
3. exact file present + entry absent → append the exact entry using supplied `acceptedAt` (crash recovery);
4. conflicting file, hash, input hash, serialization, or entry → `ACCEPTED_ARTIFACT_REPLAY_CONFLICT`, no mutation.

The test must snapshot artifact and manifest bytes before a conflict and compare them afterward.

- [x] **Step 3: Run the focused tests and confirm RED**

Run:

```powershell
rtk node --test .agents/skills/generate-game-kb/tests/accept-retry.test.js .agents/skills/generate-game-kb/tests/accepted-serialization.test.js
```

Expected: failures identify the missing immutable-write helpers, explicit submission identity, and accepted-artifact reconciliation.

- [x] **Step 4: Implement immutable helpers and explicit progress identity**

Implement write-once helpers with byte equality, not parsed-value equality. Extend fresh unit state with `last_submission_id: null`; keep old progress readable by treating a missing field as `null`.

`recordSubmission()` must enforce:

```js
if (unit.last_submission_id === submissionId) return cloneProgress(current);
if (attempt !== unit.attempts + 1) {
  throw new GameKbError('SUBMISSION_ATTEMPT_CONFLICT', 'Submission attempt is not the next controller attempt', {
    unit: unitName,
    attempt,
    expected_attempt: unit.attempts + 1
  });
}
```

Use `recordedAt` for every timestamp created by this transition so replay computes identical state.

- [x] **Step 5: Implement accepted-artifact reconciliation**

`ensureAcceptedArtifact()` must compute canonical bytes with `serializeYaml()`, compare the file and manifest entry independently, and only repair the single crash state where exact file bytes exist but the manifest entry is missing. It must never rewrite an existing accepted file or reinterpret a legacy JSON-as-YAML artifact.

Keep `recordAcceptedArtifact()` as the strict first-write API; call `ensureAcceptedArtifact()` only from replay-aware transaction code.

- [x] **Step 6: Extract `commitSubmission()` and keep `acceptDraft()` compatible**

The transaction order is fixed:

1. resolve the current unit context and verify explicit `attempt`/`inputHash`;
2. evaluate `draft` unless `prevalidationErrors` is supplied;
3. write immutable evidence archive;
4. write immutable submission record containing `submission_id`, `recorded_at`, errors, archive hash/path, intended accepted path, and the resulting unit state;
5. invoke `checkpoint('submission-recorded', record)`;
6. reconcile the accepted artifact for a successful result;
7. invoke `checkpoint('accepted-written', record)`;
8. save progress only if `last_submission_id` is not already current;
9. consume the staging file only after successful accepted/progress reconciliation.

Malformed transport content uses `evidenceExtension: '.json'`, `draft: null`, and explicit `prevalidationErrors`. Valid chapter/domain YAML uses `evidenceExtension: '.yaml'`.

- [x] **Step 7: Re-run the focused tests and require GREEN**

Run the Step 3 command again. Expected: exit `0`, zero failures, existing file-based acceptance behavior unchanged.

---

### Task 2: Repair broker byte bounds, attempt accounting, and crash replay

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/submission-journal.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/draft-submission.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/tests/draft-submission.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/accept-retry.test.js`

**Interfaces:**
- Produce: `submissionJournalPaths(paths, unit, attempt)` from `paths.js`.
- Produce from `submission-journal.js`: `openSubmissionJournal(binding)`, `writeSubmissionPhase(journal, phase, value)`, `readSubmissionPhase(journal, phase)`, and `submissionResult(journal)`.
- Extend: `submitChapterEnvelope({ paths, guardId, batchId, unit, attempt, rawInput, faultAt })`.
- Journal phases: `binding.json`, `staging-written.json`, `submission-recorded.json`, `accepted-written.json`, `result.json`.

- [x] **Step 1: Add failing UTF-8 and rejection-accounting tests**

Add a UTF-8 case using:

```js
const rawInput = '中'.repeat(Math.floor(MAX_INPUT_BYTES / 3) + 1);
assert.equal(rawInput.length < MAX_INPUT_BYTES, true);
assert.equal(Buffer.byteLength(rawInput, 'utf8') > MAX_INPUT_BYTES, true);
```

Expected error: `SUBMISSION_INPUT_OVERSIZED`; progress remains at zero because transport bounds fail before a submission is bound.

For current CLI identity, test malformed JSON, multiple envelopes, wrong draft shape, and draft-schema failure. Each must create one immutable rejected submission, increment attempts once, leave source evidence reviewable, and make the second failure enter `manual_review` with no attempt 3.

Parseable duplicate envelope identity mismatches must still consume zero attempts and must not create `binding.json`.

- [x] **Step 2: Add failing fault-injection replay tests**

For each phase below, create a fresh fixture, call once with `faultAt`, then replay without `faultAt`:

```js
for (const faultAt of [
  'receipt-created',
  'staging-written',
  'submission-recorded',
  'accepted-written'
]) {
  // first call throws SUBMISSION_FAULT_INJECTED after the named durable phase
  // second same-raw call returns the terminal result
  // attempts === 1; accepted/archive/progress/result hashes match a no-fault control
}
```

After each injected crash, snapshot binding, staging, archive, submission record, accepted artifact, manifest, progress, and result. A conflicting raw hash for the same unit/attempt must return `SUBMISSION_REPLAY_CONFLICT` and preserve every snapshot byte.

- [x] **Step 3: Run broker tests and confirm RED**

Run:

```powershell
rtk node --test .agents/skills/generate-game-kb/tests/draft-submission.test.js .agents/skills/generate-game-kb/tests/accept-retry.test.js .agents/skills/generate-game-kb/tests/accepted-serialization.test.js
```

Expected: the existing implementation fails UTF-8 byte counting, malformed-attempt accounting, every `faultAt` case, and partial receipt replay.

- [x] **Step 4: Implement append-only journal binding**

Use one directory per unit/attempt. `binding.json` contains exactly:

```js
{
  schema_version: 1,
  batch_id: batchId,
  unit,
  attempt,
  input_hash: inputHash,
  raw_hash: rawHash,
  guard_id: guardId,
  created_at: recordedAt
}
```

Opening an existing directory compares every binding field. Same binding resumes; any mismatch raises `SUBMISSION_REPLAY_CONFLICT`. Phase files are written through `writeImmutableJson()` and are never overwritten.

- [x] **Step 5: Implement broker ordering and classified rejection**

Use `Buffer.byteLength(rawInput, 'utf8')` for the 10 MiB limit.

Ordering is mandatory:

1. validate transport bounds;
2. validate current CLI batch/unit/attempt and clean guard proof;
3. attempt JSON parse;
4. when parseable, verify duplicate envelope identity before journal binding;
5. open/bind the journal (malformed JSON is bound because current CLI identity already identifies the attempt);
6. convert parse/draft-shape errors into `prevalidationErrors` and call `commitSubmission()` so they consume one attempt;
7. for a valid draft object, serialize canonical YAML to the controller-derived staging path and write `staging-written.json`;
8. pass journal phase callbacks into `commitSubmission()`;
9. write immutable `result.json` and return it.

`faultAt` throws `SUBMISSION_FAULT_INJECTED` only after the corresponding phase file is durable. It is a deterministic test hook and must not change normal output.

- [x] **Step 6: Re-run broker tests and require GREEN**

Run the Step 3 command. Expected: exit `0`; all success, rejection, conflict, and four crash-phase cases pass.

---

### Task 3: Bind submissions to a clean guard at the real repository root

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/worker-guard.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/draft-submission.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/tests/worker-guard.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/lite-cli-contract.test.js`

**Interfaces:**
- Produce: `repositoryRootFor(novelDir)` from `paths.js`; walk parents until the nearest `.git` directory or file, then verify the novel realpath is contained by that root.
- Produce: `assertCleanGuardForSubmission({ paths, guardId, repositoryRoot, batchId, unit, attempt, inputHash })` from `worker-guard.js`.
- Require CLI flag: `lite-submit-draft ... --guard-id <guard-id>`.

- [x] **Step 1: Add failing repository-root coverage tests**

Create a temporary Git-shaped root with two sibling directories: selected novel and `sibling-output/random/deep/rogue.yaml`. Open the guard for the selected novel, create the sibling rogue file, and assert `guard-check` reports the exact repository-relative and absolute sibling path.

Also assert `receipt.repository_root` equals the temporary Git root, not the selected novel directory.

- [x] **Step 2: Add failing clean-guard binding tests**

Cover:

- missing `--guard-id` → `GUARD_ID_REQUIRED`, zero attempts;
- unknown guard → `GUARD_NOT_FOUND`, zero attempts;
- guard batch/unit/attempt/input hash mismatch → `GUARD_SUBMISSION_IDENTITY_MISMATCH`, zero attempts;
- no check receipt → `GUARD_CLEAN_RECEIPT_REQUIRED`, zero attempts;
- check with violations → `GUARD_VIOLATIONS_UNRESOLVED`, zero attempts;
- exact clean check → broker may bind and submit;
- same clean batch guard authorizes each distinct submission identity listed in that guarded job, but no identity outside the job.

- [x] **Step 3: Run guard/CLI tests and confirm RED**

Run:

```powershell
rtk node --test .agents/skills/generate-game-kb/tests/worker-guard.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js .agents/skills/generate-game-kb/tests/draft-submission.test.js
```

Expected: sibling coverage, clean-check enforcement, and the required CLI guard flag fail.

- [x] **Step 4: Implement root discovery and clean proof**

`guard-open` and `guard-check` must call `repositoryRootFor(novelDir)` and pass that result to the guard. Store the complete job submission identities in the open receipt.

The check receipt must bind `guard_id`, open-receipt SHA-256, repository root, check time, and deterministic violations. `assertCleanGuardForSubmission()` verifies the exact open/check pair and finds `{ unit, attempt, input_hash }` in the guarded job before returning proof metadata.

The broker stores the guard ID plus open/check hashes in `binding.json`; it performs this proof before creating the journal or consuming an attempt.

- [x] **Step 5: Re-run guard/CLI tests and require GREEN**

Run the Step 3 command. Expected: exit `0`; repository sibling violations are visible and no unguarded submission reaches the broker transaction.

---

### Task 4: Make explicit recovery regular-file-only and route it through normal acceptance

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/draft-preflight.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/draft-recovery.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/worker-guard.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/tests/draft-preflight.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/draft-recovery.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/lite-cli-contract.test.js`

**Interfaces:**
- Produce: `matchChapterDraft({ paths, manifest, draftPath }) -> { matches, parsed, canonicalYaml, errors }` from `draft-preflight.js`.
- Produce: `assertGuardDiscoveredPath({ paths, guardId, absolutePath })` from `worker-guard.js`.
- Extend: `recoverChapterDraft({ repositoryRoot, paths, manifest, guardId, unit, sourcePath, confirmed })`.
- Require CLI flag: `lite-recover-draft ... --guard-id <guard-id> --confirm`.

- [x] **Step 1: Add failing source-safety and uniqueness tests**

Cover a file symlink and a directory junction whose lexical path is inside the repository but real target is outside. Both must return `RECOVERY_SOURCE_SYMLINK` before reading content or writing a receipt.

Cover a source under another run's `.game-kb-work/runs/<run-id>/`; return `RECOVERY_SOURCE_CROSS_RUN`.

Run full validation against every current pending chapter descriptor. Zero matches returns `RECOVERY_INVALID_CONTENT`; more than one returns `RECOVERY_AMBIGUOUS`; exactly one must equal the requested unit.

- [x] **Step 2: Add failing current-attempt and normal-accept tests**

Create a valid misplaced draft, record attempt 1 rejection for the unit, then recover. Assert:

```js
assert.match(result.destination_path, /chapter_001_attempt_02\.yaml$/);
assert.equal(result.acceptance.status, 'done');
assert.equal(readJson(paths.progress).units['chapter:001'].attempts, 2);
assert.equal(fs.existsSync(result.acceptance.accepted_file), true);
assert.equal(fs.existsSync(sourcePath), true); // source evidence preserved
```

Also prove that an invalid or unconfirmed recovery leaves progress, staging, accepted artifacts, and the source byte-identical.

- [x] **Step 3: Add failing guard-discovery tests**

Recovery without a guard violation containing the exact normalized source path returns `RECOVERY_SOURCE_NOT_GUARD_DISCOVERED`. A matching unresolved violation permits recovery; the original guard report remains unresolved until the user removes or restores the rogue source.

- [x] **Step 4: Run recovery tests and confirm RED**

Run:

```powershell
rtk node --test .agents/skills/generate-game-kb/tests/draft-preflight.test.js .agents/skills/generate-game-kb/tests/draft-recovery.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js .agents/skills/generate-game-kb/tests/accept-retry.test.js
```

Expected: symlink/junction, cross-run, current-attempt, guard-discovery, and post-copy acceptance cases fail.

- [x] **Step 5: Implement safe candidate classification**

Before `statSync()` or `readFileSync()`:

1. `lstatSync(resolvedSource)` must report a regular file and not a symbolic link;
2. `realpathSync(resolvedSource)` must equal the normalized lexical path;
3. the real source must be contained by the real repository root;
4. reject any `.game-kb-work/runs/` source not contained by `paths.run`;
5. require the exact path in the named unresolved guard report.

`matchChapterDraft()` parses once and validates against every current pending chapter. It performs no writes and never calls `recordSubmission()`.

- [x] **Step 6: Implement current-attempt recovery and normal acceptance**

Derive current attempt from shared controller context; never hard-code `1`. Write canonical YAML to that exact staging path, write one immutable recovery receipt containing guard ID, unit, attempt, source/destination paths and hashes, then call `acceptDraft()` with the destination.

Return:

```js
{
  unit,
  attempt,
  source_path: resolvedSource,
  destination_path: destinationPath,
  receipt_path: receiptFile,
  acceptance: acceptResult
}
```

Preserve the source evidence. A successful acceptance counts as the current successful submission; recovery itself adds no separate failed attempt.

- [x] **Step 7: Re-run recovery tests and require GREEN**

Run the Step 4 command. Expected: exit `0`; every invalid path is non-mutating and valid recovery ends in accepted controller state.

---

### Task 5: Expose resumable broker state and close cross-command contracts

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/submission-journal.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/next-action.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/tests/next-action.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/status-next-action.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/lite-cli-contract.test.js`

**Interfaces:**
- Produce: `pendingSubmissionJournals(paths)` returning non-terminal bindings with `guard_id`, `batch_id`, `unit`, `attempt`, `input_hash`, `raw_hash`, and last durable phase; never return raw model content.
- Add next action: `resume-draft-submission` before issuing a new worker job when a non-terminal journal exists.

- [x] **Step 1: Add failing status/resume tests**

For each injected broker phase, call `lite-status --json` and assert one deterministic pending submission is reported with the correct last durable phase. `next_action` must be `resume-draft-submission`, and no new chapter job may be dispatched until the same raw payload completes or the user explicitly handles a conflict.

Terminal `result.json` removes the journal from pending status. Unresolved worker-write reports continue to take precedence over ordinary work and publication.

- [x] **Step 2: Run status tests and confirm RED**

Run:

```powershell
rtk node --test .agents/skills/generate-game-kb/tests/next-action.test.js .agents/skills/generate-game-kb/tests/status-next-action.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js .agents/skills/generate-game-kb/tests/draft-submission.test.js
```

Expected: partial journals are absent from status and do not block new jobs.

- [x] **Step 3: Implement journal projection and next-action precedence**

Read only write-once phase files with schema validation. Reject corrupt or contradictory journals as `SUBMISSION_JOURNAL_CORRUPT`; do not silently skip them.

Precedence must be:

1. unresolved worker-write review;
2. manual review;
3. non-terminal submission replay;
4. ordinary chapter/domain work;
5. assembly/verification/publication.

- [x] **Step 4: Re-run status tests and require GREEN**

Run the Step 2 command. Expected: exit `0`; interrupted submissions are machine-visible and block fresh dispatch.

---

### Task 6: Synchronize contracts and run the final controller gate

**Files:**
- Modify only after behavior is green: `.trellis/tasks/07-19-harden-game-kb-controller-invariants/prd.md`
- Modify only after behavior is green: `.trellis/tasks/07-19-harden-game-kb-controller-invariants/design.md`
- Modify only after behavior is green: `.trellis/tasks/07-19-harden-game-kb-controller-invariants/verification.md`
- Verify: `.trellis/tasks/07-19-harden-game-kb-controller-invariants/implement.md`

- [x] **Step 1: Run the focused repair suite**

Run:

```powershell
rtk node --test .agents/skills/generate-game-kb/tests/accepted-serialization.test.js .agents/skills/generate-game-kb/tests/artifact-immutability.test.js .agents/skills/generate-game-kb/tests/accept-retry.test.js .agents/skills/generate-game-kb/tests/draft-submission.test.js .agents/skills/generate-game-kb/tests/worker-guard.test.js .agents/skills/generate-game-kb/tests/draft-preflight.test.js .agents/skills/generate-game-kb/tests/draft-recovery.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js .agents/skills/generate-game-kb/tests/next-action.test.js .agents/skills/generate-game-kb/tests/status-next-action.test.js
```

Expected: exit `0`, zero failures, no unexpected skips.

- [x] **Step 2: Run the complete game-KB suite**

Run:

```powershell
rtk node --test .agents/skills/generate-game-kb/tests/*.test.js
```

Expected: exit `0`, TAP `fail 0`; integration tests may skip only for their existing explicit fixture prerequisites.

- [x] **Step 3: Re-run protected-artifact immutability verification**

Run `artifact-immutability.test.js` with a before/after hash inventory. Expected: 76 legacy JSON-as-YAML accepted artifacts across four runs, changed count `0`.

Run `rtk git status --short` and confirm no real-novel, installed KB, `.claude/skills/*`, or unrelated dirty path was added by this repair. Pre-existing unrelated modifications must remain byte-identical.

- [x] **Step 4: Update PRD and design losslessly**

Update technical notes/signatures to include:

- explicit `--guard-id` on submit and recover;
- append-only journal phases and result semantics;
- explicit submission ID/attempt idempotency;
- true Git-root observation boundary;
- recovery through current attempt and normal acceptance;
- status projection for interrupted submission replay.

Do not weaken or delete any acceptance criterion. Mark a criterion complete only when a named automated test and fresh command prove it.

- [x] **Step 5: Replace the failed verification verdict with fresh evidence**

In `verification.md`, preserve the original failure findings as historical context, add a dated resolution section mapping each blocker to tests and implementation paths, and change the gate decision only if Steps 1–3 all pass.

- [x] **Step 6: Final self-review before handoff**

Confirm:

- no placeholder markers, disabled assertions, skipped regressions, debug logging, warning suppression, or test-only production bypass were added;
- all new error codes are asserted through both library and CLI tests;
- worker payloads still contain no path or writable target;
- journal and recovery responses never expose raw model content;
- same-content replay is byte-idempotent and conflicting replay is non-mutating;
- Lite worker planning remains separate and consumes, rather than reimplements, these controller contracts.

Stop after verification and report the evidence. Do not start the Lite worker implementation or archive the task without the user's review.
