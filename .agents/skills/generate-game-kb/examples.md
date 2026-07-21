# Command examples

The following commands use the real test book `古龙/剑神一笑`. Worker envelopes go directly to stdin and must never be written to a temporary file. There is no `batch_id`; `submit` performs all input validation inline.

## One-shot orchestration (recommended)

```text
node .agents/skills/generate-game-kb/scripts/flow.js run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
```

`run` returns the `extract` plan while chapters are incomplete; dispatch one sub-agent per `chapter:NNN` and pipe each returned envelope to `submit`; then run `run` again. Once chapters (and, with `--deep`, domains) are complete, `run` assembles, verifies, installs, verifies the install, and archives.

## Step-by-step

```text
node .agents/skills/generate-game-kb/scripts/flow.js prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js extract-plan "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js submit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --attempt 1 --json
node .agents/skills/generate-game-kb/scripts/flow.js assemble "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js install "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --installed --json
node .agents/skills/generate-game-kb/scripts/flow.js archive-run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
```

`unit` is a generic controller work unit. `chapter:001` is one chapter unit; `distill:characters` is one full-book domain unit (only present with `--deep`). `submit` checks that `unit`, `attempt`, and `input_hash` in the envelope match the CLI and the manifest; a malformed or identity-mismatched envelope fails without writing staging, accepted evidence, or progress.

## Deep mode (four domain distill units)

```text
node .agents/skills/generate-game-kb/scripts/flow.js run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-deep --deep --json
# When run returns stage=plan-domains, produce a decision for each distill unit and accept it:
node .agents/skills/generate-game-kb/scripts/flow.js accept "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-deep --unit distill:characters --draft domain-decision-characters.yaml --json
node .agents/skills/generate-game-kb/scripts/flow.js run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-deep --deep --json
```
