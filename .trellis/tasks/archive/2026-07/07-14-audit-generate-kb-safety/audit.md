# generate-kb 安全复审报告

## Findings 摘要

本次确认 7 个 High、3 个 Medium，未发现 Critical：

- High：缺少 AI 修正预算；`check` 自循环；claim 决策错误；`advance` 可制造不可恢复状态；remediation 无法回退；stale `run.lock` 无恢复；promote/rollback 存在指针与事件双写窗口。
- Medium：G4 接受任意非空 review status；work-item draft 缺少非受管路径边界；旧 `quality-gates.js` 对缺失证据 fail-open。

以下结论先说明整体安全判断，完整证据、可达复现、影响和缺失测试见后文 `Findings`。

## 结论

当前 `generate-kb` **不能保证 AI 修正失败后有界退出**，也不能保证 `status --json` 返回的 `next_action` 总能被对应命令合法执行。

本次确认 7 个 High、3 个 Medium 问题。没有发现通过正常 managed CLI 路径直接绕过全部 G1-G5、发布未验证 bundle 或混写正式数据的 Critical 问题；managed publish 的 final-data、报告 hash、bundle hash 和 promote 前复验主链总体有效。但状态机在 `claim`、`check`、`advance`、remediation 和崩溃恢复上存在可达的死循环或永久阻塞，并且没有 retry budget、错误指纹、no-progress 计数或转人工终态。

因此，本次关于兜底的明确答案是：**尚未具备**。仅记录 `last_rejection`、返回稳定错误码和允许重交 draft，不等于防循环兜底。

## 审计范围与方法

- 权威契约：`SKILL.md`、`pipeline.md`、`schemas.md`、`constants.md`、`review.md`。
- 实现范围：CLI dispatch、event/reducer、work-item、六阶段 controller、review、staged publish、promote/rollback、managed write guard。
- 静态检查：70 个 JavaScript 文件通过 `node --check`；5 个 JSON 文件均可解析；相对 `require()` 未发现缺失目标。
- 测试：20 个 `*.test.js` 共 126 tests，126 PASS。`tests/run-tests.js` 只执行其中旧式内嵌的 9 tests，不能代表完整测试套件。
- 动态复现：全部使用系统临时目录和模块级/CLI 级隔离 fixture；未读取或修改真实 novel managed run、`.kb/current`、正式 `data/` 或 `reports/`。

## 验证记录

| 检查 | 结果 |
|---|---|
| 在 skill 目录执行 `node --test tests/*.test.js` | exit 0；20 files，126 tests，126 pass，0 fail |
| 对 skill 下全部 70 个 `.js` 逐一执行 `node --check` | 70 pass，0 fail |
| 递归解析 skill 下全部 5 个 `.json` | 5 pass，0 fail |
| 扫描静态相对 `require()` 并解析 `.js/.json/index.js` 目标 | 0 个缺失目标 |
| 执行 `node tests/run-tests.js` | exit 0；仅 9 tests，9 pass，证明该文件不是完整测试入口 |
| 临时状态机/CLI harness | claim-capacity、check-noop、advance-zero-items、remediation-routing、12 次 submit、stale-lock、managed G4、legacy gates 均复现预期缺陷 |
| `git diff --check` 与 task Markdown 空白/冲突标记扫描 | 0 个问题 |

本任务只新增/更新 Trellis 审计 Markdown，没有产品代码、依赖或类型定义改动，因此没有适用的项目 lint、type-check 或 build 命令。

## Findings

### High 1：没有 AI 连续修正失败的有界兜底

**证据**

- `scripts/lib/work-items.js:202-209` 每次校验失败只追加 `work_item_submission_rejected`，随后重新抛错。
- `scripts/lib/pipeline-reducer.js:238-246` 只覆盖 `last_rejection`；没有 attempt count、连续错误指纹、总预算或终止状态。
- `scripts/lib/work-items.js:288-302` 生成的 receipt 没有 `attempt`，与 `schemas.md:267-269` 的 receipt 契约不一致。
- `risk_limit` 仅用于 recall 高风险队列，不是 AI 修正预算。

