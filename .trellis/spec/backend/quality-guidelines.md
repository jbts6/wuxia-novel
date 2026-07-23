# 质量规范

> 后端开发代码质量标准。

---

## 概述

生成的知识库是证据流水线。质量必须由可复现的源覆盖、候选闭环和独立的硬门禁来证明，绝不能靠模型自评、数量阈值或聚合分数。

---

## 禁止的模式

- 绝不可把 LLM 生成的基线当作金标准数据或召回分母。
- 绝不可用前缀、关键词、锚点或截断片段替代完整的源匹配。
- 绝不允许某一强项类别去补偿一个阻塞性的源、台账、证据、召回或语义失败。
- 绝不可把明确命名且有据可依的武功招式/技法当作 `trivial`、`non_major` 或低频而拒收。

---

## 强制的模式

- 受管理的 generate-kb 运行是一个固定的六阶段状态机：`prepare`、`inventory`、`reconcile`、`enrich`、`semantic-audit`、`publish`。一次会话必须读取 `status --json` 并只执行其返回的下一步动作。
- 对于 `.agents/skills/generate-kb` 下的审计级受管理运行，`scripts/pipeline.js` 是唯一受支持的写入入口。AI 输出采用 `claim -> draft -> submit`；分包绑定包含 stage、work-item ID、input hash、worker 和 lease。过期、重复、跨阶段或非当前的提交必须被原子拒绝。
- 在 `publish` 之前，记录使用临时键，不允许任何正式的 `data/*.json`、`reports/*.json` 或 `.kb/current` 写入。正式 ID、引用投影、报告和最终哈希，都在一个已验证的暂存包（staging bundle）内一次性生成。
- 在调和、分类或富集之前，先基于每个源窗口构建候选台账（candidate ledger）。
- 每个候选必须有且仅有一个 keep/merge/redirect/reject 决策；保留的候选在 publish 投影出唯一的正式 ID 计划之前，都指向稳定的临时键。
- 最终实体、章节摘要、描述字段、对话以及对话上下文，必须保留完整、章节局部的源证据。
- `enrich` 阶段必须在语义审计之前通过共享的临时数据契约。像 `name/source_refs` 这样的骨架记录是不完整的数据，不是有效的低细节记录。
- 富集身份检查必须遵循最终类别的 schema。对话记录没有合成的 `name`；其调和 `canonical_name` 仍是面向 publish 时 ID 规划的控制器元数据，记录本身由临时键和对话字段绑定。
- 语义证据工作项仅针对非空的 `field_evidence_claims` 创建。来自没有任何被检查描述字段的类别的空 claim map 是合法有效的，在其临时绑定通过验证后跳过；但完整的审计集合仍必须至少包含一个真实的字段检查。
- 验证与交叉验证报告必须包含全部八个当前 `data/*.json` 文件的稳定哈希。缺失或过期的哈希是阻塞失败。
- G1-G5 必须报告独立的 PASS/FAIL 结果与原因。完成要求每个门禁都通过。
- `build-publish <novel-dir> --draft <publish-draft>` 只接受 `schema_version`、活跃的 `run_id`、活跃的 `semantic_audit_hash` 和 `token_plan`。`report_inputs` 字段无效；验证、交叉验证和质量报告都由控制器基于投影出的暂存数据生成。
- 报告生成器必须以显式的暂存 `dataRoot` 和期望的 `final_data_hash` 调用验证与交叉验证，再从当前源、阶段、召回、语义、最终数据和报告证据中推导 G1-G5。AI 草稿提供的报告对象永远不是门禁证据。
- 生产工作流自动化必须沿用所属模块的既有运行时；`generate-kb` 与 `generate-game-kb` 的 Controller、Hook 和紧耦合辅助逻辑使用 Node.js，不得仅为统一语言再引入第二套实现。没有既有运行时归属的独立仓库自动化默认使用 Python（`.py`）。PowerShell（`.ps1`）仅允许作为针对中间产物的、一次性的 Windows 本地辅助脚本；生产命令、技能、测试和发布路径不得依赖它。

---

## 测试要求

- 源测试必须覆盖 CRLF、中文标点、重叠窗口、哈希变化，以及原始文件/章节切分的分歧。
- 台账测试必须覆盖 JSONL 行错误、重复或未决的候选、无效拒绝，以及缺失的最终 ID。
- 门禁测试必须包含历史性的假通过（false-pass）固件，以及一个端到端的最小完整知识库。
- 最终数据测试必须覆盖缺失文件、非数组 JSON、缺失必填字段、无效枚举、条件富集、CLI 退出状态，以及过期的报告哈希。
- 引用测试必须拒收由真实前缀 + 捏造后缀拼成的引用。

