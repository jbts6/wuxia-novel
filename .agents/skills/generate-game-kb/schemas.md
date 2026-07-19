# generate-game-kb V4 数据契约

本文件是 AI 草稿、accepted 证据与最终五个 YAML 文件的字段契约。当前可写合同为 `semantic_contract_version: 6`、`semantic_profile: domain-distill-v1`、`profile: v4`。版本 5 及更早的旧 run 只能查询、迁移或归档，不能原地升级。

## 通用规则

- AI 章节草稿使用章内 `local_key` 与名称型引用；域草稿只使用 controller 提供的 `entry_ref`。
- AI 草稿、accepted 证据和最终数据使用 YAML；控制器状态、清单、收据和报告使用 JSON。
- 每个实体至少保留一条 `source_refs`；最终五个文件不保留该字段。
- 人物 `level` 只允许：核心、重要、次要、龙套、背景。
- 章节和域层人物、武功的 `rank` 都可以是 null 或省略。只有完整全书时间线证据足够时才填写八级 rank，证据不足不阻断 keep。
- 最终人物和武功的 rank 可以为 null；非空值必须由完整全书时间线支持。
- `aliases`、`identities`、`factions`、`types`、`skills` 按首次确认顺序去重；人物和武功的 `factions` 在 `assemble` 延迟绑定。
- 四个域彼此独立，可并发生成草稿；固定顺序只用于展示与报告，不代表处理依赖。
- 每个 AI unit 最多 2 次提交。YAML 解析与语义错误共用同一提交预算，第二次失败或重复错误进入 `manual_review`。
- `status --json` 只返回一个 `next_action`，并为 AI 阶段返回稳定排序的 `next_units`。

## 章节草稿示例

```yaml
schema_version: 1
chapter: 1
title: "第一章 起始"
source_hash: "sha256:chapter"
factions:
  - local_key: "faction:青城派"
    name: "青城派"
    aliases: []
    type: "门派"
    description: null
    source_refs:
      - chapter: 1
        text: "原文锚点"
characters:
  - local_key: "character:甲"
    name: "甲"
    aliases: []
    identities: ["侠客"]
    level: "核心"
    rank: null
    description: "甲在山谷中追查旧事。"
    factions: ["faction:青城派"]
    skills: ["skill:玄门内功"]
    source_refs:
      - chapter: 1
        text: "原文锚点"
skills:
  - local_key: "skill:玄门内功"
    name: "玄门内功"
    aliases: []
    types: ["内功"]
    rank: null
    description: null
    factions: ["faction:青城派"]
    techniques:
      - name: "飞云掌"
        description: null
    source_refs:
      - chapter: 1
        text: "原文锚点"
items:
  - local_key: "item:回生丹"
    name: "回生丹"
    aliases: []
    type: "丹药"
    description: null
    source_refs:
      - chapter: 1
        text: "原文锚点"
chapter_summary:
  title: "第一章 起始"
  summary: "甲在山谷中追查旧事。"
  source_refs:
    - chapter: 1
      text: "原文锚点"
```

四个候选数组必须存在，即使为空。`chapter`、`source_hash` 和每条引用的章节号必须与 descriptor 一致。不得输出正式 ID、控制器字段或未经原文支持的字段。

## 域蒸馏草稿示例

四个域的固定展示顺序为 `distill:factions`、`distill:characters`、`distill:skills`、`distill:items`；四个域彼此独立并可并发处理。

```yaml
schema_version: 1
semantic_contract_version: 6
unit: "distill:factions"
input_hash: "sha256:input"
decisions:
  - entry_ref: "r000001"
    action: "keep"
    patch:
      name: "青城派"
      aliases: []
      type: "门派"
      description: "川西武林门派。"
notes: []
```

`action` 只允许 `keep`、`merge`、`reject`、`pending`。人物和武功的输入工作项包含按章节顺序排列的全书 `source_files` 与 `rank_contract`，必须完整读取后再判断稳定 rank。后期直接战果、真实失败、被克制和反转优先于早期描写；传闻、自述和身份不能单独支持高 rank。证据不足时 rank 为 null。

## 最终文件

最终数据严格为五个顶层 YAML 文件，供 Dashboard 读取：`characters.yaml`、`skills.yaml`、`items.yaml`、`factions.yaml`、`chapter_summaries.yaml`。

### characters.yaml

```yaml
- id: "char_jia"
  name: "甲"
  aliases: []
  identities: ["侠客"]
  level: "核心"
  rank: null
  description: "甲在江湖中追查旧事。"
  factions: ["faction_qing_cheng"]
  skills: ["skill_xuan_men_nei_gong"]
```

### skills.yaml

```yaml
- id: "skill_xuan_men_nei_gong"
  name: "玄门内功"
  aliases: []
  types: ["内功"]
  factions: ["faction_qing_cheng"]
  rank: null
  description: "调息养气。"
  techniques:
    - name: "飞云掌"
      description: "掌势迅疾。"
```

### items.yaml

```yaml
- id: "item_hui_sheng_dan"
  name: "回生丹"
  aliases: []
  type: "丹药"
  description: "用于救治重伤。"
```

### factions.yaml

```yaml
- id: "faction_qing_cheng"
  name: "青城派"
  aliases: []
  type: "门派"
  description: "川西武林门派。"
```

### chapter_summaries.yaml

```yaml
- chapter: 1
  title: "第1章"
  summary: "第1章摘要。"
```

## 验证与收据

- 最终人物、武功的 rank 可为空；非空值必须是合同八级之一。
- 普通物品不得进入 items；稳定 ID、引用闭包和 source_refs 必须完整。
- workspace 验证重新读取 accepted 证据，并核对 `assembly-report.json` 的输入哈希、候选闭包和五文件哈希。
- 安装收据必须绑定 `final_data_hash`、`id_plan_hash`、`verification_report_hash`；归档收据还绑定 artifact manifest hash、final data hash、id plan hash、verification report hash 和可选 `migration_receipt_hash`。
- 只有 `verification-report.json`、`verify --installed` 和归档收据全部通过才算完成。
