# Implementation Plan

## Preparation

- [x] Snapshot current `data/`, `build/`, and `reports/` into a dated task archive without deleting user changes.
- [x] Confirm source hash, chapter corpus hash, scan window count, and scan-manifest coverage.
- [x] Run read-only integrity checks for candidate JSONL, decision JSONL, gap-audit rounds, and source references.

## Reconciliation

- [x] **STOP CONDITION:** Do not apply an ID mapping to `data/*.json`, `staging/*.json`, or legacy final records. Existing `auto_*` IDs are diagnostic input only; no final record may be transformed in place.
- [x] Build a deterministic candidate index grouped by canonical name, aliases, category hint, and source evidence.
- [x] Revisit every decision, correcting duplicate, category, generic-name, and source-grounding cases; retain an audit reason for each action.
- [x] Generate and validate the formal ID mapping only after canonical category decisions are stable.
- [x] Generate new final records from reconciled candidates and source evidence; use the ID mapping only while writing those new records and their references.
- [x] Reconcile events, dialogues, chapter summaries, and semantic exemptions against the new ID mapping.

## Enrichment And Staging

- [x] Generate staged `characters.json`, `factions.json`, `locations.json`, `skills.json`, `techniques.json`, `items.json`, `dialogues.json`, and `chapter_summaries.json` with complete contract fields.
- [x] Add field-level source evidence for inspected explanatory fields and preserve exact dialogue/context text.
- [x] Run `validate-final-data.js` before any gap audit or promotion; fix every schema, enrichment, ID, and reference error.

## Independent Audit And Gates

- [x] Run independent gap-audit rounds against the unchanged source; merge any valid new candidates and repeat Stage 3 as required.
- [x] Run `validate-inventory.js`, `validate-final-data.js`, `verify.js`, `cross-validate.js`, `audit-recall.js`, `generate-review-packet.js`, and `generate-summary.js` against the staged output.
- [x] Verify G1-G5, review readiness, current-data hashes, and no stale report references.
- [x] Produce a before/after reuse and risk summary.

## Promotion

- [x] Promote staging to the formal data/report locations only after all acceptance criteria pass.
- [x] Run the final quality check and preserve rollback snapshot and diagnostics.
