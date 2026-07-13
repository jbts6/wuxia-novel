# generate-kb 阶段化流水线技术设计

## 1. 设计目标

当前 `generate-kb` 的问题不是缺少规则，而是规则无法约束写入顺序。新设计把 AI 视为不可信的批次结果生产者：AI 只能领取控制器发出的任务包并提交 draft；状态、账本、受管中间产物、正式数据和报告全部由控制器校验后写入。

Trellis 与流水线各自承担不同职责：

- Trellis 管理本次代码重构，以及未来每本小说生成任务的 PRD、设计、执行阶段和跨会话交接。
- `generate-kb` 控制器管理某本小说某次运行的细粒度阶段、work item、hash、租约、审核 receipt 和发布版本。
- Trellis 任务不能替代流水线状态；流水线 PASS 也不能替代 Trellis 的开发质量检查。

## 2. 总体数据流

```text
小说原文
  │
  ▼
prepare ──gate──▶ inventory ──gate──▶ reconcile
                                           │
                                  blind gap-audit loop
                                           │
                                  recall + risk review
                                           │ receipt
                                           ▼
                                       enrich
                                           │
                                           ▼
                                   semantic-audit
                                           │
                         failure ───────────┘
                         │ remediation + downstream invalidation
                         ▼
                 inventory/reconcile/enrich

semantic-audit PASS
  │
  ▼
publish ID plan → staging bundle → bundle verification
                                      │
                                      ▼
                        atomic .kb/current promote
```

六个主阶段保持固定。查漏循环是 `reconcile` 的受控子阶段，不额外制造第七个顶层阶段；语义审计发现上游问题时通过明确的 remediation transition 回退，并使受影响的下游 hash 与 receipt 失效。

## 3. 运行目录

每本小说只允许一个 active run，但保留历史 run 供审计：

```text
<novel>/build/generate-kb/
  active-run.json
  runs/<run-id>/
    config.json
    events.jsonl
    state.json
    locks/
    source/
      source-index.json
      scan-plan.json
    work-items/<stage>/
      packets/<work-item-id>.json
      drafts/<work-item-id>.json
      receipts/<work-item-id>.json
    materialized/
      inventory/candidates.jsonl
      inventory/chapter-summary-drafts.json
      reconcile/decisions.jsonl
      reconcile/entities.jsonl
      reconcile/events.json
      enrich/<category>.json
      semantic-audit/report.json
      semantic-audit/exemptions.json
    review/
      recall-review-packet.json
      recall-review-receipt.json
    publish/
      id-plan.json
      staging/<bundle-hash>/
        data/
        reports/
        manifest.json
```

正式发布版本位于：

```text
<novel>/.kb/
  current -> versions/<bundle-hash>
  versions/<bundle-hash>/
    data/
    reports/
    manifest.json
    promote-receipt.json

<novel>/data    -> .kb/current/data
<novel>/reports -> .kb/current/reports
```

新 run 不读取 `.kb/current/data`。现有正式数据在首次迁移时只被封装为 legacy bundle；之后只作为当前消费者版本和差异参考存在。

## 4. 单一 CLI

新增 `.agents/skills/generate-kb/scripts/pipeline.js`，它是唯一受支持的写入入口。建议命令面：

```text
pipeline.js init <novel-dir> [--concurrency 1..4] [--risk-limit 1..15]
pipeline.js status <novel-dir> [--json]
pipeline.js run <novel-dir>
pipeline.js claim <novel-dir> --worker <worker-id>
pipeline.js submit <novel-dir> --worker <worker-id> --item <id> --draft <path>
pipeline.js check <novel-dir>
pipeline.js advance <novel-dir>
pipeline.js review-packet <novel-dir>
pipeline.js record-review <novel-dir> --input <receipt-draft>
pipeline.js build-publish <novel-dir> --draft <publish-draft>
pipeline.js promote <novel-dir> --bundle <hash> --expected-current <hash-or-none>
pipeline.js rollback <novel-dir> --bundle <hash> --expected-current <hash>
```

约束：

- `run` 只执行当前阶段的一个确定性控制器动作，不跨阶段。
- `claim` 只返回一个允许的 work item；没有可领取项时给出下一条合法命令。
- `advance` 只改变阶段，不执行下一阶段工作。
- 所有错误非零退出，并同时输出稳定 error code 与面向 AI 的修复说明。
- `status --json` 是跨会话恢复的唯一机器接口；普通 `status` 给出当前阶段、下一动作、未完成数量和阻塞原因。

## 5. 状态所有权

### 5.1 事件日志与投影

`events.jsonl` 是 append-only 运行事实，`state.json` 是可重建投影缓存。新增共享模块：

