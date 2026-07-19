# Game KB 控制器不变量加固设计

## 1. 目标与边界

本任务只加固确定性控制器：accepted 序列化、旧 run 写入门禁、controller-owned 内容提交 broker、worker 零写入差异守卫和错位草稿恢复。它不修改 Lite 提示词，也不处理或清理 `古龙/凤舞九天` 现场。

父任务 `07-19-audit-v6-knowledge-bases` 在本任务期间暂停。父任务的只读审计设计可以保留，但其迁移 CLI 与本任务都可能修改 `flow.js`，因此不得并行实现。

父任务规划中的 `.game-kb-migration-staging` 只属于迁移 controller。它不进入 worker payload、不是 broker destination，也不从 worker guard 中排除；worker phase 中对它的任何变化仍是违规。

## 2. 已确认事实

- `candidate-ledger.js` 当前用 `JSON.stringify()` 写入 `.yaml` accepted 文件。
- 仓库内 4 个 run 的 76 个 accepted YAML 全是 JSON 序列化；20 个 final/installed YAML 均不是 JSON 序列化。
- artifact manifest 对 accepted 原始字节做 SHA-256 绑定，旧文件不能原地重写。
- 当前 accept 已在消费 attempt 之前检查精确路径和 realpath containment；它不会发现 worker 同时写出的其他文件。
- Lite status 的 chapter job 已含绝对 `source_file` 和 `staging_path`，但 job 没有显式 `allowed_write_paths`。
- broker identity/guard 错误与内容错误必须分开：stale identity 或 rogue filesystem effect 不消耗 attempt；当前 identity 的 envelope 内容错误沿用现有两次提交预算。

## 3. 采用方案

采用分层防护：规范 YAML writer + 旧 run 门禁 + worker 零文件写入 + 主代理经 stdin 调用 controller submission broker + repository delta guard + 显式错位恢复。正常流程中 worker 和主代理都不选择输出路径、不生成文件；只有 controller 根据当前状态写规范 YAML。操作系统级子代理沙箱不在本任务实现，因为当前 agent 接口不能配置每个子代理的文件权限。

## 4. 组件设计

### 4.1 规范 YAML 与旧 run 门禁

`io.js` 暴露唯一 `serializeYaml(value)`，其参数与 `atomicWriteYaml()` 完全一致。`candidate-ledger.js` 先得到 canonical bytes，再用这些字节同时写文件和计算 `content_hash`。

新 run 的 `run.json` 写入：

```json
{
  "accepted_serialization": "yaml-v1"
}
```

新 artifact manifest entry 同时记录 `serialization: "yaml-v1"`。旧 run 缺少该 marker，允许 `status`、验证和归档，但任何 accepted 写入、assemble、publish 或 install 都返回：

```json
{
  "code": "LEGACY_ACCEPTED_SERIALIZATION",
  "details": { "required": "yaml-v1", "action": "start-new-run" }
}
```

旧 run 的 76 个文件及 manifest 保持字节不变。完整已安装数据不回写。

### 4.2 Worker-visible 零写入合同

`chapter-batching.js` 为主代理提供 controller identity；投影到 worker prompt 时必须移除所有输出路径：

```json
{
  "batch_id": "chapter-batch-008-010",
  "worker_write_paths": [],
  "submissions": [
    {
      "unit": "chapter:008",
      "attempt": 1,
      "input_hash": "sha256:..."
    }
  ]
}
```

worker 可以看到绝对 `source_file` 以读取原文，但看不到 `staging_path`、输出目录或文件名。controller 内部仍保留绝对、run-scoped、attempt-specific staging path，供 broker、receipt 和恢复逻辑使用。正常 worker phase 的写入白名单恒为空。

### 4.3 Worker 文件差异守卫

新增 `worker-guard.js`，提供：

```js
openWorkerGuard({ repositoryRoot, paths, job }) -> GuardReceipt
checkWorkerGuard({ repositoryRoot, paths, guardId }) -> GuardResult
unresolvedWorkerGuardReports(paths) -> GuardResult[]
```

`guard-open` 不接受调用方自定义白名单，而是从当前 status job 重新推导 worker phase 的空写集。它从 repository root 开始递归遍历整个树，而不是只扫描预期目录；记录相对路径、entry 类型、大小和高精度 mtime，排除 `.git/`、`node_modules/` 与本 guard 自己的控制器文件。扫描包括 Git ignored 和 untracked entry，因此即使 worker 违反零写入合同并随机生成未知目录名或文件名，也能同时发现仓库根部 `game-kb/`、run 内 `out/` 及其他任意仓库内错位路径。

