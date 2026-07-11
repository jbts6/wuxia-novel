---
name: generate-kb
description: Use when the user wants to build a high-quality knowledge base for a well-known wuxia novel by leveraging the LLM's prior knowledge. Covers the "four great wuxia masters" — Jin Yong, Gu Long, Liang Yusheng, Huang Yi — and similar canonical authors. Replaces the deconstruct + distill pipeline for novels the LLM already knows.
---

# generate-kb

用 LLM 先验生成武侠知识库，再以原文 locate/verify。适用于金庸、古龙、梁羽生、黄易及同类名家。

**不适用**：训练数据中无的小众/网文/原创 → 用 `deconstruct-novel`。

## 防循环

1. 每 Phase 做完立刻 gate，不重复已通过检查  
2. 用 task 跟踪 Phase；同一步最多重试 3 次  
3. 主 agent 协调，大块生成可派 subagent  

## 必守规则

| 项 | 要求 |
|----|------|
| 原文 | 仅当 `<小说目录>/<小说名>.txt` 存在 |
| source_refs | `{chapter, anchor, event_type}`，行号由 `locate.js` 回填 |
| baseline | **独立** `build/baseline.json`：含 relationships + events；**禁止**从 `data/*` 拷全量 |
| dialogues | 字段名 **`text`**（原文句）；禁止凭记忆编 quote |
| items | 必有 `tags`、`rarity_tier` |
| ID/枚举 | `schemas.md` + `constants.md` |
| 生成模型 | 长上下文 ≥1M tokens |
| 审核 | 广撒网 → 精挑选（`review.md`） |

### 完成门禁（`assess-quality.js`）

**始终强制（honest）**

- `completion_gate_passed` 且 `honest_overall_score ≥ 85`
- Honest Entity Grounded ≥ 85%
- Dialogue quote 原文命中 ≥ 95%
- Entity Quantity ≥ 80%
- baseline 非 `invalid_self_ref`

**金标可用时**（独立 baseline + rel + events）

- overall 目标 ≥ 95%（或分项达标）
- Completeness / Relationship / Event / Cross-Book Purity 按报告阈值
- `expected=0` → **N/A**，不得记 100

### 独立 baseline 契约（Phase 1.7）

| 规则 | 值 |
|------|-----|
| 角色金标规模 | 约 15–25（短名单，非 KB 全量） |
| bl∩kb / kb（id） | **0.50–0.84**（≥0.85 会记 copy 警告） |
| relationships | ≥15；`importance` ∈ `core\|important\|secondary`（**英文**） |
| events | ≥20；`importance` ∈ `main\|branch\|detail`（**英文**） |
| dialogues | ≥10 条原文 quote；与 data 重叠率应 &lt;90% |
| 实体名 | 必须能在原文命中 |
| Purity | 靠 KB 不灌水 + 金标覆盖核心势力/功法/物品；**禁止**为刷 100% 把龙套全写入 baseline |

## 执行顺序

0. 前置：原文存在  
1. Phase 1：`split-chapters` + `compact-mention`  
2. Phase 1.2：LLM → `build/keywords.json`  
3. Phase 1.5：`outline.json`  
4. **Phase 1.7：独立 baseline**（Pass1 前）  
5. Phase 1.6 / 1.6.5：专属 prompt + 校验  
6. Phase 2 Pass1：五实体 JSON → `fix-relationships` → `extract-keywords`  
7. Phase 3 初轮：locate + verify + cross-validate + check-skill-items  
8. Phase 2 Pass2：items + chapter_summaries（读原文）  
9. Phase 2.6：实体审核  
10. Phase 2.2：chapter_summaries 交叉验证  
11. Phase 2.5：dialogues（`text`）→ `locate-dialogues` 删幻觉  
12. Phase 3 完整 + 3.5 对抗审阅  
13. Phase 3.6：`assess-quality`  
14. Phase 3.7：`summary.md`  

细节与命令：`pipeline.md`。

## 目录

```
<小说目录>/
├── data/          # 8 核心 JSON
├── build/         # manifest, mention_*, keywords, baseline
├── ch_split/
├── prompts/       # 本书专属
├── reports/
├── review/
├── summary.md
└── <小说名>.txt
```

## 文档与脚本

| 路径 | 用途 |
|------|------|
| `pipeline.md` | 分 Phase 命令与 gate |
| `schemas.md` | 8 JSON 结构 |
| `constants.md` | ID、rank、枚举 |
| `review.md` | 审核与 3.5 不通过条件 |
| `LEARNINGS.md` | 实跑坑点（精简） |
| `scripts/*` | 拆分 / locate / verify / assess 等 |
| `prompts/*` | 通用 prompt 模板 |

Base: `.agents/skills/generate-kb/`（相对路径均相对此目录）。
