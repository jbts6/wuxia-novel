# generate-kb 阶段化流水线实施计划

## 执行原则

- 本任务只修改 generate-kb 流程、测试、文档与 `.claude` 兼容链接，不修补任何小说的现有知识库。
- 当前工作树中的《天龙八部》修改属于用户/其他 AI，实施时不得覆盖、格式化或移动。
- 先写失败测试和共享契约，再接入旧函数；不得先复制一套新 validator。
- 每一阶段完成后运行对应小测试；最后一次迭代运行完整测试与交叉检查。

## Phase A：基线与契约

- [x] A1. 记录当前 generate-kb 测试基线和相关 dirty worktree，确认现有失败与本任务新增失败可区分。
- [x] A2. 新增 `scripts/lib/atomic-json.js`：stable stringify、SHA-256、原子 JSON/JSONL 写入与安全路径工具。
- [x] A3. 新增 `scripts/lib/pipeline-events.js`：事件 schema、unknown decoder、hash chain 和稳定 error codes。
- [x] A4. 新增 `scripts/lib/pipeline-reducer.js`：六阶段、work item、review、publish 的唯一 transition reducer。
- [x] A5. 新增 `scripts/lib/pipeline-paths.js` 与 `pipeline-state.js`：run 路径、事件重放、state 投影、run lock 和下游失效。
- [x] A6. 新增 reducer/state 测试：合法 transition、跳级拒绝、hash/gate version 失效、崩溃重放、篡改事件失败。

验证：

```bash
rtk node --test .agents/skills/generate-kb/tests/pipeline-state.test.js
```

## Phase B：总控 CLI 与受控提交

- [x] B1. 新增 `scripts/pipeline.js`，实现 `init/status/run/check/advance` 的命令解析和非零退出契约。
- [x] B2. 新增 `scripts/lib/work-items.js`，集中定义 packet/draft/receipt、claim、submit 和 materializer。
- [x] B3. 实现 worker/lease/expiry/reclaim；默认并发 1，最大 4，仅 inventory/enrich 允许并发。
- [x] B4. 实现 stale input、错误 worker、过期 lease、重复/跨阶段 submit 拒绝与无部分写入。
- [x] B5. 增加 `claim/submit` CLI 和面向 AI 的 `next_action` 输出。
- [x] B6. 新增 work item 协议与并发顺序确定性测试。

验证：

```bash
rtk node --test \
  .agents/skills/generate-kb/tests/pipeline-state.test.js \
  .agents/skills/generate-kb/tests/work-item-protocol.test.js
```

## Phase C：prepare 与 inventory

- [x] C1. 把 `prepare-source.js`/`source.js` 的计算与写入分离，控制器写 run-scoped source artifacts。
- [x] C2. 为 named inventory、event/dialogue 和 chapter summary 建稳定 work item 计划。
- [x] C3. inventory packet 只含当前窗口/章节与 prompt version，不含旧 data、candidate 或 summary。
- [x] C4. submit 验证完整 source ref、窗口边界、candidate schema、candidate ID 和 summary draft。
- [x] C5. 每个 receipt 记录 output count/hash；零产出要求枚举 empty reason 与具体说明。
- [x] C6. 重构 `validate-inventory.js`，以 packet/receipt coverage 取代 `completed_window_ids` 单点证明，同时保留 pure validation API。
- [x] C7. 增加完成 ID 无输出、陈旧窗口、空原因缺失和并发 materialization 回归测试。

验证：

```bash
rtk node --test \
  .agents/skills/generate-kb/tests/source-ledger.test.js \
  .agents/skills/generate-kb/tests/staged-inventory.test.js
```

## Phase D：reconcile、查漏与人工检查点

