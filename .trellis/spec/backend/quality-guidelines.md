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

- Trigger: generating a game-design-oriented wuxia knowledge base quickly with `.agents/skills/generate-game-kb` when chapter-level source accuracy and a fixed 95% quality sample are sufficient.
- This is a separate profile. The audit-grade `.agents/skills/generate-kb` six-stage state machine, `.kb/current`, managed write guards, and independent G1–G5 gates remain unchanged.
- The fast profile cannot claim G1–G5 completion, recall completeness, exact evidence, or audit-grade coverage.

### 2. Signatures

```text
node .agents/skills/generate-game-kb/scripts/flow.js archive-existing <novel-dir>
node .agents/skills/generate-game-kb/scripts/flow.js prepare <novel-dir>
node .agents/skills/generate-game-kb/scripts/flow.js status <novel-dir> --json
node .agents/skills/generate-game-kb/scripts/flow.js worker-backoff <novel-dir> --run <run-id> --batch <batch-id> --reason 429
node .agents/skills/generate-game-kb/scripts/flow.js check-coverage <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js prepare-merge <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js accept <novel-dir> --unit <unit> --draft <json>
node .agents/skills/generate-game-kb/scripts/flow.js assemble-merge <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js check-resolution <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js prepare-clean <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js assemble-clean <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js build-final <novel-dir>
node .agents/skills/generate-game-kb/scripts/flow.js verify <novel-dir>
node .agents/skills/generate-game-kb/scripts/flow.js install <novel-dir>
node .agents/skills/generate-game-kb/scripts/flow.js verify <novel-dir> --installed
node .agents/skills/generate-game-kb/scripts/flow.js archive-run <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js archive-abandoned <novel-dir> --run <run-id> --confirm
```

The writable fast profile is identified by `semantic_contract_version: 3` and `semantic_profile: domain-distill-v1`. AI units are `chapter:NNN`, exactly four initial domain units (`distill:plot`, `distill:martial`, `distill:items`, `distill:world`), high-priority-only `recall:<category>` / `supplement:<category>`, and `quality:sample`. `merge:book`, `clean:book`, and `chapter_summaries` are deterministic with `attempts: 0`; per-category merge/clean/material work is not part of the normal route. `status` is observational and never returns an executable next action.

### 3. Contracts

