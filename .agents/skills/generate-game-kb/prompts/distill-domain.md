# 域蒸馏提示词

你只处理输入工作项指定的一个领域。完整读取 `schemas.md`、本提示词和唯一 `input.json`。

## 输出格式：YAML

**重要：输出 YAML 格式，不是 JSON。**

## 四个域（顺序：factions 先行）

| 单元 | 处理类别 | 重点 | 顺序 |
|---|---|---|---|
| `distill:factions` | factions | 合并同名势力，统一 ID | **先执行** |
| `distill:characters` | characters | 人物 keep 必须给全书巅峰 rank | 后续并行 |
| `distill:skills` | skills | 武功 keep 必须给全书巅峰 rank；招式必须 named_in_source | 后续并行 |
| `distill:items` | items | 只保留秘籍、剧情关键、高级药毒、神兵利器 | 后续并行 |

**重要**：factions 必须先完成，因为 characters 和 skills 都引用 faction。

## YAML 模板

```yaml
schema_version: 1
unit: distill:factions
input_hash: "sha256:xxx"

decisions:
  - entry_ref: "factions:001"
    action: keep
    patch:
      name: 青城派
      type: 门派
      description: 川西武林门派。

  - entry_ref: "factions:002"
    action: merge
    target_ref: "factions:001"
    patch: {}

  - entry_ref: "factions:003"
    action: reject
    reason: duplicate
    detail: 与 factions:001 重复

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
- keep 补丁必须写 name、type、description
- type 可选：门派、帮会、组织、朝廷、其他

### distill:characters
- keep 补丁必须写 level 和全书巅峰 rank
- 核心/重要人物可补充 biography
- 后三档 biography 不超过 200 字
- **faction 引用已蒸馏的 faction entry_ref**

### distill:skills
- keep 补丁必须写 type 和全书巅峰 rank
- 招式必须 named_in_source: true
- **faction 引用已蒸馏的 faction entry_ref**

### distill:items
- 只保留秘籍、剧情关键、高级药毒、神兵利器、其他稀有特殊
- 普通器具用 ordinary_item 拒绝

## 注意事项

1. 输出 YAML，不是 JSON
2. **source_refs 必须保留**：每个实体必须有 source_refs，避免编造
3. 只写 staging 路径，不调用 accept
4. 不修改其他文件
5. 不在书籍目录外写文件