---

## 代码评审清单

- 确认原始小说文件存在，且 `ch_split` 保持有序并与之一致。
- 确认全部三次扫描覆盖每个窗口，且最终缺口审计未发现有效新增。
- 确认 G4 报告按类别列出候选、keep/merge/redirect 决策、拒绝项及原因。
- 确认没有任何基线分数、数量阈值或总评分可被当作完整性的证明。

## 场景：game-kb 章节 Worker 文件边界

### 1. 范围 / 触发条件

- 触发：修改 `generate-game-kb` v7 章节 Worker 派发、接收、Hook 或恢复路径。
- 目标：Worker 只产生 Controller 指定的单个 YAML；仓库根目录已有临时文件不迁移，run 期间新增的 `.tmp-*` / `.temp-*` 文件必须可审计地隔离。

### 2. 签名

- `captureWorkerRootBaseline(paths) -> void`：新 run 创建时记录根目录临时文件名称。
- `reconcileWorkerRootTemps(paths, progress) -> warning[]`：活动输出具备接收条件时隔离新增条目；基线或隔离失败抛 `WORKER_SIDE_EFFECT_GUARD_FAILED`。
- `.agents/skills/generate-game-kb/scripts/root-temp-hook.js`：从 stdin 读取 `PreToolUse` 事件，命中明确根目录临时写入时输出 deny 结果。

### 3. 合同

- `paths.workerRootBaseline`：`<run>/diagnostics/worker-root-baseline.json`，包含 `version`、`repository_root`、`entries[]`。
- `paths.workerLeaks`：`<run>/diagnostics/worker-leaks/<incident>/`，保存被移动的原文件和 `incident.json`；成功收据为 `status: quarantined`，中途失败收据为 `status: failed` 并记录 `paths`、`moved`、`failed_path`、`error`。
- 正常 `run` 返回结构不增加字段；发生隔离时才附加 `warnings[]`，每项包含 `code: WORKER_SIDE_EFFECT_QUARANTINED`、`paths[]` 和相对 run 的 `incident_file`。
- Hook deny 使用 `hookSpecificOutput.permissionDecision = "deny"`；Hook 不承诺解析动态 Shell 路径，Controller 是结果兜底。

### 4. 校验与错误矩阵

| 条件 | 行为 |
| --- | --- |
| Worker input 的 `worker_contract.version` 不等于当前版本 | `WORKER_CONTRACT_STALE_RESTART_REQUIRED`，要求新 run |
| 根目录临时条目在 run 基线中 | 保留，不处理 |
| 新增条目且全部可移动 | 移入 `worker-leaks`，返回 `WORKER_SIDE_EFFECT_QUARANTINED`，继续接收 YAML |
| Worker 合同过期且存在新增临时项 | 先返回合同错误，不移动临时项、不创建 incident |
| 基线损坏或无法读取 | `WORKER_SIDE_EFFECT_GUARD_FAILED`，停止接收 |
| 隔离中途失败 | 写入 failed incident 收据，返回 `WORKER_SIDE_EFFECT_GUARD_FAILED`，停止接收 |
| Hook 无法静态判断为写入 | 放行，由 Controller 检查最终文件集合 |

### 5. 正常 / 基线 / 错误案例

- 正常：Worker 读取 `input_file`，写 `output_file`，递归重读 YAML；根目录集合不变。
- 基线：run 创建前已有 `.tmp-old.txt`，后续 run 始终保留该文件且不产生告警。
- 错误：Worker 绕过 Hook 创建 `.tmp-worker.js`；Controller 将它移动到 run 诊断目录并在同一次 `run` 继续处理合法输出。

### 6. 必测断言

- Hook：根目录 Write/Edit、`apply_patch`、简单管道/命令列表和明确重定向被拒绝；引号内控制字符、读取、删除、移出根目录和嵌套目录同名写入放行。
- Controller：基线文件被创建；新增文件被移动；历史文件不动；合同错误发生在隔离前；成功/失败 incident 可审计；告警 incident 在 run 完成归档后仍可定位；损坏基线停止。
- Worker：旧合同在 `run`、`status` 和接收前返回稳定错误码；当前合同保持 accepted/final 数据结构不变。

