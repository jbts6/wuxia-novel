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

### Start or resume

Run commands from the repository root and replace both placeholders with the
selected novel directory and run ID.

- Existing run: run `lite-status` first:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-status "<novel>" --run <run-id> --json
```

- New run: run `lite-prepare` once, then immediately run the `lite-status`
  command above:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-prepare "<novel>" --run <run-id> --json
```

The controller packs ordinary work into a scheduler batch of two or three chapters
with at most 36,000 CJK characters, then exposes one single-chapter worker
assignment per descriptor. Each worker-visible descriptor contains the
controller-issued `run_id`, `batch_id`, `unit`, `attempt`, `input_hash`, and
`source_file`; `source_file` is an absolute read-only path and
`worker_write_paths = []`. The worker-visible payload contains no `staging_path`,
output directory, output filename, or writable location.

The worker must not create, modify, move, or delete any file or directory. The
worker must not call controller or script commands. Each worker receives exactly one
chapter descriptor, reads only its `source_file`, and returns exactly one JSON
envelope in its final worker message. Worker
prose cannot mark a unit accepted; only controller status can do so.

Read [prompts/extract-chapters.md](prompts/extract-chapters.md) before assigning
chapter work. Read [examples.md](examples.md), or
[examples-cn.md](examples-cn.md) for Chinese guidance, before running commands.

## Guarded broker lifecycle

Use this exact order for one bounded controller window. Select all descriptors
from the first `concurrency_limit` distinct `batch_id` values in `chapter_jobs`.
The 15-descriptor normal maximum and 9-descriptor fallback maximum bound one window.
Open one guard for every selected batch before starting extraction, and retain
the `batch_id` to `guard_id` mapping for submission.

```text
lite-status
-> if worker_pool.halted, stop without dispatch
-> select the first concurrency_limit distinct batch_id values and all their descriptors
-> lite-guard-open <novel> once per selected batch
-> Claude Code: game-kb-chapter-extract(run_id, prompt_file, descriptors, concurrency_limit)
-> other platforms: maintain an equivalent native rolling pool
-> worker messages finish for the bounded window
-> lite-guard-check <novel> for every opened guard_id
-> lite-submit-draft <novel> ... --guard-id <mapped guard_id> via stdin, serially
-> lite-status
```

One sub-agent processes one chapter and returns one envelope. Keep exactly
`worker_pool.concurrency_limit` workers active while queued descriptors remain:
when a worker returns, its slot is free and the next queued descriptor starts
immediately. Wait for the bounded window to finish. Check all guards before submitting any envelope; if any guard is not clean or cannot be checked, submit
nothing from the window. Submit valid envelopes serially in original descriptor order from `chapter_jobs`, using each descriptor's mapped guard.

The main agent must not create a temporary file, serialize YAML, invent a path,
or mutate the envelope. After a clean guard result, pass each unchanged JSON
envelope to `lite-submit-draft` through stdin with the descriptor's exact
`--unit`, `--batch`, and `--attempt` plus the controller `--guard-id`.

A null or missing workflow result is a transport failure. A null or missing result does not consume an attempt; skip it, while other complete results may
still be submitted after every guard is clean. Stop remaining submissions on
any broker rejection, stale identity, replay conflict, or command failure, then
refresh `lite-status`. Only an explicit platform 429 triggers worker backoff;
never infer 429 from a null or generic missing result. The controller is the
only acceptance authority.

### Claude Workflow hard gate

Even when the window contains only one chapter, Claude Code must invoke
`game-kb-chapter-extract`; generic Agent/Task is forbidden, never substitute it. The main
agent/session must not read `source_file`, perform chapter extraction, or
construct, repair, or normalize an envelope. If the Workflow is unavailable,
times out, returns null, missing, malformed, or non-JSON output, fail closed:
stop the window and do not repair, retry, submit, or create a run. Only when
`lite-status` returns `next_action: start-new-run` may the controller authorize a
new run. Keep the Workflow result in memory only; never write an envelope to
the repository, `%TEMP%`, `/tmp`, or any other filesystem path. The Workflow
result memory is the only handoff and must go directly to stdin.

After the guard is clean, pass the unchanged Workflow result directly through
stdin. `$WORKFLOW_ENVELOPE_JSON` is an in-memory value, not a path:

```text
$WORKFLOW_ENVELOPE_JSON | node .agents/skills/generate-game-kb/scripts/flow.js lite-submit-draft "<novel>" --run <run-id> --batch <batch-id> --unit <unit> --attempt <attempt> --guard-id <guard-id> --json
```

An identity-matched invalid envelope consumes exactly one attempt through formal
controller rejection. A stale identity or rogue file does not consume an
attempt; stop, refresh `lite-status`, and follow the reported action. Attempt 1
may advance only to controller-issued attempt 2. Attempt 3 is forbidden; a
second rejection enters `manual_review` until the user explicitly runs
`retry-unit --confirm` to start a new bounded cycle.

Each guard inventories the Git repository root only and reports exact absolute
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
