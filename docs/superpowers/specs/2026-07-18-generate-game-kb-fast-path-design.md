# generate-game-kb Fast Path and Deferred Overlay Tasks

## Status

Proposed design approved in discussion on 2026-07-18. Implementation is intentionally separate from this document.

## Goal

Make the normal knowledge-base build predictable for long books while keeping the hard requirement that final entities are grounded in the novel. The normal path should favor recall, perform only basic deduplication, remove obvious action descriptions such as `挥手一击`, and leave expensive enrichment for manually requested tasks.

The normal path is budgeted by source size, not chapter count. A 45-minute target is an orchestration target for a bounded source-size tier, not a promise for every 50-chapter book.

## Non-goals

- Full-book biographies, descriptions, peak-rank inference, and nuanced faction resolution in the normal path.
- Fuzzy semantic merging of every alias or near-duplicate.
- Installing ungrounded candidates for later human correction.
- Replacing the existing atomic install, hash receipts, rollback, or installed-data verification.

## Normal lifecycle

```text
prepare
  -> multi-chapter extract
  -> batch grounded accept
  -> deterministic normalize/dedup/action filter
  -> one lightweight basic-curate
  -> assemble
  -> hard verify
  -> atomic install + installed verify
  -> archive-run
```

`plan-domains` and the four AI domain-distill units are removed from the normal lifecycle. Their expensive responsibilities are either deterministic, optional, or deferred.

The final published surface remains exactly five YAML files: `characters.yaml`, `skills.yaml`, `items.yaml`, `factions.yaml`, and `chapter_summaries.yaml`. Controller state, evidence, quarantine records, manifests, receipts, and task artifacts remain JSON/YAML under the book directory's run directory.

## Chapter extraction and batching

The controller keeps chapter units independent. A worker job may receive several adjacent chapter descriptors, but it must write one YAML draft per chapter and return a job manifest. Each descriptor includes the chapter number, title, source file, input hash, and expected staging path.

Default packing rules:

- At most two adjacent chapters per worker job.
- Combined source text is at most approximately 36k CJK characters.
- A chapter larger than the budget runs alone; it is never truncated or summarized before extraction.
- Concurrency starts at five and falls back to three only after an explicit 429, preserving the existing halt rule for a second distinct 429.
- Chapter `accept` remains chapter-scoped. A failed chapter can be corrected without resubmitting a chapter from the same worker job that already passed.

The worker prompt contains a per-chapter checklist and forbids copying entities or evidence between chapters. The batch layer reduces process and prompt startup overhead; it does not create a new persistent semantic unit.

## Field contract

The contract distinguishes source-grounded facts from optional enrichment.

### Hard-required at chapter accept

- `name` and `local_key` for every candidate.
- At least one `source_refs` entry with the expected chapter number.
- A non-empty source quote that can be located in the chapter source.
- `source_hash`, chapter number, schema version, and valid category structure.
- Technique names only when the source evidence names the technique; `named_in_source` must be true.

### Nullable or optional in the base build

- Character `rank` and `level` when the chapter does not support a reliable classification.
- `faction` when the relationship is not explicit in the chapter.
- Character `biography`.
- Skill, item, and faction `description`.
- Item `inclusion_reason` when the item passes the basic source-grounded candidate filter but its importance is uncertain.

Missing enrichment is represented by `null`, an empty string, or an empty array according to the final schema. It is never filled with invented text merely to satisfy a validator. Deterministic assembly supplies stable IDs, merged evidence, reference closure, and other derived fields.

## Grounding validator

The current validator only checks that `source_refs.text` is non-empty. The new validator must also:

1. Normalize line endings, Unicode form, and whitespace consistently.
2. Confirm the normalized quote occurs in the corresponding prepared chapter source.
3. Confirm the candidate name occurs in its quote or in the validated source span.
4. Apply the same name check to every technique.
5. Reject cross-chapter references, mismatched source hashes, and invalid line ranges.

Grounding failures are record-level failures. The invalid record is written to a run-scoped quarantine artifact with its validator reason and evidence, while valid records in the same chapter can be accepted. YAML parse errors, invalid chapter identity, and source-hash mismatches remain document-level failures and may consume the chapter's one correction budget.

## Basic normalization and curation

Before the lightweight AI step, deterministic normalization performs:

- Unicode NFKC normalization, whitespace and punctuation normalization.
- Exact normalized-name deduplication within each category.
- Union of source references, aliases already present in accepted evidence, and techniques with the same normalized name.
- Conflict flags for same-name records with incompatible identities or types; ambiguous records are not silently merged.
- Strong generic-action filtering for techniques and skills, including patterns such as `挥手一击`, `反手一掌`, `随手一刀`, `连发数拳`, and similar motion-plus-generic-measure descriptions.

