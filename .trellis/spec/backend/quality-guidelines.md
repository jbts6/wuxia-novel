# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

Generated knowledge bases are evidence pipelines. Quality must be demonstrated by reproducible source coverage, candidate closure, and independent hard gates, never by model self-assessment, quantity thresholds, or aggregate scores.

---

## Forbidden Patterns

- Never use an LLM-generated baseline as gold data or as the recall denominator.
- Never replace complete source matching with prefixes, keywords, anchors, or truncated fragments.
- Never allow a strong category to compensate for a blocking source, ledger, evidence, recall, or semantic failure.
- Never reject an explicitly named and grounded martial skill or technique as `trivial`, `non_major`, or low frequency.

---

## Required Patterns

- The managed generate-kb run is a fixed six-stage state machine: `prepare`, `inventory`, `reconcile`, `enrich`, `semantic-audit`, and `publish`. A session must read `status --json` and execute only the returned next action.
- For audit-grade managed runs under `.agents/skills/generate-kb`, `scripts/pipeline.js` is the only supported write entry. AI output uses `claim -> draft -> submit`; packet bindings include stage, work-item ID, input hash, worker, and lease. Stale, duplicate, cross-stage, or non-current submissions must be rejected atomically.
- Before `publish`, records use provisional keys and no formal `data/*.json`, `reports/*.json`, or `.kb/current` writes are allowed. Formal IDs, reference projection, reports, and final hashes are created once inside a verified staging bundle.
- Build the candidate ledger from each source window before reconciliation, classification, or enrichment.
- Every candidate must have exactly one keep/merge/redirect/reject decision; retained candidates point to stable provisional keys until publish projects one formal ID plan.
- Final entities, chapter summaries, descriptive fields, dialogues, and dialogue context must retain complete, chapter-local source evidence.
- The `enrich` stage must pass the shared provisional-data contract before semantic audit. Skeleton records such as `name/source_refs` are incomplete data, not valid low-detail records.
- Enrich identity checks must follow the final category schema. A dialogue record has no synthetic `name`; its reconcile `canonical_name` remains controller metadata for publish-time ID planning, while the record is bound by its provisional key and dialogue fields.
- Semantic evidence work items are created only for non-empty `field_evidence_claims`. Empty claim maps from categories with no inspected descriptive fields are valid and skipped after their provisional binding is validated; the complete audit set must still contain at least one real field check.
- Verification and cross-validation reports must include the stable hash of all eight current `data/*.json` files. A missing or stale hash is a blocking failure.
- G1-G5 must report independent PASS/FAIL results and reasons. Completion requires every gate to pass.
- `build-publish <novel-dir> --draft <publish-draft>` accepts only `schema_version`, active `run_id`, active `semantic_audit_hash`, and `token_plan`. A `report_inputs` field is invalid; verification, cross-validation, and quality reports are controller-generated from the projected staging data.
- The report generator must invoke verification and cross-validation with an explicit staging `dataRoot` and expected `final_data_hash`, then derive G1-G5 from current source, stage, recall, semantic, final-data, and report evidence. A report object supplied by an AI draft is never gate evidence.
- Repository-maintained automation that becomes part of a production workflow must use Python (`.py`). PowerShell (`.ps1`) is allowed only as a disposable Windows-local helper for intermediate artifacts; production commands, skills, tests, and release paths must not depend on it.

---

## Testing Requirements

- Source tests must cover CRLF, Chinese punctuation, overlapping windows, hash changes, and original/chapter-split divergence.
- Ledger tests must cover JSONL line errors, duplicate or unresolved candidates, invalid rejection, and missing final IDs.
- Gate tests must include historical false-pass fixtures and an end-to-end minimal complete knowledge base.
- Final-data tests must cover missing files, non-array JSON, missing required fields, invalid enums, conditional enrichment, CLI exit status, and stale report hashes.
- Citation tests must reject a quote composed of a real prefix and a fabricated suffix.

---

## Code Review Checklist

- Confirm the original novel file exists and `ch_split` remains ordered and aligned with it.
- Confirm all three scans cover every window and the final gap audit finds no valid additions.
- Confirm G4 reports candidates, keep/merge/redirect decisions, rejections, and reasons by category.
- Confirm no baseline score, quantity threshold, or overall score can be treated as proof of completeness.

## Scenario: Source-Grounded Knowledge Base Gate

### 1. Scope / Trigger

- Trigger: creating or changing wuxia knowledge base extraction, evidence verification, recall auditing, or completion gating.

### 2. Signatures

Managed runs use the single controller:

```text
node scripts/pipeline.js init <novel-dir> [--concurrency 1..4] [--risk-limit 1..15]
node scripts/pipeline.js status <novel-dir> --json
node scripts/pipeline.js run|claim|submit|check|advance <novel-dir> ...
node scripts/pipeline.js review-packet|record-review <novel-dir> ...
node scripts/pipeline.js build-publish|promote|rollback <novel-dir> ...
```

The default high-risk review limit is 15 and may be lowered to 10 or less. A queue above the configured limit must return an AI-rerun state; it must not silently discard omitted decisions.