`guard-check` 对新增、修改、删除、类型变化和目录创建做差异比较。所有路径先进行 Windows 大小写归一化、绝对化和 realpath/junction 检查。worker phase 不允许任何 repository change。每个 changed entry 必须返回 `relative_path`、`absolute_path`、`change_kind`、`entry_type` 和 before/after fingerprint；因此主代理直接读取报告即可定位文件，不依赖 worker 自检、文件名猜测或额外搜索。违规报告写入当前 run 的 `work/worker-guards/`，且 `resolveNextAction()` 在未解决报告存在时返回 `worker-write-review`，阻断 broker submission、新 job 与 publication。

用户恢复或删除越界变化后再次运行 `guard-check`；当工作区重新等于基线（除白名单和控制器报告外）时，报告转为 resolved。控制器不自动删除现场。

该守卫的可证明观察边界是 repository root。采用 controller-owned broker 后，worker 的正常协议不包含任何文件写入、路径参数或文件生成动作，因而仓库外“写错目标”不再是合法流程的一种可能分支；但 broker 不是 OS 沙箱，仍不能声称能发现 worker 主动违反协议后对仓库外任意位置的写入。全盘扫描不能可靠归因，不纳入实现。

### 4.4 Controller-owned 内容提交 broker

新增 `draft-submission.js`，并把 accept 的“读取文件后验证/记录”核心抽成可复用的内容入口：

```js
submitChapterEnvelope({ paths, batchId, unit, attempt, rawInput })
  -> { status, unit, attempt, submission_hash, accepted_file, errors }
```

主代理调用 `lite-submit-draft <novel> --run <id> --batch <id> --unit <unit> --attempt <n> --json`，通过 stdin 传入且只传入一个 UTF-8 JSON envelope：

```json
{
  "schema_version": 1,
  "batch_id": "chapter-batch-008-010",
  "unit": "chapter:008",
  "attempt": 1,
  "input_hash": "sha256:...",
  "draft": { "schema_version": 6, "chapter": 8 }
}
```

controller 先核对 batch、unit、attempt、input hash 与当前状态。身份不匹配属于 stale/contract failure，不消费 attempt。身份匹配后，该 stdin payload 即本次正式提交：JSON 解析、schema、grounding、source hash 等错误都记录 rejection 并消费 attempt，不能先免费 preflight 再让 worker 隐藏重写。

对于可解析的 `draft` 对象，controller 使用同一个 canonical YAML writer 写入内部 staging path，再立即执行共享 accept core。worker 和主代理都不能传入或推导该路径。每个 unit/attempt 写 immutable submission receipt，绑定 raw input hash、canonical staging hash、archive、accepted artifact 和最终状态。

broker 必须支持 fault injection。相同 unit/attempt/raw hash 在 `binding`、`staging-written`、`submission-recorded` 或 `accepted-written` 后重放时恢复或返回同一结果；不同 raw hash 的重放返回 `SUBMISSION_REPLAY_CONFLICT`，不得覆盖任何字节或再消费一次 attempt。`binding` 是 `binding.json` 成功持久化后的首个 durable phase。stdin 有明确字节上限，拒绝空输入、NUL 和额外 envelope。

### 4.5 只读错位预检

`draft-preflight.js` 只服务于 guard-discovered rogue/legacy 文件：

```js
preflightChapterDraft({ paths, manifest, unit, draftPath, enforceIssuedPath: false })
  -> { valid, recoverable, descriptor, value, canonical_yaml, errors }
```

它复用 parser、`validateChapterDraft()` 和当前 descriptor，不写 progress、drafts、manifest 或 attempt。它不是正常 worker response 的入口，也不能用于 broker payload 的免费试错。

### 4.6 显式错位恢复

新增 `draft-recovery.js`：

```js
recoverChapterDraft({ repositoryRoot, paths, manifest, unit, sourcePath, confirmed })
  -> RecoveryReceipt
```

恢复条件全部满足才允许执行：

1. `--confirm` 已提供；
2. source 是 repository root 内普通文件，不是 symlink/junction，且不位于另一小说 run；
3. 当前 unit 尚未完成，destination 是当前 attempt 的唯一 staging path且不存在；
4. chapter、title、source hash、名称、引用和完整 schema 全部通过；
5. 映射唯一，不依赖文件名猜测。

