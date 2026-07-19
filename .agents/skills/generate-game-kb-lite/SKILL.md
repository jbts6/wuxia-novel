---
name: generate-game-kb-lite
description: Use when generating a source-grounded wuxia game knowledge base quickly while deferring full-book domain distillation until the user explicitly requests it.
---

# Generate Game KB Lite

Lite is the lightweight V4 workflow. It keeps source-grounded chapter
extraction, controller-owned serialization, validated acceptance, bounded retry,
assembly, verification, installation, installed verification, and archival.
It omits automatic full-book domain distillation from the base run.

`semantic_contract_version: 6` and `profile: lite` are controller JSON metadata
only. Never add either field to a submission envelope or final-data YAML. The
controller serializes accepted chapter draft YAML and the five Dashboard
knowledge files; progress, reports, manifests, and receipts remain JSON.

## Controller contract

Treat controller status from `lite-status` as the only scheduler and acceptance
authority. Follow only its `next_action` and `chapter_jobs`; never infer state
from files, file counts, or worker prose.

The controller packs ordinary work into adjacent jobs of two or three chapters
with at most 36,000 CJK characters. Each worker-visible descriptor contains the
controller-issued `run_id`, `batch_id`, `unit`, `attempt`, `input_hash`, and
`source_file`; `source_file` is an absolute read-only path and
`worker_write_paths = []`. The worker-visible payload contains no `staging_path`,
output directory, output filename, or writable location.

The worker must not create, modify, move, or delete any file or directory. The
worker must not call controller or script commands. It reads only `source_file`
and returns one JSON envelope per descriptor in its final worker message. Worker
prose cannot mark a unit accepted; only controller status can do so.

Read [prompts/extract-chapters.md](prompts/extract-chapters.md) before assigning
chapter work. Read [examples.md](examples.md), or
[examples-cn.md](examples-cn.md) for Chinese guidance, before running commands.

## Guarded broker lifecycle

Use this exact order for every controller-issued chapter job:

```text
lite-status
-> lite-guard-open <novel>
-> worker message
-> lite-guard-check <novel> --guard-id <controller guard_id>
-> lite-submit-draft <novel> ... --guard-id <controller guard_id> via stdin
-> lite-status
```

The main agent must not create a temporary file, serialize YAML, invent a path,
or mutate the envelope. After a clean guard result, pass each unchanged JSON
envelope to `lite-submit-draft` through stdin with the descriptor's exact
`--unit`, `--batch`, and `--attempt` plus the controller `--guard-id`.

An identity-matched invalid envelope consumes exactly one attempt through formal
controller rejection. A stale identity or rogue file does not consume an
attempt; stop, refresh `lite-status`, and follow the reported action. Attempt 1
may advance only to controller-issued attempt 2. Attempt 3 is forbidden; a
second rejection enters `manual_review` until the user explicitly runs
`retry-unit --confirm` to start a new bounded cycle.

The guard inventories the Git repository root only and reports exact absolute
paths inside that boundary. Paths outside the repository are not monitored.

## Recovery and blocking state

When `lite-guard-check` reports a misplaced but valid draft as recoverable, show
the controller report to the user. Only after explicit confirmation may the main
agent run `lite-recover-draft ... --guard-id <id> --confirm`. Do not copy, move,
rewrite, or delete the file manually. Recovery preserves the source bytes and
does not consume a failed attempt. The recovered source remains evidence: stop
until the user removes the added file or restores the changed path, refresh
`lite-status`, and open a new guard. Do not submit, schedule another job,
assemble, publish, install, or verify while status reports `worker-write-review`.

A run containing legacy JSON-serialized accepted artifacts is read-only. Do not
dispatch or accept more chapter work in that run; create a fresh V6 Lite run.

## Base lifecycle after chapters

1. Run `lite-prepare`, then follow the guarded broker lifecycle until all
   controller-issued chapter jobs are accepted.
2. Run `lite-status` after each brokered batch.
3. When requested, run `lite-basic-curate` with the controller-issued YAML or the
   explicit `--skip` choice.
4. Run `lite-publish` only when status returns that `next_action`.

Never copy final files manually or bypass a failed controller gate.

## Published product

A successful publication installs exactly these files in `<novel>/data/` for
Dashboard:

- `characters.yaml`
- `skills.yaml`
- `items.yaml`
- `factions.yaml`
- `chapter_summaries.yaml`

Their fields follow [../generate-game-kb/schemas.md](../generate-game-kb/schemas.md).
Evidence-insufficient deep fields remain null or empty; Lite does not guess
full-book rank or prose.

Completion requires matching `source_hash` and `final_data_hash` across
`assembly-report.json`, `verification-report.json`,
`generate_game_kb_install.json`, `artifact-manifest.json`, and
`archive-receipt.json`. Verification must pass source grounding, schema checks,
candidate closure, reference closure, installed verification, and archive hash
binding.

## User-loaded deep work

Base publication is non-blocking and complete without deep work. Load exactly
one `generate-game-kb-deep-*` Skill only when the user explicitly requests that
domain. A deep YAML overlay binds the archived base manifest and current
installed hash, backs up the current `data/`, merges from the current five-file
revision, verifies a temporary copy, and promotes it atomically for Dashboard.
Successive overlays are cumulative; archived accepted evidence stays immutable.
