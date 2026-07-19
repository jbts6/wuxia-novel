# Game KB Controller Invariants Implementation Plan

> **Verification repair gate (2026-07-19):** Tasks 1–7 below record the original implementation pass but are not accepted. Execute every unchecked step in [`repair-plan.md`](./repair-plan.md) and rerun the final gate before treating this task as complete.

> **For inline Codex execution:** REQUIRED SUB-SKILLS: use `trellis-before-dev`, `test-driven-development`, `writing-skills` when touching Skill-facing contracts, and `verification-before-completion`. Do not dispatch implement/check sub-agents.

**Goal:** Emit canonical accepted YAML and make the controller the only component that turns model output into files, with zero-write workers, guarded effects, bounded rejection, crash-safe stdin submission, and explicit recovery of valid misplaced drafts.

**Architecture:** Add a serialization marker and canonical byte writer to the existing ledger, split acceptance into a reusable content core, and layer a stdin submission broker, zero-write repository guard, and recovery modules behind small `flow.js` routes. Existing immutable artifacts remain readable but become write-locked.

**Tech Stack:** Node.js CommonJS, Node built-ins (`fs`, `path`, `crypto`), `js-yaml`, `node:test`, Windows path and junction semantics.

## Global Constraints

- Keep `07-19-audit-v6-knowledge-bases` paused; do not implement its migration changes concurrently.
- Treat `.game-kb-migration-staging` as parent-controller-owned: never expose it to workers and do not exclude it from the empty-write worker guard.
- Do not modify `古龙/凤舞九天`, the 76 existing accepted artifacts, installed data, `.claude/skills/*`, or unrelated dirty files.
- Prefix shell verification commands with `rtk`.
- Use TDD for each task. Trellis Phase 3 owns commits; do not create intermediate commits from this checklist.
- Worker-visible jobs contain no output path and workers have an empty write set.
- A broker identity mismatch or rogue path never consumes attempt; a correctly identified invalid envelope does.
- All controller-internal paths use Windows-aware normalized/realpath comparison and are never accepted from broker CLI input.

---

### Task 1: Canonical accepted serialization and legacy write gate

**Files:**
- Create: `.agents/skills/generate-game-kb/tests/accepted-serialization.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/io.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-import.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/tests/artifact-immutability.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/chapter-import.test.js`

**Interfaces:**
- Produces: `serializeYaml(value): string`, `ACCEPTED_SERIALIZATION = 'yaml-v1'`, and `assertAcceptedSerialization(run, command): void`.
- Produces: artifact entries with `serialization: 'yaml-v1'` and hashes of the exact YAML bytes.

- [x] **Step 1: Write failing canonical-byte and legacy-gate tests**

```js
assert.equal(raw.trimStart().startsWith('{'), false);
assert.deepEqual(yaml.load(raw), normalizedValue);
assert.equal(entry.content_hash, sha256(raw));
assert.throws(
  () => assertAcceptedSerialization({ run_id: 'legacy' }, 'accept'),
  error => error.code === 'LEGACY_ACCEPTED_SERIALIZATION'
);
```

- [x] **Step 2: Run the focused tests and confirm RED**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/accepted-serialization.test.js .agents/skills/generate-game-kb/tests/artifact-immutability.test.js`

Expected: failures show JSON accepted bytes, missing marker, and missing legacy gate.

- [x] **Step 3: Add the canonical serializer and marker**

```js
const ACCEPTED_SERIALIZATION = 'yaml-v1';

function serializeYaml(value) {
  return yaml.dump(value, { lineWidth: -1, noRefs: true });
}

function atomicWriteYaml(file, value) {
  const content = serializeYaml(value);
  atomicWriteFile(file, content);
  return content;
}
```

Have `recordAcceptedArtifact()` compute `content_hash` from `serializeYaml(value)`, write those exact bytes, and add the serialization field. Add the marker only when creating a new run; never update an existing run in place.

- [x] **Step 4: Enforce read-only compatibility**

```js
function assertAcceptedSerialization(run, command) {
  if (run.accepted_serialization === ACCEPTED_SERIALIZATION) return;
  if (new Set(['status', 'verify', 'archive-run']).has(command)) return;
  throw new GameKbError('LEGACY_ACCEPTED_SERIALIZATION', 'Start a new run', {
    run_id: run.run_id,
    required: ACCEPTED_SERIALIZATION,
    action: 'start-new-run'
  });
}
```

Apply it at the existing run command boundary without preventing status, verification, or archival.

- [x] **Step 5: Re-run focused tests and require GREEN**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/accepted-serialization.test.js .agents/skills/generate-game-kb/tests/artifact-immutability.test.js .agents/skills/generate-game-kb/tests/run-isolation.test.js`

