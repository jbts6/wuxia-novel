# Technical Design

## Boundaries

The source novel and chapter corpus remain the authority. Existing Stage 1/2 artifacts are read-only inputs until their hashes, window references, and JSONL integrity are checked. Final data is rebuilt in a staging directory and promoted only after all gates pass.

## Data Flow

1. Verify `source-index.json` and `scan-manifest.json` against the current source hash.
2. Validate candidate rows and their window/line references; preserve candidate IDs for audit continuity.
3. Reconcile candidates into decisions, including canonical names, final categories, importance, reasons, and formal IDs. Merge/redirect decisions must explicitly retain source candidate IDs.
4. Build events and semantic exemptions from the reconciled records.
5. Enrich the eight consumer JSON files only from source evidence. Each non-empty inspected explanatory field receives `field_source_refs`.
6. Run the independent gap audit without exposing existing final JSON to the audit pass. If it adds valid candidates, return to reconciliation and repeat within the documented round limit.
7. Run every validator and report generator against the same staged final-data hash.
8. Promote staged data and reports only when G1-G5 and review-readiness requirements pass.

## ID Contract

ID allocation happens after canonicalization and category resolution. The mapping is a deterministic artifact (`Chinese name -> pinyin syllables -> formal ID`), not a repair operation over existing `auto_*` IDs. All cross-file references are rewritten from the same mapping and validated as a set.

## Compatibility And Rollback

- Keep the current `data/` and reports untouched during reconstruction; copy them into the task archive or staging snapshot for comparison.
- Do not add a runtime pinyin dependency or retain ad hoc enrichment scripts as part of the production workflow.
- If any gate fails, leave the staging output available for diagnosis and do not replace the current data directory.
- The final comparison report must distinguish reused evidence from regenerated final records.

## Risks

- Existing decisions may encode over-retention because all decisions are `keep`; re-evaluate category and duplicate boundaries rather than trusting counts.
- Existing final reports are stale; every report must be regenerated and hash-checked.
- Some legacy event/dialogue IDs may be structurally valid but semantically tied to old IDs; cross-validation must catch these references.
