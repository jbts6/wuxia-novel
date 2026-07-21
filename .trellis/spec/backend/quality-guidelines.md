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
- 作为生产工作流一部分、由仓库维护的自动化必须使用 Python（`.py`）。PowerShell（`.ps1`）仅允许作为针对中间产物的、一次性的 Windows 本地辅助脚本；生产命令、技能、测试和发布路径不得依赖它。

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
- 这是一个独立的 profile。上文审计级的 `.agents/skills/generate-kb` 状态机与独立的 G1-G5 门禁保持不变。
- 快速 profile 证明的是"以章节为扎根的已接受证据"与"确定性的候选闭环"。它不声称达到审计级的召回完整性或 G1-G5 完成度。

### 2. 命令签名

```text
node .agents/skills/generate-game-kb/scripts/flow.js prepare <novel-dir> --run <run-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js extract-plan <novel-dir> --run <run-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js submit <novel-dir> --run <run-id> --unit chapter:NNN --attempt <n> --json < envelope.json
node .agents/skills/generate-game-kb/scripts/flow.js plan-domains <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js assemble <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js verify <novel-dir> --run <run-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js install <novel-dir> --run <run-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js verify <novel-dir> --installed --json
node .agents/skills/generate-game-kb/scripts/flow.js archive-run <novel-dir> --run <run-id>
node .agents/skills/generate-game-kb/scripts/flow.js run <novel-dir> --run <run-id>   # 编排整条流水线，端到端
```

正常阶段顺序是 `prepare -> extract-plan -> submit*（章节） -> plan-domains（可选，--deep） -> assemble -> verify -> install -> verify --installed -> archive-run`。`run` 命令自动编排这一切；主模型负责路由与串行接受，用户只需提供小说目录和一个可选的 `--deep` 标志。

### 3. 契约