- [x] D1. 定义不含正式 ID 的 decision/entity/event provisional-key 契约。
- [x] D2. 实现稳定候选簇与串行 reconcile work item；materializer 检查 candidate 恰好闭环一次。
- [x] D3. 实现事件/summary/dialogue 强人物信号到 character entity/reject 的闭环门禁。
- [x] D4. 实现 blind gap-audit packet；发现新候选后只重开受影响候选簇，最多两轮且必须以零有效新增收敛。
- [x] D5. 实现 recall review packet：核心/重要角色、主要事件、主要武功、章节异常、疑似漏项和高风险项。
- [x] D6. 实现 configurable risk limit（默认 15，允许降到 10 或更低）；超过上限返回 AI 复核。
- [x] D7. 实现 `review-packet`/`record-review`、hash-bound receipt、search anchor 回流和 receipt 失效。
- [x] D8. 增加虚竹只在事件中、gap 不收敛、无长篇 receipt、陈旧 review receipt 和风险队列截断测试。

验证：

```bash
rtk node --test \
  .agents/skills/generate-kb/tests/staged-reconcile.test.js \
  .agents/skills/generate-kb/tests/review-readiness.test.js
```

## Phase E：enrich 与 semantic audit

- [x] E1. 定义八类 provisional enrich draft、field evidence claim、discovery alert 和 shared evidence justification 契约。
- [x] E2. 按 category + 不重叠 entity key 创建 enrich work item，支持最多 4 个租约。
- [x] E3. 扩展 `final-data-contract.js` 的内容门禁：明确最小长度、模板/占位模式和非空语义；允许 provisional-key validation 模式。
- [x] E4. 新增 `semantic-gates.js`：角色召回、speaker、main event/persona 覆盖、exemption、event participant、evidence padding、classification。
- [x] E5. 将 `audits.js` 的 evidence/semantic 路径拆成可单测纯函数，禁止空检查集和通用豁免产生 PASS。
- [x] E6. 实现 shared evidence 独立审计；无逐字段事实说明、循环说明或模板字段时失败。
- [x] E7. 实现 classification 明确错误阻塞与边界争议入高风险队列，避免简单后缀误杀合法武功。
- [x] E8. discovery alert 触发明确 remediation 与下游失效，不得在 enrich 直接补实体。
- [x] E9. 增加天龙八部历史假通过的最小 fixture 与全部语义回归测试。

验证：

```bash
rtk node --test \
  .agents/skills/generate-kb/tests/final-data-contract.test.js \
  .agents/skills/generate-kb/tests/audits.test.js \
  .agents/skills/generate-kb/tests/staged-enrich.test.js \
  .agents/skills/generate-kb/tests/semantic-gates.test.js \
  .agents/skills/generate-kb/tests/staged-semantic-audit.test.js \
  .agents/skills/generate-kb/tests/quality-gate.test.js
```

## Phase F：publish bundle、版本指针与回滚

- [x] F1. 新增 `publish-bundle.js`：publish-time ID plan、provisional key 投影、引用统一重写和冲突检测。
- [x] F2. 让 `verify.js`、`cross-validate.js`、`assess-quality.js`、review/report 生成器接收显式 bundle/data root 与 expected hash。
- [x] F3. 构建 `.kb/versions/<bundle-hash>/{data,reports}` staging bundle 和 manifest；全部报告绑定同一 final data hash。
- [x] F4. 实现 bundle 自验证：缺文件、schema/enrich、semantic、source、cross reference、任何 stale hash 均失败。
- [x] F5. 实现首次 legacy data/reports 迁移、migration journal、兼容软链接和崩溃恢复。
- [x] F6. 实现 `.kb/current.next` 原子 rename、expected-current 并发保护和 promote receipt。
- [x] F7. 实现 bundle 完整性验证后的 rollback 与 receipt。
- [x] F8. 增加失败注入测试：staging 失败/current 不变、迁移中断恢复、并发 current 改变拒绝、promote/rollback 同 bundle 解析。

验证：

```bash
rtk node --test \
  .agents/skills/generate-kb/tests/publish-bundle.test.js \
  .agents/skills/generate-kb/tests/pipeline-integration.test.js
```

