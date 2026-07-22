# 防止 game-kb Worker 污染仓库根目录：技术设计

## 1. 目标与不变量

本任务只解决 Worker 越界创建根目录临时文件的问题，不把 Hook 或 Controller 扩展成通用文件系统沙箱。

必须同时成立：

1. 活动 job 的内嵌合同版本等于 `WORKER_CONTRACT_VERSION`。
2. Worker 只读取 `input_file`，只写 `output_file`，逻辑自检不依赖命令或辅助文件。
3. 全项目 Hook 拦截能够明确判断的根目录 `.tmp-*`、`.temp-*` 写入。
4. Hook 未加载或未识别动态路径时，Controller 自动隔离本 run 新增的临时文件。
5. 隔离成功不阻断合法 YAML；历史文件不迁移、不删除。

## 2. 精简决策

### D1. 保留轻量合同门禁

`semantic_contract_version` 和 `worker_contract.version` 是两个不同边界。v7 run 仍可能持有旧 v1 Worker job，因此在已经读取持久化 input 的位置做一次版本相等判断。失败返回 `WORKER_CONTRACT_STALE_RESTART_REQUIRED`，不增加迁移逻辑。

### D2. Hook 全项目生效，但不是 Shell 解析器

仓库根目录不应作为临时目录，因此规则无需识别 Worker 身份。Hook 只处理明确目标字段、`apply_patch` 文件头和少量无歧义的字面量写入形式；动态变量、嵌套命令等交给 Controller 兜底。

### D3. 自动隔离优先于硬失败

根目录临时文件不会改变 Worker YAML 的语义。成功移动并留下诊断收据后，Controller 继续正常接收；只有无法可靠恢复仓库状态时才停止。

### D4. 使用 run 级基线

新 run 只记录一次历史临时文件集合，不为每个窗口维护额外状态。这样历史文件自然排除，重试和部分接收不会反复覆盖基线。

## 3. 组件设计

### 3.1 合同版本门禁

在 `.agents/skills/generate-game-kb/scripts/lib/chapter-worker-contract.js` 增加版本断言，复用 `WORKER_CONTRACT_VERSION`。

`.agents/skills/generate-game-kb/scripts/lib/chapter-progress.js:assertJobMetadata()` 已读取并核验不可变 job input，在这里检查 `input.worker_contract.version`。`run` 的 receiver 路径已经调用 progress 不变量；`flow.js:status` 补充同一不变量检查，确保旧 job 不会再次显示为可派发任务。

错误详情包含 `run_id`、`unit`、`actual_version`、`expected_version`。不改写旧 job，也不改变 v3 Worker YAML 字段合同。

### 3.2 Worker 单文件约束

只更新真正影响执行的表面：

- `.agents/skills/generate-game-kb/SKILL.md`
- `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- `.agents/skills/generate-game-kb/examples.md`
- `.claude/agents/game-kb-chapter-worker.md`

明确禁止 Shell、Node、Python、BAT 和辅助文件。`worker_contract.preflight` 保留为重读 YAML 后的内存逻辑检查，Controller 校验继续是权威门禁。`schemas.md` 与最终五个 YAML 无字段变化，不为文案强化制造新合同版本。

### 3.3 共用 PreToolUse Hook

新增 `.agents/skills/generate-game-kb/scripts/root-temp-hook.js`，Codex 与 Claude 都调用该入口；纯判定函数放在 `scripts/lib/root-temp-guard.js`，供 Hook 和 Controller 复用。

Hook 识别：

- Write/Edit 类事件的明确目标路径；
- `apply_patch` 的 `Add File`、`Update File` 目标；
- 命令字符串中带明确根目录临时路径的重定向或创建/复制/移动目标。

只拒绝仓库根目录直接子项且 basename 匹配 `^\.(tmp|temp)-` 的写入。读取、删除、移出根目录、嵌套目录写入和正常 `output_file` 放行。命令解析只覆盖测试固定的明确形式，不尝试理解变量展开或完整 Shell 语法。

命中时输出宿主支持的 `PreToolUse` deny JSON。非法事件 JSON 明确报错；无关或无法确定为写入的事件放行，由 Controller 兜底。

`.codex/hooks.json` 与 `.claude/settings.json` 只注册入口，不复制判定逻辑。

### 3.4 run 级基线与自动隔离

在 `paths.js` 增加：

- `workerRootBaseline`: `<run>/diagnostics/worker-root-baseline.json`
- `workerLeaks`: `<run>/diagnostics/worker-leaks/`

新增 `scripts/lib/worker-side-effects.js`：

```text
首次创建 run
  -> repositoryRootFor(paths.novel)
  -> 记录现有 .tmp-* / .temp-* basename 集合

后续 run，当前活动输出可接收时
  -> 当前集合减去 run 基线
  -> 无新增：正常接收
  -> 有新增：移动到 diagnostics/worker-leaks/<incident>/
             写 incident.json
             返回 WORKER_SIDE_EFFECT_QUARANTINED warning
             继续接收 YAML
  -> 无法读取基线或移动失败：抛 WORKER_SIDE_EFFECT_GUARD_FAILED
```

检查只在当前活动 job 的现有输出已经达到可接收条件时运行，避免用户提前调用 `run` 时移动仍在运行的 Worker 文件。基线覆盖整个 run；历史名称不处理。静态 Hook 未识别的动态写入只要最终留下匹配条目，就会在此收敛。

`flow.js:publicRunResult()` 仅在发生隔离时附加可选 `warnings`，正常返回结构保持不变。警告包含原相对路径和 incident 收据路径。

## 4. 错误与告警

| 代码 | 类型 | 行为 |
| --- | --- | --- |
| `WORKER_CONTRACT_STALE_RESTART_REQUIRED` | 错误 | 停止并要求新 run 重跑 |
| `WORKER_SIDE_EFFECT_QUARANTINED` | 告警 | 已隔离，继续接收 Worker YAML |
| `WORKER_SIDE_EFFECT_GUARD_FAILED` | 错误 | 仓库状态无法可靠恢复，停止接收 |

## 5. 限制与回滚

- Hook 无法证明宿主是否已信任项目，也不保证识别动态命令；Controller 是结果兜底。
- 无输出且已异常退出的 Worker 无法与“仍在运行”机械区分；Controller 不会提前移动其文件。
- 同名历史文件在 run 生命周期内被复用时不会作为新增名称捕获；随机临时名场景下风险很低。
- 回滚时先移除 Hook 注册，再回退 Controller 收敛逻辑；已生成的 incident 诊断保留。

## 6. 测试策略

1. 合同测试：当前 v3 正常，旧版本在 `run`、`status` 和接收前被稳定错误码阻断。
2. Hook 测试：明确写入被拒绝；读取、清理、嵌套目录和不确定命令放行。
3. Controller 测试：历史基线不动，新增临时文件被隔离并继续接收，隔离失败才停止。
4. 回归测试：正常单章接收、行区间派生和全量 game-kb 测试不变。
