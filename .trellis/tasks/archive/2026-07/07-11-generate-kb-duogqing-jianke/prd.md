# generate-kb 多情剑客无情剑

## Goal

用 generate-kb 流水线为古龙《多情剑客无情剑》从零生成完整、可校验的知识库，达到 `completion_gate_passed`。

## Context

- 小说目录：`古龙/多情剑客无情剑/`
- 原文：`古龙/多情剑客无情剑/多情剑客无情剑.txt`（约 1.5MB，回目标题「第X回」）
- 当前状态：仅有原文，无 `data/` / `build/` / `ch_split/` / `summary.md`
- 参照成品：`古龙/飞刀，又见飞刀/`（同作者、已完成 generate-kb）
- Skill 根：`.agents/skills/generate-kb/`

## Requirements

1. 仅在原文存在前提下运行；全程以 `pipeline.md` + `schemas.md` + `constants.md` + `review.md` 为准。
2. 完整执行 Phase 0→3.7（split → keywords → outline → **独立 baseline** → 专属 prompt → Pass1 实体 → fix-relationships → 刷新 keywords → locate/verify 循环 → Pass2 items/summaries → 实体审核 → dialogues → 完整校验 → 对抗校验 → assess-quality → summary）。
3. 每个实体须有 `source_refs`（由 locate 回填）；dialogues 的 quote 须能在原文命中，禁止凭记忆编造。
4. `build/baseline.json` **必须独立生成**（含 relationships + events + 经典 quote），禁止从 `data/*.json` 拷贝。
5. `items.json` 必须含 `tags` 与合理 `rarity_tier`。
6. 生成阶段使用长上下文模型（≥1M tokens）。

## Constraints

- 禁止自指 baseline（`invalid_self_ref` 则金标 N/A，任务未完成）。
- `expected=0` 的金标指标记 N/A，不得记 100。
- ID / 枚举严格遵循 `constants.md` / `schemas.md`。
- 同一操作最多重试 3 次；失败则记录状态后推进或回滚到可修复阶段。
- 不修改 skill 脚本本身，除非脚本缺失且阻塞流水线（如文档提到的 `fix-chapter-refs.js` 若不存在则用等价修复流程）。

## Out of Scope

- 非本书其他古龙作品
- 前端/dashboard 展示改动
- 训练数据里没有的小众作品（本书为古龙代表作，适用 generate-kb）

## Acceptance Criteria

- [ ] `data/` 下 8 个 JSON 均可解析：characters、factions、locations、skills、techniques、items、dialogues、chapter_summaries
- [ ] `build/baseline.json` 独立且含 relationships（≥15）+ events（≥20）+ dialogues quotes（≥10 可原文命中）
- [ ] Phase 3 相关报告：`errors=0`（verify / cross-validate / check-skill-items 无阻塞错误）
- [ ] Dialogue quote 原文命中 ≥ 95%（locate-dialogues + verify）
- [ ] Honest Entity Grounded ≥ 85%
- [ ] Entity Quantity ≥ 80%
- [ ] **`assess-quality.js`：`completion_gate_passed === true` 且 `honest_overall_score ≥ 85`**
- [ ] 金标可用时：overall 目标 ≥ 95%；单项 Entity Completeness / Relationship Completeness·Accuracy / Event Coverage / Cross-Book Purity = 100%；Description Accuracy ≥ 70%
- [ ] `summary.md` 已生成且反映双轨质量与实体统计
- [ ] 无跨书污染（角色/门派/武功不混入其他书）

## Notes

- 章节格式预期为「第X回」；Phase 1 可用 `split-config.json` 对齐（参考飞刀 seed 模式）。
- 核心人物先验：李寻欢、阿飞、林诗音、龙啸云、林仙儿、荆无命、郭嵩阳、孙小红、吕凤先 等；武功意象：小李飞刀、快剑、梅花盗等——须以原文与 locate 为准，不凭记忆编 quote。
- 复杂任务：本 PRD 配套 `design.md` + `implement.md`；`task.py start` 前须评审通过。