Legacy diagnostic commands (including the direct scripts below) are read-only/`--dry-run` migration tools. When an active managed run exists, their write paths must fail with `MANAGED_RUN_WRITE_FORBIDDEN`.

- `node scripts/prepare-source.js <novel-dir> [--window-lines N] [--overlap-lines N]`
- `node scripts/validate-inventory.js <novel-dir>`
- `node scripts/validate-final-data.js <novel-dir> [--dry-run]`
- `node scripts/verify.js <novel-dir>`
- `node scripts/cross-validate.js <novel-dir>`
- `node scripts/audit-recall.js <novel-dir> [--legacy] [--dry-run]`
- `node scripts/assess-quality.js <novel-dir> [--report-only] [--dry-run]`

### 3. Contracts

- Request: `<novel-dir>/<novel-name>.txt` and its derived `ch_split/*.txt` files.
- Intermediate artifacts live under `build/generate-kb/runs/<run-id>/`: append-only `events.jsonl`, projected `state.json`, packet/draft/receipt work items, and `materialized/{inventory,reconcile,enrich,semantic-audit}`. Legacy root `build/` artifacts are not new-run inputs.
- `dialogue` enrich records match the published dialogue schema and therefore do not carry `name`; `provisional_key` binds them to the reconcile decision. Materialized evidence entries always retain that key, but only entries with one or more claimed fields become `semantic-evidence-audit` work items.
- Final data: all eight named `data/*.json` files must exist as arrays and satisfy the shared schema, enrichment, enum, nested-field, and evidence-field contract. Category-specific empty arrays are allowed only when the contract permits them; at least one character and at least one core/important character are required for non-vacuous semantic checks.
- Validation response: publish staging `reports/final_data_validation.json` contains separate `schema_errors` and `enrichment_errors`, plus `final_data_hash`. `--dry-run` must preserve the same exit status without writing the report.
- Freshness: `reports/verification_report.json.final_data_hash` and `reports/cross_validation_report.json.final_data_hash` must equal the current stable final-data hash.
- Response: `quality_report.json` contains independent G1-G5 results; G4 details contain candidates, kept, rejected, and unresolved entries by category.
- Human gold: accept `audit/gold.json` only when it has `provenance: human_curated`, the current `source_hash`, and complete grounded evidence for every item. Human recall receipts must bind the current source/reconcile hashes and cannot override an automatic gate failure.

### 4. Validation & Error Matrix

- Missing original novel or divergent chapter splits -> G1 FAIL.
- Missing/unknown windows or structurally incomplete chapter summaries -> G1 FAIL.
- Unresolved candidates, multiple decisions, invalid rejection, or missing final IDs -> G2 FAIL.
- Missing/non-array final files, skeleton records, invalid enums/nested fields, incomplete conditional enrichment, missing field evidence, verification file errors, or a missing/stale verification hash -> G3 FAIL.
- Unresolved gap candidates, unexplained named-martial signals, or human-gold mismatch -> G4 FAIL.
- No core/important character, missing dialogue/exemption for main events or important characters, invalid dialogue schema, cross-reference errors, or a missing/stale cross-validation hash -> G5 FAIL.
- Dialogue enrich record without a synthetic `name` -> valid when its provisional key and dialogue schema pass; a conflicting provisional key -> enrich submit fails.
- Empty field-claim map on a category with no inspected fields -> no semantic work item; malformed binding or an audit set with no real field claims -> `SEMANTIC_AUDIT_INPUT_INVALID` or `SEMANTIC_AUDIT_EMPTY`.

### 5. Good/Base/Bad Cases

- Good: current source hash, complete window coverage, closed ledger, fully enriched final records, fresh verification/cross-validation hashes, complete evidence, no final gap additions, and G1-G5 all PASS.
- Base: no human gold, but all other recall evidence closes; report `gold_status: no_gold` without inventing a recall rate.
- Bad: passing because fields are absent and therefore produce an empty check set, because reports describe an older data revision, because counts or an LLM baseline score are high, or because only a dialogue prefix matches the source.
- Good publish: token-only draft, controller-generated reports, all report hashes equal the staged final-data hash, and a failed staging verification removes the failed bundle without changing `.kb/current`.
- Good semantic planning: character/skill/summary field claims create independent audit items while a valid dialogue with no inspected descriptive fields does not create a vacuous item.
- Base publish: verification or cross-validation returns blocking findings; the report is still materialized for diagnostics, but `BUNDLE_VERIFICATION_FAILED` prevents a built bundle from entering pipeline state.
- Bad publish: accepting a draft `report_inputs` object containing `PASS`, or rebinding that object to a new hash without rerunning the validators.
- Bad enrich/audit: adding an out-of-schema dialogue `name` only to satisfy a generic identity check, or creating a semantic audit work item whose field list is empty.

### 7. Publish Report Trust Boundary

#### Signatures

```text
node scripts/pipeline.js build-publish <novel-dir> --draft <publish-draft>
```

The draft schema is:

```json
{
  "schema_version": 1,
  "run_id": "run-...",
  "semantic_audit_hash": "sha256",
  "token_plan": {}
}
```

