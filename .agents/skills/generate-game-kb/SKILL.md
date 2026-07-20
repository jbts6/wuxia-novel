---
name: generate-game-kb
description: Use when building the complete source-grounded v4 wuxia game knowledge base from a novel, including chapter extraction, domain distillation, verification, installation, and archival.
---

# generate-game-kb v4

这是完整的 v4 流程。小说原文是唯一事实来源；accepted、证据和最终知识数据由 controller 序列化为 YAML，控制器状态、Worker envelope 和审计信息使用 JSON。所有子代理只读输入并返回 JSON，禁止写文件；路径选择、序列化、验证和状态推进全部由 controller 负责。

## 语义合同

- 可写 run 使用新的 `semantic_contract_version: 6`、`semantic_profile: domain-distill-v1` 和 `profile: v4`。版本 5 及更早的旧 run 只能查询、迁移或显式归档。
- 旧合同 run 只能查询状态或显式归档；任何继续写入都必须失败并报告 `LEGACY_SEMANTIC_CONTRACT`，不得原地升级。
- 所有中间路径都位于小说目录内。中文作者目录、中文书名目录和空格不会改变路径合同；命令参数必须整体加引号。

## 最终产物

成功安装的 `<novel>/data/` 必须恰好包含以下五个 YAML 文件，供 Dashboard 读取：

```text
data/
├── characters.yaml
├── skills.yaml
├── items.yaml
├── factions.yaml
└── chapter_summaries.yaml
```

最终字段来自 `schemas.md`：人物包含 `id/name/aliases/identities/level/rank/description/factions/skills`；武功包含 `id/name/aliases/types/factions/rank/description/techniques`；物品和势力包含 `id/name/aliases/type/description`；章节摘要包含 `chapter/title/summary`。最终文件不保留 source_refs，source_refs 必须存在于 YAML 草稿和 accepted 证据中。

run 内必须生成并通过以下控制器产物：

- `final/reports/assembly-report.json`：五文件组装结果、输入闭包和 `final_data_hash`。
- `final/reports/verification-report.json`：原文哈希、证据闭包、引用闭包、schema 和最终哈希验证结果。
- `artifact-manifest.json`：accepted YAML 与控制器元数据的相对路径、输入哈希和内容哈希。
- `<novel>/reports/generate_game_kb_install.json`（合同名称 `install-receipt.json`）：安装位置、五文件哈希、`source_hash`、`final_data_hash` 和 verification report 哈希。
- `<novel>/_archive/generate-game-kb/<run-id>/archive-receipt.json`：归档目录、artifact-manifest 哈希、verification report 哈希、final data 哈希、id plan 哈希和可选 `migration_receipt_hash`。

只有 `verification-report.json` 通过、安装收据绑定五文件哈希和 `final_data_hash/id_plan_hash/verification_report_hash`、`verify --installed` 通过、再由 `archive-run` 写入归档收据，才算完成。任何哈希漂移、缺文件、引用悬空或证据缺失都阻断完成；rank 证据不足时可以为 null，不因 null 自动进入 `manual_review`，只有不可调和的 rank 冲突才阻断。

## 完整生命周期

```text
archive-existing
→ prepare
→ 2-3 章 controller 调度 batch → 单章零写入 Worker → guarded submit-draft
→ 可选 basic-curate
→ plan-domains
→ 四个单域零写入 Worker（可并发生成，主模型串行 submit-draft）
→ assemble
→ verify
→ install
→ verify --installed
→ archive-run
```

每个阶段完成后先读取 `status --json`，只执行 controller 返回的一个 `next_action`、`next_units`、`chapter_jobs` 或 `domain_jobs`。正常 Worker 生命周期固定为 `status -> guard-open -> worker message -> guard-check -> submit-draft via stdin -> status`。子代理不得创建、修改、移动或删除任何文件或目录；`submit-draft` 内部是 controller 唯一的 Worker envelope 序列化与 accepted 写入入口。

## 动态章节作业

