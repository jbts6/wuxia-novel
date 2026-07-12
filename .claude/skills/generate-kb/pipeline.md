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
node "$SKILL/scripts/verify.js" "$NOVEL"
node "$SKILL/scripts/cross-validate.js" "$NOVEL"
node "$SKILL/scripts/audit-recall.js" "$NOVEL"
node "$SKILL/scripts/assess-quality.js" "$NOVEL"
node "$SKILL/scripts/generate-summary.js" "$NOVEL"
```

### G1-G5

- G1 Source Coverage：当前 source hash、三类窗口 100% 覆盖、每章恰好一个结构完整的 summary。
- G2 Ledger Closure：所有候选闭环，保留项可追到 final ID，reject 合法。
- G3 Evidence Integrity：正式实体与章节摘要有 grounded ref，描述字段有独立证据，对话及上下文全文 100% 命中，grand weak/unverified 为 0。
- G4 Recall Evidence：最终 gap round 无有效新增，词法信号有解释，命名武学闭环，可选人工 gold 命中。
- G5 Semantic Coverage：主要事件和核心/重要角色对话覆盖，cross-reference/schema 无阻塞错误。

## 旧知识库迁移

只读诊断：

```bash
node "$SKILL/scripts/audit-recall.js" "$NOVEL" --legacy --dry-run
node "$SKILL/scripts/assess-quality.js" "$NOVEL" --report-only --dry-run
```

旧数据缺少新证据时应失败，这是“尚未证明完整”，不是自动判定数据错误。不要为通过门禁直接修改现有小说数据；先补 source/ledger/gap 产物，再按原文决定是否重生成。