- 当前可写合同为 `semantic_contract_version: 6` 与 `semantic_profile: domain-distill-v1`。版本 5 及更早的运行仅为观察性证据，并以 `LEGACY_SEMANTIC_CONTRACT` 使每个写入路径失败；不允许原地升级。遗留书目只能通过全新的、基于源的重新抽取进入当前契约，绝不导入旧产物。
- Worker 只返回恰好一个 JSON 信封，绝不序列化或写入任何产物。控制器拥有的暂存草稿、已接受证据和最终消费者数据使用规范的 YAML；控制器状态、worker 输入、清单、回执、报告和提交信封使用 JSON。
- 每个运行位于 `<novel-dir>/.game-kb-work/runs/<run-id>/` 之下。只有控制器可以把一个已验证信封序列化到当前 `<unit>_attempt_<attempt+1>.yaml`、更新 attempt，或创建已接受证据；已接受字节是不可变的，并绑定在 `artifact-manifest.json` 中。`accept --draft` 仅为兼容用途，不是正常的 Worker 路径。
- `extract-plan` 为每个章节暴露一个独立的 `chapter:NNN` 单元。不存在分组身份；每个 Worker 恰好读取一个源章节（一个绝对只读的 `source_file`）并恰好返回一个信封。控制器序列化并接受 YAML；Worker 永远看不到任何可写路径。`古龙/剑神一笑` 是真实语料固件：20 章、20 个平铺的单章单元。
- 并发是一个简单的五路滚动池。Worker 返回 null 或传输失败的结果会被跳过，且不消耗一次 attempt；下一个排队的章节立即开始。一次明确的平台 429 会把池降到 3 并保持到运行结束；重复的 429 不会中止运行，仍保持 3。
- `submit` 从 stdin 读取 Worker 信封，校验 unit/attempt/input-hash 身份，并在一个事务内写入规范的 YAML 草稿与已接受证据。跳过校验的直接库调用必须以零进度、零暂存、零已接受产物变更而失败。因为 `ch_split` 是确定性的、且 Worker 永不写入产物，所以不需要独立的前置阶段；上述 `submit` 内的检查就是唯一的输入校验。
- 章节单元直接读取一整个完整的源章节，产出角色、带嵌套技法的技能、物品、势力，以及一份章节摘要。角色的 `identities/factions/skills` 与技能的 `aliases/types/factions` 都是数组。角色绝不携带 `items`；技能绝不携带 users/holders；物品绝不携带 owners/holders；势力绝不携带 members。技法始终嵌套在技能之下，且需要一个显式具名的源招式。
- 实体高召回是强制要求，不是可选优化。章节单元必须逐章穷尽扫描整段原文：凡是原文中有明确可定位命名、且能绑定 `source_refs` 的具名实体——包括具名角色（含一次性出场、别名、化名、化身）、具名武功及其显名招式、具名物品、具名势力——都应作为候选抽出，不得因"看起来不重要"或"与主线无关"而丢弃。抽取阶段只负责穷尽候选并保留证据；重要性排序是 `rank` 的职责，合并与去重是 `--deep` 领域阶段的职责，章节阶段不得主动合并或去重。禁止让模型凭记忆或印象而非逐窗口扫描来产出实体，也禁止把同章多次出现的实体只保留其一而丢失其余。完整性以"每个章节窗口都被覆盖、每个保留实体都有据可依的证据"判定，不以实体总数阈值判定；但多章小说的低召回门禁见下方校验矩阵。
- `plan-domains` 确定性地构建候选登记表与恰好四个领域工作单元。四个领域相互独立，可并发处理。规范顺序 `distill:factions`、`distill:characters`、`distill:skills`、`distill:items` 仅用于展示与报告。
- 单一技能不得绕过候选规划。在所有章节都被接受之后、且当前尚不存在候选登记表/领域计划之前，`plan-domains`（仅在 `--deep` 下调用）创建或验证不可变的登记表与计划。默认模式下，零个全书领域单元、也没有 `domain_jobs`；`--deep` 保留全部四个必需的领域单元。
- 每个领域 Worker 恰好处理一个 `distill:*` 单元，读取控制器生成的只读 `worker-input.json`，不接收任何可写路径，并只返回一个 JSON 信封。控制器在规范的 YAML 序列化、暂存、接受和 attempt 记账之前，校验章节与领域信封。
- 角色与技能工作项绑定全部控制器下发的全书 `source_files` 以及一份 rank 契约。Rank 是一个完整时间线上的稳定判断，而不是单章最强刻画：后续的直面胜、负、克制、逆转会覆盖早期的赞誉；仅凭传闻与地位无法支撑高 rank。证据不足的记录保持 `rank: null` 而不进入 manual review。
- 完全一致的显示名与完全一致的拼音 slug 绝不授权自动语义合并。全书领域决策决定 keep/merge，而控制器拥有的身份锚点和持久化的字母摘要后缀用于消除冲突的 ID。重命名、别名、输入顺序和不相关的增项都不得改变既有实体的 ID。
- 角色与技能输入暴露确定性的、仅含势力的 `allowed_faction_refs` 集合，且该集合参与 input hash。非空的 `patch.faction` 必须属于该集合；未知引用或来自其他类别的可见既有引用，在写入已接受证据之前被拒。
- 角色与技能的势力引用保持晚绑定，直到 `assemble`——它在四个领域决策全部存在之后解析别名与合并。
- 每个领域条目恰好收到一个 keep、同类 merge、带有限原因的 reject，或 pending 决策。pending、缺失、重复、跨类、循环、过期或 unresolved 的决策会阻塞组装。
- `assemble` 消费所有已接受章节、恰好四个已接受领域决策，以及候选登记表。它一次性解析决策与引用、一次性分配稳定 ID，然后原子地投影出恰好五个顶层数组 YAML 文件：`characters.yaml`、`skills.yaml`、`items.yaml`、`factions.yaml`、`chapter_summaries.yaml`。
- 最终字段仅来自 `semantic-contract.js`。技法仍嵌套在 `skills[].techniques[]` 之下；最终消费者记录省略 `source_refs`。
- 已接受的 YAML 是不可变证据。工作区验证重新验证该证据，并通过 `assembly-report.json` 绑定它——其中的已接受哈希、决策哈希、候选闭环、计数与最终数据哈希必须与当前字节一致。
- `verifyDataRoot` 校验任意五文件数据集的文件名与字段精确性、YAML 数组、ID、枚举、摘要覆盖、嵌套技法名、稳定哈希，以及引用闭环。
- 工作区 `verify` 额外证明章节/领域证据、已接受不可变性、普通物品排除、候选闭环、报告新鲜度，以及零未决 manual review。它仅在通过后写入 `verification-report.json`。
- 常规验证没有补充阶段、采样门禁，或二级游戏素材投影。但它包含一个书级低召回门禁：对于章节数 ≥5 的小说，若四份终态文件去重后的实体总数 ≤9，验证报告标记 `recall: fail` 并阻断安装与归档，要求对该小说重新抽取，而不是发布残缺知识库；短篇（<5 章）豁免此门禁。
- 安装采用兄弟暂存与目录交换（带回滚）。安装回执 schema 2 绑定语义版本、源哈希、验证报告哈希、最终数据哈希、章节列表、精确的五文件集合，以及 `data_file_hashes`：全部五个已安装 YAML 文件的"文件名到原始 SHA-256"精确映射。Schema-1 回执 fail-closed，且必须由安装重新生成，而不是通过兼容回退读取。
- 已安装验证只读已安装数据、安装回执和已安装验证报告。它绝不回退到工作区产物。
- Worker 池起始为 5，在明确遇到 429 时降到 3；池永不中止运行。
- 每个 AI 单元周期有恰好一次初始验证提交，以及至多一次自动重试。失败的第二次提交、重复输出，或重复的验证错误会进入 `manual_review`。只有用户确认的 `retry --confirm` 才能开始一个新的有界周期。
- `status --json` 恰好返回一个 `next_action`；AI 阶段也返回规范排序的 `next_units`，其中 manual review 优先于可执行动作。
- 恢复与归档通过规范的只读五文件验证器检查当前工作区 `final/data`。被改动、缺失、多余、畸形、schema 无效、引用无效、摘要不完整或哈希不匹配的工作区 YAML 会使当前组装边界失效；状态路由到 `assemble` 而不写入。
- 归档前，`archive-run` 要求工作区验证报告 `passed: true` 且当前 `source_hash` 与 `final_data_hash` 匹配。`verification_report_hash` / `archive_receipt_hash` / `id_plan_hash` / `manifest_hash` 的漂移是警告，不是阻塞；只有 `source_hash` 与 `final_data_hash` 封锁完成。
- 代表性的编排证据使用真实的 `buildRunMetrics` 实现，覆盖 21 个章节单元加 4 个领域单元。每个原始单元至多两次提交，总时长至多 `2,700,000ms`（45 分钟），且 prepare/章节/领域/组装/验证/安装/归档的时长均为正。该时序证据不替代真实的源/证据/验证/安装/归档集成路径。