### 7. 错误与正确做法

错误：为 Worker 提供 `scratch_dir`，或在 Hook 中实现完整 Bash/PowerShell 解析器并把它当作唯一安全边界。

正确：Worker 保持单文件合同；Hook 只拦截明确写入；Controller 以 run 级基线和可恢复隔离作为权威兜底。

## 场景：溯源知识库门禁

### 1. 范围 / 触发条件

- 触发：创建或变更武侠知识库的抽取、证据验证、召回审计或完成门禁。

### 2. 命令签名

受管理运行使用单一控制器：

```text
node scripts/pipeline.js init <novel-dir> [--concurrency 1..4] [--risk-limit 1..15]
node scripts/pipeline.js status <novel-dir> --json
node scripts/pipeline.js run|claim|submit|check|advance <novel-dir> ...
node scripts/pipeline.js review-packet|record-review <novel-dir> ...
node scripts/pipeline.js build-publish|promote|rollback <novel-dir> ...
```

默认的高风险评审上限是 15，可下调到 10 或更低。超出配置上限的队列必须返回 AI 重跑状态；绝不能静默丢弃被省略的决策。

遗留诊断命令（包括下方的直接脚本）是只读 / `--dry-run` 的迁移工具。当存在活跃的受管理运行时，它们的写入路径必须以 `MANAGED_RUN_WRITE_FORBIDDEN` 失败。

- `node scripts/prepare-source.js <novel-dir> [--window-lines N] [--overlap-lines N]`
- `node scripts/validate-inventory.js <novel-dir>`
- `node scripts/validate-final-data.js <novel-dir> [--dry-run]`
- `node scripts/verify.js <novel-dir>`
- `node scripts/cross-validate.js <novel-dir>`
- `node scripts/audit-recall.js <novel-dir> [--legacy] [--dry-run]`
- `node scripts/assess-quality.js <novel-dir> [--report-only] [--dry-run]`

### 3. 契约

- 请求：`<novel-dir>/<novel-name>.txt` 及其派生的 `ch_split/*.txt` 文件。
- 中间产物位于 `build/generate-kb/runs/<run-id>/` 之下：仅追加的 `events.jsonl`、投影出的 `state.json`、packet/draft/receipt 工作项，以及 `materialized/{inventory,reconcile,enrich,semantic-audit}`。遗留根目录 `build/` 下的产物不是新运行的输入。
- `dialogue` 富集记录匹配已发布的对话 schema，因此不携带 `name`；`provisional_key` 将其绑定到调和决策。物化出的证据条目始终保留该键，但只有带有一个或多个已声明字段的条目才会成为 `semantic-evidence-audit` 工作项。
- 最终数据：全部八个具名的 `data/*.json` 文件都必须以数组形式存在，并满足共享 schema、富集、枚举、嵌套字段与证据字段契约。仅当契约允许时才允许类别特定的空数组；非空的语义检查要求至少一个角色、且至少一个核心/重要角色。
- 验证响应：发布暂存 `reports/final_data_validation.json` 包含分开的 `schema_errors` 与 `enrichment_errors`，外加 `final_data_hash`。`--dry-run` 必须保持相同退出状态而不写入报告。
- 新鲜度：`reports/verification_report.json.final_data_hash` 与 `reports/cross_validation_report.json.final_data_hash` 必须等于当前稳定的最终数据哈希。
- 响应：`quality_report.json` 包含独立的 G1-G5 结果；G4 明细按类别包含候选、保留、拒绝和未决条目。
- 人工金标准：仅当 `audit/gold.json` 具有 `provenance: human_curated`、当前 `source_hash`，且对每一项都有完整有据可依的证据时才接受。人工召回回执必须绑定当前 source/reconcile 哈希，且不能覆盖自动门禁失败。

### 4. 校验与错误矩阵

