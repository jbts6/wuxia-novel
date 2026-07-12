# 原文先行的四阶段流水线

设 `$SKILL=.agents/skills/generate-kb`，`$NOVEL=<作者>/<小说名>`。所有生成事实只来自 `$NOVEL/<小说名>.txt` 与它切分出的 `ch_split/`。

## 1. Prepare Source

若尚无 `ch_split/`，先运行既有章节切分：

```bash
node "$SKILL/scripts/split-chapters.js" "$NOVEL"
```

生成稳定章节内行号、source SHA-256 和重叠窗口：

```bash
node "$SKILL/scripts/prepare-source.js" "$NOVEL"
```

产物：

- `build/source-index.json`
- `build/scan-manifest.json`

原文或 `ch_split/` 改变后必须重跑。不得沿用旧 hash 下的 candidates、decisions 或人工 gold。

## 2. Inventory From Source

对 `source-index.json` 的每个 window 分别运行两次低负担扫描：

1. 读取 `prompts/named-inventory.md`，提取命名实体。
2. 读取 `prompts/event-dialogue.md`，提取事件和代表性原话。

每次只给模型当前 window 和章节内起止行号，不提供现有 `data/*.json`、baseline、百科或其他窗口的总结。将结果逐行追加到 `build/candidates.jsonl`，并在 `scan-manifest.json` 对应 pass 的 `completed_window_ids` 中登记窗口。

扫描原则：

- 命名武功与招式全部进入候选，不做重要性截断。
- 物品重点关注秘笈/图谱、信物、兵器、药物、钥匙和推动事件的普通物品。
- 对话必须带 `selection_type_hint`、选择理由与可定位的上下文原文；不要按每章固定数量凑数。
- 每章只生成一个 `chapter_summaries` 候选或最终记录。

完成两类扫描后运行：

```bash
node "$SKILL/scripts/validate-inventory.js" "$NOVEL"
```

此时 G2/G4 尚未完成可以失败，但 named-inventory 和 event-dialogue 不得再有漏扫窗口。

## 3. Reconcile And Enrich

读取 candidates 及其关联的原文窗口，先归并后丰富：

1. 统一名称与别名。
2. 区分 skill（体系/功法）与 technique（明确的一招一式）。
3. 为每个候选写 `build/decisions.jsonl`：keep、merge、redirect 或 reject。
4. 将事件归入 `build/events.json`，主要事件标记 `importance: main`。
5. 只用候选证据窗口补充最终八类 JSON 的复杂字段。

第 5 步不是可选润色。完成归并后必须运行：

```bash
node "$SKILL/scripts/validate-final-data.js" "$NOVEL"
```

只有 `reports/final_data_validation.json` 的 `passed: true` 才算完成 Stage 3。仅写入 `id`、`name`、`source_refs` 的骨架记录必须失败；缺失文件、字段、枚举、嵌套结构或条件 enrich 也必须失败。龙套/背景等允许低细节的情况按 schema 条件规则保留空值，不得为过门编造原文没有的信息。

武功/招式禁止因 `non_major` 或 `trivial` reject。类别错误用 redirect；同名重复用 merge/duplicate；原文证据不足用 not_source_grounded。

对话最终记录必须包含 `id`、`selection_type`、`selection_reason`、`context` 及其章节内起止行号。`event|both` 必须关联 `event_id`，`persona|both` 必须包含 `trait_tags`。无法找到事件或人物特征原话时，将有证据的原因写入 `build/semantic-exemptions.json`，不得静默跳过。

## 4. Independent Gap Audit And Gate

再次逐窗口读取原文，使用 `prompts/gap-audit.md`。该轮不能看到已有 candidates 或最终 JSON。新候选仍追加到 `candidates.jsonl`，`discovery_pass` 固定为 `gap-audit`。

每轮写入：

```json
{"rounds":[{"round":1,"completed_window_ids":["ch001_w001"],"new_candidate_ids":["cand_..."]}]}
```

若发现有效新候选，回到 Stage 3 归并，再做一轮独立 gap audit。最多两轮；最后一轮必须没有 keep/merge/redirect 的新候选。

依次运行：

```bash
node "$SKILL/scripts/validate-inventory.js" "$NOVEL"
node "$SKILL/scripts/validate-final-data.js" "$NOVEL"
node "$SKILL/scripts/verify.js" "$NOVEL"
node "$SKILL/scripts/cross-validate.js" "$NOVEL"
node "$SKILL/scripts/audit-recall.js" "$NOVEL"
node "$SKILL/scripts/generate-review-packet.js" "$NOVEL"
node "$SKILL/scripts/generate-summary.js" "$NOVEL"
```

### G1-G5

- G1 Source Coverage：当前 source hash、三类窗口 100% 覆盖、每章恰好一个结构完整的 summary。
- G2 Ledger Closure：所有候选闭环，保留项可追到 final ID，reject 合法。
- G3 Evidence Integrity：八类文件和记录满足最终数据契约，条件 enrich 完成；正式实体与章节摘要有 grounded ref，描述字段有独立证据，对话及上下文全文 100% 命中，verification 无文件错误、hash 对应当前数据且 grand weak/unverified 为 0。
- G4 Recall Evidence：最终 gap round 无有效新增，词法信号有解释，命名武学闭环，可选人工 gold 命中。
- G5 Semantic Coverage：至少有一名核心/重要角色，主要事件和核心/重要角色对话覆盖，cross-reference/schema 无阻塞错误，cross-validation hash 对应当前数据。

### AI 自筛与审核就绪

`generate-review-packet.js` 同时更新 `quality_report.json`、`review_packet.json` 和 `review_packet.md`。G1-G5 的 `completion_gate_passed` 语义保持不变，人工审核就绪另用三态表示：

- `blocked`：G1-G5 至少一项失败，先修硬门禁。
- `needs_ai_rerun`：G1-G5 已通过，但数量合理性、候选保留率或高风险队列异常，AI 必须先返工。
- `ready_for_human_review`：AI 自筛结束，可以交付紧凑人工审核包。

长篇定义为章节数不少于 30，或原文不少于 12000 行。以下是返工报警，不是完整性证明：

- 最终 skill + technique 少于 10：阻止人工终审，扩大武学召回；10-19 给 warning。
- 最终 item 少于 5：阻止人工终审，重扫剧情物品；5-7 给 warning。
- skill + technique 或 item 候选不少于 20，但保留率低于 10%：阻止人工终审，复审 reject，防止过度删除。
- 高风险裁决超过 10 个：先由 AI 逐条复核，在 decision 的 `ai_review.status` 写 `confirmed|revised|needs_human`，直到人工队列压缩到 10 个以内。

AI 根据异常类型自动回到 Stage 2 或 Stage 3，重跑校验和审核包。不得为了越过阈值凭空补实体；所有新增仍需原文候选、decision 和证据闭环。

### 单本执行与集中批审

每本书独立保存 source hash、质量报告和审核包，不建立跨书共享完成状态。AI 可以连续跑五六本；人工有空时只需依次查看各书 `review_packet.md` 并选择 `accept`、`rerun_recall`、`rerun_precision` 或 `manual_investigation`。任何一本要求重跑，不影响同批其他书。

## 旧知识库迁移

只读诊断：

```bash
node "$SKILL/scripts/audit-recall.js" "$NOVEL" --legacy --dry-run
node "$SKILL/scripts/assess-quality.js" "$NOVEL" --report-only --dry-run
```

旧数据缺少新证据时应失败，这是“尚未证明完整”，不是自动判定数据错误。不要为通过门禁直接修改现有小说数据；先补 source/ledger/gap 产物，再按原文决定是否重生成。
