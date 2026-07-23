# 实施计划

## 前置约束

- 只保证新建 run 的精确时间统计；既有 v7 run 不回填、不迁移、不补写。
- `semantic_contract_version: 7` 与 `semantic_profile: chapter-direct-v1` 保持不变；时间合同独立为 `timing_contract_version: 1`。
- `events.jsonl` 只由 Controller 写入；Worker 输入、单文件输出合同和公开 `status` 结构保持不变。
- 所有时间统计从持久化事件和 accepted chapter YAML 确定性重建，不读取文件 `mtime`、`birthtime` 或旧 candidate registry。
- 每阶段严格执行 RED → GREEN → 重构；失败测试必须先确认因缺少本阶段能力而失败。
- 仅提交本任务文件；不得纳入当前工作区中的批量生成任务、小说 `data/`、`reports/`、`.gitignore` 或 `.workbuddy/memory/`。

## 需求覆盖

| PRD | 实施阶段 |
| --- | --- |
| R1 时间合同版本 | 阶段 1 |
| R2 完整 Controller 事件 | 阶段 1、2、4 |
| R3 跨 cycle attempt 与幂等 | 阶段 1、2、3 |
| R4 人工等待 | 阶段 2、3 |
| R5 UTC 与禁用文件时间 | 阶段 1、3 |
| R6 确定性 metrics | 阶段 3、5 |
| R7 归档完整性 | 阶段 4 |
| R8 公开命令兼容 | 阶段 4、5 |
| R9 旧 run 只读兼容 | 阶段 1、4 |
| R10 Worker 合同不变 | 全阶段约束、阶段 6 合同审查 |

## 阶段 1：建立事件存储与时间合同

### 新增文件

- `.agents/skills/generate-game-kb/scripts/lib/timing-events.js`
- `.agents/skills/generate-game-kb/tests/timing-events.test.js`

### 修改文件