The action filter is intentionally conservative. Named wuxia techniques that merely contain an action verb are retained when the source explicitly presents them as a named technique. Filtered records remain in quarantine for later review.

`basic-curate` is one optional AI call over the deterministic candidate registry. Its only actions are `keep`, `merge`, and `drop`. It cannot create entities, invent evidence, add free-form descriptions, or change source references. It may resolve common duplicate names and obvious ordinary-item candidates that deterministic rules cannot safely classify. If it fails, the grounded deterministic result remains publishable and the failure is recorded for optional retry.

## Deferred overlay tasks

The base run writes a `deferred-tasks.json` registry. A task is added explicitly by the user or a future dashboard action; pending deferred tasks do not appear as executable actions in the normal run status.

The initial manual control surface is the controller CLI, so task creation does not depend on a Dashboard change:

```text
task-add    <novel> --type <task-type> --scope <scope>
task-run    <novel> --task-id <task-id>
task-apply  <novel> --task-id <task-id>
```

`task-add` records a pending task only. `task-run` produces a candidate overlay and stops at `manual_review` when the task requires approval. `task-apply` is the explicit approval boundary and is the only operation allowed to materialize the overlay into a new published revision.

Supported task types are:

- `deep-dedup`: semantic aliases and fuzzy duplicate resolution.
- `deep-rank`: full-book rank and level inference.
- `deep-profile`: biographies and descriptions.
- `deep-items`: detailed item relevance classification.
- `deep-factions`: semantic faction aliases and hierarchy.

Each task is isolated under the book directory:

```text
.game-kb-work/runs/<base-run-id>/
├── deferred-tasks.json
├── tasks/<task-id>/
│   ├── task.json
│   ├── input-manifest.json
│   ├── staging/
│   ├── accepted/
│   └── report.json
└── overlays/<task-id>.yaml
```

`task.json` records the task type, scope, requested time, status, attempt count, base run ID, and base artifact-manifest hash. The overlay contains only deltas against existing entities: `keep`, `merge`, `drop`, or a constrained `patch`. An overlay may reference only source evidence already present in the base run or evidence that passes the same grounding validator.

Task states are `pending`, `running`, `candidate`, `manual_review`, and `applied`. A task can be reviewed without changing the base YAML. Applying an approved overlay creates a new deterministic materialized revision, reruns assembly and verification, and installs atomically. The previous revision remains archived and recoverable.

If the base artifact hash has changed, the overlay is stale and cannot be applied silently. It must be regenerated or explicitly rebased by a separate operation.

## Verification and publishing

`assemble` remains the deterministic projection boundary. `verify` keeps hard checks for grounding, hashes, IDs, reference closure, schema shape, and receipt bindings. Soft quality concerns such as fuzzy duplicates, description quality, ordinary-item suspicion, and rank disagreement become warnings or overlay work items.

The public command surface may expose `publish` as a combined action for assemble, verify, install, installed verification, and archival. The underlying functions and receipts remain separate so failures can resume at the authoritative boundary.

## Time and failure budgets

The base run's time budget covers only the normal lifecycle. Deferred tasks have independent timers and reports. Metrics must record source character count, worker-job count, chapter count, batch concurrency, per-phase duration, task duration, attempts, corrections, quarantine count, and manual wait time.

Transport failures do not consume an AI submission. Chapter-level semantic failures quarantine the bad record; document-level failures use the existing bounded correction policy. Repeated output or a failed correction moves only the affected unit or deferred task to `manual_review`.

## Dashboard boundary

The existing Dashboard can continue to review installed YAML and mark low-value entities for deletion. The normal pipeline's grounding gate remains authoritative because the current Dashboard is primarily a post-install editor and does not inspect chapter evidence. A future review-queue view may expose quarantine records and overlay candidates, but it is not required for the fast-path implementation.

## Acceptance criteria

- A 50-chapter source is packed by the character and two-chapter limits, with independent chapter drafts and retries.
- A fake or non-matching source quote is rejected before acceptance and cannot reach final YAML.
- A chapter containing one invalid candidate still accepts its valid candidates and quarantines the invalid one.
- Exact normalized duplicates merge deterministically and retain all source references.
- Generic action descriptions are filtered while explicitly named techniques remain eligible.
- The normal path has no AI domain-distill units and no pending deferred task can block publication.
- `basic-curate` cannot create entities or evidence and is safe to skip on failure.
- Overlay application rejects stale base hashes, produces byte-stable materialized output, and leaves the previous revision intact on failure.
- Deferred task timing and attempts are reported separately from the base 45-minute budget.
- Legacy runs remain read-only under their existing semantic contract; the new contract is versioned rather than upgraded in place.