- 缺失原始小说或章节切分分歧 -> G1 失败。
- 缺失/未知窗口或结构上不完整的章节摘要 -> G1 失败。
- 未决候选、多重决策、无效拒绝，或缺失最终 ID -> G2 失败。
- 缺失/非数组的最终文件、骨架记录、无效枚举/嵌套字段、不完整的条件富集、缺失字段证据、验证文件错误，或缺失/过期的验证哈希 -> G3 失败。
- 未决缺口候选、无法解释的具名武功信号，或人工金标准不匹配 -> G4 失败。
- 无核心/重要角色、缺失针对主要事件或重要角色的对话/豁免、无效对话 schema、交叉引用错误，或缺失/过期的交叉验证哈希 -> G5 失败。
- 缺少合成 `name` 的对话富集记录 -> 当其临时键与对话 schema 通过时合法；冲突的临时键 -> 富集提交失败。
- 类别无被检查字段时的空字段 claim map -> 不产生语义工作项；畸形绑定或不含真实字段 claim 的审计集合 -> `SEMANTIC_AUDIT_INPUT_INVALID` 或 `SEMANTIC_AUDIT_EMPTY`。

### 5. 好/基准/坏 示例

- 好：当前源哈希、完整窗口覆盖、已闭环台账、完全富集的最终记录、新鲜验证/交叉验证哈希、完整证据、无最终缺口新增，且 G1-G5 全部 PASS。
- 基准：无人工资标准，但其他召回证据都闭环；报告 `gold_status: no_gold` 而不臆造召回率。
- 坏：因为字段缺失从而产出空检查集而通过；因为报告描述的是更旧的数据修订而通过；因为计数或 LLM 基线分数高而通过；或因为只有对话前缀匹配源而通过。
- 好的发布：仅含 token 的草稿、控制器生成的报告、所有报告哈希等于暂存的最终数据哈希，且失败的暂存验证会移除失败包而不改动 `.kb/current`。
- 好的语义规划：角色/技能/摘要的字段 claim 创建独立的审计项，而一个没有可检查描述字段的有效对话不会创建空洞项。
- 基准发布：验证或交叉验证返回阻塞发现；报告仍为诊断而物化，但 `BUNDLE_VERIFICATION_FAILED` 阻止已构建的包进入流水线状态。
- 坏的发布：接受含 `PASS` 的草稿 `report_inputs` 对象，或在不重新运行验证器的情况下将该对象重新绑定到新哈希。
- 坏的富集/审计：仅为了满足通用身份检查而添加超出 schema 的对话 `name`，或创建字段列表为空的语义审计工作项。

### 7. 发布报告信任边界

#### 命令签名

```text
node scripts/pipeline.js build-publish <novel-dir> --draft <publish-draft>
```

草稿 schema 为：

```json
{
  "schema_version": 1,
  "run_id": "run-...",
  "semantic_audit_hash": "sha256",
  "token_plan": {}
}
```

#### 契约

- 控制器先把投影数据写入一个临时暂存 `data/` 根。
- `verify.js` 与 `cross-validate.js` 以 `--data-root <staging-data> --expected-final-data-hash <hash> --dry-run --json` 运行。
- `quality_report.json` 由控制器基于这些结果和当前受管理阶段证据生成。全部六个必需报告文件随后在包验证之前绑定到同一个 `final_data_hash`。

#### 校验与错误矩阵

- 草稿位于受管理运行内、run/hash 错误、缺失 token 计划，或存在 `report_inputs` -> `PUBLISH_DRAFT_INVALID`（或对应的过期/路径错误）。
- 验证器无法返回 JSON -> `PUBLISH_REPORT_GENERATION_FAILED`。
- 验证器返回阻塞发现、过期报告哈希，或质量门禁失败 -> `BUNDLE_VERIFICATION_FAILED`；失败的暂存目录被移除。
- 只有已验证的包才能产出 `publish_bundle_built`；promote 额外检查 `expected-current`。

#### 必须的测试

- 仅含 token 的草稿基于暂存数据构建报告，并断言有据可依的引用、交叉验证错误计数，以及全部 G1-G5 PASS。
- 草稿提供的 `report_inputs` 在包构建前被拒收。
- 一个无据可依的暂存引用以 `BUNDLE_VERIFICATION_FAILED` 失败，且不留下失败暂存目录。
- 每个生成报告的 `final_data_hash` 等于清单哈希；过期的物化输入仍被阻止。
- 受管理 E2E 运行 `init -> inventory -> reconcile/review -> enrich -> semantic-audit -> staging -> promote -> rollback`，包含一个无 `name` 的对话和一个空对话 claim map；断言仅非空字段集被审计。

#### 错 vs 对

**错：** 接受一个 AI 提供的 `{ "quality_report": { "completion_gate_passed": true } }` 并附上当前哈希。

**对：** 拒收 `report_inputs`，针对临时投影数据运行验证器，从受管理证据推导 G1-G5，并在记录状态前验证所得包。

