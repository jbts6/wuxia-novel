# generate-game-kb 数据契约 v4

本文件是 AI 草稿、accepted 证据与最终五个 YAML 文件的字段契约。每个阶段先读本文件。

当前可写契约：`semantic_contract_version: 4`、`semantic_profile: domain-distill-v1`。

## 通用规则

- AI 章节草稿使用章内 `local_key` 与名称型引用；域草稿只使用脚本提供的 `entry_ref`。
- AI 草稿、accepted 证据和最终数据使用 YAML；控制器状态、清单、收据和报告使用 JSON。
- 域蒸馏草稿禁止输出 `candidate_key`、`local_key`、最终 ID。
- **source_refs 必须保留**：每个实体至少一条 source_refs，避免 AI 编造。
- 人物 level 只允许：核心、重要、次要、龙套、背景。
- 人物和武功都必须写 `rank`，八级固定。
- 招式必须有原著专名且 `named_in_source: true`。
- 不提取对话、事件、地点。
- 四个域彼此独立，可并发生成草稿；固定单元顺序仅用于确定性展示与报告。
- characters 与 skills 的 faction 引用延迟绑定到 `assemble`，四个域决策齐备后统一解析。
- 每个 AI 单元最多 2 次提交；YAML 解析与语义错误共用提交预算，第二次失败或重复输出/错误进入 `manual_review`。
- `status --json` 只返回一个 `next_action`，并为 AI 阶段返回稳定排序的 `next_units`。

## 章节草稿示例

```yaml
schema_version: 1
chapter: 1
title: "第一章 起始"
source_hash: "sha256:chapter"
characters:
  - local_key: "character:甲"
    name: "甲"
    level: "核心"
    rank: "初窥门径"
    faction: "势力:青城派"
    source_refs:
      - chapter: 1
        text: "原文锚点"
skills:
  - local_key: "skill:内功"
    name: "玄门内功"
    type: "内功"
    rank: "炉火纯青"
    techniques:
      - name: "飞云掌"
        named_in_source: true
    source_refs:
      - chapter: 1
        text: "原文锚点"
items:
  - local_key: "item:回生丹"
    name: "回生丹"
    type: "丹药"
    inclusion_reason: "高级药毒"
    source_refs:
      - chapter: 1
        text: "原文锚点"
factions:
  - local_key: "faction:青城派"
    name: "青城派"
    type: "门派"
    source_refs:
      - chapter: 1
        text: "原文锚点"
chapter_summary:
  title: "第一章 起始"
  summary: "甲在山谷中与故人相逢。"
  source_refs:
    - chapter: 1
      text: "原文锚点"
```

## 域蒸馏草稿示例

固定单元顺序（仅用于展示与报告）：`distill:factions`、`distill:characters`、`distill:skills`、`distill:items`。四个域彼此独立，可并发处理。

```yaml
schema_version: 1
semantic_contract_version: 4
unit: "distill:factions"
input_hash: "sha256:input"
decisions:
  - entry_ref: "r000001"
    action: "keep"
    patch:
      canonical_name: "青城派"
      type: "门派"
      description: "川西武林门派。"
notes: []
```

action 只允许 `keep`、`merge`、`reject`、`pending`。

## 最终文件

最终数据严格为五个顶层数组 YAML 文件，不包含 `locations`、`dialogues`、`events` 或顶层 `techniques`。

### characters.yaml

```yaml
- id: "char_jia"
  name: "甲"
  aliases: []
  identity: "侠客"
  level: "核心"
  rank: "登堂入室"
  biography: "甲在江湖中追查旧事。"
  faction: "faction_qing_cheng"
  skills:
    - "skill_xuan_men_nei_gong"
  items: []
```

### skills.yaml

```yaml
- id: "skill_xuan_men_nei_gong"
  name: "玄门内功"
  type: "内功"
  faction: "faction_qing_cheng"
  rank: "炉火纯青"
  description: "调息养气。"
  techniques:
    - name: "飞云掌"
      description: "掌势迅疾。"
```

### items.yaml

```yaml
- id: "item_hui_sheng_dan"
  name: "回生丹"
  type: "丹药"
  description: "用于救治重伤。"
```

**type 预设值**：武器、防具、秘籍、丹药、暗器、其他

### factions.yaml

```yaml
- id: "faction_qing_cheng"
  name: "青城派"
  type: "门派"
  description: "川西武林门派。"
```

### chapter_summaries.yaml

```yaml
- chapter: 1
  title: "第1章"
  summary: "第1章摘要。"
```

## 验证规则

- 人物/武功必须有 rank（rank）
- 招式必须 named_in_source: true
- 普通物品不得进入 items
- 稳定 ID、引用闭包必须完整
- **草稿必须保留 source_refs**，最终输出可省略
- workspace 验证重新读取 accepted 证据，并核对 `assembly-report.json` 中的输入哈希、候选闭包和五文件哈希
- 通过后写 `verification-report.json`；安装收据绑定验证报告哈希与严格五个 YAML 文件