#### Contracts

- The controller first writes projected data to a temporary staging `data/` root.
- `verify.js` and `cross-validate.js` run with `--data-root <staging-data> --expected-final-data-hash <hash> --dry-run --json`.
- `quality_report.json` is generated by the controller from those results and current managed stage evidence. All six required report files are then bound to the same `final_data_hash` before bundle verification.

#### Validation & Error Matrix

- Draft inside the managed run, wrong run/hash, missing token plan, or `report_inputs` present -> `PUBLISH_DRAFT_INVALID` (or the corresponding stale/path error).
- Validator cannot return JSON -> `PUBLISH_REPORT_GENERATION_FAILED`.
- Validator returns blocking findings, stale report hash, or a quality gate failure -> `BUNDLE_VERIFICATION_FAILED`; the failed staging directory is removed.
- Only a verified bundle can produce `publish_bundle_built`; promote additionally checks `expected-current`.

#### Tests Required

- Token-only draft builds reports from staging data and asserts grounded refs, cross-validation error count, and all G1-G5 PASS.
- Draft-supplied `report_inputs` is rejected before bundle construction.
- An ungrounded staging citation fails with `BUNDLE_VERIFICATION_FAILED` and leaves no failed staging directory.
- Every generated report's `final_data_hash` equals the manifest hash; stale materialized input remains blocked.
- Managed E2E runs `init -> inventory -> reconcile/review -> enrich -> semantic-audit -> staging -> promote -> rollback`, including a dialogue without `name` and an empty dialogue claim map; it asserts only non-empty field sets are audited.

#### Wrong vs Correct

**Wrong:** accept an AI-provided `{ "quality_report": { "completion_gate_passed": true } }` and attach the current hash.

**Correct:** reject `report_inputs`, run the validators against the temporary projected data, derive G1-G5 from managed evidence, and verify the resulting bundle before recording state.

### 6. Tests Required

- Unit: source normalization/matching, candidate/decision schemas, every final category's non-vacuous record contract, stable hash changes, CLI success/failure exit codes, and non-compensating hard gates.
- Regression: low-recall Lianchengjue and weak-evidence Tianlongbabu snapshots must fail their expected gates.
- Integration: a minimal complete knowledge base passes; removing a final file, required enrich field, report hash, original, summary evidence, dialogue context, or descriptive-field evidence fails the corresponding gate.

### 7. Wrong vs Correct

#### Wrong

Ask the model for a memory-based inventory, then use prefix matches and an overall score to claim completeness.

#### Correct

Record candidates and complete citations from each source window, close every decision, enrich all retained records, run `validate-final-data.js`, regenerate hash-bound verification reports, then let non-compensating G1-G5 gates determine completion independently.

## Scenario: Fast Game-Material Knowledge Base Profile

### 1. Scope / Trigger

- Trigger: generating a game-design-oriented wuxia knowledge base quickly with `.agents/skills/generate-game-kb`.
- This is a separate profile. The audit-grade `.agents/skills/generate-kb` state machine and independent G1-G5 gates above remain unchanged.
- The fast profile proves chapter-grounded accepted evidence and deterministic candidate closure. It does not claim audit-grade recall completeness or G1-G5 completion.

### 2. Signatures

```text
node .agents/skills/generate-game-kb/scripts/flow.js archive-existing <novel-dir>
node .agents/skills/generate-game-kb/scripts/flow.js prepare <novel-dir> --run <run-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js import-chapters <novel-dir> --run <run-id> --from-run <legacy-run-id> --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js status <novel-dir> --run <run-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js lite-status <novel-dir> --run <run-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js lite-guard-open <novel-dir> --run <run-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js lite-guard-check <novel-dir> --run <run-id> --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js lite-submit-draft <novel-dir> --run <run-id> --batch <batch-id> --unit <unit> --attempt <n> --guard-id <guard-id> --json < envelope.json
node .agents/skills/generate-game-kb/scripts/flow.js worker-backoff <novel-dir> --run <run-id> --batch <batch-id> --reason 429
node .agents/skills/generate-game-kb/scripts/flow.js accept <novel-dir> --run <run-id> --unit <unit> --draft <yaml> --json
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit <novel-dir> --run <run-id> --unit <unit> --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js refresh-domain-work <novel-dir> --run <run-id> --unit distill:characters|distill:skills --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js plan-domains <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js assemble <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js verify <novel-dir> --run <run-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js install <novel-dir> --run <run-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js verify <novel-dir> --installed --json
node .agents/skills/generate-game-kb/scripts/flow.js archive-run <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js archive-abandoned <novel-dir> --run <run-id> --confirm
```

Normal stage order is `archive-existing -> prepare -> chapter:NNN accept -> plan-domains -> four distill:* accept -> assemble -> verify -> install -> verify --installed -> archive-run`. The current main model owns routing and serial acceptance; the user supplies only the novel directory.

### 3. Contracts