- controller 把相邻 2 至 3 章组成一个调度 batch，总长度不超过 36,000 个中日韩字符；超长单章或尾章可以独立成 batch。
- status 把每个调度 batch 展开为单章 Worker assignment。
- 同一 `batch_id` 可有 2 至 3 个 assignment；每个子代理只接收一个 descriptor、只处理一章、只返回一个 JSON envelope。
- Worker descriptor 只含只读绝对 `source_file` 和 controller 身份字段，明确给出 `worker_write_paths = []`，不含 `staging_path`、输出目录或文件名。
- 子代理不得创建、修改、移动或删除任何文件或目录，不得调用 controller 或脚本。主代理也不得创建临时草稿或改写 envelope。
- 每个窗口选择前 `concurrency_limit`（并发上限）个不同 `batch_id` 的全部 descriptor；正常最多 15 章，降级最多 9 章。`worker_pool.halted` 时不得派发。
- 提取前，主代理为窗口内每个 batch 打开一个 guard，并保留 `batch_id` 到 `guard_id` 的映射。Claude Code 使用项目 Workflow `game-kb-chapter-extract(run_id, prompt_file, descriptors, concurrency_limit)`；其他平台使用等价的原生滚动子代理池。
- 有排队 descriptor 时保持 `worker_pool.concurrency_limit` 个活跃 Worker；任一 Worker 返回后槽位释放，立即派发下一章。等待窗口全部 Worker 返回；全部 guard 检查完成以前不得提交任何 envelope。
- 主代理按原始 `chapter_jobs` descriptor 顺序串行提交有效 envelope，并使用对应 batch 的 guard。任何 broker 拒绝、身份过期、重放冲突或命令失败都停止剩余提交并刷新 status。
- 空或缺失 Worker 结果属于传输失败，不提交且不消耗 attempt；其他完整结果仍可在全部 guard 干净后提交。并发上限正常为 5、降级为 3；只有明确 429 才执行 `worker-backoff`，不得从空结果推断 429；第二个不同 batch 在 3 并发再次明确 429 时停止 Worker 池。
- `古龙/剑神一笑/剑神一笑.txt` 的 20 章仍形成七个 controller 调度 batch，批次大小为 `[3, 3, 3, 3, 3, 3, 2]`，但 status 必须暴露 20 个单章 Worker assignment。

```text
章节提取：game-kb-chapter-extract 滚动池，每个 agent 只处理一章
领域蒸馏：四个只读领域 Worker 可以并发生成
所有 controller submit-draft：仅主模型串行执行
```

章节 YAML 顶层只能包含 `schema_version/chapter/title/source_hash/characters/skills/items/factions/chapter_summary`。四类候选和摘要都必须有可核验的 `source_refs`；不确定字段写 null 或省略。人物的 `identities/factions/skills` 与武功的 `aliases/types/factions` 都是数组；招式嵌套在 `skills[].techniques[]`，每个招式只保留原文明确名称和可核验的 `description`。

并发池的 controller 策略保持 `5 → 3`；明确 429 以外的传输失败不触发退避，也不消耗提交次数。

## 四域蒸馏

`plan-domains` 生成且仅生成以下四个独立 unit：

`distill:factions`、`distill:characters`、`distill:skills`、`distill:items`。

四域可以并发生成 envelope，但每个子代理只处理一个 `domain_jobs[]`。Worker 只读取 controller 生成的 `worker-input.json` 及其中签发的 `source_files`，`worker_write_paths = []`，不得读取 controller 私有路径或写文件。主模型为每个域分别打开/检查 guard，再按固定展示顺序把原样 envelope 经 stdin 交给 `submit-draft`。人物和武功必须按章节顺序完整读取全部原文后定级；证据不足时 rank 为 null 或省略。

最终 rank 是完整时间线上的稳定判断，不取某章最高描写。后期直接战果、真实失败、被克制和反转优先于早期吹捧；当场行动优先于旁观评价；传闻、自述和身份光环不能单独支持高 rank。人物 rank 表示全书结束时仍可支持的综合战力；武功 rank 表示可靠使用者实际展示且未被后文推翻的稳定上限。具体八级标尺以工作项内 controller 注入的 `rank_contract` 为准。

武功的 techniques 必须来自原文明确定名内容，物品只保留允许的关键类别，势力合并同名实体并保持稳定 ID。人物和武功的 `factions` 引用延迟到 `assemble` 统一解析。Worker 返回 JSON envelope；controller 校验 `draft` 后序列化并写入 YAML accepted 证据。

旧的 pending 人物/武功工作项若尚未提交、缺少全书输入，只能由主代理在用户确认后调用 `refresh-domain-work --confirm` 重新签发。该命令只接受 `attempts: 0` 的 `distill:characters` 或 `distill:skills`；不得手改 input、hash、plan 或 progress，也不得刷新已 accepted 的域。

## 有界失败与恢复

每个 unit 的一个周期包含首次提交和最多 1 次自动重试，等价于最多 2 次提交。JSON envelope 解析错误与语义错误共用同一提交预算；第二次失败、重复输出或重复验证错误进入 `manual_review`，不得自动安排第三次。controller 必须保留拒绝 envelope、canonical YAML 草稿、提交记录和错误记录。

