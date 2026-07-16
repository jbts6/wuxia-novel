# 域蒸馏提示词

你只处理输入工作项指定的一个领域。完整读取 `schemas.md`、本提示词和唯一 `input.json`。

## 输出格式：YAML

**重要：输出 YAML 格式，不是 JSON。**

## 三个域

| 单元 | 处理类别 | 重点 |
|---|---|---|
| `distill:characters` | characters | 人物 keep 必须给全书巅峰 power_rank |
| `distill:skills` | skills, techniques | 武功 keep 必须给全书巅峰 power_rank；招式必须 named_in_source |
| `distill:items` | items | 只保留秘籍、剧情关键、高级药毒、神兵利器 |

## YAML 模板

```yaml
schema_version: 1
unit: distill:characters
input_hash: "sha256:xxx"

decisions:
  - entry_ref: "characters:001"
    action: keep
    patch:
      level: 核心
      power_rank: 登堂入室
      biography: 甲在江湖中追查旧事。

  - entry_ref: "characters:002"
    action: merge
    target_ref: "characters:001"
    patch: {}

  - entry_ref: "characters:003"
    action: reject
    reason: duplicate
    detail: 与 characters:001 重复

notes: []
```

## 决策规则

- **keep**：保留，patch 写全书巅峰 power_rank
- **merge**：合并到 target_ref
- **reject**：使用有限 reason（duplicate、not_source_grounded 等）
- **pending**：必须语义补救

## 各域判断

### distill:characters
- keep 补丁必须写 level 和全书巅峰 power_rank
- 核心/重要人物可补充 biography
- 后三档 biography 不超过 200 字

### distill:skills
- keep 补丁必须写 type 和全书巅峰 power_rank
- 招式必须 named_in_source: true
- 原文明示所属武功时填写 source_skill_ref

### distill:items
- 只保留秘籍、剧情关键、高级药毒、神兵利器、其他稀有特殊
- 普通器具用 ordinary_item 拒绝

## 注意事项

1. 输出 YAML，不是 JSON
2. 只写 staging 路径，不调用 accept
3. 不修改其他文件
4. 不在书籍目录外写文件