- `lib/pipeline-events.js`：事件类型、unknown 解码、字段归一化、hash chain。
- `lib/pipeline-reducer.js`：唯一状态 transition reducer。
- `lib/pipeline-state.js`：加载、重放、原子写投影、合法命令判断。
- `lib/pipeline-paths.js`：所有受管路径和防 path traversal 检查。

事件至少包括：

```text
run_initialized
stage_started
work_items_created
work_item_claimed
work_item_lease_expired
work_item_submission_rejected
work_item_accepted
stage_gate_failed
stage_passed
review_requested
review_recorded
downstream_invalidated
publish_bundle_built
bundle_promoted
bundle_rolled_back
```

每个事件具有递增 `seq`、`event_id`、`run_id`、时间、payload、`prev_event_hash` 与 `event_hash`。命令在 run lock 内校验旧投影、写不可变 artifact/receipt、追加事件、重建投影并以临时文件 rename 更新 `state.json`。若状态写入前崩溃，可由事件重放恢复；无事件引用的临时文件是可清理 orphan，不构成运行事实。

### 5.2 阶段状态

阶段状态使用单点枚举：

```text
not_started | ready | running | blocked | awaiting_recall_review |
passed | invalidated | published
```

work item 状态使用：

```text
pending | claimed | submitted | accepted | failed | invalidated
```

状态投影记录每个阶段的 input hash、output hash、gate version、失败代码、remediation stage 和下一合法动作。任何上游 output hash 或 gate version 变化都会通过 reducer 使全部下游阶段、租约、draft、审核 receipt 和 bundle 失效。

## 6. claim → draft → submit

### 6.1 Packet

packet 由控制器生成且不可由 AI 修改，至少包含：

```json
{
  "schema_version": 1,
  "run_id": "...",
  "stage": "inventory",
  "work_item_id": "inventory_named_ch001_w001",
  "input_hash": "sha256",
  "worker_id": "...",
  "lease_id": "...",
  "lease_expires_at": "...",
  "instructions": { "prompt_version": "...", "allowed_output": "..." },
  "source_payload": {}
}
```

packet 只提供完成当前批次所需的原文与上游投影。inventory 和 blind gap audit packet 明确排除旧最终数据、已有 candidates、decisions 和模型总结。

### 6.2 Draft

AI 只能写 packet 指定 work item 的 draft。draft 必须回传 run/stage/item/input/lease 标识，且只包含该阶段允许的 payload。draft 是不可信输入，不是受管事实。

### 6.3 Submit

submit 在 run lock 内依次验证：

1. 当前 run、stage 与 work item。
2. worker、lease、期限和 input hash。
3. JSON/schema/枚举/大小和路径安全。
4. 完整原文引用、类别规则和阶段特定语义。
5. 无跨 work item 修改、重复提交或陈旧上游引用。

通过后写不可变 receipt、追加 accepted event，并由 materializer 按稳定 work item ID 重建阶段产物。失败只追加 rejected event 和错误，不修改受管产物。

## 7. 并发与租约

- 默认并发 1，配置最大 4。
- 只有 inventory 窗口 work item 和不重叠 entity key 的 enrich work item可并发。
- reconcile、semantic-audit 汇总、review、publish、promote 和 rollback 需要独占 stage lock。
- run lock 只覆盖 claim/submit/transition 的短事务，不覆盖 AI 生成耗时。
- 租约过期不是读取时隐式变化；`claim` 或 `run` 在锁内显式追加 `work_item_lease_expired` 事件后回收。
- materializer 按 work item ID 排序，输出不受提交先后影响。

## 8. 六阶段契约

### 8.1 prepare

输入：原始小说、`ch_split/`、窗口配置。

输出：run-scoped source index、章节 hash、窗口计划。

门禁：原文存在、章节顺序与原文对齐、窗口完整、hash 可重算。复用现有 `source.js` 与 `prepare-source.js` 的纯函数，但写入改由控制器完成。

### 8.2 inventory

work item：

- 每个窗口的 named inventory。
- 每个窗口的 event/dialogue inventory。
- 每章一个 summary draft。

每个 accepted receipt 记录 candidate count、output hash；零候选必须提供枚举化 `empty_reason` 和具体说明。阶段门禁要求所有计划 work item 有 accepted receipt，不能只检查 completed ID。

### 8.3 reconcile

先由控制器建立稳定候选簇，再串行处理 cluster work item。输出使用 provisional key，不使用正式 ID：

```json
{
  "entity_key": "entity_character_<content-hash>",
  "canonical_name": "虚竹",
  "final_category": "character",
  "candidate_ids": ["..."],
  "importance": "核心",
  "decision": "keep"
}
```