**可达复现**

对同一已 claim item 连续提交 12 次 identity 错误：产生 12 个 rejection events，item 始终是 `claimed`，`next_action` 始终是 `submit`。交替制造不同错误也不会触发退出，因为没有同错连续计数或总尝试计数。

`readDraft()` 在无效 JSON、文件不存在等路径还会直接抛 `DRAFT_INVALID`，连 rejection event 都不记录，使 no-progress 更难检测。

**影响**

严格按状态恢复的 AI 可以无限执行“修改 draft -> submit -> 同一/轮换错误 -> submit”。流水线没有机器可识别的 `manual_intervention`、`exhausted` 或 `escalate` 状态。

**缺失测试**

没有 same-error、rotating-error、总预算耗尽、预算重置和转人工终态测试。

### High 2：`next_action=check` 与公开 `check` 命令不一致，形成确定性自循环

**证据**

- `scripts/lib/pipeline-reducer.js:73-79` 在阶段所有 work item accepted 后返回 `{ command: 'check' }`。
- `scripts/pipeline.js:123-125` 将 `check` 与 `status` 合并，只加载状态，不执行阶段门禁，也不检查完成条件。
- `pipeline.md:102` 和 `SKILL.md:58` 明确要求 `check` 证明六阶段、publish、G1-G5、lease、receipt 和高风险项全部完成。

**可达复现**

构造 inventory 所有 item accepted 的状态后，连续执行 3 次 `check`：三次均成功返回，`last_seq` 均保持 7，`next_action` 均保持 `check inventory`。

**影响**

只执行 `next_action` 的 AI 必然原地循环。更严重的是，未完成甚至未 publish 的 run 也可得到退出码 0，不能充当完成门禁。

**缺失测试**

现有测试只在已 promoted 状态调用 `check`，没有断言 incomplete run 非零退出、门禁实际执行或 state 必须前进。

### High 3：`next_action=claim` 忽略并发容量和可 claim 性

**证据**

- `scripts/lib/pipeline-reducer.js:73-75` 只要存在 pending item 就优先返回 `claim`，即使同时已有 claimed item。
- `scripts/lib/work-items.js:136-148` 在并发已满或 enrich pending item 与已 claim entity keys 冲突时拒绝 claim。

**可达复现**

`max_workers=1` 的 inventory 有两个 item，claim 第一个后状态仍返回 `claim`；再次 claim 得到 `NO_WORK_ITEM_AVAILABLE`，事件序号和状态不变。重复执行会无限得到同一结果。

**影响**

这是默认并发为 1、阶段有多个 work item 时的常见状态，不是罕见竞态。`next_action` 与命令前置条件互斥，破坏了恢复接口“下一动作可执行”的核心不变量。

**缺失测试**

没有对 `pending + claimed`、容量满、entity-key 冲突时的 `next_action` 合法性做状态矩阵测试。

### High 4：公开 `advance` 可制造 running/零 work-item 的不可恢复状态

**证据**

- `scripts/pipeline.js:274-291` 在 `next_action=start-stage` 时直接写 `stage_started`。
- 正常 inventory 启动和 work-item 规划绑定在 `scripts/lib/pipeline-controller.js:42-46` 的 `run` 分支。
- inventory 已 running 且无 item 时，reducer 返回 `continue-stage`；controller 在 `scripts/lib/pipeline-controller.js:57-61` 只返回 `awaiting-work-items`，不规划任务或失败退出。

**可达复现**

prepare PASS 后执行 `advance`，inventory 变为 `running` 且 work item 数为 0。连续 3 次 `run` 均返回 `awaiting-work-items / continue-stage`，`last_seq` 始终为 4。

**影响**

合法公开命令可以制造状态机无法自行修复的状态。其他 work-item 阶段也没有统一的“启动阶段并规划任务”原子转换，零任务后的行为不一致。

**缺失测试**