- The writable V4 profile is `semantic_contract_version: 6`, `semantic_profile: domain-distill-v1`, and `profile: v4`. Version 5 and earlier runs are observational evidence only and fail every write path with `LEGACY_SEMANTIC_CONTRACT`; no in-place upgrade is allowed. A new V6 run may reuse legacy accepted chapters only through controller-owned `import-chapters`, which validates source paths, chapter numbers, source hashes, and accepted hashes without mutating the legacy run.
- Workers return exactly one JSON envelope and never serialize or write an artifact. Controller-owned staging drafts, accepted evidence, and final consumer data use canonical YAML; controller state, worker inputs, manifests, receipts, reports, and submission envelopes use JSON.
- Each run lives below `<novel-dir>/.game-kb-work/runs/<run-id>/`. Only the controller may serialize a validated envelope to the current `<unit>_attempt_<attempt+1>.yaml`, update attempts, or create accepted evidence; accepted bytes are immutable and bound in `artifact-manifest.json`. `accept --draft` is compatibility-only and is not a normal Worker path.
- The controller groups adjacent chapters into scheduling batches of two or three chapters with at most 36,000 CJK characters. Oversized chapters and an unpairable tail may form single-chapter batches. `status` expands every batch into one assignment per independent `chapter:NNN` unit; assignments from the same batch share `batch_id` and guard identity, but each Worker reads exactly one chapter and returns exactly one envelope. Controller-internal descriptors retain one absolute, run-scoped, attempt-specific `staging_path`; Worker projections expose no staging path, output directory, output filename, or other writable target, and `worker_write_paths` is always empty. `古龙/剑神一笑` is the real-corpus fixture: 20 chapters, controller batch sizes `[3, 3, 3, 3, 3, 3, 2]`, and 20 single-chapter assignments.
- Worker guards cover the real Git repository root. A clean submission proof binds the guard ID, repository root, complete guarded `submissions[]` identity, and SHA-256 hashes of the immutable open/check receipts. The broker validates this proof internally before journal creation; direct library calls without the proof must fail with zero progress, staging, archive, accepted-artifact, or journal changes. Malformed JSON, invalid receipt fields, orphan check receipts, hash/root disagreement, and a proof scoped below the real Git root fail closed as `GUARD_PROOF_MISMATCH`.
- Lite orchestration treats `lite-status` as the only scheduler. The broker must copy the Controller-issued `batch_id`, `unit`, `attempt`, and `input_hash` from the current descriptor and the guard's immutable `job_batch_id` plus `job_submissions[]`; it must never rebuild a batch identity from a chapter unit or filename. A multi-chapter guard therefore remains one batch while each envelope is submitted as its own guarded unit.
- Guard receipts are immutable audit evidence, while unresolved status is a read-only projection over current repository state. Status may stop reporting a violation after the exact rogue path is removed or restored, but the original check receipt remains byte-identical and any guard whose check recorded a violation is permanently ineligible for broker submission; continuing requires a new clean guard.
- `lite-status` must always expose `accepted_serialization`. Only `yaml-v1` may produce `chapter_jobs`; a missing or legacy value returns `accepted_serialization: null`, action `start-new-run`, and no dispatchable work. The guard, broker, recovery, and other Lite write routes independently enforce the same legacy gate.
- Submission journals use `binding`, `staging-written`, `submission-recorded`, `accepted-written`, and `result` as the canonical durable phases. Replay and next-action projection share one fail-closed decoder that validates schema, directory/unit/attempt identity, guard-proof hashes, phase order, and cross-phase identities; malformed or contradictory state raises `SUBMISSION_JOURNAL_CORRUPT` even when `result.json` exists. The binding timestamp is the transaction's only `recorded_at`, and every existing phase, archive, submission record, accepted artifact, and terminal result is content-checked before replay continues. Both accepted and rejected submissions must reach an immutable terminal result; replaying a rejected raw envelope reconstructs the same controller error without consuming another attempt.
- Any unresolved worker-guard violation outranks ordinary scheduling and blocks assemble, publish, install, and workspace verification. Status returns `worker-write-review`, the offending reports, no chapter job, and no publication action.
- Misplaced-draft recovery accepts only an exact regular-file path named by the selected unresolved guard inside the real Git root and outside another run. It rejects an existing attempt receipt before staging or acceptance changes, binds one immutable recovery timestamp, and routes canonical content through the same `commitSubmission()` transaction as broker acceptance. Replay after any durable acceptance phase reuses that timestamp, verifies archive/submission/accepted bytes, and writes immutable result and receipt files without consuming another attempt.
- Chapter units directly read one complete source chapter and emit characters, skills with nested techniques, items, factions, and one chapter summary. Character `identities/factions/skills` and skill `aliases/types/factions` are arrays. Characters never carry `items`; skills never carry users/holders; items never carry owners/holders; factions never carry members. Techniques remain nested under skills and require an explicitly named source move.
- `plan-domains` deterministically builds the candidate registry and exactly four domain work units. All four domains are independent and may be processed concurrently. The canonical order `distill:factions`, `distill:characters`, `distill:skills`, and `distill:items` is used only for presentation and reports.
- Each domain Worker handles exactly one `distill:*` unit, reads the controller-generated read-only `worker-input.json`, receives no writable path, and returns one JSON envelope. The same broker validates chapter and domain envelopes before the controller performs canonical YAML serialization, staging, acceptance, and attempt accounting.
- Character and skill work items bind all controller-issued full-book `source_files` and a rank contract. Rank is a complete-timeline stable judgment, not the highest single-chapter portrayal: later direct wins, losses, counters, and reversals override early praise; rumor and status alone cannot support a high rank. Evidence-insufficient records keep `rank: null` without entering manual review.
- Exact display names and identical pinyin slugs never authorize automatic semantic merge. Full-book domain decisions decide keep/merge, while controller-owned identity anchors and persisted alphabetic digest suffixes disambiguate colliding IDs. Renames, aliases, input order, and unrelated additions must not change an existing entity ID.
- Character and skill inputs expose the deterministic faction-only `allowed_faction_refs` set, and that set participates in the input hash. A non-null `patch.faction` must belong to this set; an unknown ref or a visible existing ref from another category is rejected before accepted evidence is written.
- Character and skill faction references remain late-bound until `assemble`, which resolves aliases and merges after all four domain decisions exist.
- Every domain entry receives exactly one keep, same-category merge, finite-reason reject, or pending decision. Pending, missing, duplicate, cross-category, cyclic, stale, or unresolved decisions block assembly.
- `assemble` consumes all accepted chapters, exactly four accepted domain decisions, and the candidate registry. It resolves decisions and references once, assigns stable IDs once, then atomically projects exactly five top-level-array YAML files: `characters.yaml`, `skills.yaml`, `items.yaml`, `factions.yaml`, and `chapter_summaries.yaml`.
- Final fields come only from `semantic-contract.js`. Techniques remain nested under `skills[].techniques[]`; final consumer records omit `source_refs`.
- Accepted YAML is immutable evidence. Workspace verification revalidates that evidence and binds it through `assembly-report.json`, whose accepted hashes, decision hashes, candidate closure, counts, and final-data hash must match current bytes.
- `verifyDataRoot` validates any five-file dataset for exact filenames and fields, YAML arrays, IDs, enums, summary coverage, nested technique names, stable hash, and reference closure.
- Workspace `verify` additionally proves chapter/domain evidence, accepted immutability, ordinary-item exclusion, candidate closure, report freshness, and zero unresolved manual review. It writes `verification-report.json` only after passing.
- Normal verification has no recall/supplement stage, quantity gate, sampling gate, or secondary game-material projection.
- Installation uses sibling staging and directory swap with rollback. Install receipt schema 2 binds semantic version, source hash, verification-report hash, final-data hash, chapter list, the exact five-file set, and `data_file_hashes`: an exact filename-to-raw-SHA-256 map for all five installed YAML files. Schema-1 receipts fail closed and must be regenerated by installation rather than read through a compatibility fallback.
- Installed verification reads only installed data, the install receipt, and the installed verification report. It never falls back to workspace artifacts.
- The worker pool starts at five, records one explicit 429 incident per batch, reduces `5 -> 3` on the first distinct 429 batch, and halts on a second distinct 429 batch while at fallback concurrency three. Transport failures never consume an AI submission.
- Every AI unit cycle has one initial validated submission and at most one automatic retry. JSON envelope parse, identity, schema, and semantic failures use the shared two-submission budget; a failed second submission, repeated output, or repeated validation error enters `manual_review`. Only a user-confirmed `retry-unit --confirm` may start a fresh bounded cycle; the controller then issues a new attempt and private staging path.
- `status --json` returns exactly one `next_action`; AI phases also return canonically ordered `next_units`, with manual review taking precedence over executable actions.
- Recovery and archive inspect the current workspace `final/data` through the canonical read-only five-file validator. Changed, missing, extra, malformed, schema-invalid, reference-invalid, summary-incomplete, or hash-mismatched workspace YAML invalidates the current assembly boundary; status routes to `assemble` without writing.
- Before any archive metadata write or run move, `archive-run` additionally requires the workspace verification report to have `passed: true`, the current source and final-data hashes, and a byte hash equal to `run.json.verification_report_hash`. Any mismatch raises `ARCHIVE_WORKSPACE_FINAL_INVALID`; a successful `archive-receipt.json` binds the same `verification_report_hash`.
- Representative orchestration evidence uses the real `buildRunMetrics` implementation over 21 chapter units plus four domain units. Every raw unit has at most two submissions, total duration is at most `2,700,000ms` (45 minutes), and prepare/chapter/domain/assemble/verify/install/archive durations are positive. This timing evidence does not replace the real source/evidence/verify/install/archive integration path.

