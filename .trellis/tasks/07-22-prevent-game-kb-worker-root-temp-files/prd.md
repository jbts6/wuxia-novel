# 防止 game-kb Worker 污染仓库根目录

## Goal

确保从新建 v3 Worker 合同运行开始，章节 Worker 只产出 Controller 指定的 YAML，仓库根目录不再遗留辅助脚本、中间文本或校验日志；旧 run 不迁移，发现旧合同任务时要求低成本重跑。防护绕过后只要临时文件能够成功隔离，合法 YAML 仍应继续接收。

## Background

- 2026-07-22 根目录出现 10 个未跟踪的 `.tmp-*` 文件，分别用于章节证据检索、长 YAML 写入、引号诊断和递归 preflight。
- 这些文件对应的三份 job 均内嵌 `worker_contract.version: 1`。v1 允许 Worker 提供 `line_start/line_end`，因此历史脚本中的行号处理符合当时合同。
- 当前 `WORKER_CONTRACT_VERSION` 为 3。v3 要求 Worker 的 `source_refs` 只写逐字 `text`，`chapter/line_start/line_end` 由 Controller 确定性派生。
- 用户明确不迁移历史 job；新建 v3 run 的成本足够低，可以用显式重跑替代兼容执行旧合同。
- 当前 Worker 提示已要求只写 `output_file`，但仍要求 Worker 自行执行递归 preflight，且没有提供可执行校验入口。这会诱导拥有 Shell 权限的 Worker 临时编写 JS/BAT。
- Claude 专用章节 Worker 已限制为 `Read, Write`；Codex 自定义 Agent 可配置 sandbox，但公开配置没有精确到单个 `output_file` 的写入白名单，因此仍需要 Hook 和批后检查。

## Requirements

### R1. Worker 合同版本门禁

- Controller 在恢复、派发或接收 job 前校验内嵌 `worker_contract.version` 等于当前 `WORKER_CONTRACT_VERSION`。
- 发现旧版本时不得继续派发或接收，返回稳定错误码 `WORKER_CONTRACT_STALE_RESTART_REQUIRED`，并携带 run、unit、实际版本和期望版本。
- 不改写旧 job、不迁移旧输出、不修改旧 run 内部文件。

### R2. 单文件 Worker 行为

- `chapter-worker` 只读取 `input_file`，只写 `output_file`。
- Worker 不运行 Shell、Node、Python 或 BAT，不创建辅助脚本、中间文本、索引、日志或 preflight 输出文件。
- Worker 写完后只重新读取 YAML 并按内嵌合同完成逻辑自检；Controller 接收校验是权威门禁。
- v3 Worker 不生成 `chapter/line_start/line_end`。

### R3. 根目录写入守卫

- 项目级 `PreToolUse` Hook 全项目生效，不依赖 game-kb Worker 上下文或批次状态。
- Hook 必须拒绝 Write/Edit 的明确目标路径、`apply_patch` 文件头和命令字符串中可明确识别的仓库根目录 `.tmp-*`、`.temp-*` 写入。
- Hook 不实现完整 Bash 或 PowerShell 语法解析；动态路径等无法可靠静态识别的情况交给 Controller 兜底。
- 删除历史临时文件、将其移出根目录、读取临时文件和嵌套目录同名文件不应被阻断。
- Hook 返回平台支持的明确阻断结果和可操作原因，不得静默放行或静默失败。
- Codex 与 Claude 使用同一份项目本地判定逻辑，各自保留平台要求的注册格式。

### R4. run 级副作用收敛

- 新 run 首次创建时记录仓库根目录已有 `.tmp-*`、`.temp-*` 条目，作为整个 run 的历史基线。
- Controller 准备接收当前活动窗口输出时比较根目录增量；新增临时条目移动到当前 run 的 `diagnostics/worker-leaks/` 并写 incident 收据。
- 隔离成功时在 `run` 返回中附加 `WORKER_SIDE_EFFECT_QUARANTINED` 警告并继续接收合法 YAML，不要求用户额外重跑。
- 只有基线损坏或隔离失败时才以 `WORKER_SIDE_EFFECT_GUARD_FAILED` 停止；不得删除或移动 run 创建前已经存在的历史文件。

### R5. 可观测性与兼容性

- Hook 脚本收到非法事件或执行失败时必须明确拒绝或报错，不得静默失效；宿主未加载项目 Hook 时，Controller 的 run 级检查继续作为独立兜底。
- 不把 `.tmp-*` 加入 `.gitignore`，避免隐藏回归。
- 正常 v3 Worker 输出与 Controller 的 accepted/final 数据结构保持不变。

## Acceptance Criteria

- [ ] 新建 v3 run 的 job 内嵌合同版本等于当前 `WORKER_CONTRACT_VERSION`。
- [ ] 旧合同 job 被 `WORKER_CONTRACT_STALE_RESTART_REQUIRED` 阻断，旧 run 文件保持原样。
- [ ] v3 Worker 提示明确禁止命令执行和任何 `output_file` 外写入，并将权威校验归属 Controller。
- [ ] Codex `PreToolUse` 在全项目范围阻断 Bash 与 `apply_patch` 写入根目录 `.tmp-*`，同时允许嵌套目录中的正常临时文件和 Worker 指定的 `output_file`。
- [ ] Claude 对等 Hook 能阻断相同越界写入。
- [ ] 删除历史根目录临时文件或将其移入诊断目录不会被 Hook 阻断。
- [ ] 绕过 Hook 创建的根目录新临时文件被 Controller 捕获并隔离，`run` 返回警告后继续接收合法 YAML。
- [ ] 基线损坏或隔离失败时 Controller 以 `WORKER_SIDE_EFFECT_GUARD_FAILED` 停止且不吞掉错误。
- [ ] 正常 v3 单章 fixture 完成接收，根目录基线不变，Controller 正确派生证据行区间。
- [ ] 全量 `generate-game-kb` 测试、Hook 单元测试、生产 JS 语法检查和 `git diff --check` 通过。

## Out Of Scope

- 迁移、补写或重新解释历史 v1/v2 job 和输出。
- 为 Worker 增加公开 `scratch_dir` 或允许新的多文件传输协议。
- 构建完整 Bash/PowerShell 解析器，或承诺静态 Hook 能识别动态生成的所有路径。
- 修改最终五个知识库 YAML 的字段结构。
- 自动删除派发前已经存在的 `.tmp-*` 文件。
