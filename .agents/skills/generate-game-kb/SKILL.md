---
name: generate-game-kb
description: Use when building the complete source-grounded v4 wuxia game knowledge base from a novel, including chapter extraction, domain distillation, verification, installation, and archival.
---

# generate-game-kb v4

这是完整的 v4 流程。小说原文是唯一事实来源；所有候选、证据和最终知识数据都使用 YAML，控制器状态和审计信息使用 JSON。流程必须由控制器签发的 run、unit、attempt 和 staging_path 驱动，不能凭文件名猜测状态。

## 语义合同

- 可写 run 使用新的 `semantic_contract_version: 5`、`semantic_profile: domain-distill-v1` 和 `profile: v4`。版本 4 的旧 run 只能查询或显式归档。
- 旧合同 run 只能查询状态或显式归档；任何继续写入都必须失败并报告 `LEGACY_SEMANTIC_CONTRACT`，不得原地升级。
- 所有中间路径都位于小说目录内。中文作者目录、中文书名目录和空格不会改变路径合同；命令参数必须整体加引号。

## 最终产物

成功安装的 `<novel>/data/` 必须恰好包含以下五个 YAML 文件，供 Dashboard 读取：

```text
data/
├── characters.yaml
├── skills.yaml
├── items.yaml
├── factions.yaml
└── chapter_summaries.yaml
```

最终字段来自 `schemas.md`：人物包含 `id/name/aliases/identity/level/rank/biography/faction/skills/items`；武功包含 `id/name/type/faction/rank/description/techniques`；物品和势力包含 `id/name/type/description`；章节摘要包含 `chapter/title/summary`。最终文件不保留 source_refs，source_refs 必须存在于 YAML 草稿和 accepted 证据中。

run 内必须生成并通过以下控制器产物：

- `final/reports/assembly-report.json`：五文件组装结果、输入闭包和 `final_data_hash`。
- `final/reports/verification-report.json`：原文哈希、证据闭包、引用闭包、schema 和最终哈希验证结果。
- `artifact-manifest.json`：accepted YAML 与控制器元数据的相对路径、输入哈希和内容哈希。
- `<novel>/reports/generate_game_kb_install.json`（合同名称 `install-receipt.json`）：安装位置、五文件哈希、`source_hash`、`final_data_hash` 和 verification report 哈希。
- `<novel>/_archive/generate-game-kb/<run-id>/archive-receipt.json`：归档目录、artifact-manifest 哈希和 verification report 哈希。

只有 `verification-report.json` 通过、安装收据绑定五文件哈希、`verify --installed` 通过、再由 `archive-run` 写入归档收据，才算完成。任何哈希漂移、缺文件、引用悬空、证据缺失或 `manual_review` 都阻断完成。

## 完整生命周期

```text
archive-existing
→ prepare
→ chapter:NNN 动态章节作业（2-3 个相邻章节）→ accept
→ 可选 basic-curate
→ plan-domains
→ 四个域作业（可并发生成，主模型串行 accept）
→ assemble
→ verify
→ install
→ verify --installed
→ archive-run
```

每个阶段完成后先读取 `status --json`，只执行控制器返回的一个 `next_action` 和 `next_units`。`accept` 是唯一写入 accepted 的入口；子代理只能写 controller 当前 descriptor 指向的 YAML staging 文件。

## 动态章节作业

- 每个普通作业包含 2 至 3 章相邻章节（即 `2 至 3 章`），总长度不超过 36,000 个中日韩字符。
- 单章超过上限时独立处理；最后无法与相邻章节合并的尾章也可独立处理。
- 子代理必须完整读取作业中每个指定章节的原文，并为每章分别写一个 YAML 文件；不能合并成跨章文件，也不能从同一作业的其他章节复制证据。
- `古龙/剑神一笑/剑神一笑.txt` 的 20 章集成测试应得到七个作业，章节数为 `[3, 3, 3, 3, 3, 3, 2]`。
- 每个章节 descriptor 只包含 controller 当前签发的一个 `attempt` 和一个 `staging_path`。子代理和主代理都使用该绝对路径；不得读取或构造旧路径列表，不得自行递增 attempt。