Expected: all tests pass; fixture-created accepted files are block YAML.

---

### Task 2: Zero-write worker job and controller-internal staging identity

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-batching.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/tests/chapter-batching.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/status-next-action.test.js`

**Interfaces:**
- Produces: each chapter job has `worker_write_paths: []` and submission identities containing only batch/unit/attempt/input hash.
- Preserves: controller-internal absolute staging paths for broker/recovery, but the worker projection omits them.
- Produces: `paths.workerGuards`, `paths.draftSubmissions`, and `paths.draftRecoveries` inside the selected run work directory.

- [x] **Step 1: Write failing job-contract tests**

```js
assert.deepEqual(job.worker_write_paths, []);
assert.deepEqual(job.submissions, job.chapters.map(({ unit, attempt, input_hash }) => ({
  unit, attempt, input_hash
})));
assert.equal(JSON.stringify(workerProjection(job)).includes('staging_path'), false);
```

Also reject a non-empty worker write set, missing/extra identity field, stale attempt, worker-visible output path, and a controller-internal staging junction escape.

- [x] **Step 2: Run focused tests and confirm RED**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/chapter-batching.test.js .agents/skills/generate-game-kb/tests/status-next-action.test.js`

Expected: zero-write projection and submission-identity assertions fail.

- [x] **Step 3: Implement zero-write worker projection**

```js
function jobFor(chapters) {
  return {
    batch_id: batchId(chapters),
    chapters,
    worker_write_paths: [],
    submissions: chapters.map(({ unit, attempt, input_hash }) => ({ unit, attempt, input_hash }))
  };
}
```

Keep the full descriptor only in controller/main-agent state and provide an explicit worker projection that contains the read-only source path plus submission identity, never an output path. Create the staging parent only inside controller submission/recovery code.

- [x] **Step 4: Re-run focused tests and require GREEN**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/chapter-batching.test.js .agents/skills/generate-game-kb/tests/status-next-action.test.js .agents/skills/generate-game-kb/tests/cli.test.js`

Expected: all tests pass with Chinese absolute paths.

---

### Task 3: Repository delta guard

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/worker-guard.js`
- Create: `.agents/skills/generate-game-kb/tests/worker-guard.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/next-action.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`

**Interfaces:**
- Produces: `openWorkerGuard({ repositoryRoot, paths, job })`.
- Produces: `checkWorkerGuard({ repositoryRoot, paths, guardId })`.
- Produces: `unresolvedWorkerGuardReports(paths)` for scheduler/publication blocking.

- [x] **Step 1: Write failing guard tests**

Build a temporary Git repository and assert detection of:

```js
const forbidden = [
  'game-kb/chapter.yaml',
  '.trellis/game-kb/chapter.yaml',
  'docs/game-kb/chapter.yaml',
  'novel/.game-kb-work/runs/run/out/chapter.yaml',
  'novel/.game-kb-work/runs/run/output/chapter.yaml'
];
```

Also cover modifying source text, deleting a file, creating a directory, a worker write to the controller-internal staging destination, Windows case normalization, and symlink/junction escapes where supported. Every repository change during worker phase is forbidden.

Generate at runtime an unpredictable nested directory and filename below the temporary repository. Do not pass that path to `guard-open`; after creation, assert `guard-check` returns its exact repository-relative and normalized absolute paths, change kind, and entry type. Assert the result is identical whether the simulated worker report names the file, omits it, or names a different file. Add a boundary-message assertion that the guard promises repository-root coverage only.

- [x] **Step 2: Run guard tests and confirm RED**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/worker-guard.test.js`

Expected: module-not-found or missing-export failures.

- [x] **Step 3: Implement snapshot and comparison**

```js
function snapshotEntry(root, target) {
  const stat = fs.lstatSync(target, { bigint: true });
  return {
    path: path.relative(root, target),
    type: stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other',
    size: stat.size.toString(),
    mtime_ns: stat.mtimeNs.toString()
  };
}
```

Exclude only `.git`, `node_modules`, and controller-owned guard artifacts. Resolve every changed path against the controller-derived empty worker set. Return relative and normalized absolute paths plus change kind, entry type, and before/after fingerprints for every delta. Persist immutable open/check receipts atomically. Do not add whole-disk scanning or imply OS-level coverage outside `repositoryRoot`.

- [x] **Step 4: Block scheduling on unresolved violations**

```js
const violations = unresolvedWorkerGuardReports(paths);
if (violations.length > 0) {
  return { next_action: 'worker-write-review', next_units: [], worker_guard_reports: violations };
}
```

- [x] **Step 5: Re-run guard and scheduler tests**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/worker-guard.test.js .agents/skills/generate-game-kb/tests/next-action.test.js`