### 4. 校验与错误矩阵

- 多个活跃运行 -> `RUN_AMBIGUOUS`；绝不隐式选择或归档某一个。
- 写入路径上缺失或不同的语义版本 -> `LEGACY_SEMANTIC_CONTRACT`；保留全部证据。
- 畸形的 Worker 信封、错误的 schema 版本，或错配的 unit/attempt/input 哈希 -> `SUBMISSION_ENVELOPE_INVALID`、`SUBMISSION_SCHEMA_VERSION_MISMATCH` 或 `SUBMISSION_IDENTITY_MISMATCH`；不写入暂存、已接受证据或进度状态。这些只是 `submit` 内的普通输入检查，不是独立的前置阶段。
- 未知的 `patch.faction` -> `DOMAIN_REFERENCE_UNKNOWN`；既有的但非势力、或其他未授权的引用 -> `DOMAIN_REFERENCE_UNAUTHORIZED`。两者都阻塞已接受证据的创建。
- 已接受哈希不匹配 -> `ACCEPTED_ARTIFACT_MUTATED`；组装、验证与安装停止。
- 领域覆盖不完整，或 pending/循环/无效决策（在 `--deep` 下）-> 组装失败；保留先前的最终目录。
- 缺失章节摘要、无效源证据、普通物品 keep、未命名技法、未决引用、过期的组装回执，或未决的 manual review -> 工作区验证失败。
- 对于章节数 ≥5 的小说，四份终态文件去重后的实体总数 ≤9 -> `LOW_RECALL`；工作区验证失败，阻断安装与归档，要求重新抽取该小说；短篇（<5 章）豁免。
- 缺失、多余、畸形或 schema 无效的终态 YAML -> 五文件验证失败。
- 缺失或过期的验证报告/安装回执、缺失/畸形的 `data_file_hashes` 映射、任意已安装文件原始哈希不匹配（含仅字节级的 YAML 漂移），或章节列表不匹配 -> 已安装验证失败，且无工作区回退。
- `id_plan_hash` / `verification_report_hash` / `manifest_hash` / `archive_receipt_hash` 的漂移是警告，不是阻塞失败；只有 `source_hash` 与 `final_data_hash` 封锁完成。
- 安装移动之前或之后的任意失败都会恢复先前已安装的目录。

