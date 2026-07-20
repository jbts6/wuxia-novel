# Audit V6 knowledge bases and archive invalid data

## Goal

Identify every currently installed novel knowledge base that satisfies the latest semantic-contract V6 data standard, report the qualified set, migrate reusable legacy data to V6 without re-extracting the novel where this can be proven safe, and archive only the remaining unqualified knowledge bases without deleting source novels.

## Background

- The user defines the latest V6 contract as the authoritative qualification standard.
- The operation is repository-wide and may move multiple knowledge-base directories, so audit evidence and rollback-safe archival are required before mutation.
- Existing untracked user work must remain untouched unless it is itself an installed knowledge base in the explicitly approved archive scope.

## Current Audit Findings

- The repository contains 87 book directories; 18 currently contain an installed `<author>/<book>/data` payload.
- `古龙/剑神一笑` is the only installed payload that currently passes canonical V6 verification.
- The other 17 installed payloads are legacy JSON layouts. Fourteen have no install receipt; `金庸/笑傲江湖`, `金庸/雪山飞狐`, and `金庸/飞狐外传` have semantic-contract V2 receipts and still fail the V6 file-set contract.
- Most legacy entities retain usable `source_refs`; some records have no verifiable evidence. `金庸/书剑恩仇录` has an incomplete installed payload but a complete legacy final payload under its retained run workspace.
- The existing archive implementation preserves novel text, chapter splits, prior archives, and the moved generated workspace under a manifest-backed, rollback-safe archive directory.

## Requirements

- Discover the canonical V6 validator and derive qualification from executable repository contracts rather than filename or timestamp heuristics.
- Inventory all installed knowledge bases and classify each as qualified, unqualified, or not a knowledge base.
- Produce a per-book reason for every unqualified classification before archival.
- Before archival, classify each unqualified knowledge base as deterministically migratable or non-migratable.
- Prefer lossless migration from existing source-grounded accepted evidence or compatible installed data; do not invoke chapter extraction, domain extraction, or any model-authored reconstruction merely to upgrade the contract.
- Legacy migration may read existing final JSON, retained run artifacts, chapter splits, and source hashes, but must not ask an agent or model to read and extract the novel again.
- Convert only fields and evidence that can be derived deterministically. Set ranks that cannot be converted reliably to `null`, remove relationships forbidden by V6, and never fabricate missing evidence.
- Legacy JSON may be converted directly into the five V6 YAML files through an explicit field mapping; serialization-format conversion alone never authorizes semantic invention.
- Isolated legacy entity records without verifiable `source_refs` may be omitted from the V6 candidate. The migration receipt must identify every omitted record and the archived legacy payload must retain it unchanged.
- Require a migrated candidate to pass the same canonical V6 workspace/install verification as a newly produced V6 knowledge base before replacing installed data.
- Preserve the pre-migration installed directory and all legacy evidence so migration can be rolled back without re-extraction.
- If candidate construction or installation fails, archive the legacy generated payload and leave no active unqualified `data`; rollback removes partial V6 output but does not reactivate legacy JSON.
- Preserve qualified data in place.
- Archive only non-migratable or failed-migration knowledge-base data without deleting novel source text or unrelated author/book files.
- Prevent partial moves and name collisions, and retain enough metadata to restore archived data.
- Keep the audit repeatable and verify the post-archive installed set against V6.

## Acceptance Criteria

- [x] The scan scope and canonical V6 qualification command are documented from repository evidence.
- [x] Every installed knowledge base has a deterministic classification and evidence.
- [x] The user receives the complete initially-qualified, migrated-to-V6, and archived-book lists with reasons.
- [x] No migration path re-runs extraction or requires a model to infer missing source evidence.
- [x] Migration receipts identify every reused legacy artifact, converted record, rejected record, and source/final hash.
- [x] Every generated YAML value is traceable either to a legacy JSON field or to deterministic migration metadata; no value is model-authored during migration.
- [x] Every successful migration passes canonical V6 verification and preserves a byte-identical backup of the pre-migration data.
- [x] Every remaining unqualified knowledge base is moved to the approved archive location; none remains discoverable as installed data.
- [x] A failed migration leaves the original payload recoverable in `_archive`, records a retryable failure report, and exposes no partial or legacy payload to the Dashboard.
- [x] Qualified knowledge bases remain byte-for-byte unchanged.
- [x] Novel source files and unrelated user files remain unchanged.
- [x] Post-archive V6 verification passes for every remaining installed knowledge base.
- [x] A manifest maps each archived original path to its archive path and records the validation failure.

## Out of Scope

- Re-running chapter or domain extraction for migration purposes.
- Using a language model to repair, enrich, summarize, or infer missing legacy data.
- Preserving unsupported legacy relationships in the V6 installed payload.
