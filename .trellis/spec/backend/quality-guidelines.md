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

- Build the candidate ledger from each source window before reconciliation, classification, or enrichment.
- Every candidate must have exactly one keep/merge/redirect/reject decision; retained candidates must point to an existing final ID.
- Final entities, chapter summaries, descriptive fields, dialogues, and dialogue context must retain complete, chapter-local source evidence.
- Stage 3 enrichment must pass the shared final-data contract before recall auditing or human review. Skeleton records such as `id/name/source_refs` are incomplete data, not valid low-detail records.
- Verification and cross-validation reports must include the stable hash of all eight current `data/*.json` files. A missing or stale hash is a blocking failure.
- G1-G5 must report independent PASS/FAIL results and reasons. Completion requires every gate to pass.

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

- `node scripts/prepare-source.js <novel-dir> [--window-lines N] [--overlap-lines N]`
- `node scripts/validate-inventory.js <novel-dir>`
- `node scripts/validate-final-data.js <novel-dir> [--dry-run]`
- `node scripts/verify.js <novel-dir>`
- `node scripts/cross-validate.js <novel-dir>`
- `node scripts/audit-recall.js <novel-dir> [--legacy] [--dry-run]`
- `node scripts/assess-quality.js <novel-dir> [--report-only] [--dry-run]`

### 3. Contracts

- Request: `<novel-dir>/<novel-name>.txt` and its derived `ch_split/*.txt` files.
- Intermediate artifacts: `source-index.json`, `scan-manifest.json`, `candidates.jsonl`, `decisions.jsonl`, and `gap-audit.json`.
- Final data: all eight named `data/*.json` files must exist as arrays and satisfy the shared schema, enrichment, enum, nested-field, and evidence-field contract. Category-specific empty arrays are allowed only when the contract permits them; at least one character and at least one core/important character are required for non-vacuous semantic checks.
- Validation response: `reports/final_data_validation.json` contains separate `schema_errors` and `enrichment_errors`, plus `final_data_hash`. `--dry-run` must preserve the same exit status without writing the report.
- Freshness: `reports/verification_report.json.final_data_hash` and `reports/cross_validation_report.json.final_data_hash` must equal the current stable final-data hash.
- Response: `quality_report.json` contains independent G1-G5 results; G4 details contain candidates, kept, rejected, and unresolved entries by category.
- Human gold: accept `audit/gold.json` only when it has `provenance: human_curated`, the current `source_hash`, and complete grounded evidence for every item.

### 4. Validation & Error Matrix

- Missing original novel or divergent chapter splits -> G1 FAIL.
- Missing/unknown windows or structurally incomplete chapter summaries -> G1 FAIL.
- Unresolved candidates, multiple decisions, invalid rejection, or missing final IDs -> G2 FAIL.
- Missing/non-array final files, skeleton records, invalid enums/nested fields, incomplete conditional enrichment, missing field evidence, verification file errors, or a missing/stale verification hash -> G3 FAIL.
- Unresolved gap candidates, unexplained named-martial signals, or human-gold mismatch -> G4 FAIL.
- No core/important character, missing dialogue/exemption for main events or important characters, invalid dialogue schema, cross-reference errors, or a missing/stale cross-validation hash -> G5 FAIL.

### 5. Good/Base/Bad Cases

- Good: current source hash, complete window coverage, closed ledger, fully enriched final records, fresh verification/cross-validation hashes, complete evidence, no final gap additions, and G1-G5 all PASS.
- Base: no human gold, but all other recall evidence closes; report `gold_status: no_gold` without inventing a recall rate.
- Bad: passing because fields are absent and therefore produce an empty check set, because reports describe an older data revision, because counts or an LLM baseline score are high, or because only a dialogue prefix matches the source.

### 6. Tests Required

- Unit: source normalization/matching, candidate/decision schemas, every final category's non-vacuous record contract, stable hash changes, CLI success/failure exit codes, and non-compensating hard gates.
- Regression: low-recall Lianchengjue and weak-evidence Tianlongbabu snapshots must fail their expected gates.
- Integration: a minimal complete knowledge base passes; removing a final file, required enrich field, report hash, original, summary evidence, dialogue context, or descriptive-field evidence fails the corresponding gate.

### 7. Wrong vs Correct

#### Wrong

Ask the model for a memory-based inventory, then use prefix matches and an overall score to claim completeness.

#### Correct

Record candidates and complete citations from each source window, close every decision, enrich all retained records, run `validate-final-data.js`, regenerate hash-bound verification reports, then let non-compensating G1-G5 gates determine completion independently.