### 6. 必须的测试

- 单元：源归一化/匹配、候选/决策 schema、每个最终类别的非空洞记录契约、稳定哈希变化、CLI 成功/失败退出码，以及不可补偿的硬门禁。
- 回归：低召回的《连城诀》与弱证据的《天龙八部》快照必须失败于其预期的门禁。
- 集成：一个最小完整知识库可通过；移除一个最终文件、必填富集字段、报告哈希、原始文件、摘要证据、对话上下文或描述字段证据，会使对应门禁失败。

### 7. 错 vs 对

#### 错

让模型基于记忆做库存，再用前缀匹配和总评分声称完整性。

#### 对

从每个源窗口记录候选和完整引用，闭环每个决策，富集所有保留记录，运行 `validate-final-data.js`，重新生成哈希绑定的验证报告，然后由不可补偿的 G1-G5 门禁独立决定完成。

---

## 场景：快速游戏素材知识库 Profile

### 1. 范围 / 触发条件

- 触发：用 `.agents/skills/generate-game-kb` 快速生成面向游戏设计的武侠知识库。
- 这是一个独立 profile；上文审计级 `.agents/skills/generate-kb` 的六阶段状态机与 G1-G5 门禁保持不变。
- 当前可写合同是 `semantic_contract_version: 7` 与 `semantic_profile: chapter-direct-v1`。旧运行不迁移、不重写，只能只读检查或显式归档。

### 2. 命令签名

```text
node .agents/skills/generate-game-kb/scripts/flow.js run <novel-dir> [--run <run-id>] --json
node .agents/skills/generate-game-kb/scripts/flow.js status <novel-dir> [--run <run-id>] --json
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit <novel-dir> --run <run-id> --unit chapter:NNN --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js recover-relations <novel-dir> --run <parent-run-id> --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js archive-abandoned <novel-dir> --run <run-id> --json
```

正常成功路径只反复调用 `run`：它先接收已出现的章节输出，再返回当前允许分派的工作；全部章节接受后，控制器内部完成组装、验证、安装、已安装验证与归档。`status` 始终只读，不能创建目录或刷新元数据。

### 3. 契约

- 每个运行位于 `<novel-dir>/.game-kb-work/runs/<run-id>/`。公开结果固定包含 `semantic_contract_version`、`run_id`、`status`、`jobs`、`active_units`、`progress` 与 `manual_review`。
- 章节采用固定五章窗口，持久化不变量是 `active_units.length <= 5`。首个窗口没有全部 accepted 之前不补位；重复 `run` 返回 `waiting` 与 `jobs: []`。窗口全部 accepted 后，下一次 `run` 才签发后续窗口。
- 每个 job 恰好包含 `unit`、`cycle`、`attempt`、`producer`、`input_file`、`output_file` 与 `input_hash`。Worker 读取控制器生成的不可变 JSON input，并直接把单章 YAML 写到该 job 唯一的 `output_file`。
- 每个不可变 JSON input 都携带由 `createWorkerContract()` 新建的
  `worker_contract`（当前 `version: 3`）。它内嵌完整五字段 YAML skeleton、
  required/optional/nullable/forbidden 字段、逐字证据、闭合 taxonomy、关系闭环与
  producer-specific recursive preflight；跨宿主派发只依赖该 input，不依赖
  `.claude/agents/`、`schemas.md` 或隐式 Skill 上下文。
- Worker YAML 顶层恰好是 `characters`、`skills`、`items`、`factions` 与 `chapter_summary`。Worker 不复制章节身份、哈希、attempt、最终 ID 或控制器路径；这些字段只由控制器在接收时注入。
- Controller 在每次 `run` 开始时扫描当前 staging 输出，执行 path confinement、YAML 解析、精确字段、闭合枚举、源证据与章节身份校验。成功后写入规范 accepted YAML、登记 artifact ledger，并移走原始稿；accepted 字节和哈希在后续阶段不可变。
- 类型只允许受控 taxonomy 或类别内显式 alias。alias key 仅做 NFKC、小写化并移除空白、下划线和连字符；未知值以 `TYPE_VALUE_UNKNOWN` 拒绝，不做编辑距离、子串或跨类别猜测。`poison` 的明确合同是 `毒功`。
- 每个章节直接覆盖角色、带嵌套技法的技能、物品、势力与章节摘要。模型必须逐章扫描，保留具名实体及精确 `source_refs`，不能因频率或主线重要性主动漏掉候选，也不能写最终 ID。
- Worker 写前必须执行 `chapter_text.includes(name/ref.text)`；实体或 technique
  名还必须被自身至少一条引用逐字覆盖，摘要必须满足
  `chapter_summary.summary.trim() !== ""`。描述性短语不得概括为正式名称，
  引号、标点和原文措辞不得改写。
