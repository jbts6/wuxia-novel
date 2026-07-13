# generate-kb 六阶段流水线

设 `$SKILL=.agents/skills/generate-kb`，`$NOVEL=<作者>/<小说名>`，`$CLI=$SKILL/scripts/pipeline.js`。新 run 的唯一写入入口是 `scripts/pipeline.js`；下列命令都通过该控制器执行。

## 恢复原则

任何会话先读取机器状态：

```bash
node "$CLI" status "$NOVEL" --json
```

只执行返回的 `next_action`，完成后再次读取状态。不得凭聊天记录猜测进度，不得一次串行执行整本书，也不得直接调用旧脚本推进状态。原文或上游 output hash 改变时，下游 PASS、lease、draft 和人工 receipt 自动失效。

## 六个有序阶段

| 阶段 | 允许输入 | 受管输出 | 硬门禁 |
|---|---|---|---|
| `prepare` | 小说原文、章节切分配置 | source index、scan plan、source hash | 章节对齐、窗口覆盖、hash 一致 |
| `inventory` | 当前 hash 的 source packets | candidates、事件/对白候选、章节摘要草稿、窗口 receipts | 每个窗口有实际输出或结构化零产出原因 |
| `reconcile` | 当前 candidates、source packets | decisions、provisional entities/events、gap-audit rounds | 候选闭环、主要人物召回、类别规则、最终 blind gap round 无有效新增 |
| `enrich` | 已通过 reconcile 的 provisional records、证据 packets | 无正式 ID 的八类丰富草稿、字段级证据 | 完整字段、无占位内容、共享证据说明有效 |
| `semantic-audit` | 当前 enrich 与 reconcile outputs、原文证据 | 独立语义审计报告、可执行失败清单 | speaker、豁免、事件参与者、类别、召回和字段证据全部通过 |
| `publish` | 已通过 semantic audit 的同一组 hashes | ID plan、staging bundle、manifest、版本 receipt | 正式数据、引用、报告 hash、bundle 完整性与并发保护全部通过 |

从 `prepare` 到 `semantic-audit` 不得写 `data/*.json` 或任何正式数据，也不得生成正式 ID。正式 ID 只在 `publish` 一次生成，并由同一 ID plan 投影到记录和全部引用。

