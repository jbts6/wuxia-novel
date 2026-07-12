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
- G1-G5 must report independent PASS/FAIL results and reasons. Completion requires every gate to pass.

---

## Testing Requirements

- Source tests must cover CRLF, Chinese punctuation, overlapping windows, hash changes, and original/chapter-split divergence.
- Ledger tests must cover JSONL line errors, duplicate or unresolved candidates, invalid rejection, and missing final IDs.
- Gate tests must include historical false-pass fixtures and an end-to-end minimal complete knowledge base.
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
- `node scripts/audit-recall.js <novel-dir> [--legacy] [--dry-run]`
- `node scripts/assess-quality.js <novel-dir> [--report-only] [--dry-run]`

### 3. Contracts

- Request: `<novel-dir>/<novel-name>.txt` and its derived `ch_split/*.txt` files.
- Intermediate artifacts: `source-index.json`, `scan-manifest.json`, `candidates.jsonl`, `decisions.jsonl`, and `gap-audit.json`.
- Response: `quality_report.json` contains independent G1-G5 results; G4 details contain candidates, kept, rejected, and unresolved entries by category.
- Human gold: accept `audit/gold.json` only when it has `provenance: human_curated`, the current `source_hash`, and complete grounded evidence for every item.

### 4. Validation & Error Matrix

- Missing original novel or divergent chapter splits -> G1 FAIL.
- Missing/unknown windows or structurally incomplete chapter summaries -> G1 FAIL.
- Unresolved candidates, multiple decisions, invalid rejection, or missing final IDs -> G2 FAIL.
- Incomplete evidence for entities, summaries, descriptions, dialogues, or context -> G3 FAIL.
- Unresolved gap candidates, unexplained named-martial signals, or human-gold mismatch -> G4 FAIL.
- Missing dialogue/exemption for main events or important characters, invalid dialogue schema, or cross-reference errors -> G5 FAIL.

### 5. Good/Base/Bad Cases

- Good: current source hash, complete window coverage, closed ledger, complete evidence, no final gap additions, and G1-G5 all PASS.
- Base: no human gold, but all other recall evidence closes; report `gold_status: no_gold` without inventing a recall rate.
- Bad: passing because counts or an LLM baseline score are high, or because only a dialogue prefix matches the source.

### 6. Tests Required

- Unit: source normalization/matching, candidate/decision schemas, and non-compensating hard gates.
- Regression: low-recall Lianchengjue and weak-evidence Tianlongbabu snapshots must fail their expected gates.
- Integration: a minimal complete knowledge base passes; removing the original, summary evidence, dialogue context, or descriptive-field evidence fails the corresponding gate.

### 7. Wrong vs Correct

#### Wrong

Ask the model for a memory-based inventory, then use prefix matches and an overall score to claim completeness.

#### Correct

Record candidates and complete citations from each source window, close every decision, then let non-compensating G1-G5 gates determine completion independently.
