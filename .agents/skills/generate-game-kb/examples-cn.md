# V4 命令真实示例

以下命令使用真实测试书 `古龙/剑神一笑`。只替换 `status --json` 返回的动态值，必须原样使用 controller 签发的 `batch_id`、`unit`、`attempt`、`input_hash` 和 `guard_id`。Worker envelope 只通过 stdin 传输，禁止写入临时文件。

```text
node .agents/skills/generate-game-kb/scripts/flow.js archive-existing "C:\git\wuxia-novel\古龙\剑神一笑" --archive-id before-run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js guard-open "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --unit chapter:001 --json
node .agents/skills/generate-game-kb/scripts/flow.js guard-check "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js submit-draft "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --batch chapter-batch-001-003 --unit chapter:001 --attempt 1 --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --unit chapter:001 --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js refresh-domain-work "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --unit distill:characters --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js import-chapters "C:\git\wuxia-novel\古龙\剑神一笑" --from-run run-jian-shen-yi-xiao-v4-real-20260718 --run run-jian-shen-yi-xiao-v4-v6-20260718 --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js plan-domains "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js guard-open "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --unit distill:characters --json
node .agents/skills/generate-game-kb/scripts/flow.js submit-draft "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --batch domain-batch-characters --unit distill:characters --attempt 1 --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js assemble "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js install "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --installed --json
node .agents/skills/generate-game-kb/scripts/flow.js archive-run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
```

`unit` 是通用工作单元：`chapter:001` 表示章节，`distill:characters` 表示全书人物域。每个 Worker envelope 提交前都必须打开并检查干净的 guard。`retry-unit` 需要用户确认，并且新的周期仍最多自动重试一次。
