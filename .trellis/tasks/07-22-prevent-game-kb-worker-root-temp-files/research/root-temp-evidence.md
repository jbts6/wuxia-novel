# game-kb Worker 根目录临时文件调查

## 结论

根目录 10 个 `.tmp-*` 文件均由旧版 v1 Worker job 的辅助工作产生，不是 Controller 的正式输出。当前 v3 已移除 Worker 行号职责，但仍需消除脚本化 preflight 的诱因并加入机械写入守卫。

## 历史文件用途

- `ch004` 四个脚本把 `chapter_text` 转为带行号文本、名称命中索引和逐字引文报告。
- `ch025` 的 `write.js` 写入完整章节 YAML，随后用多个脚本诊断引号字符、验证名称覆盖、引用逐字命中、关系闭包和 taxonomy。
- `ch036` 的 preflight 脚本检查顶层结构、引用行区间、名称、别名、taxonomy 和关系。对应历史失败包含 `YAML_INDENTATION`、`SOURCE_QUOTE_NOT_FOUND`、`SOURCE_NAME_NOT_FOUND`。
- 所有可见脚本均缺少自清理逻辑，仓库正式代码没有引用这些具体文件名。

## 合同时间线

- 三份 job JSON 均携带 `worker_contract.version: 1`，其中 `line_start/line_end` 为可选字段。
- 提交 `7c3288e0 fix(game-kb): derive source line ranges in controller` 将合同升级到 v3，从 Worker YAML skeleton 移除行号，并由 Controller 根据规范化原文最早逐字命中派生。
- 当前合同在 `.agents/skills/generate-game-kb/scripts/lib/chapter-worker-contract.js` 声明 `WORKER_CONTRACT_VERSION = 3`，并将 `chapter/line_start/line_end` 列为派生字段。
- 当前维护者文档 `.agents/skills/generate-game-kb/schemas.md` 明确：Worker 不写行号，Controller 忽略旧 Worker 行号并确定性覆盖。

## 当前执行边界

- `.agents/skills/generate-game-kb/scripts/lib/chapter-work.js` 的 `chapterWorkerInput()` 和 `repairInput()` 调用 `createWorkerContract()` 写入不可变 job input，是版本门禁和合同测试的主要插入点。
- `.agents/skills/generate-game-kb/scripts/lib/chapter-progress.js` 已在进度不变量中读取持久化 job input 并验证身份与 source hash，适合增加合同版本一致性检查。
- `.agents/skills/generate-game-kb/scripts/flow.js` 已使用稳定 `GameKbError` 错误码处理旧语义合同和工作区验证失败。
- `.agents/skills/generate-game-kb/tests/helpers.js` 提供临时小说、`runFlow()`、Worker YAML 写入等 fixture 工具。

## Hook 能力

- 项目已有 `.codex/hooks.json` 和 `.claude/settings.json`；Codex 当前只注册 `UserPromptSubmit`，Claude 已注册 `PreToolUse` 用于子代理上下文注入。
- Codex 官方 Hook 文档确认 `PreToolUse` 能拦截 Bash、统一 exec、`apply_patch`、MCP 和其他本地函数工具。
- Codex 的 Bash 与 `apply_patch` 输入位于 `tool_input.command`；阻断结果使用 `hookSpecificOutput.permissionDecision = "deny"`，也兼容退出码 2 加 stderr 原因。
- 官方文档同时强调某些专用工具可能绕过默认 Hook 路径，因此 Hook 是守卫而不是完整安全边界，必须保留批后文件系统检查。
- 官方来源：https://learn.chatgpt.com/docs/hooks

## 设计约束

- 不修改 Trellis 上游或全局安装；Hook 与注册均保存在项目本地平台目录。
- 不依赖 Codex 的 `sandbox_mode` 实现单文件 ACL；`workspace-write` 仍覆盖整个工作区，`read-only` 又无法写 Worker YAML。
- 不新增 Worker scratch 协议。v3 的目标行为是单输入、单输出，不能通过提供临时目录固化辅助脚本模式。