## 单一命令面

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
pipeline.js promote <novel-dir> --bundle <bundle-hash> --expected-current <hash-or-none>
pipeline.js rollback <novel-dir> --bundle <bundle-hash> --expected-current <hash>
```

- `run` 最多执行当前阶段的一个确定性控制器动作。
- `advance` 只在当前门禁 PASS 后切换阶段，不执行下一阶段工作。
- 所有失败必须非零退出，并保留当前阶段、稳定 error code 和修正建议。
- `status --json` 是跨会话恢复的唯一机器接口。

## Work Item 协议

`inventory`、`reconcile` 和 `enrich` 强制分批。每批严格使用 `claim -> draft -> submit`：

1. `claim` 只领取状态机确定的下一 work item，并生成只读任务包；任务包必须同时绑定 stage、work item ID 和 input hash。
2. AI 只读取任务包列出的 source/provisional 输入，只写任务包指定的非受管 draft 路径。
3. draft 必须回显 packet binding。实际没有候选时提交结构化 `empty_output_reason`，不能用空文件、占位对象或只登记 completed ID 代替。
4. `submit` 校验 stage、work item ID、input hash、lease、schema、证据和阶段规则；全部通过后才原子合并到受管产物并生成 receipt。
5. 提交失败不部分写入；修正同一个 draft 后重交。陈旧、重复、越阶段或非当前 work item 一律拒绝。

AI 不得直接编辑 `events.jsonl`、`state.json`、work item 状态、candidate/decision ledger、`materialized/`、`.kb/`、`data/` 或 `reports/`。

默认并发为 1，最多配置为 4。只有不重叠的 `inventory` 窗口和 `enrich` 实体批次可并发 claim；其他阶段及 review、promote、rollback 独占。合并顺序按稳定 work item ID，不按提交先后。

## 阶段执行与停止条件

### `prepare`

`run` 建立 source index 与 scan plan。新 run 只读取原文和章节，不读取旧 `data/*.json`、baseline 或百科。source/chapter 不一致时停止在 `prepare`。

### `inventory`

每个窗口分别按 `prompts/named-inventory.md` 与 `prompts/event-dialogue.md` 生成 draft。窗口 receipt 记录 candidate count、chapter-summary count、empty reason 和 output hash；缺少任一项即不能通过。

### `reconcile`

按稳定候选簇归并 canonical name、`final_category`、importance 与 keep/merge/redirect/reject decision。此阶段只产生 provisional key。blind gap audit 使用 `prompts/gap-audit.md`，看不到已有 candidates、decisions 或最终数据；发现有效新增时继续当前阶段，不得提前 enrich。

长篇小说通过自动门禁后必须停止并生成 recall review packet。packet 只展示主要角色/事件/武学、章节异常、疑似漏项和高风险裁决，不展示全量账本。

### Recall Review

高风险裁决上限默认最多 15 项；用户可把上限降至 10 项或更低。超过当前上限时不得截断或丢弃未展示项，必须由 AI 继续复核、修正或确定化后重新生成 packet。

人工使用 `record-review` 提交 `accept_recall`、`rerun_recall` 和逐项结论。receipt 绑定 source hash、reconcile output hash、decision ID 与 reviewer；绑定对象变化即失效。没有有效的长篇 recall receipt 时，不能 claim `enrich`。

### `enrich`

按类别和稳定实体批次补全复杂字段及 `field_source_refs`。骨架记录、同义反复、`X。`、`X的招式。`、`来历不明` 等占位句直接失败。三个或以上语义不同字段复用同一证据组默认报 `evidence_padding`；合法共享必须逐字段提交 `shared_evidence_justification`，留待下一阶段独立复核。

### `semantic-audit`

独立检查主要角色、事件参与者、skill/technique/item 分类、字段证据、共享证据说明、persona/both speaker 与语义豁免。发现上游问题时生成明确 remediation transition，使相关下游状态失效；不得在审计报告中直接补数据。

### `publish`

`build-publish` 从当前 run 的 `materialized/reconcile`、`materialized/enrich`、`materialized/semantic-audit`、source index 和 recall packet 读取受管输入并重算 hash；不接受外部预制 bundle。`--draft` 指向受管目录之外的 publish draft，只携带绑定当前 `run_id`/`semantic_audit_hash` 的 token plan，出现 `report_inputs` 立即拒绝。控制器验证 draft 和全部上游产物后，在隔离 staging 目录生成 ID plan 和八类 JSON，再对这些 staging data 实际运行 verification、cross-validation，并根据当前 source、final-data、recall、semantic 结果确定性生成 G1-G5 quality report，最后生成 manifest。bundle 必须先在目录内自验证；失败时删除未通过的 staging bundle，当前 `data/`、`reports/` 和 `.kb/current` 逐字节不变。

`promote` 复验 bundle，并比较 `expected-current`。通过后将完整 bundle 放入 `.kb/versions/<bundle-hash>/`，再原子替换唯一指针 `.kb/current`；逻辑 `data/` 与 `reports/` 始终解析到同一版本。`rollback` 同样先复验目标 manifest，再切换指针并生成 receipt。

## 完成门禁

完成必须由 `status --json` 与 `check` 共同证明：六阶段均 PASS、publish 已 promote、G1-G5 和所有报告绑定当前 final data hash、无未提交 work item/陈旧 lease/失效 receipt/未处理高风险项。任何条件失败都停在状态机指定位置，不得靠数量、总分、人工口头确认或直接编辑 JSON 放行。

## Legacy 诊断

旧 baseline、旧多 pass prompts 以及直接写 `build/`/`data/` 的命令只允许在非 managed run 中做明确的只读诊断或迁移。它们不参与新 run；输出不能合并为受管产物，也不能证明阶段完成。