用户确认后可以开始新的有界周期；`retry-unit` 和兼容的 `reset-unit` 都必须带 `--confirm`。新的周期仍最多 1 次自动重试，controller 只签发新的 attempt 和只读 Worker 身份，不向子代理暴露写入路径。

```text
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --confirm --json
```

`unit` 是通用工作单元，不只指章节；例如 `chapter:001` 是章节，`distill:characters` 是人物域。`manual_review.json` 的 suggested_action 使用同一命令格式。

## 用户命令与真实示例

以下示例中的 run、batch、unit、attempt 和 guard ID 必须来自 controller；不要让 AI 猜动态标识符，也不要把 envelope 写入临时文件。

```text
node .agents/skills/generate-game-kb/scripts/flow.js archive-existing "C:\git\wuxia-novel\古龙\剑神一笑" --archive-id before-run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js guard-open "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --json
node .agents/skills/generate-game-kb/scripts/flow.js guard-check "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js submit-draft "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --batch chapter-batch-001-003 --unit chapter:001 --attempt 1 --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js basic-curate "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --skip --json
node .agents/skills/generate-game-kb/scripts/flow.js plan-domains "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js refresh-domain-work "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit distill:characters --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js guard-open "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit distill:characters --json
node .agents/skills/generate-game-kb/scripts/flow.js submit-draft "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --batch domain-batch-characters --unit distill:characters --attempt 1 --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js assemble "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js install "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --installed --json
node .agents/skills/generate-game-kb/scripts/flow.js archive-run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
```

`status --json` 返回零写入的 `chapter_jobs` 或 `domain_jobs`。主代理只能把单个只读 descriptor/input 交给对应子代理，并原样转发返回的 envelope。`archive-run` 前不得手动复制、重命名或删除 `data/`、accepted 或 rejected draft。

## 旧知识库审计与确定性迁移

旧 JSON 升级只能使用 controller 的只读审计和确定性迁移，不得重新提取小说或让模型补写字段。中文作者、书名和路径可以直接传给 Node，无需改名。

```text
node .agents/skills/generate-game-kb/scripts/audit-v6.js "C:\git\wuxia-novel" --output ".trellis\tasks\07-19-audit-v6-knowledge-bases\reports"
node .agents/skills/generate-game-kb/scripts/flow.js migrate-legacy "C:\git\wuxia-novel\<author>\<book>" --run migration-<book>-v6 --from "C:\git\wuxia-novel\<author>\<book>\data" --json
node .agents/skills/generate-game-kb/scripts/flow.js migrate-legacy "C:\git\wuxia-novel\<author>\<book>" --run migration-<book>-v6 --from "C:\git\wuxia-novel\<author>\<book>\data" --staging-root "C:\git\wuxia-novel\.game-kb-migration-staging\<author>\<book>" --confirm --json
```

不带 `--confirm` 的 `migrate-legacy` 只返回 plan 且不得写入；mutation 模式必须同时提供 `--run`、`--staging-root` 和 `--confirm`。本命令不是 Worker 工作单元，`--unit` 不适用。若迁移失败，旧 payload 只保留在 `_archive/<run>-legacy/`，活动 `data` 不得恢复；直接执行报告中的 `retry_command`，它会用同一 run ID 和 archive 来源继续。

## 路径与安全边界

```text
<novel>/.game-kb-work/runs/<run-id>/
├── source/{original.txt,chapters/}
├── staging/<unit>_attempt_<NN>.yaml
├── drafts/<unit>/attempt_<NN>_<hash>.yaml
├── accepted/chapters/ch_001.yaml
├── accepted/domain-decisions/distill_characters.yaml
├── final/data/characters.yaml
├── final/data/skills.yaml
├── final/data/items.yaml
├── final/data/factions.yaml
└── final/data/chapter_summaries.yaml
├── final/reports/{assembly-report.json,verification-report.json}
├── artifact-manifest.json
├── progress.json
└── manual_review.json
```

`staging/` 是 controller 私有实现目录，不能暴露给 Worker。子代理不得写任何文件、生成脚本、修改 `attempt` 或调用 controller；只有 controller 可以在 broker 事务中写入并消费 staging。拒绝 envelope 和草稿证据始终保留。

## 阻断条件

不可调和的 rank 冲突、招式没有原文命名依据、普通物品进入物品库、source_refs 章节号不匹配、稳定 ID 或引用闭包不完整、输入或 accepted 哈希漂移、安装验证失败、连续失败进入 `manual_review`，都必须停在当前阶段并报告可执行恢复命令；单纯缺少 rank 不属于阻断条件。