Expected: a no-change worker phase passes; every filesystem effect, including an internal staging write, blocks broker submission and the scheduler.

---

### Task 4: Crash-safe controller-owned stdin submission broker

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/draft-submission.js`
- Create: `.agents/skills/generate-game-kb/tests/draft-submission.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/tests/accept-retry.test.js`

**Interfaces:**
- Produces: `submitChapterEnvelope({ paths, batchId, unit, attempt, rawInput, faultAt })`.
- Produces: immutable submission receipts under `paths.draftSubmissions`.
- Refactors: file-based and envelope-based acceptance share one validation/archive/progress core.

- [x] **Step 1: Write failing envelope identity and input-boundary tests**

Cover a valid JSON envelope plus empty input, NUL, oversized input, multiple envelopes, malformed JSON, wrong schema version, wrong batch/unit/attempt/input hash, stale run state, and legacy-serialization run. CLI batch/unit/attempt identifies malformed input so a current malformed payload is a content rejection; stale CLI identity fails before attempt accounting.

- [x] **Step 2: Write failing submission and retry tests**

Assert a valid `draft` object becomes controller-authored canonical staging YAML and accepted YAML. Assert forbidden/missing fields, wrong hash, missing name, fabricated quote, and malformed JSON record exactly one immutable rejection; attempt 2 then reaches `manual_review`, and no attempt 3 can be submitted.

```js
const result = submitChapterEnvelope({
  paths,
  batchId: job.batch_id,
  unit: 'chapter:008',
  attempt: 1,
  rawInput: JSON.stringify(envelope)
});
assert.equal(result.status, 'accepted');
assert.equal(fs.readFileSync(result.accepted_file, 'utf8').trimStart().startsWith('{'), false);
```

- [x] **Step 3: Write failing replay/fault-injection tests**

Inject failure after `binding`, `staging-written`, `submission-recorded`, and `accepted-written`. Re-run the identical raw payload and require one final result, one consumed attempt, stable hashes, and no duplicate archive. Re-run with a different raw hash for the same unit/attempt and require `SUBMISSION_REPLAY_CONFLICT` with byte-identical artifacts and progress.

- [x] **Step 4: Run broker tests and confirm RED**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/draft-submission.test.js .agents/skills/generate-game-kb/tests/accept-retry.test.js`

Expected: missing broker/core exports and replay behavior fail.

- [x] **Step 5: Refactor acceptance core and implement broker**

Keep legacy `acceptDraft({ draftPath })` behavior for compatible non-Lite routes, but extract a core that receives raw/canonical content plus current controller context. The broker must:

1. validate current CLI batch/unit/attempt before parsing stdin;
2. bind raw SHA-256 in an immutable receipt;
3. parse exactly one JSON envelope and, when parseable, verify its duplicate identity fields;
4. canonicalize only `envelope.draft` with the canonical YAML writer;
5. write only the controller-derived staging path and immediately call the shared accept core;
6. resume same-hash receipts and reject conflicting hashes.

- [x] **Step 6: Re-run broker/retry tests and require GREEN**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/draft-submission.test.js .agents/skills/generate-game-kb/tests/accept-retry.test.js .agents/skills/generate-game-kb/tests/accepted-serialization.test.js`

Expected: valid/invalid/replay/fault cases pass and every accepted `.yaml` is canonical block YAML.

---


### Task 5: Read-only rogue-file preflight and explicit recovery

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/draft-preflight.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/draft-recovery.js`
- Create: `.agents/skills/generate-game-kb/tests/draft-preflight.test.js`
- Create: `.agents/skills/generate-game-kb/tests/draft-recovery.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/tests/accept-retry.test.js`

**Interfaces:**
- Produces: `preflightChapterDraft({ paths, manifest, unit, draftPath, enforceIssuedPath })`.
- Produces: `recoverChapterDraft({ repositoryRoot, paths, manifest, unit, sourcePath, confirmed })`.

- [x] **Step 1: Write failing preflight tests**

Assert that valid, malformed, forbidden-field, missing-field, wrong-hash, missing-name, and fabricated-quote rogue-file fixtures return the same error codes as the shared accept core, while progress and artifact files remain byte-identical. Document that this interface is recovery-only and never accepts normal worker responses.

- [x] **Step 2: Write failing path-only recovery tests**

```js
const before = readJson(paths.progress);
const receipt = recoverChapterDraft({
  repositoryRoot,
  paths,
  manifest,
  unit: 'chapter:008',
  sourcePath: misplacedValidYaml,
  confirmed: true
});
assert.deepEqual(readJson(paths.progress), before);
assert.equal(fs.existsSync(receipt.destination_path), true);
assert.equal(fs.existsSync(misplacedValidYaml), true);
```

