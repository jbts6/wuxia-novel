---
name: generate-game-kb-v5-cn
description: Use when a Chinese reference for the lightweight v5 source-grounded wuxia game knowledge-base workflow is needed.
---

# generate-game-kb-v5 中文参考

V5 是 V4 的轻量版：保留原文取证、动态章节作业、接收、组装、验证、安装、归档和有界重试；耗时的全书域蒸馏不在基础流程内，只能由用户之后主动加载对应 deep 技能。基础发布是不阻塞的。

## 数据与动态作业

章节草稿和五个最终知识文件全部是 YAML；JSON 只用于 controller 元数据、进度、报告和收据。普通作业包含 2 至 3 个相邻章节，合计最多 36,000 个中日韩字符。每章完整读取原文，每章一个 YAML。descriptor 只给当前 `attempt` 和唯一 `staging_path`，主代理和子代理必须原样使用。

## 命令示例

以下使用真实中文路径和 controller 返回形状：

```text
node .agents/skills/generate-game-kb/scripts/flow.js v5-prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js v5-status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js v5-accept "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\runs\run-jian-shen-yi-xiao\staging\chapter_001_attempt_01.yaml" --json
node .agents/skills/generate-game-kb/scripts/flow.js v5-basic-curate "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --skip --json
node .agents/skills/generate-game-kb/scripts/flow.js v5-publish "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --confirm --json
```

每个周期最多两次提交。第二次失败进入 `manual_review`，用户确认后才可重新开始周期；不得自动循环。不要手动复制最终文件或从 staging 文件推断状态。

## 最终产物与审计

发布后 `<novel>/data/` 必须恰好包含：`characters.yaml`、`skills.yaml`、`items.yaml`、`factions.yaml`、`chapter_summaries.yaml`。Dashboard 直接读取这五个 YAML。完成还要求 assembly/verification 报告、安装收据、artifact manifest、归档收据的 source hash 和 final data hash 一致，并通过引用闭包、安装验证和归档验证。

## 按需增强

V5 基础流程完成后，只有用户明确要求时才加载一个 `generate-game-kb-deep-*` 技能。deep overlay 必须绑定 `base_manifest_hash` 与 `base_data_hash`；过期就失败并重新生成，不能修改已归档证据。

