---
name: generate-kb
description: Use when the user wants to build a high-quality knowledge base for a well-known wuxia novel by leveraging the LLM's prior knowledge. Covers the "four great wuxia masters" — Jin Yong, Gu Long, Liang Yusheng, Huang Yi — and similar canonical authors. Replaces the deconstruct + distill pipeline for novels the LLM already knows.
---

# generate-kb

用 LLM 先验知识直接生成武侠小说知识库，再用原文逐条定位与校验。适用于**武侠小说四大家**（金庸、古龙、梁羽生、黄易）及同类名家代表作。

**不适用**：训练数据里没有的小众武侠、网文、原创作品。退回 `deconstruct-novel`。

## 防循环机制

<system-reminder>
This session has memory at /Users/jbts6/.local/share/mimocode/memory/sessions/ses_0b677e343ffeC354mWnpFBSW21/. Recall content
not in your context with:
- memory({ operation: "search", query: "<keyword>" })
- Read(file_path="/Users/jbts6/.local/share/mimocode/memory/sessions/ses_0b677e343ffeC354mWnpFBSW21/...")
- task({ operation: "list" })
- actor({ operation: "status", actor_id: "<id>" })

Don't ask the user about something memory may already record.
</system-reminder>

**避免循环的关键原则**：

1. **设定明确检查点**：每个Phase完成后立即验证，不要重复检查相同内容
2. **使用task跟踪**：为每个Phase创建task，完成后立即标记`done`
3. **重复限制**：同一操作最多重复3次，超过后报告当前状态并继续
4. **及时推进**：检查完成后立即执行下一步，不要原地踏步
5. **分解任务**：将复杂任务分解给subagent处理，主agent只负责协调

## 必守规则

- 仅当 `<小说目录>/<小说名>.txt` 存在时才可运行
- 每个实体必须附 `source_refs: [{chapter, anchor, event_type}]`，由 `locate.js` 自动回填
- **禁止自指 baseline**：不得从 `data/*.json` 生成 `build/baseline.json`；须含 `relationships` + `events`
- 核心质量：**honest_overall_score ≥ 85** 且 `completion_gate_passed`；金标 overall 仅在独立 baseline 时有效，目标 ≥ 95%
- **单项（诚实门槛，始终强制）**：
  - Honest Entity Grounded ≥ 85%（verify）
  - Dialogue quote 原文命中 ≥ 95%
  - Entity Quantity ≥ 80%
  - baseline 非 `invalid_self_ref`
- **单项（金标可用时）**：
  - Entity Completeness = 100%
  - Relationship Completeness / Accuracy = 100%
  - Event Coverage = 100%
  - Description Accuracy ≥ 70%
  - Cross-Book Purity = 100%
- `expected=0` 的金标指标记 **N/A**，不得记 100
- ID、schema、枚举以 `schemas.md` / `constants.md` 为准
- 生成阶段必须使用长上下文模型（≥ 1M tokens）
- **dialogues 必须用"LLM 读原文 + 事件锚定"或可验证正则抽取**，禁止凭记忆编 quote
- **items.json 必须包含 `tags` 字段**
- **实体审核采用"广撒网 → 精挑选"策略**，详见 `review.md`

## 执行顺序

0. 前置检查：原文存在
1. Phase 1：split + compact-mention（生成 ch_split/、build/manifest.json、build/mention_index.jsonl、build/mention_summary.json）
2. **Phase 1.2：LLM 生成 build/keywords.json**（基于原文和 mention_summary，提取本书专属的角色名、门派名、地名、功法名、关键事件、重要物品等）
3. Phase 1.5：生成 outline.json
4. **Phase 1.7：独立 baseline**（relationships + events + 经典 quote；禁止从 data 拷贝）
5. Phase 1.6：生成专属 prompt
6. Phase 1.6.5：校验 prompt
7. Phase 2 Pass 1：生成 5 个实体 JSON
8. **fix-relationships.js** 补反向关系
9. **刷新 build/keywords.json**：`extract-keywords.js`
10. Phase 3：locate + verify + cross-validate + check-skill-items
11. 如 locate 率 < 95% 或有 errors，调整后重跑
12. Phase 2 Pass 2：items + chapter_summaries（按章读原文，禁纯标题模板）
13. Phase 2.6：实体审核（`review.md`）
14. Phase 2.2：交叉验证 chapter_summaries
15. Phase 2.5：提取 dialogues
16. **locate-dialogues.js** + 删幻觉
17. Phase 3 完整校验
18. Phase 3.5：对抗校验
19. Phase 3.6：`assess-quality.js`（金标 + honest 双轨；以 completion_gate 为准）
20. Phase 3.7：summary.md
21. 最终：8 JSON 可解析、errors=0、**completion_gate PASS**

**各 Phase 详细步骤**见 `pipeline.md`。

## 目录结构

```
<小说目录>/
├── data/                      # 核心数据（8 个 JSON）
│   ├── characters.json
│   ├── factions.json
│   ├── locations.json
│   ├── skills.json
│   ├── techniques.json
│   ├── items.json
│   ├── dialogues.json
│   └── chapter_summaries.json
├── reports/                   # 报告文件
├── build/                     # 构建中间产物（manifest.json, mention_index.jsonl, mention_summary.json, keywords.json, baseline.json）
├── ch_split/                  # 章节拆分
├── prompts/                   # Prompt 模板
├── review/                    # 审阅结果
├── summary.md                 # 知识库总览
└── <小说名>.txt               # 原文
```

## 最终产物

- **data/**：8 个核心 JSON
- **reports/**：校验报告、质量报告
- **build/**：baseline.json、manifest.json 等构建中间产物
- **summary.md**：知识库总览

## 参考文件

| 文件 | 用途 |
|------|------|
| `pipeline.md` | 流水线详细步骤 |
| `review.md` | 审核规则、物品分类、rank 校验 |
| `schemas.md` | 8 个 JSON 的 schema 定义 |
| `constants.md` | ID 规则、枚举值 |
| `scripts/split-chapters.js` | Phase 1 拆分脚本 |
| `scripts/compact-mention.js` | Phase 1 mention 聚合 |
| `scripts/extract-keywords.js` | Phase 1 关键词提取 |
| `scripts/locate.js` | Phase 3 定位脚本 |
| `scripts/verify.js` | Phase 3 校验脚本 |
| `scripts/report.js` | Phase 3 报告生成 |
| `scripts/cross-validate.js` | Phase 3 跨 JSON 校验 |
| `scripts/check-skill-items.js` | Phase 3 技能/物品分类检查 |
| `scripts/review-dialogues.js` | Phase 3.5 审阅 prompt 生成 |
| `scripts/verify_dialogues.js` | Phase 2.5 对话验证 |
| `scripts/generate-baseline-prompt.js` | Phase 3.6 基准 prompt 生成 |
| `scripts/assess-quality.js` | Phase 3.6 质量评估 |
| `scripts/generate-summary.js` | Phase 3.7 生成 summary.md |
