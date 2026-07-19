---
name: generate-game-kb-lite
description: Use when generating a source-grounded wuxia game knowledge base quickly while deferring full-book domain distillation until the user explicitly requests it.
---

# Generate Game KB Lite

Lite is the lightweight V4 workflow. It keeps source-grounded chapter
extraction, controller-owned paths, validated acceptance, bounded retry,
assembly, verification, installation, installed verification, and archival.
It omits automatic full-book domain distillation from the base run.

`semantic_contract_version: 6` and `profile: lite` are controller JSON metadata
only. Never add either field to chapter-draft or final-data YAML. Chapter drafts
and the five Dashboard knowledge files are YAML; progress, reports, manifests,
and receipts remain JSON.

## Controller contract

Treat `status` as the only scheduler. Follow only its `next_action` and
`next_units`; never infer state from files. Reuse the controller-issued
`run_id`, `unit`, `attempt`, absolute `source_file`, `input_hash`, and absolute
`staging_path` exactly.

The controller packs ordinary work into adjacent jobs of two or three chapters
with at most 36,000 CJK characters. A worker reads the complete source of every
assigned chapter and writes one independent chapter draft YAML to each
descriptor's sole `staging_path`. The main agent accepts those paths serially.

Read [prompts/extract-chapters.md](prompts/extract-chapters.md) before assigning
chapter work. Read [examples.md](examples.md), or
[examples-cn.md](examples-cn.md) for Chinese guidance, before running commands.

## Base lifecycle

1. Run `lite-prepare`, then `lite-status`.
2. Process every controller-issued chapter job and run `lite-accept` once per
   chapter draft.
3. Run `lite-status` after each accepted batch.
4. When requested, run `lite-basic-curate` with the issued YAML draft or the
   explicit `--skip` choice.
5. Run `lite-publish` only when status returns that `next_action`.

Never copy final files manually or bypass a failed controller gate.

## Retry boundary

Each unit cycle permits the initial validated submission plus at most one
automatic retry. A second rejection enters `manual_review` and blocks
publication. The user may explicitly start a new bounded cycle with
`retry-unit --confirm`; accepted sibling units remain unchanged. Never start a
third attempt automatically.

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
