# 逐章提取

完整读取 `schemas.md` 的“通用规则”和“章节草稿示例”。一次可阅读 2–3 个完整章节以提高速度，但每章必须独立输出、独立提交，事实和 `source_refs` 不得串章。

固定输出字段为 `schema_version`、`chapter`、`title`、`source_hash`、`characters`、`events`、`items`、`skills`、`techniques`、`factions`、`locations`、`dialogues`、`summary`。`source_hash` 逐字复制 manifest 中该章的 `input_hash`；空类别仍输出空数组。

- 所有候选至少写 `local_key`、原著 `name`、`source_refs`。章内关联使用名称、`*_name`、`*_names` 或 `local_key`。
- 人物用 `level` 标记五级；前两级可提取身份、性格、关系和功法，后三档只保留辨识度高的短定位。
- 事件优先经典冲突、奇遇、传承、反转和关系转折；不要把同一段过程拆成多个近义事件。
- 物品只收秘籍、剧情关键物、高级药毒、神兵利器和其他稀有特殊物品；普通随身匕首、衣食器具不收。
- 原文明确定名的功法和招式偏高召回。招式必须写 `named_in_source: true`；“全力一挥”“拍出一掌”等普通动作不收，也不创建动作类别。
- 对白必须有 `event_local_key`、`speaker_name`、`text`，并指向本章 `events` 中的现有 `local_key`；一个事件最多一条代表性短对白。
- `summary` 写 `title`、`summary`、`key_events`、`key_characters`、`source_refs`；`key_events` 用本章事件键，`key_characters` 用原著人名。

证据只要求章节正确：`source_refs.chapter` 和非空 `text` 必填，行号可省略。不得借用旧 `data/`、百科、改编或模型记忆补事实。

只输出一个纯 JSON 对象，不附解释，不生成最终 `id`、`*_id`、`*_ids`。
