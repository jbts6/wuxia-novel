# 全书一次性清理草稿

完整读取 `schemas.md` 的“通用规则”和“清理草稿示例”，再读取已接受的 `merged/book.json` 与 `pre_clean_quantity.json`。只执行这一轮语义清理和数量复核；成功提交后不得因数量再次返工。

固定输出沿用合并对象的九类数组，改为 `stage: "cleaned"`，并新增 `quantity_review` 与 `game_material_candidates`。`ambiguities` 必须为空；若仍无法消除歧义，停止提交并转人工，不能猜测。

- 删除错类、描述词、泛称、无证据实体、无名普通动作和无特殊性且不推动剧情的普通物品。
- 原文明确定名的功法与招式即使只出现一次也保留；招式保持 `named_in_source: true`。不得创建动作类别。
- 物品 `inclusion_reason` 只允许 `秘籍`、`剧情关键`、`高级药毒`、`神兵利器`、`其他稀有特殊`。
- `核心`、`重要`人物保留详细 `biography`、`personality`、关系和功法；`次要`、`龙套`、`背景`人物的生平短于 200 字，性格词不超过 2 个。
- 每个事件最多保留一条短对白；对白继续用 `event_key` 关联现有事件，并保持 `chapter` 与证据章节一致。
- 只允许一次有原文依据的补漏或删冗。写入 `quantity_review: { "consumed": true, "explanations": [...] }`；数量仍在建议区间外时记录原因并继续，不为过区间而凑数。
- `game_material_candidates` 每项只含 `material_type`、`source_category`、`source_name`、`relevance`、`suggested_use`、`reason`。五种素材类型见 `schemas.md`；候选只能引用本清理结果中唯一存在的实体，不能嵌入事实记录。

只输出一个纯 JSON 对象，不附解释，不生成或修补最终 `id`、`*_id`、`*_ids`。
