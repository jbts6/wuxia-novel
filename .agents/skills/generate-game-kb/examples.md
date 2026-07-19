# V4 command examples

The following commands use the real test book `古龙/剑神一笑`. Replace only values returned by `status --json`; keep the controller-issued `attempt` and `staging_path` unchanged.

```text
node .agents/skills/generate-game-kb/scripts/flow.js archive-existing "C:\git\wuxia-novel\古龙\剑神一笑" --archive-id before-run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js accept "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --unit chapter:001 --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\runs\run-jian-shen-yi-xiao-v4-real-20260718\staging\chapter_001_attempt_01.yaml" --json
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --unit chapter:001 --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js refresh-domain-work "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --unit distill:characters --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js import-chapters "C:\git\wuxia-novel\古龙\剑神一笑" --from-run run-jian-shen-yi-xiao-v4-real-20260718 --run run-jian-shen-yi-xiao-v4-v6-20260718 --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js plan-domains "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js assemble "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js install "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --installed --json
node .agents/skills/generate-game-kb/scripts/flow.js archive-run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
```

`unit` is a generic controller work unit. `chapter:001` is one chapter unit; `distill:characters` is one full-book domain unit. `retry-unit` starts a new user-confirmed bounded cycle and still allows at most one automatic retry.
