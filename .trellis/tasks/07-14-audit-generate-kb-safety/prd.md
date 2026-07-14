# 复审 generate-kb 管线安全性

## Goal

对 `.agents/skills/generate-kb` 的当前实现做一次源码级、证据化的重新审核，确认其不存在明显编码错误、状态机逻辑错误或可被绕过的门禁，并确认 AI 在连续无法修正草稿时不会使流程无界循环。

## Background

- 权威实现位于 `.agents/skills/generate-kb`，核心入口为 `scripts/pipeline.js`。
- 管线要求六阶段有序执行，并通过 `claim -> draft -> submit` 隔离 AI 与受管状态。
- 本任务是只读审计；发现缺陷后是否修复，由用户根据审计结果另行决定。

## Requirements

- R1. 检查 JavaScript/JSON/Shell 等实现中的语法、引用、边界值、空值、异常处理和持久化顺序等低级编码错误。
- R2. 检查六阶段状态转换、`next_action` 选择、claim/lease/submit/check/advance/publish/promote/rollback 的逻辑一致性。
- R3. 检查所有门禁是否默认拒绝、互不补偿，是否存在同时可达的矛盾状态、错误优先级覆盖或绕过路径。
- R4. 检查 AI 草稿反复失败时的有界重试、错误指纹/进度判定、人工升级或终止状态，确保没有“同错无限 claim/submit”、“自动重开已失败项”或“无进展 advance/check 振荡”。
- R5. 核对文档、schema/constants、控制器实现和测试的契约，找出文档宣称存在但实现未强制的保障。
- R6. 所有结论按严重度排序，提供文件与行号、可达路径/失败场景、影响以及缺失的测试。

## Out Of Scope

- 本阶段不修改 `generate-kb` 实现、不重建任何小说知识库，不变更正式 `data/*.json` 或 `reports/*.json`。
- 不以风格偏好、非必要重构或未证实的理论风险作为缺陷。

## Acceptance Criteria

- [x] AC1. 所有受管命令、阶段转换和关键写入点均已纳入静态或动态检查，没有未说明的核心路径。
- [x] AC2. 门禁矩阵覆盖每个阶段的通过条件、拒绝条件、互斥关系及可能的绕过路径。
- [x] AC3. 对相同错误重复提交、不同错误轮换、过期 lease、崩溃恢复、人工 receipt 失效和 publish 失败执行有界性检查。
- [x] AC4. 运行与风险成比例的语法/静态检查和现有测试，记录命令、退出码和关键结果。
- [x] AC5. 输出以 findings 为首的审计报告；若未发现缺陷，明确说明剩余风险和测试缺口。
