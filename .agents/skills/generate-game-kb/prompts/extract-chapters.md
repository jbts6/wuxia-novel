# v7 章节直写合同

每个 job 只处理一个 `chapter:NNN`。执行者只读取 controller 签发的绝对路径 `input_file`，并且只把一份 YAML 写到其中声明的绝对路径 `output_file`。

## 通用边界

- 不返回 envelope，不调用 controller、CLI、接收或提交命令。
- 不创建、修改、移动或删除 `output_file` 之外的任何文件。
- 不改写 `unit/cycle/attempt/producer/input_hash/input_file/output_file` 等 controller 身份字段。
- YAML 顶层恰好为 `characters/skills/items/factions/chapter_summary`；四个实体数组即使为空也必须存在。
- 不输出 `schema_version/chapter/title/source_hash/normalizations`；这些字段和章节局部 `local_key` 由 controller 写入 accepted YAML。不得生成正式 ID 或 controller candidate key。
- 所有实体和章节摘要必须保留当前章节的精确 `source_refs`；不得使用记忆或其他章节证据。
- `skills/items/factions` 使用闭合的 `types` 数组，不使用 legacy `type`。
- 写完后重新读取 `output_file`，确认它是单个可解析 YAML 文档且没有额外顶层字段。

## `chapter-worker` 输入

`input_file` 是只读 JSON，`producer` 为 `chapter-worker`，包含本章 `chapter_text`、章节号、标题、source hash、完整 taxonomy 和唯一 `output_file`。逐章穷尽扫描 `chapter_text`，提取所有有明确名称且有证据的角色、武功、物品、势力与章节摘要，然后直接写入 `output_file`。

## `main-agent-repair` 输入

`input_file` 是只读 JSON，`producer` 为 `main-agent-repair`，只包含 `rejected_draft`、`error_report`、`allowed_repair_codes` 和唯一 `output_file`，不包含小说原文。只做白名单允许的机械修复；任何需要重新理解语义或补充证据的错误都不得猜测修复。

## 返回前检查

1. 只写了 controller 指定的 `output_file`。
2. 输出是 schema v7 YAML，不是 envelope，也没有 Markdown 围栏。
3. `chapter/source_hash/source_refs` 与输入一致。
4. 没有正式 ID、旧 `type`、controller 状态或其他章节内容。