现有端到端测试只在 publish 前使用 `advance`，没有覆盖 prepare/inventory/reconcile/enrich/semantic-audit 的公开 advance。

### High 5：`remediation_stage` 只写不读，blocked 阶段无法按要求回退

**证据**

- `scripts/lib/pipeline-reducer.js:172-180` 保存 `remediation_stage`，但 `calculateNextAction()` 在 `scripts/lib/pipeline-reducer.js:81-83` 始终对当前 blocked stage 返回 `remediate-stage`。
- `scripts/lib/staged-semantic-audit.js:243-250` 明确要求回退 `reconcile` 或 `enrich`；`scripts/lib/staged-reconcile.js:539-545` 明确要求回退 `inventory`。
- 从 blocked 重启当前阶段时，`stage_started` 只失效下游，不失效当前阶段旧 work item（`scripts/lib/pipeline-reducer.js:132`）。随后相同规划会被 `scripts/lib/pipeline-reducer.js:192-194` 当作重复 item 拒绝。

**可达复现**

inventory blocked event 写入 `remediation_stage=prepare` 后，状态仍返回 `remediate-stage inventory`。重启 inventory 再规划同一 item 得到 `INVALID_STAGE_TRANSITION: Duplicate work item inventory_item_1`。

语义审计和第二轮 gap audit 的真实失败路径会触发相同错误路由；它们没有 enrich discovery 分支那样额外追加 `downstream_invalidated` 事件。

**影响**

错误阶段得不到修正，blocked 阶段本身又无法重新规划，形成永久阻塞。即使 AI 能理解错误文本，也没有合法命令把状态切回声明的 remediation stage。

**缺失测试**

测试中没有出现 `remediation_stage`；缺少每一种上游回退、当前 work-item 失效和重复规划测试。

### High 6：崩溃残留 `run.lock` 没有恢复机制

**证据**

- `scripts/lib/pipeline-state.js:43-55` 仅以目录存在表示锁；目录内没有 PID、host、acquired_at、lease 或 owner token。
- 只有当前进程正常进入 `finally` 才会删除锁，没有 stale-lock 检测或公开恢复命令。

**可达复现**

在临时 run 中留下 `run.lock` 后连续执行 3 次 claim，均返回 `RUN_LOCKED`，`last_seq` 不变。

**影响**

进程 kill、机器重启或文件系统异常可永久冻结 run。人工直接删目录又绕过了受管写入原则，且无法判断是否仍有活跃 owner。

**缺失测试**

没有 crash/stale lock、owner token、租约续期或安全 unlock 测试。

### High 7：promote/rollback 的指针切换先于事件提交，存在双写崩溃窗口

**证据**

- `scripts/pipeline.js:222-236` 和 `scripts/pipeline.js:257-270` 在 `appendPipelineEvent(... beforeCommit)` 中先执行 promote/rollback。
- `scripts/lib/pipeline-state.js:130-140` 在 `beforeCommit` 返回后才写 event log 和 state projection。
- promote 在 `scripts/lib/publish-bundle.js:752` 切换 `.kb/current`，到 `:771` 才写 receipt；rollback 在 `:798` 切换指针，到 `:821` 才写 receipt。

**可达场景**

若进程在 current pointer 已切换、但 `bundle_promoted`/`bundle_rolled_back` event 尚未提交时退出，文件系统已是新 bundle，pipeline state 仍是 `built/promoted`。按原 `expected-current` 重试会得到 `CURRENT_CHANGED`。

**影响**

正式消费指针与事件事实源分裂，自动恢复命令失效。人工可以猜测新的 expected-current 再重试，但这不是确定性、幂等的崩溃恢复协议，receipt 的 from/to 语义也会改变。

**缺失测试**

现有故障注入覆盖 `before_current_swap`，未覆盖 `after_current_swap` 到 event commit 之间的 CLI 恢复。

### Medium 1：managed G4 接受任意非空 review packet status

**证据**