### 4. Validation & Error Matrix

- Multiple active runs -> `RUN_AMBIGUOUS`; never select or archive one implicitly.
- Missing or different semantic version on a write path -> `LEGACY_SEMANTIC_CONTRACT`; preserve all evidence.
- Legacy import with changed source paths, chapter numbers, source hashes, accepted hashes, or a writable target mismatch -> fail closed and preserve both runs byte-for-byte.
- A staging path outside the selected run, wrong next attempt, or symlink escape -> reject before changing the attempt budget.
- A malformed Worker envelope, wrong schema version, or mismatched unit/attempt/input hash -> `SUBMISSION_ENVELOPE_INVALID`, `SUBMISSION_SCHEMA_VERSION_MISMATCH`, or `SUBMISSION_IDENTITY_MISMATCH`; write no staging, accepted evidence, or progress state.
- A broker batch/unit/attempt/input hash that differs from the immutable guard identity -> `GUARD_SUBMISSION_IDENTITY_MISMATCH`; create no journal, staging, submission, accepted artifact, or progress change.
- A guard check that recorded any write violation -> `GUARD_VIOLATIONS_UNRESOLVED` for broker submission even if current status no longer projects the restored path; open and clean a new guard before retrying.
- Missing or legacy `accepted_serialization` on a Lite write route -> `LEGACY_ACCEPTED_SERIALIZATION`; `lite-status` reports `start-new-run` and no `chapter_jobs`.
- Unknown `patch.faction` -> `DOMAIN_REFERENCE_UNKNOWN`; an existing but non-faction or otherwise unauthorized ref -> `DOMAIN_REFERENCE_UNAUTHORIZED`. Both block accepted-evidence creation.
- Accepted hash mismatch -> `ACCEPTED_ARTIFACT_MUTATED`; assembly, verification, and installation stop.
- Incomplete domain coverage or pending/cyclic/invalid decisions -> assembly failure; preserve the previous final directory.
- Missing chapter summary, invalid source evidence, ordinary-item keep, unnamed technique, unresolved reference, stale assembly receipt, or unresolved manual review -> workspace verification failure.
- Missing, extra, malformed, or schema-invalid final YAML -> five-file verification failure.
- Missing or stale verification report/install receipt, an absent/malformed `data_file_hashes` map, any raw installed-file hash mismatch (including byte-only YAML drift), or chapter-list mismatch -> installed verification failure without workspace fallback.
- Workspace final YAML drift, a non-passing/stale workspace verification report, or report bytes that do not match `run.json.verification_report_hash` -> direct `archive-run` raises `ARCHIVE_WORKSPACE_FINAL_INVALID` with canonical blocking errors before changing metadata or moving the live run.
- Any failure before or after the installation move restores the previous installed directory.

