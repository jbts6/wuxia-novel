# generate-game-kb 数据契约 v2

本文件是 AI 草稿与最终四类 YAML 的字段契约。每个阶段先读本文件。

## 通用规则

- AI 章节草稿使用章内 `local_key` 与名称型引用；域草稿只使用脚本提供的 `entry_ref`。
- 域蒸馏草稿禁止输出 `candidate_key`、`local_key`、最终 ID。
- **source_refs 必须保留**：每个实体至少一条 source_refs，避免 AI 编造。
- 人物 level 只允许：核心、重要、次要、龙套、背景。
- 人物和武功都必须写 `rank`，八级固定。
- 招式必须有原著专名且 `named_in_source: true`。
- 不提取对话、事件、地点。

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
```

## 域蒸馏草稿示例

```yaml
schema_version: 1
unit: "distill:factions"
input_hash: "sha256:input"
decisions:
  - entry_ref: "factions:001"
    action: "keep"
    patch:
      name: "青城派"
      type: "门派"
      description: "川西武林门派。"
notes: []
```

action 只允许 `keep`、`merge`、`reject`、`pending`。

## 最终文件

### characters.yaml

```yaml
- id: "char_jia"
  name: "甲"
  aliases: []
  identity: "侠客"
  role: "核心"
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
      type: "招式"
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