事件、关系、speaker 等中间引用均使用 entity key/event key/dialogue key。拒绝项继续保留标准原因。

初次闭环后，控制器生成 blind gap-audit work item；packet 只含原文窗口和 gap prompt，不含现有 inventory/reconcile 结果。若发现新候选，阶段重新生成受影响的 cluster work item。默认最多两轮；最后一轮仍有有效新增时阶段阻塞为 `gap_audit_not_converged`，不得强行通过。

门禁还执行强信号闭环：事件名称和参与者中的重复人物信号、章节摘要 key characters、对白 speaker 提示必须能追到 character entity 或证据化 reject。

reconcile PASS 后，长篇进入 `awaiting_recall_review`。recall review packet 合并：核心/重要角色、主要事件、主要武功、章节覆盖异常、疑似漏项和最多配置上限的高风险裁决。默认上限 15，可降到 10 或更低。超过上限先返回 AI 自审。

### 8.4 enrich

按 category + 不重叠 entity key 分批。输出是无正式 ID 的完整草稿：

- 所有 schema 字段。
- field-level source refs。
- 每个字段的 evidence claim。
- 必要时的 `shared_evidence_justification`。
- 发现新实体时的 discovery alert。

三个以上语义不同字段完全复用引用时默认阻塞。合法共享说明逐字段列出引用中的支持事实，并在 semantic audit 由独立 work item复核。模板句、同义反复、问号/unknown 占位、低于明确长度下限的内容不能借共享说明放行。

enrich 发现新实体不会直接添加记录；控制器记录 discovery alert，阻塞阶段并返回 reconcile/inventory remediation。

### 8.5 semantic-audit

由确定性门禁和隔离的审计 work item共同组成：

- 主要角色召回与章节分布。
- persona/both 对话真实 speaker 与人物覆盖。
- event/both 对话事件覆盖。
- exemption 具体原因、完整证据和反例检查。
- 事件参与者、关系和技能引用闭环。
- 字段 claim 与证据语义支持。
- shared evidence 说明。
- skill/technique/item 分类。
- 占位和机械生成模式。

豁免不能只写“没有关联对白”等结果性理由，必须说明检索范围、原文事实和为何没有合适原话。主要角色存在有效对白候选时 persona exemption 直接失败。

分类规则采用“确定性明显错误直接阻塞，真实边界争议进入高风险队列”的方式，避免把 `易筋经` 这类合法武功误判为普通经脉。穴位名、经脉章节、普通动作、人物外号、普通花名等必须有独立武学/物品身份与剧情作用证据，否则不能进入对应类别。

### 8.6 publish

publish 内部先生成 ID plan，但不回写上游草稿。ID plan 以 entity key 为键，记录 canonical name、逐字拼音音节、最终 ID 和冲突处理。复用 `id-contract.js` 校验前缀、ASCII、音节分隔、类别一致和引用映射。

控制器把 provisional keys 统一投影为正式 ID，在 staging bundle 中生成八类数据与报告。publish draft 只允许提供 token plan，显式拒绝 `report_inputs`。控制器对投影后的 staging data 实际运行 verification 与 cross-validation，并以当前 source/final-data/recall/semantic 结果确定性生成 G1-G5 quality report；所有报告接受显式 data root 和同一个 final data hash，禁止信任 AI 提交的 PASS 对象或从当前正式目录猜测版本。

bundle manifest 至少包含：

```json
{
  "schema_version": 1,
  "run_id": "...",
  "source_hash": "...",
  "reconcile_hash": "...",
  "enrich_hash": "...",
  "semantic_audit_hash": "...",
  "final_data_hash": "...",
  "reports_hash": "...",
  "bundle_hash": "...",
  "gate_versions": {}
}
```

所有验证只针对 staging bundle。验证成功后才允许 promote。

## 9. 原子版本切换

首次 promote：

1. 检查 `data/`、`reports/` 当前是目录还是兼容软链接。
2. 若为真实目录，将完整内容复制并验证到 `.kb/versions/<legacy-hash>`，写 legacy manifest。
3. 原路径改名为可恢复临时备份。
4. 创建静态兼容链接：`data -> .kb/current/data`、`reports -> .kb/current/reports`。
5. 创建 `.kb/current.next -> versions/<bundle-hash>`，再用同目录 rename 原子替换 `.kb/current`。
6. 验证逻辑路径解析的 bundle hash，写 promote receipt 后清理临时备份。

后续 promote 只原子替换 `.kb/current`。promote 必须比较 `expected-current` 与当前 manifest；不匹配即拒绝。旧 bundle 不修改，因此 rollback 等同于验证目标 bundle 后原子切回指针并写 receipt。

