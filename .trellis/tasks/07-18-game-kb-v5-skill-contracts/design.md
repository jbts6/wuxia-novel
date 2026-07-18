# V4-First Game KB and Lightweight V5 Skill Design

## Boundary

V4 is the canonical, complete workflow. V5 is derived only after the V4 workflow, controller contract, and regression suite pass. V5 reuses V4 chapter scheduling, source grounding, acceptance, retry, assembly, verification, installation, and archival behavior while omitting the expensive domain-distill stage. The four deep skills expose those omitted domain passes only when the user explicitly invokes them.

The controller remains the single owner of source paths, staging paths, attempts, acceptance, hashes, publication, installation, archival, deferred tasks, and immutable revisions. Skill documents route agents through those interfaces; they do not derive paths or reimplement controller state.

## V4 Canonical Contract

### Chapter scheduling

The main agent requests deterministic chapter jobs from the controller. A normal job contains two or three adjacent chapters selected by total source length. Multi-chapter jobs may not exceed 36,000 CJK characters. A single chapter is permitted only when that chapter alone exceeds the budget or a final remainder cannot be combined without exceeding it. Every worker reads the complete original text for every assigned chapter and writes one independent YAML draft per chapter.

Each chapter descriptor exposes exactly one current `attempt` and one controller-generated `staging_path`, plus its canonical `source_file`, `input_hash`, and source length. It must not expose a list from which the main agent or worker chooses a path. The worker writes only to the descriptor's `staging_path`; the main agent submits that same path to `accept`.

### Bounded retry

The initial submission may receive at most one controller-issued retry, for two attempts in a normal cycle. A second rejection moves the unit to `manual_review`; no status loop, scheduler, or worker may start a third attempt automatically. Rejected drafts remain available for review and are never deleted as part of rejection handling.

The explicit command below starts a new bounded cycle for one unit:

```text
retry-unit <novel> --run <run-id> --unit <unit> --confirm
```

`retry-unit` is user-invoked only. It resets the selected unit and its controller work item to attempt one, issues a new current staging path, and leaves accepted sibling units unchanged. Each manually started cycle is still limited to one retry. The lower-level `reset-unit` behavior may remain for compatibility, but public skill recovery instructions use `retry-unit`.

### Skill scope

The V4 skill describes only behavior and artifacts implemented by this workflow. Unsupported future extraction promises are removed from all user-facing skill prose. V4 remains responsible for four entity categories, chapter summaries, four domain-distill decisions, five final YAML files, verification, installation, installed verification, receipts, and archival.

## V5 Base Contract

`generate-game-kb-v5` inherits the verified V4 product and controller contracts while shortening only the model pipeline. It uses the same dynamic chapter jobs, controller-owned current paths, and bounded retry behavior. Its base lifecycle is:

```text
v5-prepare -> repeated v5-status/v5-accept -> v5-basic-curate (submit or skip)
-> v5-publish (assemble -> verify -> install -> installed verify -> archive)
```

The installed result remains the five YAML files under `<novel>/data/`. Chapter extraction drafts are YAML as well. JSON is reserved for controller-owned manifests, progress, reports, task state, and receipts; agents must never substitute JSON for chapter or final knowledge data. A successful publish is not merely the presence of YAML: source and final hashes, reference closure, verification status, installation receipt, installed verification, artifact manifest, and archive receipt must agree.

## On-Demand Distill Contract

Each domain skill is a discoverable, independently invoked adapter over the shared deferred-task interface. Deferred state lives outside the archived base run so enrichment remains available after `v5-publish`:

```text
task-add <novel> --run <run-id> --type <domain>-deep --scope <domain>
task-run <novel> --run <run-id> --task-id <task-id> --draft <controller-requested-overlay-path>
task-apply <novel> --run <run-id> --task-id <task-id>
```

The skill reads the published v5 base and grounded evidence, performs the corresponding v4-quality full-book domain analysis, and submits only constrained operations over existing grounded records. The task is bound to the archived base artifact-manifest hash plus the current installed-data identity. Application rejects stale or invalid overlays, applies operations to a copied five-file YAML data set, verifies it, backs up the currently installed `data/`, and atomically promotes the revision to `<novel>/data/`. The revision and backup receipts bind all hashes. Pending or failed deep tasks never change v5 base completion.

Successive overlays are cumulative: task creation binds the currently installed data hash, and apply rejects the task if another revision changed the installed data first. Every successful apply creates a distinct backup before Dashboard's active data pointer changes.

## Skill Layout

- `generate-game-kb/SKILL.md` and its chapter prompt: canonical V4 scheduling, current-path, retry, final-output, and recovery contract.
- `generate-game-kb-v5/SKILL.md`: discovery metadata, base workflow, output and completion contract, recovery, and routing to optional skills.
- `generate-game-kb-v5/prompts/extract-chapters.md`: a lightweight adapter over the canonical V4 chapter contract, not an independent scheduling definition.
- Four deep `SKILL.md` files: shared task lifecycle plus domain-specific objectives and schema constraints. The documents may reference the canonical v4 `schemas.md` and `distill-domain.md`; no duplicate scripts are added.
- Contract tests cover V4 first, then verify that V5 and the four deep skills inherit or intentionally omit each V4 stage.

## Command Examples and Real Corpus

Every user-facing command documented anywhere in the V4, V5, or deep-skill folders must be followed by a concrete example. Examples use the quoted Windows novel path `"C:\git\wuxia-novel\古龙\剑神一笑"`, the concrete run ID `run-jian-shen-yi-xiao`, and valid unit forms such as `chapter:001` and `distill:characters`. Commands that consume generated identifiers must show the preceding command and reuse the exact identifier from its output; neither the main agent nor a worker may invent a run, task, unit, or path value. Placeholder syntax may remain as a reference only when the concrete example appears beside it.

The tracked source `古龙/剑神一笑/剑神一笑.txt` is the V4 real-corpus integration fixture. It currently contains 20 chapters and approximately 98,000 CJK characters. With the approved three-chapter and 36,000-character limits, deterministic greedy packing produces seven jobs with chapter counts `[3, 3, 3, 3, 3, 3, 2]`. Integration coverage uses this corpus to verify Chinese author/book paths, real chapter-length distribution, controller-issued source and staging paths, and stable resume/status behavior. Small synthetic novels remain the fast unit-test fixtures; the real corpus is not duplicated into temporary test data.

## Compatibility

Existing command names and the five YAML schemas are preserved. `retry-unit` adds an explicit user-facing recovery command without removing `reset-unit`. This change does not auto-run deep skills. It adds a post-publish deferred workspace and makes the explicitly approved `task-apply` operation install a verified revision while retaining the previous installed data as a recoverable backup.

## Validation

Validation proceeds in dependency order:

1. V4 contract and controller tests prove deterministic two-to-three chapter jobs, one current staging path per descriptor, path equality across controller/main agent/worker, one automatic retry, retained rejected drafts, explicit manual retry, and no automatic third attempt.
2. The `古龙/剑神一笑` real-corpus integration test proves seven deterministic jobs with counts `[3, 3, 3, 3, 3, 3, 2]`, quoted Chinese path handling, and controller-owned paths before the complete V4 lifecycle and five-file YAML product pass.
3. V5 tests prove reuse of the V4 chapter and retry contracts while omitting base domain distill.
4. Deep-skill, deferred-task, cumulative overlay, backup, atomic install, and stale-task tests pass.
5. Standard skill validators, JavaScript syntax checks, the complete relevant Node test suite, and diff checks run last.