- Request: one source novel under `<novel-dir>`; `archive-existing` first leaves only that source, `ch_split/`, and `_archive/`. Each run lives under `.game-kb-work/runs/<run-id>/`; `prepare` derives ordered chapter files and a hash-bound manifest, creates or restores `<run-dir>/staging/`, and resuming skips unchanged completed chapters. Every new run persists `run.json.semantic_contract_version: 3`.
- Characters and martial skills require the same canonical `power_rank`, recording the strongest state supported anywhere in the book. Ordered low to high: `平平无奇`, `初窥门径`, `略有小成`, `登堂入室`, `炉火纯青`, `出神入化`, `登峰造极`, `返璞归真`. Chapter workers provide provisional values; `distill:plot` and `distill:martial` keep patches provide final values without adding an AI unit. Final skills expose no legacy rank field, and final items expose no rarity field.
- Legacy contract boundary: a run with a missing or different semantic contract version is observational evidence only. `status --json` is allowed; prepare/resume, semantic planning or acceptance, reset, deterministic assembly, build, workspace verification, install, and positive acceptance fail with `LEGACY_SEMANTIC_CONTRACT`. No in-place upgrade is allowed. Only an explicit `archive-abandoned --confirm` may move the complete legacy run, drafts included, under the abandoned evidence archive.
- Invocation: the user supplies the novel directory and invokes `generate-game-kb`; the current main model owns zero/one/multiple-run routing and every subsequent normal stage. Internal command ordering is a Skill contract, not user input. `prepare` without `--run` must archive only when no eligible run exists, resume the unique eligible run without moving it, and fail with `RUN_AMBIGUOUS` when multiple runs exist. A legacy unique run reaches the semantic-version guard instead of being archived. Multiple active runs stop for explicit selection.
- Semantic boundary: one isolated host-native chapter worker directly reads each complete chapter source file and writes only its assigned run-scoped staging draft. The current main model orchestrates chapter/domain workers, serializes `accept`, and performs targeted recall and fixed-sample review. CTX/context-mode, search summaries, heuristic extraction, and external model CLIs are not semantic inputs or substitute executors; deterministic scripts own archive, state, candidate registration, hash, validation, projection, installation, and reports.
- Worker-pool state: every prepared run owns `<run-dir>/worker-pool.json` with `schema_version`, `initial_limit`, `concurrency_limit`, `halted`, `incidents`, and `updated_at`. Chapter and domain work share the pool. A new run starts at 3; explicit resume preserves the file, and observational `status --json` returns it as `worker_pool` without changing it.
- Dispatch: one batch contains at most `min(worker_pool.concurrency_limit, host-native available slots, pending unit count)` workers. One or more explicit 429 results from the same batch call `worker-backoff` once with the same batch ID, producing `3 -> 1`; duplicate batch IDs are idempotent. The limit never auto-increases within a run.
- Transport failures: `worker-backoff` modifies only `worker-pool.json`; `progress.json` remains byte-for-byte unchanged, no `accept` call occurs, and chapter `attempts` / `semantic_attempts` stay unchanged. A retried chapter uses a fresh worker and rereads the complete source chapter.
- Staging submissions: `accept` permits only `<run-dir>/staging/<unit>_attempt_<attempts+1>.json` for the current input hash. Once a submission is recorded, the CLI archives its raw bytes and consumes the staging file on both success and validation rejection. Replaying a lower attempt fails before changing progress.
- Chapter drafts use provisional local keys and name-based references. Domain drafts see only bounded `entry_ref` / `target_ref` references and semantic facts. Controller-only `candidate_key`, `local_key`, `registry_key`, private bindings, full candidate ledgers, unchanged whole-book arrays, and final IDs are forbidden in AI-visible domain inputs and outputs.
- Every AI unit has at most three total attempts across restarts. Repeated output, repeated normalized error, or `A -> B -> A` output/error oscillation must stop earlier in `manual_review`.
- `prepare-merge` first builds a deterministic candidate registry: normalize names mechanically, merge exact same-category names, union evidence, migrate references, and retain near-name, identity-conflict, and cross-category-name groups as pending. It then emits exactly one work item per domain. A domain input above the explicit size ceiling fails with `DOMAIN_INPUT_TOO_LARGE`; it is never truncated, sharded by category, or routed back to the former loop.
- Every domain `entry_ref` receives exactly one `keep`, same-category `merge`, finite-reason `reject`, or explained `pending` decision. `assemble-merge` expands private bindings, closes migrations, and writes the compatible merged book. `prepare-clean` emits zero AI units; `assemble-clean` writes the compatible cleaned book. Both aggregate units keep attempts zero.
- High-priority categories are characters, events, items, skills, and techniques. Only deterministic gaps in these categories may open bounded recall/supplement. Fresh chapter extraction requires `dialogues: []`; existing dialogue candidates remain readable for archived-run compatibility. Low-priority factions, locations, dialogues, and chapter-summary completeness produce warnings. Structural schema, evidence, candidate-closure, or unresolved-reference errors remain blocking in every category. Quantity is advisory and cannot become a completion gate.
- Every chapter candidate has a stable candidate key and exactly one ledger destination: `merged_to`, finite-reason `rejected`, or `ambiguous`. Accepted artifacts are immutable and hash-bound in `artifact-manifest.json`; any later change is `ACCEPTED_ARTIFACT_MUTATED`.
- `check-coverage` and `check-resolution` can open bounded work only for high-priority categories. Sparse ordinary dialogue, minor-location coverage, and peripheral-faction coverage are warnings and never create recall.
- Evidence requires a correct chapter and a non-empty source anchor. Exact evidence, line numbers, and paragraph offsets are optional; a cross-chapter event may retain multiple non-contiguous chapter references.
- Named martial skills and named techniques remain high recall. A named technique requires source evidence and uses a non-empty skill reference only when the source states that relationship; a source-grounded technique with no stated parent skill keeps `source_skill: null`. Ordinary actions remain excluded from techniques and do not create a tenth action category.
- Final output is nine top-level-array files: `characters.json`, `events.json`, `items.json`, `skills.json`, `techniques.json`, `factions.json`, `locations.json`, `dialogues.json`, and `chapter_summaries.json`.
- `reports/game_materials.json` is an ID-resolving index over those files, not another entity category. The Dashboard's existing eight browseability files remain unchanged; `events.json` is an additional compatible ninth file.
- Direct `data/` installation is allowed only after workspace verification and only through the fast profile's clean-baseline swap installer. An archived clean baseline must not contain unbound `data/`, `reports/`, or activity artifacts. The installer records hashes and `installed_at`, restores the prior directory after a failed swap, and requires `verify --installed` before `archive-run` moves the complete run to `_archive/generate-game-kb/<run-id>/`.
- Fixed quality quotas never reallocate: skills/techniques 12, events 8, characters 5, items 5, dialogues 4, factions/locations 4, and chapter summaries 2. An empty fresh-run dialogue category contributes zero dialogue samples and does not reallocate its quota. The high-priority subset independently requires 95% source support; low-priority failures are warnings. Legitimately empty high-priority categories require a persisted `none_found` review.
- Each archived run contains `reports/run-metrics.json` with stage wall-clock durations, AI planned/done/attempt counts, format repairs, semantic remedies, maximum AI input bytes, and candidate-count changes. The archive receipt binds the metrics hash.