控制器把 parsed value 用 canonical YAML 写到 destination，保留 source，不消费失败 attempt，并写 `work/draft-recoveries/<unit>-attempt-<n>.json`，记录 source/destination 绝对路径及两个 SHA-256。随后正常 accept。原越界变化仍须通过 guard 复查解决，不能因恢复而静默忽略。

### 4.7 CLI

`flow.js` 增加 Lite 路由：

- `lite-guard-open <novel> --run <id> --batch <batch-id> --json`
- `lite-guard-check <novel> --run <id> --guard <guard-id> --json`
- `lite-submit-draft <novel> --run <id> --batch <batch-id> --unit <unit> --attempt <n> --json`（stdin JSON）
- `lite-check-draft <novel> --run <id> --unit <unit> --draft <absolute-path> --json`
- `lite-recover-draft <novel> --run <id> --unit <unit> --from <absolute-path> --confirm --json`

命令统一使用当前 `GameKbError` JSON 形状。broker 身份错误使用 `SUBMISSION_IDENTITY_*`，冲突重放使用 `SUBMISSION_REPLAY_CONFLICT`，worker 文件变化使用 `WORKER_WRITE_BOUNDARY_VIOLATION`，内容错误沿用 validator error codes，恢复错误使用 `DRAFT_RECOVERY_*` 前缀。正常 Lite 流程不再调用 `lite-accept --draft`。

## 5. 状态与失败规则

| 条件 | attempt | 下一步 |
|---|---:|---|
| worker phase 无 repository change | 不变 | 允许主代理提交返回的 envelope |
| broker identity 匹配且 draft valid | 成功提交 | canonicalize + accept |
| broker identity 匹配但 JSON/draft invalid | +1 | reject；attempt 1 后重试，attempt 2 后 manual review |
| broker identity stale/mismatch | 不变 | 拒绝；重新读取 status，不得改写 payload 重试 |
| 相同 payload replay | 不变 | 恢复或返回 immutable result |
| 同 attempt 不同 payload replay | 不变 | `SUBMISSION_REPLAY_CONFLICT` |
| worker 创建任何 repository 文件，无论内容 | 不变 | worker-write-review；不调用 broker |
| guard-discovered rogue file 唯一且完全 valid | 不变 | 用户确认 recover；再 accept |
| 旧 accepted serialization | 不变 | new-run-required；仅查询/验证/归档 |
| 未解决 guard violation | 不变 | 阻断后续 job 与 publish |

## 6. 兼容性与回滚

- 不迁移、不重写 76 个旧 accepted。
- 《凤舞九天》旧 run 保持冻结；修复后创建新 run。
- final/installed YAML 格式不变。
- 新 envelope/receipt 字段只添加到新 run、job 和 manifest entry；读路径继续兼容旧字段缺失。
- 旧的 path-based `accept` 保留给非 Lite/兼容入口；新的 Lite Skill 正常流程只使用 stdin broker。
- 若新逻辑失败，回滚代码即可；无旧 artifact 需要回滚。

## 7. 测试设计

- canonical YAML 字节、manifest hash 与 round-trip。
- 旧 run status/verify/archive 可读，所有写命令失败。
- stdin envelope 的中文、空格、字节上限、空/NUL/多 envelope、malformed JSON、identity mismatch 和 stale attempt。
- canonical object-to-YAML submission、invalid submission 正式 rejection、两次预算和无 attempt 3。
- same-payload crash replay、conflicting replay 与每个 fault injection point 的 artifact/progress 一致性。
- repository root 和 ignored run 目录的新增、修改、删除、目录创建。
- 未预先写入测试常量的随机嵌套路径，断言报告给出准确 absolute/relative path 且不依赖 worker report；另测 operator message 明示 repository-root observation boundary。
- path-only valid 恢复、ambiguous/cross-book/symlink/invalid 恢复拒绝。
- 全部使用 `node:test` 临时 fixture，不读写真实小说。

## 8. 文件所有权

本任务拥有 `candidate-ledger.js`、`io.js`、`run.js`、`chapter-batching.js`、accept core、submission/guard/preflight/recovery 新模块、`lite-cli-contract.test.js` 及对应 controller tests，并对 `flow.js` 做最小路由修改。worker 子任务只读取这些 CLI tests，不修改它们；父任务恢复前必须以本任务完成后的 `flow.js` 为基线。
