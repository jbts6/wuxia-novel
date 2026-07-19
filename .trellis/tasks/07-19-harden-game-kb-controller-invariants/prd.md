# Harden game KB controller invariants

## Goal

Make the V6 game-KB controller produce canonical YAML artifacts and own the complete model-output submission path so workers never choose a filesystem location or write a file.

## Background

- This is an independently verifiable child of `07-19-audit-v6-knowledge-bases`.
- The frozen `古龙/凤舞九天` Lite run is the reproducing incident. This task must not resume, repair, accept, delete, or rewrite that live run.
- All seven files under its `accepted/chapters/` use a `.yaml` suffix but contain pretty-printed JSON. `recordAcceptedArtifact()` serializes accepted values with `JSON.stringify()` in `.agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js:111`, although `.agents/skills/generate-game-kb/scripts/lib/io.js:34` already provides `atomicWriteYaml()`.
- Repository inventory found four affected runs and 76 accepted `.yaml` files; all 76 contain JSON serialization. The 20 final or installed V6 YAML files inspected use non-JSON YAML serialization, so the defect is currently confined to the accepted-artifact layer.
- JSON is parseable as YAML, so parser-only tests do not prove that the controller emitted canonical YAML.
- Accepted artifact manifests bind the exact serialized bytes. Silently rewriting an existing accepted artifact would violate immutability and invalidate its recorded content hash.
- `.agents/skills/generate-game-kb/scripts/lib/accept.js:40` already checks exact-path equality and realpath containment for submitted drafts. The incident shows that these acceptance checks do not by themselves prevent or diagnose additional files written elsewhere by a worker.
- `flow.js` currently accepts drafts only through `--draft <path>` and the repository has no stdin/content-submission route. A no-worker-write design therefore requires a new controller-owned broker rather than another prompt-only path rule.

## Requirements

- Serialize every newly accepted chapter and domain decision as deterministic block-style YAML, not JSON text stored behind a YAML suffix.
- Compute artifact hashes from exactly the canonical bytes written to disk, and preserve manifest/hash immutability checks.
- Preserve semantic normalization: changing serialization must not change the accepted data model.
- Treat any run that already contains pre-fix JSON-as-YAML accepted artifacts as a legacy-serialization run: allow read-only verification and archival, but reject further accepted writes with an explicit error. Never mix legacy JSON serialization and canonical YAML in one run; continuing work requires a new run.
- Keep controller-internal staging paths absolute, run-scoped, attempt-specific, and derived from the selected novel directory, but do not expose any output path in the worker-visible payload.
- Replace normal worker filesystem submission with a controller-owned `lite-submit-draft` broker. The worker returns one structured JSON envelope per chapter to the main agent; the main agent passes the envelope to the broker through stdin and must not create a draft file or construct a destination path itself.
- Bind every envelope to `schema_version`, `batch_id`, `unit`, `attempt`, `input_hash`, and a `draft` object. The broker must compare those identity fields with current controller state before any attempt accounting.
- Derive the only destination inside the controller, serialize the submitted `draft` object as deterministic block-style YAML, and immediately execute the normal validation, archive, acceptance, and progress transition. Neither worker nor main-agent CLI input may supply a draft path.
- Treat a correctly identified envelope as the submission attempt: malformed JSON, wrong draft shape, schema failure, grounding failure, or hash failure consumes the current attempt. Identity/staleness mismatches fail before the attempt budget.
- Make broker replay crash-safe and idempotent. Replaying the same unit/attempt/content hash may resume or return its immutable result; a different payload for an already-bound unit/attempt must fail without overwriting evidence or consuming a second attempt.
- Open the worker filesystem guard with an empty write allowlist. During worker execution every repository change is unauthorized; controller-owned submission writes occur only after a clean `guard-check` closes the worker phase.
- Report path-contract violations with the offending paths and stop the affected run before publication; do not automatically delete unrecognized files.
- Discover violations from a recursive before/after inventory of the entire repository root, including ignored and untracked entries, rather than by guessing filenames or trusting the worker report. The guard result must return every discovered path as both repository-relative and normalized absolute paths with its change kind.
- State the observation boundary explicitly: the repository guard guarantees discovery only beneath the repository root. The adopted broker removes every legitimate worker filesystem write and therefore removes output-path choice from the normal protocol, but it is not an OS sandbox and must not be described as detecting arbitrary writes elsewhere on the machine.
- Classify a wrong-path draft before the submission budget. A path mismatch never consumes an attempt, even when the draft content is invalid.
- Allow explicit recovery only when a wrong-path regular file is inside the repository, maps uniquely to the current chapter descriptor, and passes the complete parser, schema, source-hash, name, and quote checks. Recovery must require confirmation, write canonical YAML to the issued absolute staging path, preserve the original file, and record both hashes and paths.
- Retain path-based preflight/recovery only for guard-discovered rogue or legacy misplaced files; it is not the normal submission route and must never enable hidden unlimited rewrites.
- Preserve novel source text, unrelated user files, accepted siblings, and the frozen incident run.