### 4. Validation & Error Matrix

- A Skill invocation asks the user to choose or sequence ordinary internal commands -> autonomous invocation contract failure; fix the Skill routing instead of documenting manual instructions.
- A chapter draft is generated from CTX/search summaries, heuristic extraction, an external model subprocess, or a worker that did not directly read its one complete source chapter -> source-input contract failure; reject the evidence and regenerate through an isolated native chapter worker without consuming another accepted-artifact path.
- A chapter worker selects an arbitrary `/tmp` path, returns chapter text or JSON through the parent context, calls `accept`, or edits shared run state -> worker-boundary failure; discard that staging output and keep the main model as the only state writer.
- A draft path is outside the selected run, names an attempt other than persisted `attempts + 1`, or resolves through a symlink outside staging -> `DRAFT_STAGING_MISMATCH` or `DRAFT_STAGING_ESCAPE`; do not change the attempt budget.
- Missing or unsafe `--batch` -> `WORKER_BATCH_REQUIRED`; a reason other than the literal `429` -> `WORKER_BACKOFF_REASON_INVALID`, with no concurrency change.
- A repeated batch ID -> return the current `worker_pool` with `duplicate: true` and do not append another incident or halve again.
- A fresh 429 while `concurrency_limit === 1` -> persist `halted: true`, append one `halted` incident, and return `WORKER_RATE_LIMITED`; the Skill stops instead of retrying indefinitely.
- Missing, malformed, out-of-range, or wrong-version worker-pool state -> `WORKER_POOL_CORRUPT`; never silently reset a resumed run to 3.
- Multiple active runs -> stop for explicit run selection; never choose latest, merge state, or archive one implicitly.
- A no-`--run` `prepare` archives or replaces a unique eligible run -> recovery-contract failure; the existing run, progress, worker pool, and archive directory must remain in place.
- Missing or different `semantic_contract_version` on a writable path, including version 2 runs, -> `LEGACY_SEMANTIC_CONTRACT`; preserve status and evidence, never upgrade or reset the run in place. Abandoned archival without confirmation -> `ABANDON_CONFIRM_REQUIRED`.
- Domain draft includes `candidate_key`, `local_key`, `registry_key`, a final ID, or any private binding -> reject it. A short ref is missing, duplicated, outside its work item, or merges across categories -> domain-contract validation failure.
- Work input/binding/hash differs from the planned bytes -> `WORK_ITEM_STALE`. Stable planning or book assembly remains non-semantic and consumes no attempt.
- A named technique is kept without `named_in_source: true`, a non-empty technique skill reference is unresolved, the source names a parent skill but the relation is omitted, an ordinary item is kept without an allowed inclusion reason, or a key event lacks participants/result -> hard validation failure. A source-grounded named technique whose source does not state a parent skill may keep a null relation.
- Domain pending remains, a decision is missing/duplicated, or the candidate ledger does not close -> assembly failure; no aggregate book is written.
- Chapter, domain, recall, or quality draft violates its contract -> reject the submission and consume one persisted attempt.
- Same output, same normalized error, or `A -> B -> A` oscillation -> `manual_review` before another automatic retry.
- Third failed submission -> `ATTEMPTS_EXHAUSTED` and `manual_review`; automatic `reset-unit` is forbidden.
- Unresolved or ambiguous deterministic reference -> `finalize:references` enters `manual_review`; do not ask AI to rotate between ID plans.
- Accepted hash mismatch -> `ACCEPTED_ARTIFACT_MUTATED`; coverage/resolution or final projection stops without refreshing the expected hash.
- Candidate ledger incomplete -> `CANDIDATE_RESOLUTION_INCOMPLETE`; an unresolved `recall:*` or `supplement:*` unit blocks build and install.
- Archived clean baseline contains unbound install entries -> `DIRTY_INSTALL_BASELINE`; existing bytes remain unchanged.
- Any unresolved `manual_review` item -> `build-final` or `install` fails closed, while unrelated chapter extraction may continue.
- Quantity outside its suggested range -> report the actual count and one explanation, then continue; count alone is non-blocking.
- High-priority sample support below `ceil(n * 0.95)` -> `quality:sample` enters `manual_review`; low-priority failures remain warnings and do not return to domain processing.
- Workspace verification missing or failing -> installation refused. Installed hashes, named reports, or receipt missing/stale -> `verify --installed` fails without falling back to work files.