### 5. 好/基准/坏 示例

- 好：主模型恢复所选可写运行，为每个章节分派至多五个 sub-agent（每章一个信封），让控制器序列化并接受 YAML，然后（在 `--deep` 下）在组装、验证、安装、已安装验证和归档之前，为每个领域单元分派一个只读 `worker-input.json`。
- 好：用不变的已接受证据重跑 `assemble` 会产生字节一致的文件和相同的 `final_data_hash`。
- 好：角色/技能工作只在 `allowed_faction_refs` 中暴露势力引用；归档绑定通过的 workspace 验证报告哈希。
- 基准：一个基于源的具名技法没有源中声明的父技能；保持 null 关系。每个非空关系都必须可解析。
- 基准：当源中不含有效实体时，类别数组可以为空；完整性由已接受章节证据与已闭环决策证明，而不是靠计数。
- 坏：让 AI 分配最终 ID、改动已接受 YAML、接受 pending 决策，或在验证期间修补语义数据。
- 坏：自动合并完全一致的显示名或完全一致的拼音 slug、把伪装标签当作角色身份的证据，或把单章最强主张当作最终 rank。
- 坏：恢复被移除的类别、多发出一个消费者文件、在没有当前回执的情况下安装，或通过读取工作运行来验证已安装数据。
- 好（高召回）：逐章穷尽扫描原文，具名角色（含一次性出场与别名/化名/化身）、具名武功与其显名招式、具名物品、具名势力全部作为候选抽出并各自绑定 `source_refs`；多章小说最终实体数为数十量级而非个位数。
- 坏（低召回）：让模型基于印象而非逐窗口扫描产出实体、把"看起来不重要"的具名角色/招式/物品丢弃、或在章节阶段就主动合并而丢失同章多个实体，导致中篇小说最终仅个位数实体。

### 6. 必须的测试

