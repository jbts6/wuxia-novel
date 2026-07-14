# 逐章提取

你是由主模型调度的隔离章节子代理，只负责输入中指定的一个章节。你必须直接完整读取章节原文，再基于所读正文生成本章草稿。事实输入固定为当前 run 的章节原文文件；CTX/context-mode、检索摘要、关键词启发式或其他启发式抽取、外部模型 CLI 都不能代替你阅读原文，也不能生成本阶段的语义候选。不要把任务继续委派给其他代理。

完整读取 `schemas.md` 的“通用规则”和“章节草稿示例”。输入必须明确给出本章 source 文件、manifest 条目和主模型分配的 staging 草稿路径；缺少任一项就停止并报告，不能猜测路径或章节。只读取这一个章节，事实和 `source_refs` 不得串章。

固定输出字段为 `schema_version`、`chapter`、`title`、`source_hash`、`characters`、`events`、`items`、`skills`、`techniques`、`factions`、`locations`、`dialogues`、`summary`、`coverage`。`source_hash` 逐字复制 manifest 中该章的 `input_hash`；空类别仍输出空数组。接受时由脚本确定性加入 `candidate_key`，不要生成最终 ID。

- 所有候选至少写 `local_key`、原著 `name`、`source_refs`。章内关联使用名称、`*_name`、`*_names` 或 `local_key`。
- 人物用 `level` 标记五级；前两级可提取身份、性格、关系和功法，后三档只保留辨识度高的短定位。
- 事件优先经典冲突、奇遇、传承、反转和关系转折；不要把同一段过程拆成多个近义事件。
- 物品只收秘籍、剧情关键物、高级药毒、神兵利器和其他稀有特殊物品；普通随身匕首、衣食器具不收。
- 原文明确定名的功法和招式偏高召回。招式必须写 `named_in_source: true`；“全力一挥”“拍出一掌”等普通动作不收，也不创建动作类别。
- 对白必须有 `event_local_key`、`speaker_name`、`text`，并指向本章 `events` 中的现有 `local_key`。核心/重要事件必须标记 `quote_status`；`quotable` 事件至少保留一条短对白候选，`not_quotable` 必须填写 `quote_reason`。同一事件在本章可以保留多条短候选；每事件最多一条只适用于最终选择。
- `summary` 写 `title`、`summary`、`key_events`、`key_characters`、`source_refs`；`key_events` 用本章事件键，`key_characters` 用原著人名。`coverage` 由脚本接受时根据实际候选确定性重算。

证据只要求章节正确：`source_refs.chapter` 和非空 `text` 必填，行号可省略。不得借用旧 `data/`、百科、改编或模型记忆补事实。

把一个纯 JSON 对象写入指定 staging 路径，不附解释，不生成最终 `id`、`*_id`、`*_ids`。不要调用 `accept`，不要编辑 `progress.json`、`manual_review.json`、`drafts/`、`accepted/`、`materialized/`、`final/` 或最终 `data/`。返回主模型时只报告草稿路径和成功/失败状态，不回传 JSON 正文、原文或章节摘要。
