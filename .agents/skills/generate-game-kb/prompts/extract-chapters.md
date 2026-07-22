# v7 章节直写合同

每个 job 只处理一个 `chapter:NNN`。执行者只读取 controller 签发的绝对路径
`input_file`，服从其中内嵌的结构化 `worker_contract`，并且只把一份 YAML
写到其中声明的绝对路径 `output_file`。派发必须自包含：不依赖 Skill 隐式上下文、
`.claude/agents/`、`schemas.md` 或执行者自行寻找其他合同文件。

## 通用边界

- 不返回 envelope，不调用 controller、CLI、接收或提交命令。
- 不执行 Shell、Node、Python 或 BAT 命令，不创建辅助脚本或校验日志。
- 不创建、修改、移动或删除 `output_file` 之外的任何文件。
- 不改写 `unit/cycle/attempt/producer/input_hash/input_file/output_file` 等 controller 身份字段。
- YAML 顶层恰好为 `characters/skills/items/factions/chapter_summary`；四个实体数组即使为空也必须存在。
- 不输出 `schema_version/chapter/title/source_hash/normalizations`；这些字段和章节局部 `local_key` 由 controller 写入 accepted YAML。不得生成正式 ID 或 controller candidate key。
- 所有实体和章节摘要必须保留当前章节的精确 `source_refs`；不得使用记忆或其他章节证据。
- `source_refs[]` 只写逐字 `text`，不写 `chapter/line_start/line_end`；这些定位字段
  由 controller 根据章节原文确定性生成。
- `skills/items/factions` 使用闭合的 `types` 数组，不使用 legacy `type`。
- `worker_contract.output.yaml_skeleton` 是完整字段骨架；不得只依据顶层键猜测嵌套结构。
- 写完后重新读取 `output_file`，执行 `worker_contract.preflight.common` 以及当前
  producer 对应的全部检查。必须递归检查每个实体、technique、章节摘要和所有
  `source_refs`，不能只检查 YAML 顶层。

## `chapter-worker` 输入

`input_file` 是只读 JSON，`producer` 为 `chapter-worker`，包含本章
`chapter_text`、章节号、标题、source hash、完整 taxonomy、`worker_contract`
和唯一 `output_file`。逐章穷尽扫描 `chapter_text`，提取所有有明确名称且有证据
的角色、武功、物品、势力与章节摘要，然后直接写入 `output_file`。

写入前逐项执行：

- `chapter_text.includes(entity.name)`；不成立就不提取该实体，不得把描述性短语
  概括为正式名称。
- 对具名 technique 执行 `chapter_text.includes(technique.name)`；不成立就不输出。
- 对每条引用执行 `chapter_text.includes(source_ref.text)`；不成立就不引用，且不得
  改写引号、标点或原文措辞。
- 每个实体和 technique 的名称还必须逐字出现在它自己的至少一条
  `source_refs[].text` 中；仅在章节别处出现不能通过证据检查。
- 执行 `chapter_summary.summary.trim() !== ""`，并保证摘要至少有一条逐字引用。
- `types` 只能来自输入的闭合 `taxonomies`；未知值不得猜测。
- `characters[].skills/factions` 与 `skills[].factions` 的每个名称必须精确匹配
  本次输出中对应类别的候选名；否则补提取有据候选或不写该关系，不能留下悬空引用。

## `main-agent-repair` 输入

`input_file` 是只读 JSON，`producer` 为 `main-agent-repair`，只包含
`rejected_draft`、`error_report`、`allowed_repair_codes`、同版本
`worker_contract` 和唯一 `output_file`，不包含小说原文。只做白名单允许的机械
修复；不得新增、删除或改写名称、描述、引用及其他语义内容。任何需要重新理解
语义或补充证据的错误都不得猜测修复。

## 返回前检查

1. 只写了 controller 指定的 `output_file`。
2. 输出是 `worker_contract.output` 指定的单文档 YAML，不是 envelope，也没有 Markdown 围栏。
3. 所有嵌套对象满足 `required_fields/optional_fields/forbidden_fields`，且递归检查了 `source_refs`。
4. `chapter-worker` 已完成逐字名称、逐字引用、非空摘要和闭合 taxonomy 检查；
   `main-agent-repair` 已证明只改了 allowlist 机械错误。
5. 没有正式 ID、旧 `type`、controller 状态或其他章节内容。
