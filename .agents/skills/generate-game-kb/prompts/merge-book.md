# 全书合并草稿

完整读取 `schemas.md` 的“通用规则”和“合并草稿示例”，再读取全部已接受章节 JSON 与脚本提供的规范化名称分组。只执行一次合并；缺章时停止，不猜补。

固定输出字段为 `schema_version: 1`、`stage: "merged"`、八类实体数组、`chapter_summaries`、`ambiguities`，不得添加其他顶层字段。

- 每个实体使用全书唯一 `local_key`、原著 `canonical_name`、可选 `aliases` 和合并后的 `source_refs`。
- 合并同一实体的候选与别名；同名异人保留不同 `local_key`。无法唯一判断时写入 `ambiguities`，其每项至少含 `category`、`name`、两个以上 `candidates`。
- 跨章事件合并为一条，保留起因、经过、结果和所有相关章节；章节可以不连续。
- 关联只用 `*_name`、`*_names` 或本地键。对白用 `event_key` 指向合并后事件 `local_key`；一个事件最多一条短对白。
- `chapter_summaries` 必须覆盖 manifest 的每一章且每章恰好一条；`key_events`、`key_characters` 改用可唯一解析的原著规范名称。
- 不做数量补齐、不执行最终清理、不加入原文之外的游戏设定。

只输出一个纯 JSON 对象，不附解释，不生成最终 `id`、`*_id`、`*_ids`。合并成功后不得自动生成第二版。