### 5. Good/Base/Bad Cases

- Good: the main model resumes the selected writable V6 run, dispatches adjacent 2-3 chapter controller batches as single-chapter assignments, receives one JSON envelope per chapter, lets the controller serialize and accept YAML, then dispatches one read-only `worker-input.json` per domain unit and follows the same broker path before assembly, verification, installation, installed verification, and archive.
- Good: a real `古龙/剑神一笑` migration imports 20 immutable V5 chapters into a new V6 run, produces `[3, 3, 3, 3, 3, 3, 2]` jobs, completes all four domains, and leaves the legacy run tree hash unchanged.
- Good: rerunning `assemble` with unchanged accepted evidence produces byte-identical files and the same final-data hash.
- Good: character/skill work exposes only faction refs in `allowed_faction_refs`; archive binds the exact passing workspace verification-report hash in both run metadata and the archive receipt.
- Good: a two-chapter Lite guard keeps the Controller-issued batch ID for both per-chapter envelopes, survives repeated status reads without identity drift, and submits only after a clean immutable check receipt.
- Base: a source-grounded named technique has no source-stated parent skill; keep a null relation. Every non-empty relation must resolve.
- Base: category arrays may be empty when the source contains no valid entity; completeness is proved by accepted chapter evidence and closed decisions, not by count.
- Bad: asking AI to assign final IDs, mutating accepted YAML, accepting pending decisions, or repairing semantic data during verification.
- Bad: automatically merging equal display names or equal pinyin slugs, treating a disguise label as proof of actor identity, or taking a single chapter's strongest claim as the final rank.
- Bad: accepting a guessed globally visible ref as `patch.faction`, or archiving a parseable report merely because its final-data hash matches.
- Bad: restoring removed categories, emitting an extra consumer file, installing without current receipts, or verifying installed data by reading the work run.
- Bad: reopening semantic work merely because a count is low or adding records to satisfy a quota.
- Bad: assigning multiple chapters or multiple domains to one Worker, exposing a writable path, asking a Worker to write YAML, deriving a batch ID from `chapter:NNN`, reusing a guard whose immutable check recorded a violation, or dispatching from a legacy run because accepted files happen to parse.

### 6. Tests Required