- `scripts/lib/staged-reports.js:112-113` 只拒绝空 status 和字面值 `needs_ai_review`；`corrupt-but-nonempty` 会 PASS。
- `scripts/lib/staged-publish.js:218-225` 只校验 review packet 的 run/source/reconcile 三个字段，不重算 `packet_hash`，也不与 `state.review.packet_hash/receipt_hash` 绑定。
- bundle 自验证只确认 quality report 中 G4 为 PASS，没有独立验证 review packet 状态枚举和 hash。

**可达复现**

向 `buildStagedQualityReport()` 提交其余门禁均合法、review status 为 `corrupt-but-nonempty` 的输入，得到 `G4.passed=true` 且 `completion_gate_passed=true`。

**影响**

正常 CLI 状态迁移仍要求 reconcile PASS，因此这不是直接跳过 review 的 Critical 绕过；但 managed review artifact 若损坏或被误写，publish 会 fail-open 并固化错误审计证据。

**缺失测试**

没有 unknown/malformed review status、packet hash tamper、accepted receipt rebinding 测试。

### Medium 2：work-item packet 未提供非受管 draft 路径，submit 也不执行路径边界

**证据**

- `SKILL.md:18`、`pipeline.md:55`、`schemas.md:6` 要求 AI 只写 claim 返回的非受管 draft 路径。
- `scripts/lib/work-items.js:154-168` 返回 `instructions/source_payload`，没有 `draft_path` 或契约中的 `inputs`。
- `scripts/lib/work-items.js:257` 对调用方任意路径直接读取 draft；没有像 publish draft 的 `scripts/lib/staged-publish.js:61-69` 那样拒绝 managed run 内路径。

**可达复现**

真实 claim packet 的键为 `input_hash/instructions/lease_*/run_id/schema_version/source_payload/stage/work_item_id/worker_id`，`draft_path=false`、`inputs=false`。

**影响**

AI 无法从 packet 得到唯一合法输出位置，控制器也不能阻止 AI 把草稿放进受管目录。submit 本身只读该路径，但错误的 AI 写入动作可先破坏受管 packet、definition、materialized 或 receipt。

**缺失测试**

没有 packet schema、non-managed draft path 和 `PATH_OUTSIDE_RUN` 测试。

### Medium 3：旧 `quality-gates.js` 对缺失证据字段 fail-open

**证据**

- `scripts/lib/quality-gates.js:5` 将非数组和缺失数组统一当作空数组。
- G1-G5 多个字段因此可省略；`scripts/lib/quality-gates.js:72` 仅在 `final_gap_round_complete === false` 时失败，缺失值通过。
- 最小对象只填写少数 boolean/count 字段、完全省略 coverage arrays 和 final gap 完成标志时，G1-G5 全部 PASS。

**可达复现**

直接调用旧 `quality-gates.js` 的门禁评估，输入只保留少数通过态 boolean/count，省略 coverage arrays 和 `final_gap_round_complete`；返回结果仍将 G1-G5 全部判为 PASS。该路径可由 `scripts/assess-quality.js` 的旧诊断入口触达。

**调用范围说明**

该模块只被 `scripts/assess-quality.js` 调用；新的 managed publish 使用 `staged-reports.js` 和 `publish-bundle.js`，所以此问题不能直接绕过 managed publish。它仍会让旧诊断报告产生 false PASS，并削弱回归防线。

**影响**

缺失关键证据的旧质量报告会显示为通过，误导人工审阅和回归判断。由于 managed publish 不依赖该模块，影响限定在旧诊断链和测试防线，不构成正式发布门禁绕过。

**缺失测试**

现有 quality gate 测试覆盖显式错误，没有覆盖字段缺失、错误类型和 incomplete evidence object。

## 状态转换矩阵

