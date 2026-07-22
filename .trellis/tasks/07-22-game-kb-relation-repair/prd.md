# 补齐 generate-game-kb 关系闭环与定向返工

## Goal

让 `generate-game-kb` 在章节接收、确定性归并和终态安装之间形成可执行的关系闭环：可确定解析的关系必须稳定投影为正式 ID，无法解析的关系必须在安装前映射回来源章节，并在用户确认后只返工受影响章节。既有 v7 run 应能保留已通过校验的数据，不必因为少量关系问题全量重跑全部章节。

## Background

- 当前《萧十一郎》run 曾有 25/25 个 accepted 章节，但终态引用解析可复现 123 条 `REFERENCE_UNRESOLVED`。
- 其中 107 条关系的目标已经存在为正式实体；当前解析器只索引 `local_key`、`registry_key` 和 `member_local_keys`，而 Worker 关系字段携带名称，导致合同错位。
- 剩余 16 条确实没有精确目标实体，集中在 `ch_001`、`ch_003`、`ch_007`、`ch_008`、`ch_011`、`ch_012`、`ch_020`。
- 当前 Controller 只在终态组装时统一失败，不能把问题映射成可确认、可恢复的章节级返工。
- 当前《萧十一郎》run 已由另一 AI 修复并安装完成；本任务不得修改该 run 的 accepted、progress、draft、revision、安装或终态数据，避免并行工作互相覆盖。
- 用户已确认保留通用的定向返工能力；本任务不能缩减为只修名称解析和前置验证。

## Requirements

- 关系解析采用确定性优先级：精确正式名称优先；没有正式名称命中时，仅允许唯一别名命中；多义别名和缺失目标必须阻断，不做模糊匹配。
- `characters[*].skills`、`characters[*].factions` 和 `skills[*].factions` 必须经过 Controller 硬校验，不能只依赖 Worker 提示中的 preflight。
- 终态关系错误必须携带目标类别、关系路径、目标名称和可追溯的来源章节，不能只抛出整本书级 `FINAL_REFERENCE_INVALID`。
- 对需要语义判断的缺失目标，Controller 只能在用户确认后为相关章节开启新 cycle，并派发能够读取章节原文的 `chapter-worker`；`main-agent-repair` 不得承担语义增删。
- 已 accepted 的旧版本必须保留哈希和审计记录；返工产生新的可追踪版本，不得原地静默改写 accepted YAML 或手工修改 `progress.json`。
- 定向返工采用派生恢复 run：新 run 复制未受影响章节的可验证 artifact，只为错误来源章节创建 pending 单元；原 run、其 accepted 文件和 artifact manifest 均不改写。
- 不得通过静默删除关系、自动新增无证据实体、相似度猜测或跨实体模糊合并来通过终态验证。
- 运行时 Worker 合同、维护者 schema 文档和 Controller 校验必须表达同一套关系闭包规则，且跨 Claude Code、Qoder、Codex 等宿主自包含。
- 自动化测试必须使用仓库内稳定的合成 fixture；当前《萧十一郎》run 只作为只读问题证据，不作为会被并行数据修复改变的测试输入。

## Out of Scope

- 新建通用调度平台、broker 或独立的终态 AI 修复器。
- 无用户确认地自动重开已经 accepted 的章节。
- 为解决关系问题而全量重写与关系无关的实体描述、摘要或证据。
- 改变五个终态 YAML 的文件名或 Dashboard 消费合同。
- 修改当前《萧十一郎》run 的任何运行时数据，或接管另一 AI 已完成的数据修复。

## Acceptance Criteria

- [ ] 精确正式名称可稳定解析为唯一正式 ID，即使同一文本同时是其他实体的别名，正式名称仍优先。
- [ ] 只有唯一别名命中时才允许解析；多义别名返回结构化阻断错误。
- [ ] 缺失目标在章节接收或终态组装阶段被硬拒绝，并能确定性映射到所有来源章节。
- [ ] 用户确认后，只为受影响章节创建派生 recovery run；未受影响章节以可验证副本带入，原 run 的 accepted 内容和哈希保持不变。
- [ ] 旧 accepted 版本、错误报告、新 recovery run 输入输出和状态迁移均可审计，恢复后可继续正常 assembly、verify、install 和 archive。
- [ ] 合成回归 fixture 复现“已有目标被误报”和“真实缺失目标”两类问题：前者可确定解析，后者被映射到来源章节，而不是要求全量重跑。
- [ ] 自动化测试覆盖正式名称优先、唯一别名、多义别名、缺失目标、来源章节映射、确认门禁、派生 recovery run 和中断恢复。
- [ ] 全量 `generate-game-kb` 测试、语法检查和工作区差异检查通过。
