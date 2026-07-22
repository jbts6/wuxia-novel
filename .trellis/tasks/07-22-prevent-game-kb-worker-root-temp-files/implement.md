# 防止 game-kb Worker 污染仓库根目录：实施计划

## 实施方式

主会话内联实现，不派发实现或检查子代理。工作拆成两个可独立验证的本地提交；每个阶段先写失败测试，再实现和回归。

## 阶段 1：旧合同门禁与 Worker 执行约束

### 测试先行

- [x] 在 `tests/chapter-work.test.js` 覆盖当前 v3 合同签发。
- [x] 在 `tests/chapter-receiver.test.js` 覆盖旧合同在读取 staging YAML 前失败。
- [x] 在 `tests/cli.test.js` 覆盖 `status` 不再返回旧合同 job。
- [x] 在 `tests/simplified-contract.test.js` 断言执行表面禁止命令和 `output_file` 外写入。

### 实现

- [x] 在 `scripts/lib/chapter-worker-contract.js` 增加版本断言和 `WORKER_CONTRACT_STALE_RESTART_REQUIRED`。
- [x] 在 `scripts/lib/chapter-progress.js` 的持久化 job input 校验中调用断言。
- [x] 在 `scripts/flow.js:status` 加载 manifest 并执行 progress 不变量检查。
- [x] 更新 `SKILL.md`、`prompts/extract-chapters.md`、`examples.md` 和 `.claude/agents/game-kb-chapter-worker.md`，不修改 YAML 字段合同。

### 验证与提交

```powershell
node --test .agents/skills/generate-game-kb/tests/chapter-work.test.js .agents/skills/generate-game-kb/tests/chapter-receiver.test.js .agents/skills/generate-game-kb/tests/cli.test.js .agents/skills/generate-game-kb/tests/simplified-contract.test.js
node --check .agents/skills/generate-game-kb/scripts/flow.js
```

提交目标：`fix(game-kb): enforce current worker contract`

## 阶段 2：轻量 Hook 与自动收敛

依赖：阶段 1 已明确当前 job 的唯一合法输出边界。

### 测试先行

- [ ] 新增 `tests/root-temp-guard.test.js`，覆盖两个宿主的明确路径、`apply_patch` 和字面量命令写入。
- [ ] 证明读取、删除、移出根目录、嵌套目录和无法静态确定的命令不会误拦截。
- [ ] 新增 `tests/worker-side-effects.test.js`，覆盖 run 基线、隔离告警、继续接收与隔离失败。
- [ ] 覆盖提前调用 `run` 时不移动仍可能被活动 Worker 使用的临时文件。

### 实现

- [ ] 新增 `scripts/lib/root-temp-guard.js` 和 `scripts/root-temp-hook.js`。
- [ ] 在 `.codex/hooks.json` 与 `.claude/settings.json` 注册同一全项目 `PreToolUse` 入口。
- [ ] 在 `scripts/lib/paths.js` 增加基线与诊断路径。
- [ ] 新增 `scripts/lib/worker-side-effects.js`，实现 run 级基线、隔离和 incident 收据。
- [ ] 在 `scripts/flow.js` 的新 run 创建与接收路径接入收敛逻辑，并只在发生隔离时返回可选 `warnings`。
- [ ] 确认未修改 `.gitignore`，也未处理历史临时文件。

### 验证与提交

```powershell
node --test .agents/skills/generate-game-kb/tests/root-temp-guard.test.js .agents/skills/generate-game-kb/tests/worker-side-effects.test.js .agents/skills/generate-game-kb/tests/v7-e2e.test.js
node --check .agents/skills/generate-game-kb/scripts/root-temp-hook.js
node --check .agents/skills/generate-game-kb/scripts/lib/worker-side-effects.js
node -e "JSON.parse(require('fs').readFileSync('.codex/hooks.json','utf8')); JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"
```

提交目标：`fix(game-kb): contain worker root temp files`

## 最终质量门禁

- [ ] 执行 `.trellis/spec/backend/quality-guidelines.md` 的适用检查。
- [ ] 运行全部 `.agents/skills/generate-game-kb/tests/*.test.js`。
- [ ] 对本次修改的生产 JavaScript 执行 `node --check`。
- [ ] 执行 `git diff --check`。
- [ ] 确认用户已有的根目录 `.tmp-*` 和其他无关变更没有进入提交。
- [ ] 用新 v3 fixture 完成签发、Worker 输出和接收；根目录新增临时文件被自动隔离且无需第二次 `run`。

## 开始实现前检查

- [ ] 用户审阅并批准精简后的三个规划文件。
- [ ] 执行 `python ./.trellis/scripts/task.py start 07-22-prevent-game-kb-worker-root-temp-files`。
- [ ] 通过 `trellis-before-dev` 加载 backend 规范和任务上下文。