- `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- `.agents/skills/generate-game-kb/scripts/lib/run.js`
- `.agents/skills/generate-game-kb/tests/run-isolation.test.js`

### 测试先行

1. 为 `timing-events.js` 写失败测试，覆盖：
   - 首事件序号从 1 开始，后续严格递增；
   - 相同 `event_key` 重放不追加重复行；
   - 同 key 不同 payload 被拒绝；
   - 事件 UTC 时间、run/unit/cycle/attempt/producer 绑定和事件类型校验；
   - 非法尾行、序号断裂或顺序倒退被拒绝；
   - 写入故障不留下半行或损坏原文件。
2. 扩展 run isolation 测试，要求新 run 路径含受管 `events.jsonl`，run metadata 声明 `timing_contract_version: 1`，恢复同一 run 不重复 `run_started`。
3. 运行：
   - `node --test .agents/skills/generate-game-kb/tests/timing-events.test.js`
   - `node --test .agents/skills/generate-game-kb/tests/run-isolation.test.js`
4. 确认 RED 原因分别是事件模块、路径和时间合同尚不存在。

### 最小实现

1. 在 `pathsFor()` 增加 run-scoped `events` 路径，并纳入路径隔离断言。
2. 实现事件 schema、稳定 `event_key`、规范 JSON 序列化、既有日志全量校验和幂等追加。
3. 使用同目录临时文件、完整写入、同步和原子替换，保证每次提交后 `events.jsonl` 要么保持旧版本，要么成为完整新版本。
4. 在新 run 创建时持久化 `timing_contract_version: 1` 并写 `run_started`；恢复路径先校验事件文件再继续。
5. 旧 run 缺少时间合同或事件文件时，只允许兼容读取路径，不在恢复或 `status` 中补写。

### 验证与提交

- 上述两个定向测试转为 GREEN。
- 运行 `git diff --check`。
- 独立提交：`feat(game-kb): 添加持久化时间事件合同`。

## 阶段 2：覆盖章节窗口、attempt 与人工等待时间线

### 修改文件

- `.agents/skills/generate-game-kb/scripts/lib/source.js`
- `.agents/skills/generate-game-kb/scripts/lib/chapter-work.js`
- `.agents/skills/generate-game-kb/scripts/lib/chapter-receiver.js`
- `.agents/skills/generate-game-kb/scripts/flow.js`
- `.agents/skills/generate-game-kb/tests/progress.test.js`
- `.agents/skills/generate-game-kb/tests/chapter-receiver.test.js`
- `.agents/skills/generate-game-kb/tests/run-archive.test.js`

### 测试先行

1. 增加 source prepare、window issued/closed、attempt issued/observed/accepted/rejected 的失败测试。
2. 覆盖三条代表性序列：
   - 无重试：planned 1、attempt 1、correction 0；
   - 同 cycle 自动 attempt 2：planned 1、attempt 2、correction 1；
   - `manual_review` 后确认新 cycle：等待进入/恢复成对，跨 cycle attempt 全部保留。
3. 覆盖重复 `run`、重复观察同一文件、恢复 active window 和重复 `retry-unit --confirm` 不产生重复事件。
4. 先运行三个定向测试文件并确认 RED。

### 最小实现

1. `source.js` 写 `source_prepare_started` / `source_prepared`。
2. `chapter-work.js` 在窗口和 job 持久化成功后写 `window_issued` / `attempt_issued`；事件 key 包含 unit、cycle、attempt。
3. `chapter-receiver.js` 在 Controller 观察输出时写 `attempt_observed`，校验完成后写 accepted 或 rejected；最后一个 active unit 接受后写 `window_closed`。
4. 将 `receiveAvailableChapterOutputs()` 拆成观察、校验、接受/拒绝和窗口收口的小函数，使单函数不超过 60 行且保持现有接收语义。
5. `flow.js` 首次进入人工复核时写 `manual_review_entered`；`retry-unit --confirm` 成功恢复时写 `manual_review_resumed`，再由 chapter work 签发新 cycle attempt。
6. 所有事件写入点放在对应状态持久化边界之后，并使用稳定 key 保证恢复幂等。

### 验证与提交

- 运行：
  - `node --test .agents/skills/generate-game-kb/tests/progress.test.js`
  - `node --test .agents/skills/generate-game-kb/tests/chapter-receiver.test.js`
  - `node --test .agents/skills/generate-game-kb/tests/run-archive.test.js`
- 检查受影响函数均不超过 60 行。
- 独立提交：`feat(game-kb): 记录章节与人工复核时间线`。

## 阶段 3：从事件确定性生成 run metrics

### 新增文件

- `.agents/skills/generate-game-kb/tests/timing.test.js`

### 修改文件

- `.agents/skills/generate-game-kb/scripts/lib/timing.js`
- `.agents/skills/generate-game-kb/scripts/flow.js`

### 测试先行

1. 用固定 UTC 事件夹具写失败测试，精确断言：
   - `total_ms`、`human_wait_ms`、`active_ms`；
   - source/chapter/assemble/verify/install/archive 各阶段耗时；
   - 全部 cycle 的 planned、attempt、correction；
   - issued/closed/unclosed window 数量和墙钟跨度；
   - attempt 的 issued→observed 周转与 observed→decision 校验耗时；
   - `timing_contract_version` 与 `timing_events_hash`。
2. 用 accepted chapter YAML 夹具断言 `chapter_candidates` 为四类数组出现次数之和；断言旧 candidate registry 的值不会影响结果。
3. 覆盖缺事件、未配对人工等待、负跨度、重复终态和 hash 不匹配均失败。
4. 运行 timing 定向测试并确认 RED。

### 最小实现

1. 删除对 `progress.units[*].updated_at` 和旧 candidate registry 的依赖。
2. 按 `(sequence, event_key)` 校验后的事件序列构建阶段配对、等待区间、window 和 attempt 聚合。
3. 将 attempt 周转明确命名和解释为 Controller 签发到观察时间，不宣称纯模型推理时间。
4. 扫描本 run 的 accepted chapter YAML 计算章节候选出现次数；五个最终文件继续用于 `final_records`。
5. 由同一规范字节计算 `timing_events_hash`，并输出新的 `run-metrics.json` schema。

### 验证与提交

- 运行 `node --test .agents/skills/generate-game-kb/tests/timing.test.js`。
- 重新运行阶段 1、2 的定向测试，确认事件 schema 与 metrics 消费方一致。
- 独立提交：`feat(game-kb): 从事件生成精确运行指标`。

## 阶段 4：绑定终态阶段、归档证据与兼容读取

### 新增文件

- `.agents/skills/generate-game-kb/scripts/lib/archive-integrity.js`

### 修改文件

- `.agents/skills/generate-game-kb/scripts/flow.js`
- `.agents/skills/generate-game-kb/scripts/lib/archive.js`
- `.agents/skills/generate-game-kb/tests/archive.test.js`
- `.agents/skills/generate-game-kb/tests/run-archive.test.js`
- `.agents/skills/generate-game-kb/tests/assemble-flow.test.js`

### 测试先行

1. 写失败测试，要求 assemble、verify、install、archive 均有 started/completed 成对事件，失败阶段不伪造 completed。
2. 要求归档回执绑定 `events.jsonl`、`run-metrics.json` 及 `timing_events_hash`；篡改任一事件或 metrics 后验证失败。
3. 对既有无时间合同的 v7 archived fixture 执行两次 `status`，断言均返回 `complete` 且目录字节快照不变；`archive-abandoned` 继续沿用旧合同且不补写时间文件。
4. 先运行 archive、run-archive、assemble-flow 定向测试并确认 RED。

### 最小实现

1. 在 `flow.js` 用 try/finally 明确包围终态阶段，只在成功持久化后写 completed 事件。
2. 将 `archive.js` 中纯哈希、证据校验和回执构建职责提取到 `archive-integrity.js`，把 `archiveRun()` 拆成不超过 60 行的准备、移动、验证和回滚步骤，并将原文件降至 400 行以内。
3. 归档前生成最终 metrics；归档验证同时检查事件序列、事件哈希、metrics 哈希和安装身份。
4. 兼容分支以 run metadata 是否声明时间合同为界：新合同严格验证，旧 run 只读沿用原判定。

### 验证与提交

- 运行：
  - `node --test .agents/skills/generate-game-kb/tests/archive.test.js`
  - `node --test .agents/skills/generate-game-kb/tests/run-archive.test.js`
  - `node --test .agents/skills/generate-game-kb/tests/assemble-flow.test.js`
- 运行代码体积检查，确认修改后的文件不超过 400 行、函数不超过 60 行。
- 独立提交：`feat(game-kb): 将时间证据绑定归档回执`。

## 阶段 5：端到端与性能预算

### 修改文件

- `.agents/skills/generate-game-kb/tests/v7-e2e.test.js`
- `.agents/skills/generate-game-kb/tests/helpers.js`（仅在需要复用确定性时钟/事件夹具时）
- `.agents/skills/generate-game-kb/tests/performance-budget.test.js`

### 测试内容

1. E2E 覆盖六章跨窗口、自动 attempt 2、人工确认新 cycle 三条 run，并断言完整事件时间线与 metrics。
2. 代表性新 run 断言 chapter、assemble、verify、install、archive 均为真实事件口径；人工等待从 active 中剔除。
3. 事件写入与 metrics 聚合保持线性；在现有 25/1000 章性能夹具上加入预算断言，避免每事件反复扫描导致二次复杂度。
4. 在固定时钟下重复构建 metrics，断言字节和哈希完全一致。

### 验证与提交

- 运行 `node --test .agents/skills/generate-game-kb/tests/v7-e2e.test.js`。
- 运行定位到的性能预算测试。
- 独立提交：`test(game-kb): 覆盖 v7 时间统计端到端`。

## 阶段 6：合同文档、全量 QA 与收尾

### 修改文件

- `.agents/skills/generate-game-kb/SKILL.md`
- `.agents/skills/generate-game-kb/schemas.md`
- `.trellis/spec/backend/` 下现有 generate-game-kb 合同文档（按 `trellis-update-spec` 结果就地更新）

### 合同同步

1. 记录 `timing_contract_version: 1`、事件字段/类型、metrics 口径和兼容边界。
2. 明确 `human_wait_ms`、`active_ms` 与 attempt 周转的解释，避免把 Controller 周转误称模型推理时间。
3. 明确旧 run 不迁移，Worker 和公开 `status` 合同未改变。

### 全量验证

1. 运行：`node --test .agents/skills/generate-game-kb/tests/*.test.js`。
2. 运行项目既有的 lint/typecheck/性能验证命令；不存在的门禁明确记录为不适用，不伪造通过。
3. 运行 `git diff --check`，检查事件 fixture 无绝对路径、凭据或小说数据泄漏。
4. 使用 `trellis-check` 完成规范、数据流、兼容性和测试覆盖审查；失败则修复并重跑。
5. 更新 Trellis spec、开发者 journal，归档任务并提交最后的合同/任务收尾检查点。

## 完成判定

- `prd.md` 的全部验收项均有自动化测试证据。
- 新 run 可从 `events.jsonl` 重建完整时间线，metrics 与归档哈希一致。
- 无重试、自动重试、人工确认新 cycle 三类 attempt/等待统计正确。
- 旧 archived v7 run 的只读 `status` 行为与目录字节保持不变。
- generate-game-kb 全量测试、性能预算和 Trellis 质量门禁通过。
