# 实施计划

## 前置约束

- 当前仍为 planning；用户审阅本文件前不运行 `task.py start`，不写生产代码。
- 使用 TDD：先提交失败测试，再写最小实现并重构。
- 子任务与 rank/level 修复分别验证、分别提交。
- 不修改或迁移 `run-2026-07-23-xuehai-v3-rerun`。

## 阶段 1：排版符号 grounding 子任务

依照 `.trellis/tasks/07-23-grounding-typography-folding/implement.md` 执行。

完成门槛：

- `grounding.test.js` 覆盖 exact、唯一 fallback、多命中、非 allowlist 和 `chapter:015` false-pass；
- `chapter-receiver.test.js` 证明 accepted quote 回填源文本并写审计；
- assembly 测试证明 grounding 审计没有混入 `type_normalizations`；
- 子任务定向测试与 generate-game-kb 全量测试通过；
- 独立提交：`fix(game-kb): normalize grounded typography safely`。

## 阶段 2：先写 rank/level 失败测试

### 修改文件

- `.agents/skills/generate-game-kb/tests/chapter-work.test.js`
- `.agents/skills/generate-game-kb/tests/type-taxonomy.test.js`
- `.agents/skills/generate-game-kb/tests/chapter-receiver.test.js`
- 必要时补充 `.agents/skills/generate-game-kb/tests/cli.test.js`

### 测试内容

1. 断言合同版本为 4，job input 包含共享 `CHARACTER_LEVELS`、`POWER_RANKS`、`POWER_RANK_CONTRACT` 语义及身份归属规则。
2. 断言 `rank: "帮主"`、`rank: "掌门"`、非法 skill rank 在 v7 接收边界失败。
3. 断言非法 character level 失败。
4. 断言合法枚举、`null` 及 `identities: ["帮主"]` + `rank: null` 通过。
5. 断言 v3 job 在 run/status/receive 的写路径按现有 stale-contract 规则失败。

先运行并确认测试因缺失 v4 合同或接收校验而失败，而不是测试夹具错误。

## 阶段 3：实现最小 rank/level 修复

### 修改文件

- `.agents/skills/generate-game-kb/scripts/lib/chapter-worker-contract.js`
- `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`

### 实现步骤

1. 从 `semantic-contract.js` 导入共享常量。
2. 将 `WORKER_CONTRACT_VERSION` 提升到 4。
3. 在 `createWorkerContract()` 中加入结构化 rank/level 语义、允许值、可空行为及身份归属规则。
4. 在 preflight 中加入受控字段和“职位不进入 rank”的检查说明。
5. 在 `validateWorkerChapterDraft()` 的现有候选遍历内复用 `validatePowerRank()` / `validateCharacterLevel()`；不新增并行校验实现。
6. 运行阶段 2 的定向测试，修复至通过并清理重复代码。

## 阶段 4：同步 Worker 文档 surface

### 修改文件

- `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- `.agents/skills/generate-game-kb/schemas.md`
- `.agents/skills/generate-game-kb/examples.md`
- `.agents/skills/generate-game-kb/SKILL.md`

同步原则：要求 Worker 读取 job 内嵌结构化合同；不在 Markdown 中复制八档枚举，以免形成双真相源。

完成后运行合同、receiver、CLI 与 simplified-contract 相关测试，再运行完整测试目录。

独立提交：`fix(game-kb): enforce rank and level contract`。

## 阶段 5：新《血海飘香》端到端验证

1. 使用新 run id 从当前小说源创建 v4 run：

   `node .agents/skills/generate-game-kb/scripts/flow.js run "古龙/血海飘香" --run <new-v4-run-id> --json`

2. 仅派发返回的 `jobs`；Worker 只读 job `input_file` 并只写 `output_file`。
3. 重复 `run`，直到 Controller 返回 `complete`；若出现语义拒绝，按现有一次 correction budget 处理，不改写 accepted artifact。
4. 核验：
   - 27/27 accepted；
   - 无 `POWER_RANK_INVALID` / `CHARACTER_LEVEL_INVALID`；
   - 最终 workspace verify、install、archive 成功；
   - accepted artifact 使用 worker contract v4；
   - 根目录 `.tmp-*` / `.temp-*` 数量为 0；
   - 旧 v3 run 未被修改。
5. 对最终生成数据和 run receipt 做哈希/状态检查。

若生成数据产生仓库变更，单独提交：`data(game-kb): rebuild 血海飘香 with v4 contract`。

## 阶段 6：质量闭环

- 运行相关定向测试。
- 运行 generate-game-kb 全量测试。
- 按 `.trellis/spec/backend/quality-guidelines.md` 检查跨层数据流、错误码、immutable artifact 和 false-pass 固件。
- 检查 `git diff --check`、`git status --short`，确认无无关文件和根目录临时文件。
- 更新任务上下文和开发日志；所有门禁通过后才归档父子任务。

