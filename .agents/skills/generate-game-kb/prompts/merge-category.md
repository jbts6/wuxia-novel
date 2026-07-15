# 类别合并决策

完整读取 `schemas.md` 的“通用规则”和“类别合并决策草稿示例”，然后只读取主模型分配的一个 AI 可见 `input.json`。该文件对应一个 `merge:<category>:<shard>` 或 `merge:<category>:consolidate` 单元。

输入边界只有 `schemas.md`、本提示词、该单元的 `input.json` 和唯一 run-scoped staging 输出路径。不得读取 CTX/context-mode、检索摘要、根目录 `data/`、其他 run、其他工作项、私有 bindings、accepted 全书对象或最终 ID。`candidate_key`、`local_key`、最终 `id` 及其引用均由脚本私下维护；草稿不得生成、复制或猜测这些机械键。

只输出一个纯 JSON 对象：

```json
{
  "schema_version": 1,
  "stage": "merge_decision",
  "unit": "merge:characters:001",
  "decisions": [
    {
      "entity_ref": "e0001",
      "member_refs": ["c0001", "c0002"],
      "action": "merge",
      "canonical_name": "甲",
      "aliases": ["甲别名"],
      "fields": {"level": "核心", "biography": "甲行走江湖。"}
    }
  ],
  "ambiguities": []
}
```

- 输入 `candidates[*].candidate_ref`，或 consolidation 输入 `entities[*].entity_ref`，必须在 `decisions` 与 `ambiguities` 的 `member_refs` 中恰好出现一次；不得遗漏、重复、跨工作项引用。
- `merge` 生成当前草稿内唯一的 `entity_ref`，合并同一实体的短引用，并填写原著规范名称、别名和本类别允许的 `fields`。
- `fields` 只能使用当前类别对应行列出的键；没有依据的可选键省略，不得增加其他键：
  - `characters`: `level`, `identity`, `biography`, `personality`, `relationship_names`, `skill_names`, `item_names`
  - `events`: `cause`, `process`, `result`, `participant_names`, `location_names`, `importance`
  - `items`: `inclusion_reason`, `type`, `description`
  - `skills`: `type`, `description`, `holder_names`, `technique_names`
  - `techniques`: `named_in_source`, `source_skill_name`, `description`
  - `factions`: `type`, `description`
  - `locations`: `region`, `description`
  - `dialogues`: `event_ref`, `speaker_name`, `chapter`, `text`；对白决定不写 `canonical_name` 和 `aliases`
- `reject` 只含 `member_refs`、`action`、有限 `reason` 和有依据的非空 `detail`。有限 reason 为 `ordinary_item`、`duplicate`、`misclassified`、`no_evidence`、`not_game_relevant`。
- 无法唯一判断时把该组写入 `ambiguities`，使用 `action: "ambiguous"`、`member_refs` 和非空 `detail`；不能猜测。
- consolidation 只合并脚本提供的初步实体摘要，不回读逐章候选或其他 shard 草稿。
- 对白类别中同一个 `event_ref` 最多只能有一个 `merge` 结果；有多条候选时选择最具代表性且证据完整的一条，其余用 `reject` + `reason: "duplicate"` 明确裁决，不能把同一事件的多条对白分别保留。
- 不输出章节摘要、全量实体数组、`candidate_resolutions`、数量复核或游戏素材。

把 JSON 写到主模型指定的 staging 路径。不要调用 `accept`；结束时只返回草稿路径和简短状态。
