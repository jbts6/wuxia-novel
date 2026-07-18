# generate-game-kb Skill Split Design

**Date:** 2026-07-18
**Status:** Proposed

## Goal

Separate the strict audit workflow from the fast high-recall workflow and from
optional deep enrichment. The existing `generate-game-kb` skill remains the
v4 audit workflow. A new `generate-game-kb-v5` skill owns the 30-45 minute
grounded base build. Deep enrichment is exposed as independent skills that
produce hash-bound overlays and never block or mutate the base run.

## Skill Boundaries

### `generate-game-kb` (v4)

- Preserve the semantic v4 contract and strict four-domain distillation.
- Preserve legacy domain verification and installed-data receipts.
- Require every worker input to include a controller-allocated staging path.
- Keep rejected drafts, validation errors, and attempt metadata reviewable.
- Allow at most two submissions per unit; the second failure becomes
  `manual_review` without restarting a worker loop.

### `generate-game-kb-v5`

- Use semantic contract v5 and a separate progress/work namespace.
- Run `prepare`, batched chapter extraction, grounded accept/quarantine,
  deterministic basic normalization, optional `basic-curate`, and publish.
- Do not run `plan-domains` or four domain accepts.
- Publish the five YAML files from grounded candidates even when enrichment is
  null or `basic-curate` is skipped.
- Keep quarantine and receipts inside the selected run and bind publication to
  source, registry, resolution, and final hashes.

### Deep Skills

The following skills consume a published v5 base and create only deferred
overlay tasks:

- `generate-game-kb-deep-characters`
- `generate-game-kb-deep-skills`
- `generate-game-kb-deep-items`
- `generate-game-kb-deep-factions`

Each deep skill has one domain scope, its own prompt and validation contract,
and an explicit task/overlay entry point. It may keep, merge, drop, or apply a
constrained patch to an existing grounded entity. It may not invent entities,
evidence, source references, or unsupported enrichment. Applying an overlay
requires a matching base manifest hash and materializes a new verified
revision atomically.

## Data Flow

```text
v4: prepare -> chapter extraction -> accept -> plan-domains -> domain accepts
    -> assemble -> verify -> install -> verify-installed -> archive

v5: prepare -> batched chapter extraction -> grounded accept/quarantine
    -> basic normalization -> optional basic-curate -> publish -> archive

deep skill: published v5 base -> task-add -> task-run -> validated overlay
    -> task-apply -> new hash-bound revision (optional)
```

The v4 and v5 flows use distinct semantic profiles, progress unit namespaces,
work roots, manifests, and receipts. A verifier dispatches by the run or
receipt contract version; a v4 artifact is never upgraded in place and a v5
artifact is never sent through v4 domain verification.

## Staging and Retry Contract

The controller allocates and passes the exact staging path in every worker
input. Workers never infer an attempt number or construct a filename. The
controller records the path, unit, input hash, and attempt together.

On validation failure the original staging draft remains available alongside
the immutable archive and normalized error report. A retry receives a new
controller-allocated path. A unit has at most two submissions; after the
second failure, status is `manual_review` and no worker is restarted
automatically. A missing or wrong-path draft is a controller error and does not
consume an attempt.

## Publication and Overlay Safety

v5 publication is independent of deep tasks. Pending, failed, or skipped deep
tasks do not change the base `next_action`. Every overlay records its input
base manifest hash, validates all operations against grounded base records,
and rejects stale bases. Base artifacts are immutable; revision materializing,
installed verification, and rollback use the existing atomic installer
transaction boundaries.

## Verification Matrix

- v4: rejected staging is retained, retry paths are exact, two-attempt limits
  terminate, and no automatic distill restart loop is possible.
- v5: three chapters with no domain artifacts publish successfully; quarantined
  records remain reviewable; missing summaries, registry drift, receipt drift,
  and final hash drift block publication.
- Deep skills: unknown entity/evidence creation is rejected, stale overlays are
  rejected, operations are deterministic, and failed tasks remain retryable.
- Regression: v4 fixtures remain readable and verifiable; v5 fixtures never
  require v4 domain decisions.

