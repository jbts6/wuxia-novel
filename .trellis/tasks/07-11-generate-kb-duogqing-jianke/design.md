# Design: generate-kb 多情剑客无情剑

## Overview

在 `古龙/多情剑客无情剑/` 内按 generate-kb 流水线从原文生成 8 核心 JSON + baseline + 报告 + summary。LLM 先验生成实体/摘要/对话，脚本负责 split、mention、locate、verify、评估；baseline 独立于 data，用于金标轨。

## Boundaries

| 层 | 职责 | 不负责 |
|----|------|--------|
| 原文 + ch_split | 唯一事实源 | 不写入 data 外业务逻辑 |
| build/* | 中间产物：manifest、mention、keywords、baseline | 不作为最终交付 |
| data/* | 8 个知识库 JSON | 不生成 baseline |
| prompts/* | 本书专属生成/审核 prompt | 不替代 schemas |
| scripts (skill) | 确定性校验与定位 | 不替代 LLM 内容生成 |
| reports/review | 质量与对抗审阅输出 | 不修改实体除非有明确修复步骤 |

## Contracts

### 输入

- `古龙/多情剑客无情剑/多情剑客无情剑.txt`
- Skill：`.agents/skills/generate-kb/{pipeline,schemas,constants,review}.md` + `scripts/*` + `prompts/*`

### 输出（最终）

```
古龙/多情剑客无情剑/
├── data/          # 8 JSON
├── build/         # manifest, mention_*, keywords, baseline, ...
├── ch_split/
├── prompts/       # 本书专属
├── reports/
├── review/
└── summary.md
```

### Schema / ID

- 以 `schemas.md`、`constants.md` 为准（entity id 前缀、rank、relation type、event_type 等）。
- 每个实体：`source_refs: [{chapter, anchor, event_type, ...}]`，行号由 locate 回填。
- `items.json`：必有 `tags`；`rarity_tier` 不得全「未知」。

### Baseline（Phase 1.7）

- 路径：`build/baseline.json`
- 必含：characters（分档）、relationships≥15、events≥20、dialogues≥10（quote 可原文命中）
- 可选：factions、skills、expected_entity_counts
- 生成：`generate-baseline-prompt.js` + LLM 写入；**禁止**从 data 拷贝

### Quality gate

`assess-quality.js` 双轨：

- 诚实轨（始终）：honest_overall≥85、entity grounded≥85%、dialogue quote≥95%、entity_quantity≥80%、baseline 非 invalid_self_ref
- 金标轨（独立 baseline 时）：overall 目标≥95% + 各单项门槛

**完成定义**：`completion_gate_passed === true`

## Data flow

```
txt
 → split-chapters + compact-mention
 → keywords (LLM) + outline
 → baseline (独立 LLM)
 → prompt-craft (+ 校验)
 → Pass1: 5 实体 JSON → fix-relationships → extract-keywords 刷新
 → locate/verify/cross-validate/check-skill-items（循环至达标）
 → Pass2: items + chapter_summaries
 → 实体审核 (review.md 广撒网→精挑选)
 → chapter_summaries 交叉验证
 → dialogues (LLM 读原文) → locate-dialogues 删幻觉
 → 完整 Phase3 + 3.5 对抗 + 3.6 assess + 3.7 summary
```

## Tradeoffs

| 选择 | 理由 | 代价 |
|------|------|------|
| 全文流水线单任务 | 交付是整体 completion_gate | 会话长；需 checkpoint 与防循环 |
| 独立 baseline | 金标可信 | 额外 LLM 轮次 |
| dialogues 读原文 | 防幻觉 quote | 按批处理，耗时长 |
| 复用飞刀目录结构/配置形态 | 同作者、已验证 | 关键词/回目需按本书改写 |

## Compatibility / Rollout

- 仅写入本书目录；不改其他小说 data。
- 若 split 失败：调整 `split-config.json`（chapterPattern 已支持「回」）后重跑 Phase 1。
- 若 locate <95% 或 errors>0：修 source_refs/keywords/实体后重跑 Phase 3（最多 3 次）。
- 回滚：删除错误 data/build 中间产物，保留 txt；从最近成功 checkpoint 重跑。

## Validation commands

```bash
SKILL=.agents/skills/generate-kb
NOVEL="古龙/多情剑客无情剑"

node $SKILL/scripts/split-chapters.js "$NOVEL"
node $SKILL/scripts/compact-mention.js "$NOVEL"
node $SKILL/scripts/extract-keywords.js "$NOVEL"
node $SKILL/scripts/fix-relationships.js "$NOVEL"
node $SKILL/scripts/locate.js "$NOVEL"
node $SKILL/scripts/verify.js "$NOVEL"
node $SKILL/scripts/report.js "$NOVEL"
node $SKILL/scripts/cross-validate.js "$NOVEL"
node $SKILL/scripts/check-skill-items.js "$NOVEL"
node $SKILL/scripts/locate-dialogues.js "$NOVEL"
node $SKILL/scripts/verify_dialogues.js "$NOVEL/data/dialogues.json" "$NOVEL"
node $SKILL/scripts/assess-quality.js "$NOVEL"
node $SKILL/scripts/generate-summary.js "$NOVEL"
```

（LLM 生成步骤无单一脚本，按 pipeline.md / 专属 prompts 执行。）
