# Lite command examples

Use controller-returned identities verbatim. These examples use the tracked
medium-length corpus at `C:\git\wuxia-novel\古龙\剑神一笑`.

## Prepare

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## Guarded chapter submission

Read the current controller job:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

Open a guard for the current job. `lite-guard-open` binds the current batch; do
not pass a guessed batch:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-guard-open "C:\git\wuxia-novel\古龙\剑神一笑" --json
```

Dispatch the read-only descriptors returned by status. A worker message returns
one envelope per chapter and writes no file. For example:

```json
{"schema_version":1,"batch_id":"chapter-batch-001","unit":"chapter:001","attempt":1,"input_hash":"sha256:controller-input-hash","draft":{"schema_version":1,"chapter":1,"title":"Chapter title","source_hash":"sha256:controller-input-hash","factions":[],"characters":[],"skills":[],"items":[],"chapter_summary":{"title":"Chapter title","summary":"Grounded summary.","source_refs":[{"chapter":1,"text":"Exact source quote."}]}}}
```

Check the guard using the returned guard ID:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-guard-check "C:\git\wuxia-novel\古龙\剑神一笑" --guard-id <guard-id> --json
```

Only after a clean check, pass the unchanged envelope directly through stdin.
The main agent creates no temporary file and never adds a `--draft` path:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-submit-draft "C:\git\wuxia-novel\古龙\剑神一笑" --batch chapter-batch-001 --unit chapter:001 --attempt 1 --guard-id <guard-id> --json
stdin: <unchanged worker envelope>
```

Refresh status after every brokered batch:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## Controller-reported recovery

When guard check reports a recoverable wrong-path file, show that report to the
user first. Only after explicit confirmation may the controller copy it. Never
copy, move, rewrite, or delete it manually:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-recover-draft "C:\git\wuxia-novel\古龙\剑神一笑" --unit chapter:001 --source <absolute-path-from-guard-report> --guard-id <guard-id> --confirm --json
```

Run `lite-guard-check` again with the same `--guard-id`. Continue only after it
returns clean, then refresh `lite-status`.

## Optional basic curation

When status offers the explicit skip choice:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-basic-curate "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --skip --json
```

## Publish

Run only when status returns `next_action: lite-publish`:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-publish "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## User-authorized retry cycle

After attempt 2 enters `manual_review`, only the user may begin a new bounded
cycle:

```text
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --unit chapter:001 --confirm --json
```

Afterward, call `lite-status` and use only the newly issued identity and attempt.
