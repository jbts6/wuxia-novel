# 流水线详细步骤

`NOVEL=<小说目录>` · `SKILL=.agents/skills/generate-kb`

## Phase 1：split + compact-mention

```bash
node $SKILL/scripts/split-chapters.js "$NOVEL"
node $SKILL/scripts/compact-mention.js "$NOVEL"
```

产出：`ch_split/`、`build/manifest.json`、`build/mention_index.jsonl`、`build/mention_summary.json`

**split-config.json**（可选，优先级：novel 根 → build/ → prompts/）

```json
{
  "chapterPattern": "^第[零〇○一二三四五六七八九十百千\\d]{1,8}[回章]\\s*.*$",
  "numberPattern": "^第([零〇○一二三四五六七八九十百千\\d]{1,8})[回章]",
  "seedPatterns": ["角色A|角色B", "门派", "地名", "武功"]
}
```

**Gate**：章数合理，manifest 与 ch_split 一致。

## Phase 1.2：keywords

输入：manifest、mention_summary、原文采样（前3+中2+末2）。  
输出：`build/keywords.json`（字符串数组，长词优先，≥50）。  
模板：`prompts/generate-keywords.md`。

**Gate**：含本书核心专名。

## Phase 1.5：outline

`data/outline.json`：characters / factions / locations / skills 骨架。模板：`prompts/outline.md`。

## Phase 1.7：独立 baseline（Pass1 前）

```bash
node $SKILL/scripts/generate-baseline-prompt.js "$NOVEL"
# LLM 写入 build/baseline.json
```

**必须**

- 角色分档 core/important/secondary/minor（**短名单 15–25**，勿抄 data 全量）
- `relationships` ≥15，`importance` 英文：`core|important|secondary`
- `events` ≥20（按章号 key），`importance` 英文：`main|branch|detail`
- `dialogues` ≥10，quote 能在原文命中；勿整表复制 data/dialogues
- 可选：factions、skills、items、expected_entity_counts

**禁止**：从 `data/*.json` 生成 baseline。  
**比例**：`|bl_ids ∩ kb_ids| / |kb_ids|` 宜在 **0.50–0.84**（≥0.85 记 copy 警告）。

门禁：`baseline_mode=invalid_self_ref` 时金标 overall = N/A。

## Phase 1.6 / 1.6.5：prompt-craft + 校验

读 `prompts/prompt-craft.md` + manifest/mention/采样 → 写出 `$NOVEL/prompts/`：  
`outline.md`、`pass1-entities.md`、`pass2-details.md`、`review-all.md`。

**1.6.5**：校验章节号、事件分配、角色列表；修张冠李戴后再 Pass1。

## Phase 2 Pass1：五实体

输出：`characters|factions|locations|skills|techniques.json`  
然后：

```bash
node $SKILL/scripts/fix-relationships.js "$NOVEL"
node $SKILL/scripts/extract-keywords.js "$NOVEL"
```

（Pass2 后必须再跑 extract-keywords，否则 locate 难匹配角色名 anchor。）

## Phase 3 初轮

LLM 的 source_refs 章节常错。locate 前：对 `not_located` 在全文搜实体名并修正 chapter（可用脚本或批处理；**无**独立 `fix-chapter-refs.js` 时手动/临时代码即可）。

```bash
node $SKILL/scripts/locate.js "$NOVEL"
node $SKILL/scripts/verify.js "$NOVEL"
node $SKILL/scripts/report.js "$NOVEL"
node $SKILL/scripts/cross-validate.js "$NOVEL"
node $SKILL/scripts/check-skill-items.js "$NOVEL"
```

**Gate**：尽量 locate≥95%；errors 清零（≤3 次修复循环）。

## Phase 2 Pass2：items + chapter_summaries

- 按章读 `ch_split`；禁纯标题模板  
- items：`tags` + `rarity_tier`（勿全「未知」）  
- summaries：`key_events` 须能在该章命中关键词  

## Phase 2.6：实体审核

见 `review.md`（广撒网 → 精挑选；skills vs items）。

## Phase 2.2：chapter_summaries 交叉验证

`key_events` 与原文错位则修正后再抽对话。

## Phase 2.5：dialogues

1. LLM 读原文 + 事件锚定批量提取  
2. 输出字段：**`text`**（原文）、`speaker`（id）、`speaker_name`、`tone`、`chapter`  
3. `verify_dialogues.js`（可选）  
4. **必做**：

```bash
node $SKILL/scripts/locate-dialogues.js "$NOVEL"
```

兼容遗留字段 `quote`（会规范为 `text`）；全文找不到的条目删除。

**Gate**：quote 原文命中 ≥95%。

## Phase 3 完整 + 3.5

重跑 locate/verify/report/cross-validate/check-skill-items。

```bash
node $SKILL/scripts/review-dialogues.js "$NOVEL"
# + LLM reviewer → review/review-result.json
```

不通过条件：`review.md`。

## Phase 3.6：质量评估

```bash
node $SKILL/scripts/assess-quality.js "$NOVEL"
```

| 轨道 | 字段 | 条件 |
|------|------|------|
| 金标 | `overall_score` | 独立 baseline + rel + events |
| 诚实 | `honest_overall_score` | 始终 |

**完成**：`completion_gate_passed === true`。

注意：`namesMatch` 对 1–2 字泛称（剑/刀/毒…）不做子串匹配，避免假 purity。

## Phase 3.7：总览

```bash
node $SKILL/scripts/generate-summary.js "$NOVEL"
```

## 最终检查

- [ ] 8 JSON 可解析  
- [ ] verify/cross-validate 无阻塞 error  
- [ ] completion_gate PASS，honest≥85  
- [ ] baseline 非 invalid_self_ref  
- [ ] summary.md 存在  