- Worker 的 `source_refs[]` 只写逐字 `text`，不得计算
  `chapter/line_start/line_end`。Controller 以 NFKC、换行和空白规范化后的全文命中
  为准，将最早命中位置映射回原始行区间并写入 accepted YAML；已签发旧 job
  自报的行号会被忽略和覆盖，不能把有效引用误判为 `SOURCE_QUOTE_NOT_FOUND`。

```yaml
# Worker output
source_refs:
  - text: "甲拔剑。"
# accepted projection
source_refs:
  - chapter: 3
    text: "甲拔剑。"
    line_start: 18
    line_end: 18
```
- `characters[].skills/factions` 与 `skills[].factions` 的每个关系名称必须精确
  解析到本次输出对应类别的候选名；否则补提取有据候选或省略关系，不能留下会在
  终态触发 `FINAL_REFERENCE_INVALID` 的悬空引用。
- 终态关系解析按正式名称、内部键、唯一别名的确定性优先级执行。未解析或多义关系
  生成绑定 source hash、artifact manifest hash 和来源章节的
  `reports/reference-recovery.json`，`run/status` 返回对应 `manual_review`。
- `recover-relations` 只接受带 `--confirm` 的有效 v7 父 run。它创建稳定命名的派生
  run，以子 run 自己的 immutable artifacts carry-forward 无关章节，只把报告映射的
  章节置为 pending；收据绑定父 run、报告、源、artifact manifest 和逐章恢复上下文。
- 每个 cycle 从 attempt 1 开始且最多两次。仅 allowlist 中的 YAML 语法类错误可生成一次 `main-agent-repair` attempt 2；机械修复者不能读取章节原文或改变语义。schema、taxonomy、证据或语义错误由章节 Worker 重做 attempt 2。第二次失败、重复错误或重复输出进入 `manual_review`；只有带 `--confirm` 的 `retry-unit` 才开启新 cycle。
- 拒绝稿唯一保存在
  `drafts/<unit>/cycle_<NN>/attempt_<NN>.yaml`；`revisions/` 只保存
  `attempt_<NN>.errors.json`。`main-agent-repair.rejected_draft` 必须指向前者并在
  签发测试中证明文件存在；repair input 携带同版本输出合同，但不得携带
  `chapter_text/source_file/source_hash/taxonomies`，也不得新增、删除或改写语义。
- 书级归并只在同类别、精确规范名称相同的候选之间进行；近似名、子串、拼音相同或语义相似都不授权自动合并。身份信号冲突进入人工复核，不能静默选边。
- 泛称过滤使用保守确定性规则；被过滤项不阻断发布，但必须以 `GENERIC_CANDIDATE_FILTERED` warning 记录类别、名称、章节、源证据、原因与 resolution。
- 稳定 ID 由控制器一次性规划。一个拼音 base 只对应一个规范中文名时不附加 hash；不同中文名发生 base 碰撞时使用基于规范名称的稳定摘要后缀，输入顺序和无关增项不得改变既有 ID。
- 确定性组装输出恰好五个顶层数组 YAML：`characters.yaml`、`skills.yaml`、`items.yaml`、`factions.yaml`、`chapter_summaries.yaml`。`final_data_hash` 必须由与五文件验证器相同的 `hashFinalData` 计算。
- `assembly-report.json` 记录字段决策、归并、过滤、稳定 ID 与 deterministic audit；`reports/game-kb-review.json` 只记录非阻塞 warning，并按 code/category 汇总。两者都绑定当前 `source_hash` 与 `final_data_hash`。
- `manual_review.json` 始终写入；读取旧 lite 产物时，缺失文件表示没有待处理项，缺少旧 assembly 字段会跳过对应 stale check，不得把不存在的 candidate registry 当作失败。
- 工作区验证检查五文件精确 shape、YAML 数组、ID、枚举、摘要覆盖、嵌套技法、引用闭环、accepted 不可变性、报告新鲜度与零未决人工复核。章节数不少于 5 且四类实体去重总数不超过 9 时以 `LOW_RECALL` 阻断安装。
- 安装使用兄弟暂存和目录交换，失败时恢复旧数据。安装回执绑定语义版本、源哈希、验证报告哈希、最终数据哈希、章节列表、精确五文件集合及每个文件的原始 SHA-256；已安装验证不回退到工作运行。
- 正常运行不得在仓库根目录或 `.kb-scratch` 创建章节碎片、临时清洗/转交脚本、原始传输文件或修复日志；失败稿与 revision 只能留在 run 私有目录。

