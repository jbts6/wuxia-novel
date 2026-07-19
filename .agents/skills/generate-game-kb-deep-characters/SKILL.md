---
name: generate-game-kb-deep-characters
description: Use when a user explicitly requests full-book character distillation after a source-grounded Lite game knowledge base has been published.
---

# Deep characters

This is a user-invoked, non-blocking enrichment of an archived Lite base. It is
never part of `lite-publish` and never delays a successful base. The published
run, installed data, accepted evidence, and candidate registry are immutable
inputs.

## Prerequisites and objective

Require a published, archived Lite run and a passing installed verification. The
controller must return the base `artifact-manifest` hash and current installed
data hash before any draft is written. Read the accepted character evidence and
the installed `characters.yaml`; resolve aliases and duplicates, then refine
only `aliases`, `identities`, `level`, `rank`, `description`, `factions`, and
`skills`. Keep, merge, drop, or patch only known character
registry keys. Every change must be supported by existing accepted evidence;
never add a character, relationship, quote, source_refs, rank, or reference.

## Merge policy

Use ordered union for `aliases`, `identities`, `factions`, and `skills`. Use the
highest supported `level`; use full-book evidence to make `rank` a stable
judgment that accounts for later wins, losses, counters, and reversals. Treat a `description` conflict
as unresolved until accepted evidence supports one coherent replacement; never
concatenate contradictions.

## Controller commands

First create the task:

```text
node .agents/skills/generate-game-kb/scripts/flow.js task-add "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --type characters-deep --scope characters --requested-by user --json
```

The controller returns the generated identifiers and absolute paths. This is a
representative response shape; in a live run copy the returned values exactly:

```json
{
  "task_id": "characters-deep-1763424000000-a1b2c3d4",
  "type": "characters-deep",
  "scope": "characters",
  "requested_by": "user",
  "base_manifest_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
  "base_data_hash": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
  "status": "pending",
  "created_at": "2026-07-18T08:00:00.000Z",
  "staging_path": "C:\\git\\wuxia-novel\\古龙\\剑神一笑\\.game-kb-work\\deferred\\run-jian-shen-yi-xiao\\tasks\\characters-deep-1763424000000-a1b2c3d4\\overlay.yaml",
  "input_path": "C:\\git\\wuxia-novel\\古龙\\剑神一笑\\.game-kb-work\\deferred\\run-jian-shen-yi-xiao\\tasks\\characters-deep-1763424000000-a1b2c3d4\\input.json"
}
```

Read `input_path`, write the YAML overlay only to `staging_path`, then reuse the
same `task_id` and path. Apply only after `task-run` returns `status: ready`:

```text
node .agents/skills/generate-game-kb/scripts/flow.js task-run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --task-id characters-deep-1763424000000-a1b2c3d4 --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\deferred\run-jian-shen-yi-xiao\tasks\characters-deep-1763424000000-a1b2c3d4\overlay.yaml" --json
node .agents/skills/generate-game-kb/scripts/flow.js task-apply "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --task-id characters-deep-1763424000000-a1b2c3d4 --json
```

`task-add` is allowed only after `lite-publish` archived `run-jian-shen-yi-xiao`
and `<novel>/data/` passes `verify --installed`. It binds
`base_manifest_hash` to the archived `artifact-manifest.json` and
`base_data_hash` to the currently installed five-file data set. `task-run`
validates and freezes the YAML overlay without changing active data. Apply is
an explicit user action; one task applies once. A ready `task-run` response
retains `staging_path`/`draft_path` and adds the immutable accepted
`overlay_path`; `task-apply` consumes that accepted overlay.

## Overlay contract

The overlay is YAML, ordered deterministically by `registry_key`, and contains
only the target domain operations. Use `keep`, `merge`, `drop`, or constrained
`patch`:

```yaml
schema_version: 1
base_manifest_hash: "sha256:published-artifact-manifest"
base_data_hash: "sha256:installed-characters-base"
operations:
  - registry_key: "character:甲"
    action: patch
    patch:
      aliases: ["甲公子"]
      identities: ["掌门"]
      level: 重要
      rank: 登堂入室
      description: "仅由 accepted character source_refs 支持的简介"
      factions: ["faction_qing_cheng_pai"]
      skills: ["skill_xuan_men_nei_gong"]
notes: []
```

Do not include `source_refs`, evidence, quotes, formal IDs, unknown registry
keys, or unapproved patch fields. A stale base hash, unknown key, invalid merge
target, duplicate operation, or invented fact fails closed. Rebuild the overlay
against the current installed revision after a stale-base failure.

## Revision and verification

`task-apply` always reads the current installed five YAML files, applies the
overlay to a temporary copy, validates all five files and reference closure,
backs up the current `<novel>/data/`, and atomically promotes the verified copy
back to `<novel>/data/` for Dashboard. Every successful overlay is cumulative,
creates a distinct recoverable backup, and writes an immutable revision.

Check `revision-receipt.json` for bindings to `task_id`, operations,
`base_manifest_hash`, `previous_final_data_hash`, `backup_final_data_hash`, the
new `final_data_hash`, backup path, revision directory, and installed data path.
The archived run and accepted evidence must never be edited. A second overlay
must start from the current installed hash and create a new backup rather than
reuse the previous one.