### 5. Good/Base/Bad Cases

- Good: invoking the Skill with only a novel directory makes the current main model inspect persisted state, select the unique valid route, dispatch one isolated native worker per chapter, serially accept run-scoped staging drafts, and continue through installed verification and `archive-run` without user-authored command sequencing.
- Good: a new run reports concurrency 3; a batch with several 429 worker results records one incident and resumes at 1 without changing attempts. A later distinct incident at 1 halts, and context recovery observes the same state.
- Good: a rejected staging draft is archived and removed once; after recovery, recreating or replaying that lower attempt is rejected without changing progress, while a fresh worker writes the next attempt.
- Base: the host exposes fewer than 3 native slots or fewer pending units; dispatch uses the smaller available count without treating that capacity limit as an error or rewriting the persisted upper bound.
- Good: every chapter is accepted, the deterministic registry closes exact matches, four domain decisions assemble attempts-0 compatibility books, only high-priority gaps receive bounded recall, named martial material is retained, ordinary actions/items are absent, the high-priority 95% sample passes, clean installation re-verifies, metrics are hash-bound, and the complete run archives.
- Good: a fresh chapter draft writes `dialogues: []`; a named technique with direct source evidence but no source-stated parent skill remains valid with a null relation, while any non-empty relation must resolve.
- Base: category counts remain outside guidance after the single review, with a source-grounded explanation; verification continues because quantity is advisory.
- Base: line or paragraph placement is approximate while every cited chapter is correct; the record remains valid for this profile but is not exact-evidence output.
- Bad: claiming G1–G5 or recall completeness from the 95% sample, adding entries to reach a quantity band, repeatedly polling `status`, automatically resetting attempts, asking AI to copy a whole-book ledger, or editing final IDs with AI.
- Bad: silently adding version 3 to an older run, using its successful-looking output as positive evidence, installing it, or discarding its failed drafts without explicit abandoned-archive confirmation.
- Bad: writing nine files directly over `data/` without a complete backup, atomic directory swap, install receipt, and installed re-verification.
- Bad: treating an empty item/dialogue quota as permission to sample more skills, opening recall for sparse ordinary dialogue, reopening four domains after a local gap, mutating an accepted file, or installing over an unarchived dirty baseline.
- Bad: restoring default chapter dialogue fixtures after extraction is disabled, rejecting a source-grounded named technique only because its parent skill is unstated, or inventing a parent skill to satisfy the relation field.
- Bad: giving the user a command checklist to operate manually, using a helper script or external model CLI instead of host-native chapter workers, or allowing workers to mutate shared progress while claiming the Skill itself completed the flow.
- Bad: launching more than 3 workers, calling backoff once per failed worker in a shared batch, consuming an `accept` attempt for 429, resetting to 3 after context compaction, or looping after `WORKER_RATE_LIMITED`.

