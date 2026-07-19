---
name: generate-game-kb-cn
description: Use when a Chinese reference for the complete v4 source-grounded wuxia game knowledge-base workflow is needed.
---

# generate-game-kb v4 中文参考

这是完整 V4 流程。原文是唯一事实来源；候选、证据和最终知识数据使用 YAML，控制器状态、清单、报告和收据使用 JSON。所有写入都由 controller 签发的 `run`、`unit`、`attempt` 和 `staging_path` 驱动。

新 V4 run 使用 `semantic_contract_version: 6`、`semantic_profile: domain-distill-v1` 和 `profile: v4`。版本 5 及更早的旧 run 只能查询、迁移或显式归档，不能原地升级。

## 最终产物

成功安装后，`<novel>/data/` 必须恰好包含：

```text
characters.yaml
skills.yaml
items.yaml
factions.yaml
chapter_summaries.yaml
```

Dashboard 直接读取这五个 YAML。完成前还必须看到 `assembly-report.json`、`verification-report.json`、`generate_game_kb_install.json`、`artifact-manifest.json` 和 `archive-receipt.json`，并确认 source hash、final data hash、id plan hash、verification report hash、引用闭包和安装验证一致；归档收据还记录可选 migration receipt hash。

## 章节作业

- 普通作业是 2 至 3 个相邻章节，总长度不超过 36,000 个中日韩字符。
- 超长单章或无法合并的尾章可以单独作业。
- 子代理完整读取 descriptor 指定的每章原文，每章写一个 YAML。
- 只使用 controller 当前签发的一个 `attempt` 和一个绝对 `staging_path`，不构造旧路径或新路径。

## 阶段顺序

```text
archive-existing -> prepare -> chapter:* -> accept -> basic-curate(可选)
-> plan-domains -> distill:factions -> distill:characters
-> distill:skills -> distill:items -> assemble -> verify -> install
-> verify --installed -> archive-run
```

## 全书 Rank

章节只记录局部证据，人物和武功的 `rank` 可以是 null 或省略。V4 的人物域和武功域会收到 controller 签发的全书 `source_files` 与 `rank_contract`，必须按章节顺序完整读取后，为每个 keep 决策填写最终八级 rank。

最终 rank 不取单章最高描写。后期直接战果、真实失败、被克制和反转优先于早期吹捧；当场行动优先于旁观评价；传闻、自述和身份不能单独支持高 rank。人物表示全书结束时的稳定综合战力，武功表示可靠使用者实际展示且未被后文推翻的稳定上限。证据不足时 rank 保持 null，不自动阻断发布；不可调和的 rank 冲突才进入 manual_review。

旧的零尝试 pending 人物/武功工作项缺少全书输入时，只能由 controller 显式刷新：

```text
node .agents/skills/generate-game-kb/scripts/flow.js refresh-domain-work "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit distill:characters --confirm --json
```

不得手改 `input.json`、hash、plan 或 `progress.json`，也不得刷新已 accepted 的域。

每阶段后执行 `status --json`，只执行返回的 `next_action` 和 `next_units`。真实测试书使用 `古龙/剑神一笑`：

```text
node .agents/skills/generate-game-kb/scripts/flow.js prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js accept "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\runs\run-jian-shen-yi-xiao\staging\chapter_001_attempt_01.yaml" --json
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --confirm --json
```

`unit` 是通用工作单元，例如 `chapter:001` 或 `distill:characters`。每周期首次提交后最多自动重试一次；第二次失败进入 `manual_review`，不会自动开始第三次。用户确认后才能用上面的 `retry-unit` 开启新的有界周期。

## 安全边界

拒绝的草稿和错误记录必须保留。不要手动复制、改名、删除 staging/accepted/final 文件，也不要凭文件存在判断完成；只有 controller 的验证、安装和归档收据可以证明完成。