章节 YAML 顶层只能包含 `schema_version/chapter/title/source_hash/characters/skills/items/factions/chapter_summary`。四类候选和摘要都必须有可核验的 `source_refs`；不确定字段写 null 或省略。招式嵌套在 `skills[].techniques[]`，且 `named_in_source: true`。

并发池初始为 5；429 处理为 `5 → 3`，即同一 batch 首次明确 429 后降为 3；在 3 并发再次遇到不同 batch 的 429，停止 Worker 池并报告限流。传输失败不消耗提交次数。

## 四域蒸馏

`plan-domains` 生成且仅生成以下四个独立 unit：

`distill:factions`、`distill:characters`、`distill:skills`、`distill:items`。

四域可以并发生成 draft，但主模型按固定展示顺序串行 `accept`。每域只能依据已 accepted 的章节 YAML 和原文证据：人物和武功保留全书最高可靠 rank，武功的 techniques 必须来自原文明确定名内容，物品只保留允许的关键类别，势力合并同名实体并保持稳定 ID。faction 引用延迟到 `assemble` 统一解析。领域 draft 仍是 YAML，禁止把 JSON 当知识数据提交。

## 有界失败与恢复

每个 unit 的一个周期包含首次提交和最多 1 次自动重试，等价于最多 2 次提交。YAML 解析错误与语义错误共用同一提交预算；第二次失败、重复输出或重复验证错误进入 `manual_review`，不得自动安排第三次。拒绝的 YAML 草稿、提交记录和错误记录必须保留在 run 的 drafts 目录。

用户确认后可以开始新的有界周期；`retry-unit` 和兼容的 `reset-unit` 都必须带 `--confirm`。新的周期仍最多 1 次自动重试，且 controller 会签发新的 attempt/staging_path。

```text
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --confirm --json
```

`unit` 是通用工作单元，不只指章节；例如 `chapter:001` 是章节，`distill:characters` 是人物域。`manual_review.json` 的 suggested_action 使用同一命令格式。

## 用户命令与真实示例

以下示例中的路径、run、unit 和 draft 路径都是可直接替换为 controller 返回值的真实形状；不要让 AI 猜动态标识符。

```text
node .agents/skills/generate-game-kb/scripts/flow.js archive-existing "C:\git\wuxia-novel\古龙\剑神一笑" --archive-id before-run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js accept "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\runs\run-jian-shen-yi-xiao\staging\chapter_001_attempt_01.yaml" --json
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js basic-curate "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --skip --json
node .agents/skills/generate-game-kb/scripts/flow.js plan-domains "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js accept "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit distill:characters --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\runs\run-jian-shen-yi-xiao\staging\distill_characters_attempt_01.yaml" --json
node .agents/skills/generate-game-kb/scripts/flow.js assemble "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js install "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --installed --json
node .agents/skills/generate-game-kb/scripts/flow.js archive-run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
```

`status --json` 返回的章节 job 会再次给出每章的 `unit`, `attempt` 和唯一 `staging_path`；主代理必须原样转交这些值给子代理。`archive-run` 前不得手动复制、重命名或删除 `data/`、accepted 或 rejected draft。

## 路径与安全边界

```text
<novel>/.game-kb-work/runs/<run-id>/
├── source/{original.txt,chapters/}
├── staging/<unit>_attempt_<NN>.yaml
├── drafts/<unit>/attempt_<NN>_<hash>.yaml
├── accepted/chapters/ch_001.yaml
├── accepted/domain-decisions/distill_characters.yaml
├── final/data/characters.yaml
├── final/data/skills.yaml
├── final/data/items.yaml
├── final/data/factions.yaml
└── final/data/chapter_summaries.yaml
├── final/reports/{assembly-report.json,verification-report.json}
├── artifact-manifest.json
├── progress.json
└── manual_review.json
```

子代理不得在小说目录外写文件，不得生成脚本文件，不得修改 `attempt`，不得调用 `accept`，不得删除旧 draft。控制器在成功接收后才消费对应 staging 文件；拒绝 draft 始终保留。

## 阻断条件

人物或武功缺可靠 rank、招式没有原文命名依据、普通物品进入物品库、source_refs 章节号不匹配、稳定 ID 或引用闭包不完整、输入或 accepted 哈希漂移、安装验证失败、连续失败进入 `manual_review`，都必须停在当前阶段并报告可执行恢复命令。
