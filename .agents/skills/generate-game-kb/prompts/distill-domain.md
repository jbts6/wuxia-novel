# 域蒸馏提示词

你只处理输入工作项指定的一个领域。完整读取 `schemas.md`、本提示词和唯一 `input.json`。

当前 v4 完整构建通过本提示词处理四个域决策；新 run 使用 `semantic_contract_version: 6` 与 `profile: v4`。版本 5 及更早的旧 run 不得原地升级或继续写入。

## 输出格式：YAML

**重要：输出 YAML 格式，不是 JSON。**

## 四个域（固定顺序仅用于展示与报告）

四个域彼此独立，可并发生成草稿；主模型仍串行调用 `accept`。

每个 `input.json` 都包含由 controller 写入的唯一 `staging_path` 和当前 `attempt`。
只能把本次草稿写到该 `staging_path`；不得自行推导、改名或选择下一次路径。
提交被拒绝后不得自动重试，必须等待 controller 提供下一份工作项。

| 单元 | 处理类别 | 重点 | 固定展示顺序 |
|---|---|---|---|
| `distill:factions` | factions | 合并同名势力，统一 ID | 1 |
| `distill:characters` | characters | 合并同名人物；按全书时间线判断 rank | 2 |
| `distill:skills` | skills | 合并同名武功；按全书时间线判断 rank；招式必须有原文名称 | 3 |
| `distill:items` | items | 只保留秘籍、剧情关键、高级药毒、神兵利器 | 4 |

**重要**：characters 与 skills 的 faction 引用保持 `entry_ref` 延迟绑定，直到 `assemble` 在四个域决策齐备后统一解析。

## YAML 模板

```yaml
schema_version: 1
semantic_contract_version: 6
unit: distill:factions
input_hash: "sha256:xxx"

decisions:
  - entry_ref: "r000001"
    action: keep
    patch:
      name: 青城派
      aliases: []
      type: 门派
      description: null

  - entry_ref: "r000002"
    action: merge
    target_ref: "r000001"
    patch: {}

  - entry_ref: "r000003"
    action: reject
    reason: duplicate
    detail: 与 r000001 重复

notes: []
```

## 决策规则

- **keep**：保留，patch 写必要字段
- **merge**：合并到 target_ref
- **reject**：使用有限 reason（duplicate、not_source_grounded 等）
- **pending**：必须语义补救

## 各域判断

### distill:factions
- 合并同名势力（如"青城派"和"青城"）
- keep 补丁写可确认的 `name`、`aliases`、`type`；description 不确定时写 null 或省略
- type 可选：门派、帮会、组织、朝廷、其他

### distill:characters
- 按 `source_files` 顺序完整读取全书原文，再按输入中的 `rank_contract` 综合定级
- 证据足够时填写合法八级 rank；证据不足时 rank 为 null，不得取单章最高描写
- 后期直接战果、真实失败、被克制和反转优先；传闻、自述和身份不能单独支持高 rank
- level 只在证据足以可靠判断时填写，否则写 null 或省略
- description 只在完整证据时间线支持时补充，否则写 null 或省略
- `identities` 和 `factions` 使用数组；faction 引用使用工作项提供的 entry_ref，并保持到 assemble 再解析

### distill:skills
- 按 `source_files` 顺序完整读取全书原文，再按输入中的 `rank_contract` 判断该武功经可靠使用者展示、且未被后文推翻的稳定上限
- 证据足够时填写合法八级 rank；证据不足时 rank 为 null
- description、factions 不确定时写 null 或空数组
- 后期直接战果、真实失败、被克制和反转优先；传闻、自述和身份不能单独支持高 rank
- keep 补丁写可确认的 `types` 数组
- 招式必须有原文明确名称，description 不确定时为 null
- `factions` 使用数组；引用使用工作项提供的 faction entry_ref，并保持到 assemble 再解析

### distill:items
- 只保留秘籍、剧情关键、高级药毒、神兵利器、其他稀有特殊
- description 和 inclusion_reason 不确定时写 null 或省略
- 普通器具用 ordinary_item 拒绝

## 注意事项

1. 输出 YAML，不是 JSON
2. factions/items 依据工作项保留的 `source_refs`；characters/skills 还必须读取工作项签发的全部 `source_files`
3. 不得为了通过校验而编造字段；人物/武功 rank 按 `rank_contract` 从完整时间线得出
4. 其他不确定字段保持 null 或省略
5. entry_ref、unit、input_hash 以及输入中的 canonical_name/source_refs 绑定仍是硬约束，不得留空、改写或编造
6. 只写输入中的 `staging_path`，不得修改 `attempt`，不调用 accept
7. 不修改其他文件
8. 不在书籍目录外写文件
