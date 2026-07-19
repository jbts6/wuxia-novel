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
- AI staging drafts, accepted evidence, and final consumer data use YAML. Controller state, manifests, receipts, and reports use JSON.
- Each run lives below `<novel-dir>/.game-kb-work/runs/<run-id>/`. Staging accepts only the current `<unit>_attempt_<attempt+1>.yaml`; accepted bytes are immutable and bound in `artifact-manifest.json`.
- The controller groups adjacent chapters into dynamic worker jobs of two or three chapters with at most 36,000 CJK characters. Oversized chapters and an unpairable tail may be single-chapter jobs. Every chapter remains an independent `chapter:NNN` unit with one controller-issued absolute `staging_path`; a worker reads and writes each chapter in descriptor order and reports progress after every YAML write. `古龙/剑神一笑` is the real-corpus fixture: 20 chapters and job sizes `[3, 3, 3, 3, 3, 3, 2]`.
- Chapter units directly read one complete source chapter and emit characters, skills with nested techniques, items, factions, and one chapter summary. Character `identities/factions/skills` and skill `aliases/types/factions` are arrays. Characters never carry `items`; skills never carry users/holders; items never carry owners/holders; factions never carry members. Techniques remain nested under skills and require an explicitly named source move.
- `plan-domains` deterministically builds the candidate registry and exactly four domain work units. All four domains are independent and may be processed concurrently. The canonical order `distill:factions`, `distill:characters`, `distill:skills`, and `distill:items` is used only for presentation and reports.
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
- Every AI unit cycle has one initial validated submission and at most one automatic retry. YAML parse and semantic failures use the shared two-submission budget; a failed second submission, repeated output, or repeated validation error enters `manual_review`. Only a user-confirmed `retry-unit --confirm` may start a fresh bounded cycle; the controller then issues a new attempt and staging path.
- `status --json` returns exactly one `next_action`; AI phases also return canonically ordered `next_units`, with manual review taking precedence over executable actions.
- Recovery and archive inspect the current workspace `final/data` through the canonical read-only five-file validator. Changed, missing, extra, malformed, schema-invalid, reference-invalid, summary-incomplete, or hash-mismatched workspace YAML invalidates the current assembly boundary; status routes to `assemble` without writing.
- Before any archive metadata write or run move, `archive-run` additionally requires the workspace verification report to have `passed: true`, the current source and final-data hashes, and a byte hash equal to `run.json.verification_report_hash`. Any mismatch raises `ARCHIVE_WORKSPACE_FINAL_INVALID`; a successful `archive-receipt.json` binds the same `verification_report_hash`.
- Representative orchestration evidence uses the real `buildRunMetrics` implementation over 21 chapter units plus four domain units. Every raw unit has at most two submissions, total duration is at most `2,700,000ms` (45 minutes), and prepare/chapter/domain/assemble/verify/install/archive durations are positive. This timing evidence does not replace the real source/evidence/verify/install/archive integration path.

### 4. Validation & Error Matrix

- Multiple active runs -> `RUN_AMBIGUOUS`; never select or archive one implicitly.
- Missing or different semantic version on a write path -> `LEGACY_SEMANTIC_CONTRACT`; preserve all evidence.
- Legacy import with changed source paths, chapter numbers, source hashes, accepted hashes, or a writable target mismatch -> fail closed and preserve both runs byte-for-byte.
- A staging path outside the selected run, wrong next attempt, or symlink escape -> reject before changing the attempt budget.
- Unknown `patch.faction` -> `DOMAIN_REFERENCE_UNKNOWN`; an existing but non-faction or otherwise unauthorized ref -> `DOMAIN_REFERENCE_UNAUTHORIZED`. Both block accepted-evidence creation.
- Accepted hash mismatch -> `ACCEPTED_ARTIFACT_MUTATED`; assembly, verification, and installation stop.
- Incomplete domain coverage or pending/cyclic/invalid decisions -> assembly failure; preserve the previous final directory.
- Missing chapter summary, invalid source evidence, ordinary-item keep, unnamed technique, unresolved reference, stale assembly receipt, or unresolved manual review -> workspace verification failure.
- Missing, extra, malformed, or schema-invalid final YAML -> five-file verification failure.
- Missing or stale verification report/install receipt, an absent/malformed `data_file_hashes` map, any raw installed-file hash mismatch (including byte-only YAML drift), or chapter-list mismatch -> installed verification failure without workspace fallback.
- Workspace final YAML drift, a non-passing/stale workspace verification report, or report bytes that do not match `run.json.verification_report_hash` -> direct `archive-run` raises `ARCHIVE_WORKSPACE_FINAL_INVALID` with canonical blocking errors before changing metadata or moving the live run.
- Any failure before or after the installation move restores the previous installed directory.

### 5. Good/Base/Bad Cases