## Acceptance Criteria

- [ ] A newly accepted chapter and domain decision exactly match the controller's canonical YAML serializer and do not begin with a JSON object or array delimiter.
- [ ] The accepted artifact manifest hashes exactly match the canonical bytes on disk.
- [ ] Round-tripping canonical YAML preserves the normalized accepted value.
- [ ] Tests fail if accepted `.yaml` files are written with `JSON.stringify()` or otherwise contain JSON serialization.
- [ ] All 76 existing JSON-as-YAML accepted artifacts remain byte-identical and readable for verification or archival.
- [ ] A run containing any legacy JSON-as-YAML accepted artifact rejects further accepted writes with an explicit legacy-serialization error and directs the caller to create a new run.
- [ ] Controller-internal descriptor paths remain absolute and contained by the selected run's staging directory, while worker-visible jobs contain no `staging_path`, `allowed_write_paths`, output directory, or output filename.
- [ ] `lite-submit-draft` accepts one bounded UTF-8 JSON envelope through stdin, accepts no draft-path argument, derives the current destination itself, and works with Chinese names and spaces without shell path interpolation.
- [ ] A valid envelope is serialized by the controller as canonical YAML and accepted without the worker or main agent writing any file.
- [ ] Stale or mismatched batch/unit/attempt/input-hash identity fails without spending an attempt; a correctly identified malformed or invalid envelope records exactly one rejection.
- [ ] Same-content replay is idempotent across injected crash points, while conflicting replay cannot overwrite staging, archive, receipt, accepted artifact, or progress state.
- [ ] A reported path-contract violation blocks publication and retains the offending evidence for user review.
- [ ] A worker-created file at an unpredicted, randomly nested path anywhere below the repository root is returned by `guard-check` with its exact normalized absolute path even when the worker omits or lies about that path; ignored and untracked paths are covered.
- [ ] Worker-phase guard tests use an empty write allowlist: even a write to the controller's internal staging destination is a violation before broker submission.
- [ ] Tests and operator messages describe repository-root coverage and broker protection accurately and never imply OS-level discovery outside the observation root.
- [ ] A path-only failure leaves progress and attempt unchanged and reports whether the misplaced draft is recoverable.
- [ ] Confirmed recovery copies a uniquely matched, fully valid draft to the issued absolute path, records a recovery receipt, preserves the source evidence, and does not consume a failed attempt.
- [ ] Ambiguous, cross-book, symlinked, or content-invalid misplaced drafts cannot be recovered automatically.
- [ ] Identity-matched content-invalid envelopes consume attempt 1 or attempt 2 through the broker rejection record; attempt 2 failure enters `manual_review` and no attempt 3 is issued.
- [ ] The controller test suite passes without modifying `古龙/凤舞九天` or unrelated working-tree files.

## Dependencies and Boundaries

- This child owns deterministic controller behavior, serialization, hashes, descriptor paths, and machine-readable safety signals.
- `07-19-harden-lite-worker-reliability` consumes those controller signals and owns dispatch prompts, zero-write worker behavior, guard/broker orchestration, and reporting; it does not own guard comparison or model-output validation logic.
- Controller implementation and tests complete first. The worker child starts from the stabilized broker/guard interface and must not independently recreate controller behavior.
- The paused parent task's `.game-kb-migration-staging` is migration-controller-owned, never worker-visible, and never a model write target. It receives no special worker-guard exemption.

## Out of Scope

- Repairing or continuing the frozen `古龙/凤舞九天` run.
- Improving model extraction quality, prompt adherence, or self-authored worker summaries.
- Archiving or deleting the incident's stray files.
