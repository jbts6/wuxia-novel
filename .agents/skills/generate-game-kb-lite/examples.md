# Lite command examples

Use the controller-returned run ID and paths verbatim. These examples use the
tracked medium-length corpus at `C:\git\wuxia-novel\古龙\剑神一笑`.

## Prepare

Syntax:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-prepare <novel> --run <run-id> --json
```

Example:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## Status

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## Accept one controller-issued chapter draft

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-accept "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --unit chapter:001 --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\runs\run-jian-shen-yi-xiao-lite\staging\chapter_001_attempt_01.yaml" --json
```

For a two-or-three-chapter job, run one `lite-accept` command per chapter in
descriptor order, then call `lite-status` again.

## Optional basic curation

Submit the issued YAML:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-basic-curate "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\runs\run-jian-shen-yi-xiao-lite\staging\basic-curate_attempt_01.yaml" --json
```

Or explicitly skip it:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-basic-curate "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --skip --json
```

## Publish

Run only when status returns `next_action: lite-publish`:

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-publish "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## User-authorized retry cycle

Here `unit` is the controller unit ID; `chapter:001` means chapter 1.

```text
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --unit chapter:001 --confirm --json
```

Afterward, call `lite-status` and use only the newly issued attempt and staging
path.