Reject missing confirmation, ambiguity, another novel run, symlink/junction, invalid content, existing destination, stale unit, and attempt 3.

- [x] **Step 3: Run tests and confirm RED**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/draft-preflight.test.js .agents/skills/generate-game-kb/tests/draft-recovery.test.js .agents/skills/generate-game-kb/tests/accept-retry.test.js`

Expected: missing modules/exports and missing recovery behavior fail.

- [x] **Step 4: Implement preflight through shared validator context**

```js
const value = yaml.load(raw);
const errors = validateChapterDraft(value, {
  number: chapter.number,
  title: chapter.title,
  inputHash: chapter.input_hash,
  chapterText: fs.readFileSync(chapter.file, 'utf8')
});
return { valid: errors.length === 0, errors, value, canonical_yaml: serializeYaml(value) };
```

Do not update progress or ledger from this function.

- [x] **Step 5: Implement confirmed recovery and immutable receipt**

Write canonical YAML to the current issued staging path, preserve the source, and atomically write source/destination paths, hashes, unit, attempt, input hash, and timestamp under `paths.draftRecoveries`.

- [x] **Step 6: Verify retry semantics**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/draft-preflight.test.js .agents/skills/generate-game-kb/tests/draft-recovery.test.js .agents/skills/generate-game-kb/tests/accept-retry.test.js`

Expected: rogue paths never spend attempt; normal invalid envelopes reach manual review after two broker submissions; no attempt 3 exists.

---

### Task 6: CLI integration and machine-readable status

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/tests/lite-cli-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/status-next-action.test.js`

**Interfaces:**
- Produces: `lite-guard-open`, `lite-guard-check`, `lite-submit-draft`, `lite-check-draft`, and `lite-recover-draft` CLI routes.
- Produces: status fields `accepted_serialization`, `chapter_jobs[].worker_write_paths`, submission identities, and unresolved guard reports.

- [x] **Step 1: Write failing CLI contract tests**

Invoke each command with `--json`; for `lite-submit-draft`, use `spawnSync(..., { input })` and assert there is no `--draft`/path input. Cover missing flags, wrong profile, stale identity, empty/oversized stdin, legacy run, submission before clean guard check, path-only recovery, and guard violations; require stable codes and no unrelated mutation.

- [x] **Step 2: Run CLI tests and confirm RED**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js .agents/skills/generate-game-kb/tests/status-next-action.test.js`

Expected: new commands are unknown and new status fields are absent.

- [x] **Step 3: Add minimal routes**

```js
'lite-guard-open': { command: 'guard-open', profile: PROFILE_LITE },
'lite-guard-check': { command: 'guard-check', profile: PROFILE_LITE },
'lite-submit-draft': { command: 'submit-draft', profile: PROFILE_LITE },
'lite-check-draft': { command: 'check-draft', profile: PROFILE_LITE },
'lite-recover-draft': { command: 'recover-draft', profile: PROFILE_LITE }
```

Each route must resolve the selected run and derive paths/jobs from controller state rather than trusting caller paths. `submit-draft` synchronously reads one bounded UTF-8 payload from fd 0, requires a completed clean guard receipt for the batch, and passes no path from argv or stdin into the writer.

- [x] **Step 4: Re-run CLI tests and require GREEN**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js .agents/skills/generate-game-kb/tests/status-next-action.test.js .agents/skills/generate-game-kb/tests/cli.test.js`

Expected: all commands, stdin boundaries, zero-write job fields, guard ordering, and status contracts pass.

---

### Task 7: Controller regression gate

**Files:**
- Verify only; fix only files owned by Tasks 1–6 if failures reveal regressions.

- [x] **Step 1: Run focused safety suite**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/accepted-serialization.test.js .agents/skills/generate-game-kb/tests/artifact-immutability.test.js .agents/skills/generate-game-kb/tests/chapter-batching.test.js .agents/skills/generate-game-kb/tests/worker-guard.test.js .agents/skills/generate-game-kb/tests/draft-submission.test.js .agents/skills/generate-game-kb/tests/draft-preflight.test.js .agents/skills/generate-game-kb/tests/draft-recovery.test.js .agents/skills/generate-game-kb/tests/accept-retry.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js`

Expected: all tests pass.

- [x] **Step 2: Run the complete game-KB suite**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/*.test.js`

Expected: zero failures; integration tests may skip only when their existing explicit fixture prerequisites are absent.

- [x] **Step 3: Verify protected artifacts**

Compare pre/post hashes for the 76 legacy accepted files and run `rtk git status --short`. Expected: no real-novel or unrelated dirty path changed; only planned controller files and task artifacts differ.