| 当前状态 | 当前 `next_action` | 对应命令实际结果 | 审计结论 |
|---|---|---|---|
| stage ready/invalidated | `start-stage` | `run` 通常启动并规划；`advance` 只写 started | `advance` 可制造零任务 running |
| pending，无 claimed | `claim` | claim 一个 item | 正常 |
| pending + claimed | `claim` | 容量满或 entity 冲突时拒绝 | 非法 next action，可循环 |
| 仅 claimed | `submit` | 校验 draft | 无失败预算，可循环 |
| 全 accepted | `check` | 公开 `check` 只读状态 | 确定性自循环 |
| running、零 item | `continue-stage` | inventory controller 只等待 | 无进展 |
| blocked | `remediate-stage` 当前 stage | 忽略 `remediation_stage`，旧 item 未失效 | 错误路由/重复 item |
| recall review pending | `record-review` | receipt 强绑定并校验 | 主路径正常 |
| publish running、未 build | `build-publish` | 重算并验证 staging bundle | 主路径正常 |
| publish built | `promote` | bundle 复验后切 current | 有 pointer/event 崩溃窗口 |
| publish promoted | `complete` | rollback 是显式带外动作 | 正常完成；rollback 同样有双写窗口 |
| claimed lease 已过期 | 仍可能显示 `submit` | 第一次 submit 才追加 expiry 并回到 pending | 状态时间不敏感；通常一次失败后可恢复 |

## G1-G5 门禁矩阵

| Gate | managed publish 主路径 | 缺失/陈旧处理 | 结论 |
|---|---|---|---|
| G1 source | controller 生成 source validation，并绑定 manifest source hash | missing report、false passed、hash mismatch 均失败 | fail-closed |
| G2 ledger | 要求 reconcile stage passed，并绑定 reconcile materialized hash | 非 passed 或 hash chain 不一致失败 | fail-closed |
| G3 final/evidence | final data 先验证再生成报告；verification weak/unverified/no-ref 必须为 0 | 文件、schema、enrichment、final hash、report hash 均复验 | fail-closed；`staged-reports` 的 false+空 errors 分支在当前 controller 输入下不可达 |
| G4 recall | reconcile stage 必须 passed | packet 缺失和三项绑定错误失败 | **unknown 非空 status 与 packet hash fail-open** |
| G5 semantic/cross | semantic report 自带 output hash；cross errors 必须为 0 | report false、hash stale、cross unknown/error 均失败 | fail-closed |
| Bundle/promote | reports hash、manifest hash、bundle dir hash、final-data hash 全部复验 | tamper 或 expected-current 变化失败 | 验证有效；提交顺序有崩溃窗口 |

跨 gate 不可补偿：managed quality report 使用所有 G1-G5 的 `every(passed)`，bundle verifier 又逐项检查。人工 receipt 不能覆盖 G1/G2/G3/G5。旧 `quality-gates.js` 的 fail-open 已单独降级评估，不能与 managed 路径混为一谈。

## 崩溃一致性

- event log 使用原子整文件替换并作为事实源；`state.json` 缺失或不一致时会从 events 重建，这部分可恢复。
- work-item draft/receipt、阶段 materialized 和 review receipt 在 event 前写入；若崩溃，重试通常可确定性覆盖，未发现由这些路径直接放行未提交产物。
- build-publish 在 event 外完成 staging bundle；提交失败会遗留已验证 orphan bundle，但下一次使用新 `created_at` 通常仍可重建，主要风险是垃圾清理，不是门禁绕过。
- `run.lock` 没有 owner/lease，崩溃后不可恢复。
- current pointer 是正式外部副作用，先切换再提交 event，属于不可自动对账的关键双写窗口。

## 必须增加的有界兜底

以下条件应作为一个整体实现，缺少任一项都仍可被轮换错误绕过：

