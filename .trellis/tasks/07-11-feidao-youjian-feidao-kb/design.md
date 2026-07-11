# Design: generate-kb 飞刀，又见飞刀

## Approach

复用 `.agents/skills/generate-kb` 既定流水线：代码拆章与 mention → LLM 关键词/outline/专属 prompt → Pass1 实体 → 刷新 keywords → locate/verify → Pass2 细节与 dialogues → 审核与质量评估 → summary。

## Boundaries

| 区域 | 职责 |
|------|------|
| `古龙/飞刀，又见飞刀/` | 本书全部产物根目录 |
| `data/` | 8 核心 JSON（交付物） |
| `build/` | manifest、mention、keywords、baseline 等中间态 |
| `ch_split/` | 分章原文 |
| `prompts/` | 本书专属 prompt |
| `review/`、`reports/` | 审阅与校验报告 |
| skill `scripts/` | 只读调用，默认不改技能脚本 |

## Data flow

```
原文.txt
  → split-chapters + compact-mention
  → keywords.json (LLM) + outline.json
  → 专属 prompts (craft + 校验)
  → Pass1: 5 entity JSON
  → extract-keywords 刷新
  → locate / verify / cross-validate / check-skill-items
  → Pass2: items + chapter_summaries
  → Phase 2.6 实体审核
  → dialogues 原文提取 + locate-dialogues
  → Phase 3 全量校验
  → Phase 3.5 对抗校验
  → baseline + assess-quality
  → summary.md
```

## Contracts

- Schema / 枚举：skill `schemas.md`、`constants.md`
- 质量门槛：skill SKILL.md 单项表 + 综合 ≥ 95%
- source_refs：`{chapter, anchor, event_type}`，由 locate 回填行号

## Tradeoffs

- **先验 vs 原文**：先验加速骨架，一律用原文 locate/verify 纠偏，降低幻觉。
- **单本书任务**：不做父任务拆分子书；阶段内可子 agent 并行（如分批 dialogues）。
- **无古龙样例**：结构对齐金庸完成 KB；人物风格按古龙本书调整。

## Compatibility / Rollback

- 不修改仓库其他小说 data。
- 回滚：删除本书 `data/`、`build/`、`ch_split/`、`prompts/`、`review/`、`reports/`、`summary.md`（保留 txt）；任务目录保留审计记录。

## Risks

| 风险 | 缓解 |
|------|------|
| 章节标题格式特殊导致 split 失败 | 检查/补 `split-config.json` 后重跑 Phase 1 |
| 串书角色（如小李飞刀线） | Cross-Book Purity + review 对抗；outline 锁定本书实体 |
| dialogues 幻觉 | 禁止凭记忆；locate-dialogues 删全文找不到条目 |
| locate 率 < 95% | 刷新 keywords、修 anchor/章节号、fix-chapter-refs 若可用 |
