# 域蒸馏提示词

你只处理输入工作项指定的一个领域。完整读取 `schemas.md`、本提示词和唯一 `input.json`。

当前 v5 基础构建不要求四个域决策文件；本提示词仅用于显式提供的过渡期 v5 工作项和旧草稿只读检查。`semantic_contract_version: 4` 的旧 run 不得继续写入。

## 输出格式：YAML

**重要：输出 YAML 格式，不是 JSON。**

## 四个域（固定顺序仅用于展示与报告）

四个域彼此独立，可并发生成草稿；主模型仍串行调用 `accept`。

| 单元 | 处理类别 | 重点 | 固定展示顺序 |
|---|---|---|---|
| `distill:factions` | factions | 合并同名势力，统一 ID | 1 |
| `distill:characters` | characters | 合并同名人物；不确定的 enrich 字段留空 | 2 |
| `distill:skills` | skills | 合并同名武功；招式必须 named_in_source | 3 |
| `distill:items` | items | 只保留秘籍、剧情关键、高级药毒、神兵利器 | 4 |

**重要**：characters 与 skills 的 faction 引用保持 `entry_ref` 延迟绑定，直到 `assemble` 在四个域决策齐备后统一解析。

## YAML 模板

```yaml
schema_version: 1
semantic_contract_version: 5
unit: distill:factions
input_hash: "sha256:xxx"

decisions:
  - entry_ref: "r000001"
    action: keep
    patch:
      canonical_name: 青城派
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
- keep 补丁写可确认的 name、type；description 不确定时写 null 或省略
- type 可选：门派、帮会、组织、朝廷、其他

### distill:characters
- level 和 rank 只在证据足以可靠判断时填写，否则写 null 或省略
- biography 只在证据直接支持时补充，否则写 null 或省略
- 后三档 biography 不超过 200 字
- **faction 引用使用工作项提供的 faction entry_ref，并保持到 assemble 再解析**

### distill:skills
- keep 补丁写可确认的 type；rank、description、faction 不确定时写 null 或省略
- 招式必须 named_in_source: true
- **faction 引用使用工作项提供的 faction entry_ref，并保持到 assemble 再解析**

### distill:items
- 只保留秘籍、剧情关键、高级药毒、神兵利器、其他稀有特殊
- description 和 inclusion_reason 不确定时写 null 或省略
- 普通器具用 ordinary_item 拒绝

## 注意事项

1. 输出 YAML，不是 JSON
2. 只能依据工作项中保留的 `source_refs` 决策，不得补写或编造证据
3. 不得为了通过校验而编造 rank、level、faction、biography、description 或 inclusion_reason；不确定字段必须保持 null 或省略
4. entry_ref、unit、input_hash 以及输入中的 canonical_name/source_refs 绑定仍是硬约束，不得留空、改写或编造
5. 只写 staging 路径，不调用 accept
6. 不修改其他文件
7. 不在书籍目录外写文件
