---
name: generate-kb
description: Build or audit a source-grounded knowledge base for a wuxia novel. Use when extracting characters, factions, locations, named martial arts, named techniques, plot-relevant items, chapter events, and representative original dialogue from a novel text, or when an existing wuxia knowledge base has suspiciously low recall or weak source evidence.
---

# generate-kb

以小说原文为唯一事实来源，生成兼容的八类知识库 JSON，并用可追踪候选账本证明扫描覆盖、归并决策和查漏结果。

## 核心规则

1. 先建立原文证据，再做归一化、分类、重要性和丰富描述。模型先验只能提出检索词，不能直接成为知识库事实。
2. 将召回与丰富分开。扫描窗口时只提名称、类别提示、原文位置和短引文。
3. 原文明确定名且可定位的武功与招式全部保留；`importance` 只分级，不参与删除。
4. 角色、地点、势力和物品按剧情作用筛选，但每个候选都必须有 keep/merge/redirect/reject decision。
5. 对话必须覆盖主要事件和核心/重要角色的人物特征。必须保存完整原话、选择理由及可定位的原文上下文。
6. 不使用可补偿总分。只有 G1-G5 全部通过，才可声明完成。
7. G1-G5 与人工审核就绪状态分离。数量只能触发低召回报警，不能证明完整；异常必须先由 AI 返工，不能把整本候选账本交给人工兜底。
8. 默认每本书独立运行和产出审核包。人工可以逐本立即审核，也可以积累五六本后集中审核；批审不改变单本状态和证据链。
9. Stage 3 的 enrich 是硬步骤。最终记录不能只含 `id/name/source_refs`；必须通过代码级最终数据契约后才能进入 gap audit 和完成门禁。

## 执行

开始生成或重做时，读取 [pipeline.md](pipeline.md) 并严格执行四阶段：

1. Prepare Source
2. Inventory From Source
3. Reconcile And Enrich
4. Independent Gap Audit And Gate

处理字段、枚举或中间产物时读取 [schemas.md](schemas.md) 与 [constants.md](constants.md)。AI 自审、人工审核包和人工动作读取 [review.md](review.md)。

最终保持以下消费接口：

- `data/characters.json`
- `data/factions.json`
- `data/locations.json`
- `data/skills.json`
- `data/techniques.json`
- `data/items.json`
- `data/dialogues.json`
- `data/chapter_summaries.json`

## 完成条件

运行：

```bash
node scripts/validate-inventory.js "$NOVEL"
node scripts/validate-final-data.js "$NOVEL"
node scripts/verify.js "$NOVEL"
node scripts/cross-validate.js "$NOVEL"
node scripts/audit-recall.js "$NOVEL"
node scripts/generate-review-packet.js "$NOVEL"
node scripts/generate-summary.js "$NOVEL"
```

`reports/quality_report.json` 必须满足 `completion_gate_passed: true`，且 G1-G5 各自为 PASS。缺少 source index、扫描覆盖、ledger、最终数据字段/enrich、最终 gap round、当前数据对应的 grand verification、事件对话或人物特征对话时，均不得完成。`validate-final-data.js` 必须先 PASS；缺失八类文件、骨架记录、非法枚举或条件丰富字段为空时不得进入人工审核。

完成门禁通过后，`reports/review_packet.json` 的 `review_readiness.status` 还必须为 `ready_for_human_review`，才能交给人工做短审核。状态为 `blocked` 时先修 G1-G5；状态为 `needs_ai_rerun` 时按自动异常扩大召回、复审 reject 或压缩高风险队列。人工只审核最多 10 个高风险裁决和两侧确定性样本，不逐条重做全书抽取。

## Legacy

`generate-baseline-prompt.js`、`compact-mention.js`、`extract-keywords.js`、`coverage-gap.js` 及旧版多 Phase prompt 暂时保留，用于旧知识库诊断和迁移。新生成流程不得把它们的 baseline 或数量分当作完整性证明。
