---
name: generate-game-kb
description: 从中文武侠小说生成溯源证据完备的游戏知识库（角色/武功/物品/势力/章节摘要）。当用户需要根据小说目录产出结构化、可溯源的游戏素材知识库时使用。
---

# generate-game-kb — 简化版

从一本中文武侠小说生成游戏知识库。controller（`scripts/flow.js`）把源书拆成章节单元，AI 派发隔离的子代理逐章抽取实体，controller 序列化并校验每个 YAML 产物，最后组装、验证、安装五个终态 YAML 文件。

新 run 使用 `semantic_contract_version: 6`、`semantic_profile: domain-distill-v1`。默认模式只做章节抽取与终态组装；加 `--deep` 才会额外产出四个领域蒸馏单元。

## 最终产物

成功安装后，`<novel>/data/` 必须恰好包含五个 YAML：

```text
characters.yaml
skills.yaml
items.yaml
factions.yaml
chapter_summaries.yaml
```

Dashboard 直接读取这五个文件。完成前还必须看到 `assembly-report.json`、`verification-report.json`、`generate_game_kb_install.json`、`artifact-manifest.json` 与 `archive-receipt.json`。`source_hash` 与 `final_data_hash` 是阻断发布的硬哈希门禁；id plan、verification report、migration receipt 等辅助哈希只用于溯源，漂移时记录 warning，不阻断发布。

## 命令面（目标）

```text
prepare <novel> --run <id>              # 归档已有 data，创建/恢复 run，构建 manifest
extract-plan <novel> --run <id>         # 扁平的 chapter:NNN 单元列表（无 batch_id）
submit <novel> --run <id> --unit chapter:NNN --attempt <n> --json < envelope.json
plan-domains <novel> --run <id>         # 仅 --deep 下使用
assemble <novel> --run <id>
verify <novel> --run <id> --json
install <novel> --run <id> --json
verify <novel> --installed --json
archive-run <novel> --run <id>
run <novel> --run <id> [--deep]         # 编排整条管线
```

正常阶段顺序：`prepare -> extract-plan -> submit*（章节） -> plan-domains（可选，--deep） -> assemble -> verify -> install -> verify --installed -> archive-run`。`run` 命令自动编排这一切；主模型负责路由与逐章派发子代理，用户只需提供小说目录和一个可选的 `--deep` 标志。

## `run` 编排器

`run` 是渐进式的：它根据当前 run 状态尽量向前推进，并返回下一个需要 AI 驱动的阶段，或最终的归档结果。

- 章节未全部完成 → 返回 `extract` 阶段（`extract-plan`），由 AI 派发每章一个子代理并调用 `submit`。
- 章节完成、且 `--deep` 下领域单元未完成 → 返回 `plan-domains` 阶段，由 AI 为四个领域单元产出决策并调用 `accept`。
- 全部就绪 → 依次 `assemble -> verify -> install -> verify --installed -> archive-run`，返回 `archived`。

硬门禁（工作区验证失败、`LOW_RECALL`、安装验证失败）会在对应阶段停下并抛出，不会继续推进。

## 章节作业

- `extract-plan` 为每个章节暴露一个独立的 `chapter:NNN` 单元。不存在 batch 身份，也没有 `batch_id`；每个子代理恰好读取一个源章节（一个绝对只读的 `source_file`）并恰好返回一个 envelope。
- 并发上限为 5；仅在明确收到 429 时降到 3（普通传输失败、空结果或缺失结果不消耗 attempt，也不得推断为 429）。
- Worker 只读取绝对 `source_file`，`worker_write_paths = []`；不得创建、修改、移动或删除任何文件或目录，也不得调用 controller 或推导输出路径。
- 主代理把未修改的 Worker 结果经标准输入直接交给 `submit`；controller 负责验证、序列化并写入 YAML，Worker 永不接触任何可写路径。`submit` 只做命令内输入校验（envelope 形状、schema 版本、unit/attempt/input-hash 身份），没有独立的 guard 阶段——因为章节拆分（`ch_split`）是确定性的，且 Worker 从不落盘。

## 实体高召回（强制）

章节单元必须逐章穷尽扫描整段原文：凡是原文有明确命名且能绑定 `source_refs` 的具名实体——包括具名角色（含一次性出场、别名、化名、化身）、具名武功及其显名招式、具名物品、具名势力——都应抽出为候选，不得因"看起来不重要"或"与主线无关"而丢弃。抽取只负责穷尽候选 + 保留证据；重要性排序交给 `rank`，合并/去重交给领域阶段，章节阶段不得主动合并或去重，也不得凭记忆而非逐章扫描产出实体。多章小说若最终实体仅个位数，属低召回，必须重抽而非发布（见 `LOW_RECALL` 门禁）。

## 工作区验证与 `LOW_RECALL` 门禁

`verify` 对工作区做整书校验。其中两个哈希是**硬门禁**：`source_hash`（源书未变）与 `final_data_hash`（终态文件未被漂移）。其余哈希只记录用于溯源，漂移仅作告警。

额外的高召回门禁（用户明确强制）：对于章节数 ≥ 5 的小说，四份实体终态文件（characters / skills / items / factions）去重后的实体总数 ≤ 9 → `LOW_RECALL`；工作区验证失败，阻断安装与归档，要求重新抽取该小说。短篇（< 5 章）豁免此门禁。

## 全书 Rank