## Phase G：唯一入口、软链接与文档

- [x] G1. 将旧写入 CLI 改为控制器调用的 pure exports；managed run 下直接写入命令拒绝，保留明确只读/`--dry-run` 路径。
- [x] G2. 删除独立 `.claude/skills/generate-kb` 文件副本，创建指向 `.agents/skills/generate-kb` 的相对软链接。
- [x] G3. 增加软链接类型、target 与内容解析测试，防止副本再次漂移。
- [x] G4. 重写 `SKILL.md`、`pipeline.md`、`schemas.md`、`constants.md`、`review.md` 和相关 prompts，描述六阶段、work item、停止条件与唯一 CLI。
- [x] G5. 更新 `.trellis/spec/backend/quality-guidelines.md`，记录阶段状态、receipt、语义门禁和单指针发布的新项目契约。
- [x] G6. 删除或标记与新流程矛盾的旧“四阶段直接写 data”说明；legacy 诊断文档明确不参与新生成。

验证：

```bash
rtk node --test .agents/skills/generate-kb/tests/skill-layout.test.js
rtk grep "Reconcile And Enrich\|completed_window_ids.*完成" .agents/skills/generate-kb
```

## Phase H：全量验证与交付检查

- [x] H1. 运行全部 generate-kb 测试，确认旧合法 fixture 兼容、新失败 fixture 均失败。
- [x] H2. 在临时小说 fixture 上执行完整 init → work items → review → enrich → audit → staging → promote → rollback。
- [x] H3. 验证不同并发提交顺序产生相同 materialized/bundle hash。
- [x] H4. 验证当前《天龙八部》数据未被本任务修改；其失败 fixture 能触发预期 gate。
- [x] H5. 运行 git diff 检查，确认没有引入依赖、临时文件、测试缓存或两份 skill 实现。
- [x] H6. 对照 PRD 的每条 acceptance criterion，记录通过证据后再进入 Trellis finish。

全量命令：

```bash
rtk node --test \
  .agents/skills/generate-kb/tests/run-tests.js \
  .agents/skills/generate-kb/tests/source-ledger.test.js \
  .agents/skills/generate-kb/tests/final-data-contract.test.js \
  .agents/skills/generate-kb/tests/quality-gate.test.js \
  .agents/skills/generate-kb/tests/review-readiness.test.js \
  .agents/skills/generate-kb/tests/pipeline-state.test.js \
  .agents/skills/generate-kb/tests/work-item-protocol.test.js \
  .agents/skills/generate-kb/tests/staged-inventory.test.js \
  .agents/skills/generate-kb/tests/staged-reconcile.test.js \
  .agents/skills/generate-kb/tests/semantic-gates.test.js \
  .agents/skills/generate-kb/tests/publish-bundle.test.js \
  .agents/skills/generate-kb/tests/skill-layout.test.js \
  .agents/skills/generate-kb/tests/managed-pipeline-e2e.test.js \
  .agents/skills/generate-kb/tests/pipeline-integration.test.js

rtk git diff --check
rtk git status --short
```

## 风险文件与回滚点

- `.agents/skills/generate-kb/scripts/lib/final-data-contract.js`：所有最终数据消费者共享；每次改动先跑 final-data-contract 与 pipeline integration。
- `audits.js`、`quality-gates.js`、`assess-quality.js`：可能制造历史报告变化；必须用旧合法 fixture 和新 false-pass fixture 双向验证。
- `validate-inventory.js`：旧任务依赖其 CLI；pure API 与 legacy dry-run 必须保留。
- `.claude/skills/generate-kb`：从目录改软链接前先验证两目录仍完全一致；若失败，停止并报告差异，不删除任一份。
- 小说目录 `data/`、`reports/`：实现只在临时 fixture 测试迁移；本任务不得对真实小说执行 promote/migrate。
- 不新增 `pinyin` 等运行依赖；publish ID plan 通过受控 work item 与现有 id contract 完成。