迁移过程本身使用 migration journal；如果在静态链接尚未建立时崩溃，下次命令必须先恢复原目录或完成迁移，不能继续其他阶段。

## 10. 校验架构

新增共享层：

- `lib/stage-contracts.js`：六阶段输入/输出 schema 与 gate registry。
- `lib/work-items.js`：packet/draft/receipt schema、租约与 materializer。
- `lib/semantic-gates.js`：召回、speaker、exemption、evidence padding、placeholder、classification。
- `lib/publish-bundle.js`：ID projection、bundle hash、manifest、promote/rollback。
- `lib/atomic-json.js`：stable stringify、hash、临时文件 rename；所有模块复用，禁止各自实现。

现有代码的处理原则：

- `final-data-contract.js` 保留最终消费契约，增加显式 data root 参数和真实最小长度/占位检测。
- `audits.js` 拆出可测试的纯函数，G3/G5 消费 semantic audit 结果而非只看字段存在。
- `validate-inventory.js` 改为验证 receipt coverage 和 run-scoped materialized artifacts。
- `assess-quality.js`、`verify.js`、`cross-validate.js` 和 review/report 生成器接受显式 artifact root 与 expected hash。
- 所有 gate 结果为非补偿式；数量只产生 warning 或触发 recall review，不制造 PASS。

## 11. 人工审核 receipt

人工先编辑 CLI 导出的 receipt draft，再由 `record-review` 校验写入。receipt 包含：

- reviewer 与时间。
- source/reconcile hash。
- `accept_recall|rerun_recall`。
- 每个高风险 decision ID 的 `accept|revise|rerun|manual_investigation` 和备注。
- 用户补充的 source search anchors。

若选择 rerun 或补充 anchor，控制器追加 invalidation event，重新排队 inventory/reconcile。任何 reconcile output hash 改变都会自动使旧 receipt 无效。

## 12. 兼容与迁移

- `.agents/skills/generate-kb` 是唯一源码目录。
- 删除独立 `.claude/skills/generate-kb` 副本，改为相对软链接 `../../.agents/skills/generate-kb`；测试用 `lstat/readlink` 验证。
- 现有消费者继续读取 `<novel>/data/*.json` 与 `<novel>/reports/*.json`。
- 未进入新流水线的小说不自动迁移。
- 旧 CLI 只保留明确的只读/`--dry-run` 诊断；写入命令检测 managed run 后拒绝，并提示等价 pipeline 命令。
- 旧 `build/*.json` 不被新 run 读取；只可由显式 legacy audit 使用。

## 13. 测试策略

### 单元测试

- 事件解码、hash chain、reducer 全 transition、下游失效。
- claim/lease/reclaim、并发上限、陈旧/重复/跨阶段 submit。
- stable work item merge 与 crash replay。
- 六阶段 schema 和 gate registry。
- placeholder、evidence padding、共享说明、speaker、exemption、classification。
- ID plan、bundle hash、manifest 和 expected-current。
- symlink 迁移、原子切换、rollback、migration recovery。

### 回归测试

扩展现有 `legacy-tianlongbabu-false-pass.json`，并增加最小可执行 fixture，覆盖：

- 虚竹只存在于事件候选而不在角色候选。
- 对话全是 unknown speaker 或全部被 generic persona exemption 放行。
- 字段全复用一条弱证据。
- `X。`、`X的招式。`、`X的来历不明。`。
- 穴位/经脉/茶花错误分类。
- final validation hash 陈旧而其他报告新。

保留 `legacy-lianchengjue-low-recall.json`，验证数量不能证明召回完成。

### 集成测试

- 最小完整小说从 init 走到 staging bundle PASS。
- 每个阶段尝试跳过前置阶段均失败。
- 并发 inventory/enrich 提交顺序不同仍产生相同 hash。
- 长篇无 recall receipt 不能进入 enrich。
- staging 失败不改变 current 指针。
- promote/rollback 后逻辑 data/reports 始终来自同一 bundle。

## 14. 重要取舍

- 选择事件日志 + 投影而不是只写 mutable state，增加实现量但提供崩溃恢复、审计与确定性重放。
- 选择 provisional key，把 ID 工作推迟到 publish，代价是发布时需要统一引用投影，但能消除 ID 对前期语义工作的干扰。
- 选择真实版本指针发布，代价是首次迁移物理目录和 Git 路径；换来数据与报告的单指针一致性。
- 选择默认单 worker、有限并发，而不是通用任务队列；满足长篇速度需求，同时控制竞态范围。
- 不在本任务重建《天龙八部》。本任务只让它的失败模式成为自动回归；新流程通过后另开单书任务。