章节只记录局部证据，人物和武功的 `rank` 可以是 null 或省略。`--deep` 下的人物域和武功域会收到 controller 签发的全书 `source_files` 与 `rank_contract`，必须按章节顺序完整读取后，为每个 keep 决策填写最终八级 rank。

最终 rank 不取单章最高描写。后期直接战果、真实失败、被克制和反转优先于早期吹捧；当场行动优先于旁观评价；传闻、自述和身份不能单独支持高 rank。人物表示全书结束时的稳定综合战力，武功表示可靠使用者实际展示且未被后文推翻的稳定上限。证据不足时 rank 保持 null，不自动阻断发布；不可调和的 rank 冲突才进入 manual_review。

## JSON envelope（章节）

`unit`、`attempt` 和 `input_hash` 必须逐字复制 `extract-plan` 返回的对应单元。`draft.source_hash` 必须等于同一个 `input_hash`。

```json
{
  "schema_version": 1,
  "unit": "chapter:001",
  "attempt": 1,
  "input_hash": "sha256:controller-input-hash",
  "draft": {
    "schema_version": 1,
    "chapter": 1,
    "title": "第一章 xxx",
    "source_hash": "sha256:controller-input-hash",
    "factions": [
      {
        "local_key": "faction:青城派",
        "name": "青城派",
        "aliases": [],
        "type": "门派",
        "description": null,
        "source_refs": [{ "chapter": 1, "text": "原文锚点" }]
      }
    ],
    "characters": [
      {
        "local_key": "character:甲",
        "name": "甲",
        "aliases": [],
        "identities": [],
        "level": null,
        "rank": null,
        "description": null,
        "factions": [],
        "skills": [],
        "source_refs": [{ "chapter": 1, "text": "原文锚点" }]
      }
    ],
    "skills": [
      {
        "local_key": "skill:内功",
        "name": "玄门内功",
        "aliases": [],
        "types": ["内功"],
        "factions": [],
        "rank": null,
        "description": null,
        "techniques": [{ "name": "飞云掌", "description": null }],
        "source_refs": [{ "chapter": 1, "text": "原文锚点" }]
      }
    ],
    "items": [
      {
        "local_key": "item:回生丹",
        "name": "回生丹",
        "aliases": [],
        "type": "丹药",
        "description": null,
        "source_refs": [{ "chapter": 1, "text": "原文锚点" }]
      }
    ],
    "chapter_summary": {
      "title": "第一章 xxx",
      "summary": "本章摘要",
      "source_refs": [{ "chapter": 1, "text": "原文锚点" }]
    }
  }
}
```

### 字段规则

- `draft` 顶层只能包含 `schema_version/chapter/title/source_hash/factions/characters/skills/items/chapter_summary`；四个候选数组必须存在，即使为空。
- `chapter` 必须等于单元章节号；所有 `source_refs[].chapter` 也必须等于该章节号。
- 引用文本必须是当前 `source_file` 的精确原文片段；不得复制其他章节的名称、证据或摘要。
- `local_key` 使用 `category:名称`，不要写正式 `id`、`candidate_key` 或其他 controller 字段。
- `rank` 只能使用合同中的八级固定值；证据不足时为 null。人物 `level` 只能使用 `核心/重要/次要/龙套/背景`；证据不足时为 null。
- `description` 值只包含描述正文，不得添加"概述：""描述：""说明："等重复字段标签；内容只能复述本章原文直接支持的信息，不确定时为 null。
- `aliases`、`identities`、`types`、`factions` 和 `skills` 按原文首次确认顺序去重。
- `techniques` 只保留原文明确定名的招式；说明不确定时为 null。
- 物品类型使用完整枚举 `武器/防具/秘籍/丹药/暗器/坐骑/异兽/饰品/其他`；只提取原文明确命名、稀有或剧情关键且有证据的物品。

## 真实语料示例（古龙/剑神一笑）

```text
# 1) 一次性编排（章节 -> 组装 -> 验证 -> 安装 -> 归档）
node .agents/skills/generate-game-kb/scripts/flow.js run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json

# 2) 或分步驱动：先看计划，再逐章 submit
node .agents/skills/generate-game-kb/scripts/flow.js prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js extract-plan "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
# 为每个返回的 chapter:NNN 派发子代理，子代理把 envelope 经 stdin 交给：
node .agents/skills/generate-game-kb/scripts/flow.js submit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --attempt 1 --json
node .agents/skills/generate-game-kb/scripts/flow.js assemble "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js install "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --installed --json
node .agents/skills/generate-game-kb/scripts/flow.js archive-run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
```

`--deep` 示例（额外四个领域蒸馏单元）：

```text
node .agents/skills/generate-game-kb/scripts/flow.js run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-deep --deep --json
# 当 run 返回 stage=plan-domains 时，为 distill:characters 等单元产出决策并 accept：
node .agents/skills/generate-game-kb/scripts/flow.js accept "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-deep --unit distill:characters --draft domain-decision-characters.yaml --json
```

## 安全边界

拒绝的 envelope、草稿和错误记录必须保留。`staging/` 是 controller 私有目录；不要手动复制、改名、删除 staging/accepted/final 文件，也不要凭文件存在判断完成。只有 controller 的验证、安装和归档收据可以证明完成。遗留 JSON 知识库不被原地升级；要带入当前契约，重新运行完整的 `prepare -> extract-plan -> submit* -> assemble -> verify -> install` 流程。
