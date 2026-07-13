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
- `scripts/pipeline.js` is the only supported write entry. AI output uses `claim -> draft -> submit`; packet bindings include stage, work-item ID, input hash, worker, and lease. Stale, duplicate, cross-stage, or non-current submissions must be rejected atomically.
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
