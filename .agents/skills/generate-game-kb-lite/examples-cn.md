# Lite 真实命令示例

以下命令使用 `C:\git\wuxia-novel\古龙\剑神一笑`。实际执行时必须复制
controller 返回的 `run_id`、`unit` 和 `staging_path`，不能自行猜测。

## 准备或恢复

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## 查询下一步

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## 接收一个章节 YAML

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-accept "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --unit chapter:001 --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\runs\run-jian-shen-yi-xiao-lite\staging\chapter_001_attempt_01.yaml" --json
```

动态作业若含 2 至 3 章，仍按 descriptor 顺序逐章执行一次 `lite-accept`，
完成该组后再次运行 `lite-status`。

## 基础整理

提交 controller 指定的 YAML：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-basic-curate "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\runs\run-jian-shen-yi-xiao-lite\staging\basic-curate_attempt_01.yaml" --json
```

或明确跳过：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-basic-curate "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --skip --json
```

## 发布

仅当状态返回 `next_action: lite-publish` 时执行：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-publish "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## 用户手动重试

`unit` 是 controller 的工作单元 ID；`chapter:001` 就是第 1 章。

```text
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --unit chapter:001 --confirm --json
```

命令完成后重新运行 `lite-status`，只使用新返回的 `attempt` 与
`staging_path`。