- Good: the main model resumes the selected writable V6 run, dynamically assigns adjacent 2-3 chapter jobs while each chapter writes its own controller staging path, accepts chapter YAML serially, plans four domains, accepts four terminal decision sets, assembles byte-stable YAML, verifies evidence, installs atomically, verifies installed bytes, and archives the complete run.
- Good: a real `古龙/剑神一笑` migration imports 20 immutable V5 chapters into a new V6 run, produces `[3, 3, 3, 3, 3, 3, 2]` jobs, completes all four domains, and leaves the legacy run tree hash unchanged.
- Good: rerunning `assemble` with unchanged accepted evidence produces byte-identical files and the same final-data hash.
- Good: character/skill work exposes only faction refs in `allowed_faction_refs`; archive binds the exact passing workspace verification-report hash in both run metadata and the archive receipt.
- Base: a source-grounded named technique has no source-stated parent skill; keep a null relation. Every non-empty relation must resolve.
- Base: category arrays may be empty when the source contains no valid entity; completeness is proved by accepted chapter evidence and closed decisions, not by count.
- Bad: asking AI to assign final IDs, mutating accepted YAML, accepting pending decisions, or repairing semantic data during verification.
- Bad: automatically merging equal display names or equal pinyin slugs, treating a disguise label as proof of actor identity, or taking a single chapter's strongest claim as the final rank.
- Bad: accepting a guessed globally visible ref as `patch.faction`, or archiving a parseable report merely because its final-data hash matches.
- Bad: restoring removed categories, emitting an extra consumer file, installing without current receipts, or verifying installed data by reading the work run.
- Bad: reopening semantic work merely because a count is low or adding records to satisfy a quota.

### 6. Tests Required

- Skill contract: assert autonomous routing, YAML/JSON boundaries, the full normal-stage order, four stable domain units, exactly five final files, and exclusion of removed stages and projections.
- Chapter/domain contract: assert source evidence, named-technique rules, ordinary-item reasons, exact decision coverage, legal merges, hashed faction-only `allowed_faction_refs`, unknown/unauthorized faction rejection before acceptance, and forbidden private/final IDs.
- V6 semantic contract: assert array fields across chapter/domain/final schemas, uniform `description`, forbidden holder/member/user/item links, exact-name candidates remaining separate before full-book decisions, persistent ID disambiguators, and null rank when full-book evidence is insufficient.
- Real corpus: read `古龙/剑神一笑/剑神一笑.txt` through production prepare/status, assert 20 chapters, adjacent job sizes `[3, 3, 3, 3, 3, 3, 2]`, Chinese absolute path preservation, one current staging path per descriptor, V5 chapter import immutability, four domain accepts, five-file assembly, workspace verify, install, installed verify, and archive receipt bindings.
- Deterministic assembly: assert pending/missing/cyclic decisions fail, references close once, chapter summaries project to `{ chapter, title, summary }`, atomic rollback works, and repeated assembly is byte-stable.
- Workspace verification: assert exact fields/files, YAML parsing, IDs/enums, summary coverage, nested techniques, reference closure, accepted immutability, candidate closure, evidence, ordinary-item exclusion, and fresh report hashes.
- Installation: assert only five files are staged, the previous whole data directory is archived, receipts bind the exact raw SHA-256 of each current YAML file through `data_file_hashes`, missing/wrong maps and byte-only drift fail installed verification, pre/post-move failures roll back, reinstall is idempotent, and installed verification has no workspace fallback.
- Recovery/archive freshness: change, remove, and add workspace final YAML after verification; status must route to `assemble`. Direct archive must reject non-passing, stale-source, stale-final, and byte-hash-mismatched workspace reports before metadata writes or the run move, preserve pre-call metadata/metrics/location, and bind the current verification-report hash in the success receipt.
- Integration: run three chapters through the exact normal path `prepare -> chapter accepts -> plan-domains -> four domain accepts -> assemble -> verify -> install -> verify --installed -> archive-run`; assert the archived receipt and exactly five installed YAML files.
- Performance: feed a checked 21-chapter/four-domain fixture through the real `buildRunMetrics`; require every raw unit at no more than two attempts, exact current-v4 AI aggregates, positive prepare/chapter/domain/assemble/verify/install/archive durations, and total time at or below `2,700,000ms`.

### 7. Wrong vs Correct

#### Wrong

Preserve the legacy merge/clean/build chain behind a new command name, trust counts or model-authored reports as proof, or list five filenames in an install receipt without binding each installed file's raw bytes.

#### Correct

Bound late faction refs in the hashed domain input, run the real three-chapter verify/install/installed-verify/archive path, require the exact passing verification-report hash before archive, bind all five installed YAML byte hashes in `data_file_hashes`, and pair it with real-`buildRunMetrics` 21-chapter/four-domain timing evidence; do not substitute a hand-built aggregate or omit the source/evidence integration path.
