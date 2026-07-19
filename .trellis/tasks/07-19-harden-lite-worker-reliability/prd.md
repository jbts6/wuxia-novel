# Harden Lite worker reliability

## Goal

Make `generate-game-kb-lite` use chapter workers only for extraction, return structured content without filesystem writes, and delegate all path selection, YAML serialization, validation, and submission state to the controller.

## Background

- This is an independently verifiable child of `07-19-audit-v6-knowledge-bases`.
- The frozen `古龙/凤舞九天` Lite run is the concrete failure example and must remain untouched.
- The selected compatibility policy preserves every pre-fix accepted artifact byte-for-byte and forbids continuing a run that already contains JSON-serialized accepted YAML. A corrected `古龙/凤舞九天` build must start as a new run after both child tasks pass.
- Its controller status reports seven completed chapters and fifteen pending chapters.
- Its staging directory contains twenty YAML-suffixed files. Five do not parse as YAML; every parseable staging file still fails the chapter validator.
- Common failures include `SOURCE_QUOTE_NOT_FOUND`, `SOURCE_NAME_NOT_FOUND`, and `SOURCE_HASH_MISMATCH`. One draft also exhibits broad forbidden/missing-field drift.
- Workers wrote chapter YAML outside the novel run under repository-root `game-kb/`, `.trellis/game-kb/`, and `docs/game-kb/`, and invented `out/` and `output/` directories inside the run.
- A worker also created `chapter_021_attempt_03.yaml`, exceeding the bounded initial-plus-one-retry contract.
- The Lite extraction prompt says to use the issued `staging_path`, but unlike the full workflow prompt it does not explicitly forbid every other file/directory write or require all writes to remain within the selected novel's current run.
- The worker's prose self-check misclassified controller-owned accepted serialization, understated grounding/hash failures, and omitted path and attempt violations. Model-authored self-checks are therefore not acceptance evidence.

## Requirements

- Treat `lite-status` as the sole scheduler and copy only the controller-issued `run_id`, `batch_id`, `unit`, `attempt`, absolute read-only `source_file`, and `input_hash` into the worker job. Do not include any staging path, output directory, output filename, or write allowlist path.
- Give workers an explicit zero-write contract: do not create, modify, move, or delete any file or directory and do not invoke the submission/controller scripts. A worker reads its assigned source and returns one structured JSON submission envelope per chapter to the main agent.
- Require each envelope to repeat the controller identity fields and contain the V6 chapter data as a JSON `draft` object. Require one envelope per chapter and prohibit multi-chapter objects or cross-chapter evidence.
- Keep the worker prompt concise but low-freedom: include the exact V6 chapter shape, required and forbidden fields, null/empty-array rules, exact quote requirements, source-hash binding, and named-technique rule.
- Require the main agent to run `guard-open`, dispatch the worker, run `guard-check`, and only after a clean result pass each envelope unchanged through stdin to `lite-submit-draft`. The main agent must not hand-serialize YAML, create a temporary draft, construct a destination path, or call legacy `lite-accept --draft` for normal Lite work.
- Treat controller validation and status as authoritative. The worker's prose self-check is non-authoritative, and the first correctly identified envelope submitted to the broker consumes the attempt whether accepted or rejected.
- Compare worker filesystem effects against an empty write allowlist. Any repository change must stop orchestration before broker submission, preserve evidence, and report exact paths without automatic deletion.
- Never expose or use the paused parent task's `.game-kb-migration-staging`; it is a future migration-controller workspace, not a worker scratch/output location.
- Preserve the initial submission plus at most one automatic retry. Never infer or manufacture attempt 3; only an explicit user-confirmed retry cycle may obtain a newly issued submission identity.
- After an attempt 1 content rejection, re-read status and dispatch the controller-issued attempt 2 identity; an attempt 2 content rejection enters `manual_review` and stops automatic work.
- Treat wrong-path files as rogue/legacy evidence outside the normal protocol. If the controller reports one as uniquely recoverable, request explicit confirmation and use only the controller recovery command; never move or copy it manually.
- After each accepted batch, re-read controller status rather than inferring progress from staging, drafts, or the worker's report.
- If the controller reports a legacy accepted-serialization run, stop and require a new run; never ask a worker to continue into a mixed-serialization run.
- Validate the updated skill and its prompt/resources with deterministic regression fixtures derived from the incident, not by modifying the live incident run.

## Acceptance Criteria

- [x] Dispatch construction uses only fields returned by `lite-status`; the worker payload contains an absolute read-only `source_file` but no output path or writable location.
- [x] Prompt-contract tests require zero filesystem writes, no controller/script invocation, one JSON envelope per chapter, exact identity fields, exact schema, source grounding, and bounded attempts.
- [x] The lifecycle is exactly `status -> guard-open -> worker message -> guard-check -> main-agent stdin submit -> status`; fixtures reject worker file writes, main-agent file writes, path arguments, or submission before a clean guard result.
- [x] A valid structured chapter fixture is converted by `lite-submit-draft` into canonical YAML and accepted without any model-authored file.
- [x] A wrong-path but fully valid fixture is reported as recoverable, remains byte-preserved at its original path, and can be copied to the issued absolute path only through explicit controller recovery without a failed attempt.
- [x] A correctly identified malformed JSON envelope or invalid `draft` is formally rejected, consumes exactly one attempt, and cannot be silently rewritten under the same attempt.
- [x] Forbidden fields, missing required fields, wrong source hash, fabricated quotes, and missing source names fail broker validation with machine-readable errors; YAML formatting and serialization are controller-owned rather than model-authored.
- [x] A simulated worker write to `game-kb/`, `.trellis/game-kb/`, `docs/game-kb/`, `out/`, `output/`, or an unissued staging filename is detected before acceptance and reported without deletion.
- [x] A simulated write to an unpredictable nested repository path is located from the controller's before/after inventory and reported with its exact absolute path even when worker prose does not disclose it; user-facing wording does not promise discovery outside the repository root.
- [x] A simulated third attempt cannot be dispatched without an explicit controller-issued retry cycle.
- [x] Attempt 1 rejection can dispatch only controller-issued attempt 2; attempt 2 rejection reports `manual_review` and dispatches nothing.
- [x] A pre-fix run with JSON-serialized accepted artifacts cannot dispatch or accept additional chapter work; a fresh run uses canonical YAML throughout.
- [x] Worker prose cannot mark a unit accepted; only controller status can do so.
- [x] Regression tests reproduce the incident classes without reading from or writing to the frozen `古龙/凤舞九天` run.
- [x] Skill validation and the relevant game-KB test suite pass while unrelated working-tree changes remain untouched.

## Dependencies and Boundaries

- This child owns the Lite skill, extraction prompt, zero-write worker envelope contract, main-agent broker lifecycle, filesystem-delta guard usage, and trustworthy reporting rules.
- It depends on `07-19-harden-game-kb-controller-invariants` for `lite-submit-draft`, canonical serialization, the empty-write guard contract, recovery, attempt accounting, and status.
- Implementation starts only after the controller child is complete and green; its broker/guard/status contracts are prerequisites, not duplicated assumptions.

## Out of Scope

- Reusing, repairing, accepting, archiving, or deleting the frozen incident run.
- Changing V6 domain semantics or enriching the novel knowledge base.
- Treating model-authored self-assessment as authoritative validation.