1. 每次 AI 可修正失败都追加不可覆盖的 `correction_failed` 事件，记录 scope、attempt、规范化 error fingerprint、input/draft hash 和 validator code。
2. 同时维护三种单调预算：相同 fingerprint 连续次数、单 work item/stage 总失败次数、整个 run 的 no-progress 次数。不能只看“连续相同错误”。
3. 建议默认阈值：相同错误 3 次、单 item 总失败 8 次、同一 stage remediation 3 轮；配置只能收紧，不能由 draft 放宽。
4. 达阈值后原子地释放/失效 lease，将 item 或 stage 置为 `manual_intervention`，并令 `next_action={command:'escalate', ...}`；`claim/submit/run` 必须 fail-closed，不能继续自动循环。
5. controller 生成受管 incident packet，包含最后错误、失败 fingerprints、相关 hashes、允许用户修改的非受管 draft 路径和明确恢复命令。不得要求用户直接编辑 state/events。
6. 只有 work item accepted、上游 input hash 改变或有效人工 receipt 才能重置对应预算；换错误码、换 worker、重新 claim 或重启会话不能清零。
7. orchestrator 再加一层 no-progress guard：相同 `last_seq + next_action + error fingerprint` 连续 3 次时停止调用并转 `escalate`，防止 controller 漏记的异常路径无限重试。
8. stale lock 使用 owner token、PID/host、acquired_at 和 lease；自动回收前必须确认 owner 不存活或 lease 已过期，并把 recovery 写入事件。
9. promote/rollback 使用 intent/receipt 两阶段协议或幂等 reconciliation：重试时若 current 已是目标 bundle，应验证 receipt/hash 后补写事件，而不是返回 `CURRENT_CHANGED`。

## 修复优先级

1. 先修 `check`、claim 决策和 correction budget；这三项直接决定 AI 是否会循环。
2. 再修 remediation routing/current-item invalidation 和 `advance`，恢复状态机闭包。
3. 增加 stale lock 与 promote/rollback 崩溃恢复，保证进程级可恢复性。
4. 收紧 G4 status/packet/receipt 绑定和 work-item draft path 边界。
5. 收紧 legacy quality gates，并把完整 20-file test glob 设为唯一测试入口。

## 必补测试

- 属性/表驱动测试：任意可达 state 的 `next_action` 必须至少有一个当前可成功执行的合法命令。
- `check`：各阶段未完成、pending/claimed/stale lease、review pending、G1-G5 任一失败、未 promote 均非零；完整状态才成功。
- claim：`pending+claimed`、容量满、entity key 冲突、lease 恰好到期。
- retry：相同错误、交替错误、换 worker、重启会话、预算重置和 manual intervention。
- remediation：semantic -> enrich/reconcile、gap -> inventory、当前/下游 work item 失效、重新规划不重复。
- crash：stale lock、event 写后 state 写前、materialized 写后 event 前、after current swap/event commit 前。
- gates：G4 unknown status、packet hash tamper、receipt hash stale；legacy 所有必填字段缺失/类型错误。
- packet：claim 返回唯一非受管 draft path，submit 拒绝 run 内路径。

## 验收判断

| 用户关注点 | 判断 |
|---|---|
| 低级编码错误 | 语法/import/JSON 基础检查通过；发现 `check` 误路由、packet 字段缺失等实现错误 |
| 逻辑性错误 | 未通过；`advance`、remediation、retry 状态转换存在可达错误 |
| 门禁互斥 | 未通过；`next_action=claim/check` 与对应命令前置条件/行为冲突 |
| G1-G5 防绕过 | managed 主链大体通过；G4 malformed status/packet binding 需收紧；legacy API fail-open |
| 防 AI 修正循环兜底 | **未通过；当前没有有界退出机制** |
| 崩溃恢复 | 未通过；stale lock 与 pointer/event 双写窗口未闭合 |

### PRD 验收映射

| 条目 | 证据 | 结果 |
|---|---|---|
| AC1 核心路径覆盖 | `审计范围与方法`、`状态转换矩阵`、`崩溃一致性` | 完成 |
| AC2 门禁与互斥矩阵 | `G1-G5 门禁矩阵`及 High 2–5、Medium 1、3 | 完成 |
| AC3 有界性与失败序列 | `验证记录`、High 1、3、5–7 | 完成；确认现有兜底不合格 |
| AC4 语法、静态与测试 | `验证记录`中的 70 JS、5 JSON、126 tests 和隔离 harness | 完成 |
| AC5 findings-first 报告 | 置顶 `Findings 摘要`及后文 10 条完整 finding | 完成 |
