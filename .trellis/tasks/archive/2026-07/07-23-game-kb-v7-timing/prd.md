# 补全 generate-game-kb v7 时间统计

## Goal

让 `generate-game-kb` 的未来 v7 run 形成可审计、可恢复的生命周期时间线，并从该时间线确定性生成真实的阶段耗时、跨 cycle attempt 总数、人工等待和候选统计，避免用总墙钟时间或文件时间推测性能。

## Background

- 当前 `run-metrics.json` 只可靠记录 `total_ms`；其余阶段字段在真实 v7 run 中为 `0`。
- `timing.js` 从 `progress.units[*].updated_at` 推导章节耗时，但 v7 progress 不写该字段。
- 当前 attempt 统计只读取每个单元最终 cycle 的 `attempt`，人工开启新 cycle 后会漏算旧 cycle 的尝试。
- 当前候选统计读取已退出 v7 主路径的 candidate registry，因此真实 accepted 章节已有候选时仍可能报告 `0`。
- 用户已确认只保证未来 run 的精确统计；已完成 run 不迁移、不近似回填。

## Requirements

- R1：新建 run 必须声明独立的时间统计合同版本；不改变 `semantic_contract_version: 7` 与 `semantic_profile: chapter-direct-v1`。
- R2：Controller 必须持久化按顺序排列的运行事件，至少覆盖 run 创建、source prepare、窗口签发/关闭、attempt 签发/观察/接受/拒绝、人工复核进入/恢复，以及 assemble、verify、install、archive 的开始/完成。
- R3：attempt 事件必须绑定 `unit`、`cycle`、`attempt` 与 `producer`，使所有 cycle 的真实尝试都能累计；重复恢复不得重复计数同一生命周期事件。
- R4：人工等待必须由 `manual_review` 进入与用户确认恢复两个 Controller 事件计算，不能从相邻章节接受时间或文件系统时间推测。
- R5：正式指标不得使用文件 `mtime`、`birthtime` 或目录名时间戳。所有持久化时间使用 UTC ISO 8601；同步 Controller 阶段的持续时间使用非负毫秒值。
- R6：最终 `run-metrics.json` 必须从受管事件与 accepted artifact 确定性生成，报告总墙钟、活动时间、人工等待、各阶段耗时、窗口统计、跨 cycle attempt/correction 统计和真实章节候选数量。
- R7：时间事件及其汇总必须纳入归档完整性证据，篡改后不能继续作为可信 metrics。
- R8：现有公开命令和稳定返回结构保持兼容；`status` 继续只读，不因缺少时间事件而修改旧 run。
- R9：旧 v7/遗留 run 缺少时间合同或事件文件时仍可 `status` 与 `archive-abandoned`；不补写、不迁移、不伪造时间。
- R10：Worker 单文件合同保持不变；不得要求 Worker 写时间事件、调用 Controller 或新增辅助文件。

## Non-Goals

- 不为已完成 run 回填近似时间。
- 不把 attempt 周转时间描述为纯模型推理时间；Worker 输出由下一次 Controller 调用观察，系统只能证明签发到观察的端到端周转。
- 不修改游戏知识库五文件、证据、rank/level 或归并语义。

## Acceptance Criteria

- [ ] 新 run 的事件序列可完整重建窗口、attempt、manual-review 和终态阶段时间线，并通过 schema/顺序/绑定校验。
- [ ] 无重试、自动 attempt 2、人工确认新 cycle 三类测试分别得到正确的总 attempt、correction 与人工等待。
- [ ] 同一状态恢复或重复 `run/status` 不产生重复事件；失败写入不留下半行或不完整事件。
- [ ] `phase_durations.chapter_extraction_ms`、assemble、verify、install、archive 与 `total_ms` 在代表性 v7 E2E 中均有真实口径，不再依赖不存在的 `progress.updated_at`。
- [ ] 候选统计从 36 个 accepted 章节中的实体出现次数计算，最终实体统计仍来自五文件；不读取旧 candidate registry 伪造 `0`。
- [ ] manual-review 等待从进入到 `retry-unit --confirm` 恢复精确累计，且从活动耗时中单独列出。
- [ ] 新事件文件、metrics 和归档回执哈希一致；任一受管时间证据被修改时验证失败。
- [ ] 缺少时间合同的既有 v7 archived run 仍能只读返回 `complete`，目录字节不变。
- [ ] `generate-game-kb` 相关单元、集成、CLI、E2E 和性能预算测试全部通过。

## Notes

- 这是跨 progress、接收、retry、finalize、archive 与 metrics 的复杂任务，必须补充 `design.md` 和 `implement.md` 后才能启动实现。
- 当前待评审的核心技术选择是：集中式追加事件日志、progress 内嵌历史，或按 attempt 分散收据。