### 4. 校验与错误矩阵

- 多个活跃运行且未显式选择 -> `RUN_AMBIGUOUS`；不能隐式选择或归档。
- 对旧运行执行 `run` 或 `retry-unit` -> `LEGACY_SEMANTIC_CONTRACT`，且运行树保持字节不变。
- staging 路径越界、job 身份不匹配、Worker 写入禁止字段或整章证据无效 -> 整章拒绝；不产生 accepted 产物，不增加 accepted 进度。
- taxonomy 未知值 -> `TYPE_VALUE_UNKNOWN`；只能显式补 alias 表，不能猜测归类。
- attempt 1 失败 -> 依据错误类别创建唯一 attempt 2；attempt 2 再失败 -> `manual_review`，窗口不继续推进。
- repair input 指向 `revisions/*.yaml` 或文件不存在 -> `The rejected draft file is missing`；这是 Controller 路径所有权错误，必须让 input 指向 `drafts/*.yaml`，不得复制原文或放宽 repair 隔离来掩盖。
- 实体名没有被自身引用覆盖 -> `SOURCE_NAME_NOT_FOUND`；引用不是原文逐字子串 -> `SOURCE_QUOTE_NOT_FOUND`；空摘要 -> `SUMMARY_TEXT_REQUIRED`。
- Worker 行号缺失、错误或类型无效 -> 忽略模型坐标并从全文命中派生；逐字 `text`
  不存在仍以 `SOURCE_QUOTE_NOT_FOUND` 拒绝。accepted/终态中的行区间继续严格校验。
- 关系名称在书级候选中无法精确解析 -> `FINAL_REFERENCE_INVALID`；不得静默删除 accepted 关系或按相似度猜测目标。
- `recover-relations` 缺少确认、报告/收据哈希过期、父 artifact 变化、源变化或章节集合
  不一致 -> fail closed；新建子 run 初始化失败时删除该半成品子 run，不触及父 run。
- accepted 文件或 artifact ledger 哈希漂移 -> `ACCEPTED_ARTIFACT_MUTATED`；组装、验证与安装停止。
- 精确同名候选身份冲突 -> `IDENTITY_COLLISION_REVIEW_REQUIRED`；不得自动合并。
- 缺失章节摘要、普通物品误收、未命名技法、未决引用、无效审查报告或未决人工复核 -> 工作区验证失败。
- 章节数不少于 5 且四类实体去重总数不超过 9 -> `LOW_RECALL`；阻断安装与归档，短篇豁免。
- 五文件缺失、多余、畸形、schema 无效，或 `source_hash` / `final_data_hash` 过期 -> 验证失败。
- 安装移动前后的任意失败 -> 恢复旧 `data/` 与 review report；不能留下半安装状态。

### 5. 好/基准/坏 示例

- 好：第一次 `run` 为六章语料只返回 1–5；没有输出时重复调用返回 `waiting`；五个输出全部接受后才返回第 6 章，最终安装五个 YAML 与当前 review report。
- 好：Worker 只写 job 的 `output_file`；Controller 注入身份、登记 accepted artifact、确定性归并、规划 ID 并验证安装。
- 好：Qoder、Claude Code 或其他宿主只读 job input 即可得到同一完整
  `worker_contract`，递归验证嵌套字段、逐字证据和关系闭环后再写输出。
- 好：Worker 只提交逐字引用，Controller 生成 accepted 行号；终态关系失败可在用户
  确认后派生仅重开来源章节的 recovery run，父 run 全目录字节保持不变。
- 基准：一个有据可依的具名技法没有可证明的父技能关系；保持 null 关系，而不是编造引用。
- 基准：泛称被过滤并出现在 warning report；书仍可发布，Dashboard 可按需解释该 warning。
- 坏：窗口内刚完成一个章节就补发第 6 章、让 Worker 写最终 ID/证据行号、按相似度
  合并实体、验证时手工修补 accepted YAML，或在仓库根目录生成辅助脚本。

