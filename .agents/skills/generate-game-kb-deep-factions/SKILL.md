---
name: generate-game-kb-deep-factions
description: Use when a user explicitly requests full-book faction distillation after a source-grounded v5 game knowledge base has been published.
---

# Deep factions

This is a user-invoked, non-blocking enrichment of an archived v5 base. It is
never run by `v5-publish` and never delays base completion. The published run,
installed data, accepted evidence, and candidate registry remain immutable.

## Prerequisites and objective

Require an archived v5 run and passing installed verification. The controller
must return the archived `artifact-manifest` hash and current installed data
hash. Read accepted faction evidence and the installed `factions.yaml`; resolve
aliases and duplicate organizations, then refine only `name`, `type`, and
`description` using evidence-supported hierarchy or relationships. Keep,
merge, drop, or patch only known faction registry keys. Never add a faction,
edge, quote, source_refs, or cross-category entity.

## Controller commands

First create the task:

```text
node .agents/skills/generate-game-kb/scripts/flow.js task-add "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --type factions-deep --scope factions --requested-by user --json
```

The controller returns the generated identifiers and absolute paths. This is a
representative response shape; in a live run copy the returned values exactly:

```json
{
  "task_id": "factions-deep-1763424000000-d4e5f6a7",
  "type": "factions-deep",
  "scope": "factions",
  "requested_by": "user",
  "base_manifest_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
  "base_data_hash": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
  "status": "pending",
  "created_at": "2026-07-18T08:00:00.000Z",
  "staging_path": "C:\\git\\wuxia-novel\\古龙\\剑神一笑\\.game-kb-work\\deferred\\run-jian-shen-yi-xiao\\tasks\\factions-deep-1763424000000-d4e5f6a7\\overlay.yaml",
  "input_path": "C:\\git\\wuxia-novel\\古龙\\剑神一笑\\.game-kb-work\\deferred\\run-jian-shen-yi-xiao\\tasks\\factions-deep-1763424000000-d4e5f6a7\\input.json"
}
```

Read `input_path`, write the YAML overlay only to `staging_path`, then reuse the
same `task_id` and path. Apply only after `task-run` returns `status: ready`:

```text
node .agents/skills/generate-game-kb/scripts/flow.js task-run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --task-id factions-deep-1763424000000-d4e5f6a7 --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\deferred\run-jian-shen-yi-xiao\tasks\factions-deep-1763424000000-d4e5f6a7\overlay.yaml" --json
node .agents/skills/generate-game-kb/scripts/flow.js task-apply "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --task-id factions-deep-1763424000000-d4e5f6a7 --json
```

Run `task-add` only after `v5-publish` archived the named run and installed
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
base_data_hash: "sha256:installed-factions-base"
operations:
  - registry_key: "faction:青城派"
    action: patch
    patch:
      type: 门派
      description: "仅由 accepted faction source_refs 支持的说明"
notes: []
```

Do not include source_refs, evidence, quotes, formal IDs, unknown keys, or
unsupported fields. Stale hashes, duplicate operations, invalid merge targets,
or invented facts fail closed; regenerate against the current installed
revision.

## Revision and verification

`task-apply` starts from the current installed five YAML files, applies and
verifies a copy, backs up the current `<novel>/data/`, and atomically promotes
the verified revision for Dashboard. Overlays are cumulative; each success
gets a distinct recoverable backup and immutable revision. Verify
`revision-receipt.json` binds `task_id`, operations, `base_manifest_hash`,
`previous_final_data_hash`, `backup_final_data_hash`, new `final_data_hash`,
backup path, revision directory, and installed data path. Never modify archived
accepted evidence, the registry, or active YAML directly.
