# 类别清理决策

完整读取 `schemas.md` 的“通用规则”和“类别清理决策草稿示例”，然后只读取主模型分配的一个 AI 可见 `input.json`。该文件对应一个 `clean:<category>:<shard>` 单元。

输入边界只有 `schemas.md`、本提示词、该单元的 `input.json` 和唯一 run-scoped staging 输出路径。不得读取 CTX/context-mode、检索摘要、根目录 `data/`、其他 run、其他工作项、私有 bindings、完整 merged/cleaned book 或最终 ID。`candidate_key`、`local_key`、最终 `id`、候选 ledger 和引用迁移均由脚本私下维护；草稿不得生成、复制或猜测这些机械键。

只输出一个纯 JSON 对象：

```json
{
  "schema_version": 1,
  "stage": "clean_decision",
  "unit": "clean:characters:001",
  "decisions": [
    {
      "entity_ref": "e0001",
      "action": "edit",
      "patch": {"biography": "甲行走江湖。"},
      "resolves": ["o0001"]
    },
    {
      "entity_ref": "e0002",
      "action": "keep",
      "resolves": []
    }
  ],
  "quantity_explanation": null
}
```

- 每个 `entities[*].entity_ref` 必须在 `decisions` 中恰好出现一次；不得遗漏、重复、跨工作项引用。
- 每个决定都显式给出 `resolves`。只能引用输入 `obligations[*].obligation_ref`；声称解决但结果没有消除义务仍会被脚本拒绝。
- `keep` 不改字段；`edit` 的 `patch` 只写本类别允许的语义字段；`merge_into` 只指向本工作项的 `target_ref`，reason 固定为 `duplicate` 并填写 detail；`drop` 使用有限拒绝 reason 与非空 detail。
- 原文明确定名功法/招式、核心人物和重要人物不得直接 `drop`；只能 keep、edit，或有依据地 `merge_into` 同类存活实体。
- 人物详略、物品准入、对白事件存在性/章节/唯一性等以输入 obligations 为硬约束。存在义务时不得用 keep-all 绕过；义务为空且全部实体显式裁决时允许零删除。
- `quantity_explanation` 只解释本类别的保留、合并或删除；数量不是补数或删数门禁。
- 不输出全量实体数组、`candidate_resolutions`、章节摘要或游戏素材。

把 JSON 写到主模型指定的 staging 路径。不要调用 `accept`；结束时只返回草稿路径和简短状态。