### 6. 必须的测试

- 公共命令：只暴露 `run`、`status`、`retry-unit`、`recover-relations`、
  `archive-abandoned`；旧运行写入 fail-closed，显式废弃归档保持原字节。
- 固定窗口：25 章首次只返回 1–5；重复调用和仅完成 1–4 个输出时都不得暴露第 6 章；第五个完成后才返回下一窗口。
- 直写接收：Worker 直接写 `output_file`；覆盖路径约束、attempt 身份、机械修复 allowlist、语义重试、第二次失败人工复核与 accepted artifact ledger。
- Job input：两种 producer 都携带独立 `worker_contract` 对象；断言完整 skeleton、
  必填/禁止字段、`includes` 检查、非空摘要、递归 `source_refs`、闭合 taxonomy、
  自身证据覆盖、关系闭包、Controller 派生行号和 producer-specific preflight；repair
  继续隔离章节源字段。覆盖错误旧行号、无行号、跨行、CRLF、NFKC 与空白规范化。
- Repair 路径：断言 `rejected_draft === drafts/.../attempt_<NN>.yaml` 且文件存在，
  error report 仍位于 `revisions/`。
- 类型合同：覆盖机械 key 归一化、显式 alias、未知值拒绝和 `poison -> 毒功`。
- 确定性组装：覆盖精确名称归并、身份冲突人工复核、泛称 warning、稳定 ID 碰撞、字段决策 audit，以及重复组装字节稳定。
- 关系恢复：覆盖正式名称优先、唯一/多义别名、来源章节报告、确认门禁、稀疏五章
  窗口、carry-forward artifact、父 run 不变、报告/父 artifact 篡改、中断恢复、
  初始化清理，以及恢复 run 完成 assembly/install/archive。
- 验证与安装：覆盖五文件精确 shape、`hashFinalData` 一致性、低召回、报告新鲜度、原子回滚、安装回执与已安装只读验证。
- 端到端：六章跨过首个窗口并完成安装；断言恰好五个 YAML、`reports/game-kb-review.json`、无 `.kb-scratch`、无根目录章节碎片或运输辅助脚本。

### 7. 错 vs 对

#### 错

把固定窗口实现成滚动补位，把输出路径、最终身份或证据行号交给 Worker；只在外部
文档写 schema 却不给 job input；让 repair 去 `revisions/` 找拒绝 YAML；静默删除
悬空关系；或另建清洗/转交阶段来掩盖无效章节。

#### 对

只反复调用 `run`，严格等待整个五章窗口 accepted；每个 job input 内嵌完整
`worker_contract`，Worker 递归 preflight 后直写唯一 staging 文件；Controller
从全文验证逐字引用并派生 accepted 行号，从 `drafts/` 签发机械 repair、原子接收并
登记不可变 accepted artifact、确定性组装五文件；终态关系失败生成来源章节报告，
用户确认后创建不改父 run 的派生 recovery run，并在安装前通过引用闭环、完整验证
与 review report 新鲜度门禁。

---

## 场景：遗留知识库（无原地迁移）

### 1. 范围 / 触发条件

- 触发：小说已安装遗留 JSON / YAML 知识库，或仍保留旧语义运行。
- 遗留已安装数据可由 Dashboard 只读消费；旧运行不在原地迁移、续跑或修补。

### 2. 受支持路径

- 旧运行的 `status` 只读，`archive-abandoned` 仅在用户明确选择后原样归档；其他写入命令在修改前 fail-closed。
- 要进入当前写入合同，必须从原始小说创建全新运行并重新抽取。成功安装以原子目录交换保留此前数据，不导入旧运行中间产物。

### 3. 校验与错误矩阵

- 旧运行写入 -> `LEGACY_SEMANTIC_CONTRACT`；全部证据保持不变。
- 未显式确认的人工重试或废弃归档 -> 拒绝，不改变运行状态。
- 新运行安装失败 -> 恢复此前已安装目录和报告。

### 4. 必须的测试

- 断言旧状态查询不写文件，旧运行写入 fail-closed，显式废弃归档保留原树。
- 断言全新运行不读取旧中间产物，安装前后失败都能恢复旧数据。

### 5. 错 vs 对

#### 错

把旧运行升级到当前 schema、从旧终态反推 accepted 章节，或静默覆盖已安装数据。

#### 对

保留旧证据并只读展示；需要新合同能力时从原始小说重新抽取，通过当前验证后原子安装。