- 技能契约：断言 `run` 编排、YAML/JSON 边界、正常阶段顺序、`--deep` 下可选四个领域单元、恰好五个终态文件，以及没有已删除的旧投影。
- 章节规划：断言 `extract-plan` 为每个章节返回一个平铺 `chapter:NNN` 单元（无分组身份）、五路并发、null 结果跳过且不消耗 attempt、以及明确 429 时池降到 3。
- 提交校验：断言 `submit` 只做命令内的输入校验（信封形状、schema 版本、unit/attempt/input-hash 身份），没有独立的前置阶段；且畸形/身份错误的信封会以 `SUBMISSION_ENVELOPE_INVALID`/`SUBMISSION_IDENTITY_MISMATCH` 抛出，而不写入暂存或已接受证据。
- 章节/领域契约：断言源证据、具名技法规则、普通物品原因、精确决策覆盖、合法合并、哈希化的仅含势力的 `allowed_faction_refs`、在接收前拒绝未知/未授权势力引用，以及禁止的私有/最终 ID。
- V6 语义契约：断言章节/领域/终态 schema 中的数组字段、统一的 `description`、禁止的 holder/member/user/item 链接、在全书决策前保持分离的精确同名候选、持久的 ID 消除歧义后缀，以及全书证据不足时 `rank: null`。
- 真实语料：通过生产的 `prepare`/`extract-plan` 读取 `古龙/剑神一笑/剑神一笑.txt`，断言 20 章、20 个平铺单章单元（无分组形态）、中文绝对路径保留、Worker 看不到可写路径、五文件组装、工作区验证、安装、已安装验证和归档。
- 确定性组装：断言 pending/缺失/循环决策失败（在 `--deep` 下）、引用一次性闭环、章节摘要投影为 `{ chapter, title, summary }`、原子回滚有效、且重复组装字节稳定。
- 工作区验证：断言精确字段/文件、YAML 解析、ID/枚举、摘要覆盖、嵌套技法、引用闭环、已接受不可变性、候选闭环、证据、普通物品排除，以及新鲜报告哈希。
- 安装：断言只暂存五个文件、先前的整个数据目录被归档、回执通过 `data_file_hashes` 绑定每个当前 YAML 文件的精确原始 SHA-256、缺失/错误映射与仅字节漂移使已安装验证失败、移动前/后失败回滚、重装幂等，且已安装验证无工作区回退。
- 集成：把章节（以及 `--deep` 下的四个领域单元）跑过 `prepare -> extract-plan -> submit* -> assemble -> verify -> install -> verify --installed -> archive-run`；断言归档回执与恰好五个已安装 YAML 文件。
- 哈希门禁：断言完成只需 `source_hash` 与 `final_data_hash`；`id_plan_hash` / `verification_report_hash` / `manifest_hash` / `archive_receipt_hash` 的漂移是警告，不是阻塞失败。
- 低召回门禁：断言章节数 ≥5 的小说若最终四文件去重实体总数 ≤9，必须以 `LOW_RECALL` 使工作区验证失败并阻断归档；重新抽取且实体数达标后才通过；短篇（<5 章）豁免此门禁。
- 高召回抽取：断言 `extract-plan` 后每个章节单元都被要求穷尽扫描、具名实体（含一次性出场、别名/化名、显名招式、具名物品/势力）作为候选抽出并各自绑定 `source_refs`，且抽取阶段不主动合并/去重。

### 7. 错 vs 对

#### 错

把已经删除的多阶段闸门、分组代理或提交日志机制改名保留，在每次提交时扫描整个仓库，或在安装回执里只列出五个文件名而不绑定每个已安装文件的原始字节。

#### 对

把章节展开为每章一个信封的单元（无分组身份），并发分派至多五个 sub-agent，让 `submit` 只做命令内输入校验（无独立前置阶段，因为 `ch_split` 是确定性的且 Worker 永不写入），让控制器验证并序列化每个 YAML 产物，跑真实的 verify/install/installed-verify/archive 路径，在归档前要求通过的验证报告哈希，并把全部五个已安装 YAML 的字节哈希绑定到 `data_file_hashes`。

---

## 场景：遗留知识库（无原地迁移）

### 1. 范围 / 触发条件

- 触发：某本小说已经装好了一个遗留的 JSON 或旧版本 YAML 知识库。
- 原地迁移与审计子系统、遗留暂存均已移除。遗留 JSON 知识库不被原地升级。

### 2. 受支持路径

- 要把一本遗留书目带入当前契约，重新运行完整的快速 profile：`prepare -> extract-plan -> submit* -> assemble -> verify -> install`。快速 profile 是基于源的，所以重新抽取才是受支持路径，且不依赖遗留证据。
- 在全新运行之前，`prepare` 会归档任何既有的活跃 `data/`，使先前的产物保存在 `_archive/` 之下，永不被静默覆盖。

### 3. 校验与错误矩阵

- 不经重新抽取就试图把遗留 JSON 跑过当前控制器的写入路径，必须以 `LEGACY_SEMANTIC_CONTRACT` 失败；全部遗留证据被保留。
- 对已有遗留数据的书目启动全新运行时，必须在写入新产物之前归档旧的 `data/`。

### 4. 必须的测试

- 断言遗留 JSON 写入路径以 `LEGACY_SEMANTIC_CONTRACT` fail-closed 并保留遗留树。
- 断言 `prepare` 在新运行开始前归档既有的活跃 `data/`。

### 5. 错 vs 对

#### 错

保留一个从遗留 JSON 重新派生实体的旧迁移命令，或用新运行静默覆盖活跃的遗留 `data/`。

#### 对

把遗留写入路径 fail-closed、保留遗留树、并要求一次全新的基于源的重新抽取；在新运行写入之前归档旧的 `data/`。