### 6. Tests Required

- Skill contract: assert zero/one/multiple-run autonomous routing, the full normal-stage order, one direct complete source read per isolated native chapter worker, run/unit/attempt staging paths, main-model-only serial acceptance, and exclusion of CTX, summaries, heuristics, external model CLIs, arbitrary `/tmp` drafts, and book-specific branches.
- Run isolation: assert both run creation and resume provide `<run-dir>/staging/`, every generated staging path remains below the selected run, and a second no-`--run` `prepare` resumes the unique v2 run without adding an archive entry.
- Staging lifecycle: assert exact next-attempt binding, realpath containment, consumption after success and rejection, non-consuming stale replay rejection, and continuation through the next attempt.
- Worker-pool unit/CLI: assert initial 3, one incident per batch, `3 -> 1`, duplicate-batch idempotence, explicit-429 validation, persistence across prepare/status recovery, reset only on a new run, and `WORKER_RATE_LIMITED` at one.
- Worker-pool attempt isolation: hash or compare `progress.json` before and after `worker-backoff`; assert byte equality and zero changes to chapter `attempts` and `semantic_attempts`.
- Unit: persisted three-attempt budget, identical output/error, output/error oscillation, explicit reset confirmation, and manual-review blocking.
- Contract: chapter-local evidence, named-technique requirement, conditional source-skill linkage, five character levels, important-item reasons, empty fresh-run chapter dialogues, one summary per chapter, and forbidden intermediate IDs.
- Domain contract: AI-visible short refs only; mechanical-key exclusion; exact entry coverage; legal action/reason/patch fields; cross-category merge rejection; explicit oversize failure; and byte-identical replanning.
- Deterministic assembly: all candidates resolve once through keep/merge/reject, pending blocks, reference chains close uniquely, chapter summaries are projected without AI, and both compatibility books keep attempts zero.
- Legacy isolation: status remains readable while prepare, semantic stages, reset, build, workspace verify, install, and positive acceptance fail closed; `archive-abandoned` requires confirmation and preserves the entire run.
- Projection: deterministic pinyin IDs, collision stability, one-shot reference rewrite, nine arrays, cross-chapter events, and unresolved-reference fail-closed behavior.
- Quality: fixed non-reallocating quotas, high-priority-only 95% hard threshold, low-priority warnings, empty critical-category receipts, quantity-only warnings, game-material source resolution, and no domain retry after sample failure.
- Installation: clean-baseline rejection, pre/post-move fault recovery, idempotence, receipt hashes, installed-only verification, and full run archival.
- Integration: a three-chapter source executes `archive-existing -> prepare -> chapter accept -> check-coverage -> four domain accepts -> deterministic assembly -> high-priority recall if needed -> build-final -> verify -> quality -> install -> verify --installed -> archive-run`, including ordinary-item rejection, empty `dialogues.json`, and no dialogue-driven recall.

### 7. Wrong vs Correct

#### Wrong

Give the user a list of internal commands, launch a separate model CLI to read chapters, treat the fast sample as recall proof, then copy files directly into `data/`.

On one batch with three 429 worker results, call `worker-backoff` three times with three IDs and count each transport failure as a chapter attempt.

Require one dialogue candidate per event and force every named technique to name a parent skill, even when the source states neither relationship.

#### Correct

Invoke the Skill with a novel directory, let the current main model route from persisted state, dispatch at most three isolated native chapter/domain workers, serially accept run-scoped drafts, let scripts register candidates and project IDs once, stop unresolved work in `manual_review`, pass the high-priority sample, then install through backup-and-swap and reverify only installed artifacts.

Keep fresh chapter dialogues empty, preserve the compatible `dialogues.json` array, and require a technique-to-skill link only when that link is source-stated; validate every non-empty link against the final skill set.

Use one stable ID for the entire dispatch batch, record its explicit 429 once, persist `3 -> 1`, and retry affected chapters in fresh full-source workers while leaving `progress.json` unchanged.