- Skill contract: assert autonomous routing, YAML/JSON boundaries, the full normal-stage order, four stable domain units, exactly five final files, and exclusion of removed stages and projections.
- Chapter/domain contract: assert source evidence, named-technique rules, ordinary-item reasons, exact decision coverage, legal merges, hashed faction-only `allowed_faction_refs`, unknown/unauthorized faction rejection before acceptance, and forbidden private/final IDs.
- V6 semantic contract: assert array fields across chapter/domain/final schemas, uniform `description`, forbidden holder/member/user/item links, exact-name candidates remaining separate before full-book decisions, persistent ID disambiguators, and null rank when full-book evidence is insufficient.
- Real corpus: read `古龙/剑神一笑/剑神一笑.txt` through production prepare/status, assert 20 chapters, controller batch sizes `[3, 3, 3, 3, 3, 3, 2]`, 20 single-chapter assignments with shared per-batch identity, Chinese absolute path preservation, no Worker-visible write path, one private current staging path per descriptor, V5 chapter import immutability, four one-unit domain envelopes, five-file assembly, workspace verify, install, installed verify, and archive receipt bindings.
- Deterministic assembly: assert pending/missing/cyclic decisions fail, references close once, chapter summaries project to `{ chapter, title, summary }`, atomic rollback works, and repeated assembly is byte-stable.
- Workspace verification: assert exact fields/files, YAML parsing, IDs/enums, summary coverage, nested techniques, reference closure, accepted immutability, candidate closure, evidence, ordinary-item exclusion, and fresh report hashes.
- Installation: assert only five files are staged, the previous whole data directory is archived, receipts bind the exact raw SHA-256 of each current YAML file through `data_file_hashes`, missing/wrong maps and byte-only drift fail installed verification, pre/post-move failures roll back, reinstall is idempotent, and installed verification has no workspace fallback.
- Recovery/archive freshness: change, remove, and add workspace final YAML after verification; status must route to `assemble`. Direct archive must reject non-passing, stale-source, stale-final, and byte-hash-mismatched workspace reports before metadata writes or the run move, preserve pre-call metadata/metrics/location, and bind the current verification-report hash in the success receipt.
- Lite controller/worker safety: assert Controller-issued multi-chapter batch identity survives expansion into single-chapter assignments and broker submission, every chapter/domain Worker has `worker_write_paths: []`, immutable violation receipts remain unchanged while status filters restored paths, violated guards cannot submit, a new clean guard can continue, and legacy accepted serialization exposes no jobs or Lite write route.
- Integration: run three chapters through the exact normal path `prepare -> chapter accepts -> plan-domains -> four domain accepts -> assemble -> verify -> install -> verify --installed -> archive-run`; assert the archived receipt and exactly five installed YAML files.
- Performance: feed a checked 21-chapter/four-domain fixture through the real `buildRunMetrics`; require every raw unit at no more than two attempts, exact current-v4 AI aggregates, positive prepare/chapter/domain/assemble/verify/install/archive durations, and total time at or below `2,700,000ms`.

### 7. Wrong vs Correct

#### Wrong

Preserve the legacy merge/clean/build chain behind a new command name, trust counts or model-authored reports as proof, or list five filenames in an install receipt without binding each installed file's raw bytes.

#### Correct

Keep all Workers zero-write: expand controller chapter batches into one-envelope-per-chapter assignments, issue one read-only input per domain, and let the controller validate and serialize every YAML artifact. Bound late faction refs in the hashed domain input, run the real three-chapter verify/install/installed-verify/archive path, require the exact passing verification-report hash before archive, bind all five installed YAML byte hashes in `data_file_hashes`, and pair it with real-`buildRunMetrics` 21-chapter/four-domain timing evidence; do not substitute a hand-built aggregate or omit the source/evidence integration path.

## Scenario: Deterministic Legacy Knowledge-Base Migration

### 1. Scope / Trigger

Use this contract when auditing installed legacy JSON knowledge bases, converting compatible legacy data to semantic contract V6, archiving incompatible data, or retrying a migration after the legacy payload has already moved to `_archive`.

### 2. Signatures

```powershell
node .agents/skills/generate-game-kb/scripts/audit-v6.js <repository> --output <report-dir>
node .agents/skills/generate-game-kb/scripts/flow.js migrate-legacy <novel> --run <run-id> [--from <legacy-data>] --staging-root <outside-novel-dir> [--confirm] --json
node .agents/skills/generate-game-kb/scripts/flow.js verify <novel> --installed --json
archiveExisting(novelDir, { archiveId, reason: { code, blocking_errors } })
```

Without `--confirm`, `migrate-legacy` returns a read-only plan. With `--confirm`, it may build a candidate, archive the legacy payload, publish the run, install five YAML files, and verify the installation.

### 3. Contracts

