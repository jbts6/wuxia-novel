---
name: generate-game-kb-deep-items
description: Use when a user explicitly requests full-book item distillation after a source-grounded Lite game knowledge base has been published.
---

# Deep items

This is a user-invoked, non-blocking enrichment of an archived Lite base. It is
never run by `lite-publish` and never delays base completion. The published run,
installed data, accepted evidence, and candidate registry remain immutable.

## Prerequisites and objective

Require an archived Lite run and passing installed verification. The controller
must return the archived `artifact-manifest` hash and current installed data
hash. Read accepted item evidence and the installed `items.yaml`; keep only
source-grounded named, rare, or plot-relevant items whose type is in
`武器/防具/秘籍/丹药/暗器/坐骑/异兽/饰品/其他` (manuals, weapons or armor,
medicines, hidden weapons, mounts, exotic beasts, accessories, and other named
rare objects). Resolve aliases and duplicates and refine only `aliases`, `type`,
and `description`. Keep, merge, drop, or patch only
known item registry keys. Never promote generic scenery or add an item, quote,
source_refs, or cross-category reference.

## Merge policy

Use ordered union for `aliases`. Keep a source-supported `type` and
`description`; leave conflicting `type` or `description` null or unchanged until
accepted evidence resolves the conflict. Never concatenate competing values.

## Controller commands

First create the task:

```text
node .agents/skills/generate-game-kb/scripts/flow.js task-add "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --type items-deep --scope items --requested-by user --json
```

The controller returns the generated identifiers and absolute paths. This is a
representative response shape; in a live run copy the returned values exactly:

```json
{
  "task_id": "items-deep-1763424000000-c3d4e5f6",
  "type": "items-deep",
  "scope": "items",
  "requested_by": "user",
  "base_manifest_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
  "base_data_hash": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
  "status": "pending",
  "created_at": "2026-07-18T08:00:00.000Z",
  "staging_path": "C:\\git\\wuxia-novel\\古龙\\剑神一笑\\.game-kb-work\\deferred\\run-jian-shen-yi-xiao\\tasks\\items-deep-1763424000000-c3d4e5f6\\overlay.yaml",
  "input_path": "C:\\git\\wuxia-novel\\古龙\\剑神一笑\\.game-kb-work\\deferred\\run-jian-shen-yi-xiao\\tasks\\items-deep-1763424000000-c3d4e5f6\\input.json"
}
```

Read `input_path`, write the YAML overlay only to `staging_path`, then reuse the
same `task_id` and path. Apply only after `task-run` returns `status: ready`:

```text
node .agents/skills/generate-game-kb/scripts/flow.js task-run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --task-id items-deep-1763424000000-c3d4e5f6 --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\deferred\run-jian-shen-yi-xiao\tasks\items-deep-1763424000000-c3d4e5f6\overlay.yaml" --json
node .agents/skills/generate-game-kb/scripts/flow.js task-apply "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --task-id items-deep-1763424000000-c3d4e5f6 --json
```

Run `task-add` only after `lite-publish` archived the named run and installed
verification passes. It binds `base_manifest_hash` to the archived manifest
and `base_data_hash` to the current installed five-file data. `task-run`
validates and freezes the YAML overlay; `task-apply` requires explicit user
approval and performs one immutable revision. A ready `task-run` response
retains `staging_path`/`draft_path` and adds the immutable accepted
`overlay_path`; `task-apply` consumes that accepted overlay.

## Overlay contract

Operations are YAML, sorted by `registry_key`, and limited to `keep`, `merge`,
`drop`, or constrained `patch` actions:

```yaml
schema_version: 1
base_manifest_hash: "sha256:published-artifact-manifest"
base_data_hash: "sha256:installed-items-base"
operations:
  - registry_key: "item:回生丹"
    action: patch
    patch:
      aliases: ["回命丹"]
      type: 丹药
      description: "仅由 accepted item source_refs 支持的说明"
notes: []
```

Do not include source_refs, evidence, quotes, formal IDs, unknown keys, generic
objects, or invalid fields. Stale hashes, duplicate operations, invalid merge
targets, or invented facts fail closed; regenerate against the current
installed revision.

## Revision and verification

`task-apply` starts from the current installed five YAML files, applies and
verifies a copy, backs up the current `<novel>/data/`, and atomically promotes
the verified revision for Dashboard. Overlays are cumulative; each success
gets a distinct recoverable backup and immutable revision. Verify
`revision-receipt.json` binds `task_id`, operations, `base_manifest_hash`,
`previous_final_data_hash`, `backup_final_data_hash`, new `final_data_hash`,
backup path, revision directory, and installed data path. Never modify archived
accepted evidence, the registry, or active YAML directly.
