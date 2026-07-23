# 修复 v7 rank 合同门禁

## Goal

让 v7 章节 Worker 获得明确且可执行的 `rank` / `level` 语义合同，并让 Controller 在章节接收边界拒绝无效值，避免 27 章全部 accepted 后才由最终工作区验证失败。

## Background

- 《血海飘香》新 run `run-2026-07-23-xuehai-v3-rerun` 已达到 `27/27 accepted`，最终验证因 50 个 `POWER_RANK_INVALID` 失败。
- 无效值均为“帮主”“掌门”“长老”等职位或身份；v7 Worker 把它们写入 `characters[].rank`。
- `semantic-contract.js` 把 `rank` 定义为全书时间线上的八档战力等级；职位/身份应进入 `identities`。
- 旧版 `validateChapterDraft` 会校验 `rank` / `level`，但 v7 `validateWorkerChapterDraft` 没有调用这些共享校验器，导致无效值进入 immutable accepted 产物。
- `worker_contract.version: 3` 仅给出 `rank: null` / `level: null` 骨架，没有提供允许值、字段语义或职位归属规则。

## Requirements

- R1：在自包含 job input 中明确 `characters[].level`、`characters[].rank`、`skills[].rank` 的允许值、`null` 行为和语义边界；明确职位/身份写入 `identities`，不得写入 `rank`。
- R2：v7 章节接收边界复用共享 semantic contract 校验 `rank` / `level`；无效值必须在 accepted artifact 写入前被拒绝，并按语义错误签发 `chapter-worker` 重试。
- R3：提升 Worker 合同版本，使已签发的 v3 job fail closed；不迁移、不修补旧 run。
- R4：使用测试先复现“职位 rank 被接收”的假通过，再验证无效值被拒、合法枚举与 `null` 被接受、旧合同失效。
- R5：同步 Worker prompt、示例、Skill / agent surface 和 Trellis 快速 Profile 规范，保持 job input 是唯一结构真相源。
- R6：用新合同从原始小说创建《血海飘香》新 run；最终必须通过工作区验证、安装与归档，且仓库根目录 `.tmp-*` / `.temp-*` 保持为零。
- R7：本任务只修 rank/level 合同闭环；成本效率评审中的缓存、双章打包、机械修复、并发窗口和自检裁剪不与本修复捆绑。
- R8：父任务纳入一个可独立验证、独立提交的中文排版符号 grounding 子任务。不得修改小说原文或 prepared chapter；Worker 仍须逐字抄录。Controller 仅对 allowlist 中的一对一排版符号做确定性折叠，且只有当前章节唯一命中时才接受；accepted artifact 必须回填源文本的精确片段并记录 normalization audit。

## Acceptance Criteria

- [ ] `rank: "帮主"`、`rank: "掌门"` 等职位值在章节接收阶段返回 `POWER_RANK_INVALID`，不会生成 accepted artifact。
- [ ] 非法 `characters[].level` 返回 `CHARACTER_LEVEL_INVALID`。
- [ ] 合同允许的战力等级、人物层级和 `null` 可通过章节接收并保持到 accepted YAML。
- [ ] 新 job input 明示战力等级全集、人物层级全集、全书聚合语义和职位归属规则。
- [ ] Worker 合同版本已提升；v3 run 的 `run` / `status` / 接收路径按现有 stale-contract 规则 fail closed。
- [ ] 定向回归、generate-game-kb 全量测试及相关 CLI / E2E 测试全部通过。
- [ ] 纯 allowlist 排版符号差异可唯一定位并回填为原文；零命中、多命中、非 allowlist 符号差异及措辞改写仍返回 `SOURCE_QUOTE_NOT_FOUND`。
- [ ] `chapter:015 attempt_01` 作为 false-pass 固件保持拒绝，证明符号机制不会放行模型改写或拼接。
- [ ] 新《血海飘香》run 成功完成，`27/27 accepted` 且最终工作区验证通过；根目录临时文件数为 0。

## Out of Scope

- 修改或迁移 `run-2026-07-23-xuehai-v3-rerun` 的 immutable accepted 产物。
- 在本任务中实现 prompt caching、双章打包、确定性机械修复、动态补位或提高并发窗口。
- 新增全书 AI enrichment 阶段，除非设计评审明确选择该方案。
- 批量替换小说原文或 prepared chapter 中的其他中文符号。
- 把 `、` 与 `,`、`—` 与 `-` 等非稳定一对一符号默认视为等价，或采用删除全部标点、编辑距离等模糊匹配。

## Open Decision

- 无。实现前仍需由用户审阅 `prd.md`、`design.md` 与 `implement.md`。

## Confirmed Decisions

- 中文排版符号 grounding 作为父任务下的独立子任务交付，与 rank/level 修复分别验证、分别提交。
- `rank` / `level` 采用受控枚举：合同直接引用 `semantic-contract.js` 的共享允许值，现有 deterministic assembly 继续聚合章节数据；不强制写 `null`，也不新增书级 AI enrichment。
- Controller 在 accepted artifact 写入前复用现有 `validatePowerRank()` / `validateCharacterLevel()`；职位、门派职务和社会身份只能写入 `identities`。
- 原文及 prepared chapter 保持不变；兼容机制位于 Controller 接收边界，不作为 Worker 私有修复。
- Worker 候选引文只有在 allowlist 折叠后于当前章节唯一命中时才可恢复；恢复结果必须投影回原文精确片段。实际措辞改写不得当作标点差异接受。

## Child Task

- `.trellis/tasks/07-23-grounding-typography-folding/`：独立实现并验证排版符号 grounding。其代码不依赖 rank/level 改动；父任务的《血海飘香》最终重跑依赖该子任务和 rank/level 合同修复都已通过。