- Repository audit derives qualification from `verifyInstalled()`, isolates per-book failures, protects every qualified book with hashes for five YAML files, its install receipt, and its published run, and emits a separate migration plan.
- Automatic source selection tries complete active data, retained run finals, then archive finals in deterministic priority/mtime/path order. Each source receives the full semantic preflight; the first `eligibility.migratable === true` source wins. The plan records skipped attempts in `source.candidates` with blocking errors.
- Explicit `--from` never switches to another source. An explicit source may produce an ineligible plan, but candidate construction must raise `MIGRATION_PLAN_INELIGIBLE` before creating staging output.
- Chapter summary coverage is structural: every current chapter number appears exactly once and binds to the current chapter inventory. Summary text is reused unchanged. Invalid optional legacy summary quotes remain diagnostics, then the summary binds to `{ chapter, title, content_hash }`; invalid entity evidence still rejects the entity.
- `readChapterRoot()` must apply the shared `normalizeSource()` contract before storing chapter text or signing `input_hash`. This keeps BOM removal, LF normalization, and terminal-newline insertion identical to semantic-work freshness checks.
- Confirmed migration order is candidate verify -> legacy archive -> run promotion -> install -> installed verify. A failure after archive never restores legacy JSON as active `data`; it writes `archived_after_migration_failure` plus a same-run retry command whose `--from` points into the preserved archive.
- Before candidate mutation or archival, the transaction captures the active legacy installation's `verifyInstalled()` result. Both normal and failure archival pass `{ code: 'LEGACY_INSTALLATION_UNQUALIFIED', blocking_errors }` to `archiveExisting()`. The archive plan validates a non-empty reason code before creating or moving anything, and the final manifest preserves the complete structured reason alongside every source/archive path and file hash.
- A verified active installation contains exactly `chapter_summaries.yaml`, `characters.yaml`, `factions.yaml`, `items.yaml`, and `skills.yaml`. Rejected legacy records and invalid evidence remain enumerated in the migration receipt and unchanged in the archive.

### 4. Validation & Error Matrix

| Condition | Result |
|---|---|
| Legacy JSON file missing/malformed or source outside novel | Stable `LEGACY_SOURCE_*` / `LEGACY_JSON_INVALID` error; no mutation |
| Automatic candidate fails semantic summary coverage | Record its eligibility errors and try the next usable source |
| Explicit source or every automatic source lacks accepted summary coverage | `eligibility.migratable: false`; candidate build raises `MIGRATION_PLAN_INELIGIBLE` |
| `--confirm` omitted for execution | Plan only; no staging, archive, run, or installed-file write |
| Chapter bytes signed without canonical normalization | Semantic work detects `WORK_ITEM_STALE`; fix inventory normalization rather than weakening freshness checks |
| Archive reason is present but missing a non-empty `code` | `ARCHIVE_REASON_INVALID`; reject before creating the archive directory or moving any entry |
| Archive move fails | `archive_failed`; archive rollback preserves active legacy data |
| Candidate/promotion/install/verify fails after archive | `archived_after_migration_failure`; no active legacy `data`, archive and retry command retained |
| Installed files, receipt hashes, chapter list, or published verification drift | Installed verification fails; book is not qualified |

### 5. Good/Base/Bad Cases

- Good: active legacy data has incomplete accepted summaries, a retained final is complete, and the plan selects the retained run while recording why active data was skipped.
- Good: a transient Windows rename failure occurs after archive; the same run ID retries from the manifest-backed archive and finishes verified without re-extraction.
- Base: all legacy entities have invalid evidence but chapter summaries fully cover the inventory. Migrate five files with empty entity arrays and list every rejected record in the receipt.
- Bad: silently changing an explicit `--from`, accepting missing/duplicate chapter summaries, hashing raw CRLF/BOM bytes, or asking a model to reconstruct rejected evidence.
- Bad: restoring archived legacy JSON to active `data` after a post-archive failure or treating a successful workspace candidate as proof that installed verification passed.

### 6. Tests Required

- Source tests: active/retained/archive ordering, explicit-source confinement, semantic fallback, all-ineligible behavior, and deterministic candidate diagnostics.
- Evidence tests: ref-less and invalid-ref summaries bind to chapter hashes without changing summary text; invalid entity refs still reject entities; missing/duplicate/out-of-range summary chapters remain coverage failures.
- Freshness tests: BOM, CRLF, and missing terminal newline normalize to the same chapter bytes and SHA-256 consumed by semantic-work.
- Candidate tests: real legacy fixtures build five deterministic YAML files, reject ineligible plans before staging, and pass canonical workspace verification.
- Transaction tests: confirmation gate, archive rollback, structured legacy qualification reason in the manifest, each post-archive failure state, same-run retry from archive, installed verification, and no reactivation of legacy JSON.
- Archive tests: a valid structured reason is preserved verbatim; an invalid reason fails with `ARCHIVE_REASON_INVALID` before any filesystem move.
- Repository tests: per-book isolation, qualified protection hashes, `migratable` versus `non_migratable`, stable reports, and migration plans containing no extraction/domain/model-authored commands.

### 7. Wrong vs Correct

#### Wrong

```js
const text = fs.readFileSync(chapterFile, 'utf8');
const inputHash = sha256(text); // disagrees with semantic-work on BOM/CRLF/no-final-newline files

if (legacySummary.source_refs.every(ref => quoteIsInvalid(ref))) {
  dropTheWholeSummary(); // turns optional bad quotes into fake chapter-coverage loss
}
```

#### Correct

```js
const text = normalizeSource(fs.readFileSync(chapterFile, 'utf8'));
const inputHash = sha256(text);

const refs = validLegacyRefs.length > 0
  ? validLegacyRefs
  : [{ chapter: number, text: chapter.title, content_hash: chapter.hash }];
// Keep quote-validation errors in the receipt; keep the unchanged legacy summary bound to its chapter.
```
