---
name: generate-kb
description: Use when the user wants to build a high-quality knowledge base for a well-known wuxia novel by leveraging the LLM's prior knowledge. Covers the "four great wuxia masters" — Jin Yong, Gu Long, Liang Yusheng, Huang Yi — and similar canonical authors. Replaces the deconstruct + distill pipeline for novels the LLM already knows.
---

# generate-kb

用 LLM 先验知识直接生成武侠小说知识库，再用原文逐条定位与校验。适用于**武侠小说四大家**（金庸、古龙、梁羽生、黄易）及同类名家代表作。

**不适用**：训练数据里没有的小众武侠、网文、原创作品。退回 `deconstruct-novel`。

## 必守规则

- 仅当 `<小说目录>/<小说名>.txt` 存在时才可运行
- 每个实体必须附 `source_refs: [{chapter, anchor, event_type}]`，由 `locate.js` 自动回填 `primary` + `alternatives`
- 核心质量指标：**locate 率 ≥ 99%**、**事件匹配率 ≥ 90%**（人工抽样）
- ID、schema、枚举以 `schemas.md` / `constants.md` 为准
- 生成阶段必须使用长上下文模型（≥ 1M tokens）
- **dialogues 必须用"LLM 读原文 + 事件锚定"方案提取**，禁止凭记忆生成

## 流水线

### Phase 1：split（纯代码）

```bash
node <skill>/scripts/split-chapters.js <novelDir>
node <skill>/scripts/compact-mention.js <novelDir>
```

输出：`ch_split/`、`manifest.json`、`mention_summary.json`

### Phase 1.6：prompt-craft（LLM 生成书籍专属 prompt）

读取 `prompts/prompt-craft.md`（meta-prompt），输入 manifest.json + mention_summary.json + 原文采样，输出 `<novelDir>/prompts/` 下 4 个文件：
- `outline.md`、`pass1-entities.md`、`pass2-details.md`、`review-dialogues.md`

专属 prompt 包含：本书简介、核心角色提示、易混淆提醒、叙事风格、source_ref 锚定策略、角色说话风格。

### Phase 1.6.5：prompt 校验

用 subagent 校验 4 个专属 prompt 的章节号、事件分配、角色列表。**已知陷阱**：LLM 容易把事件张冠李戴到错误章节，会级联影响后续所有阶段。

### Phase 1.5：outline（可选）

读取专属 `outline.md`，生成 `outline.json`（characters/factions/locations/skills 骨架清单）。

### Phase 2：generate（2 个 pass）

**Pass 1 — 实体骨架**
- 输入：manifest.json + mention_summary.json + outline.json（可选）
- 输出：`characters.json`、`factions.json`、`locations.json`、`skills.json`、`techniques.json`

**Pass 2 — 细节**
- 输入：Pass 1 的 5 个 JSON
- 输出：`items.json`、`dialogues.json`、`chapter_summaries.json`

**Phase 2.2：chapter_summaries 交叉验证**

检查每章 `key_events` 是否与原文匹配（关键词子串检测）。错位章节必须修正后才能进入 Phase 2.5。

### Phase 2.5 — dialogues 提取

1. 读取 chapter_summaries 的 key_events + ch_split 原文
2. 用 subagent 逐批（每批 5-10 章）挑选 5-10 条核心对话
3. 用 `verify_dialogues.js` 做子串匹配验证，真实率应 ≥ 70%
4. 清理未通过条目

```bash
node <skill>/scripts/verify_dialogues.js <dialogues.json> [novelDir]
```

### Phase 3：locate + verify + cross-validate

```bash
node <skill>/scripts/locate.js <novelDir>
node <skill>/scripts/verify.js <novelDir>
node <skill>/scripts/report.js <novelDir>
node <skill>/scripts/cross-validate.js <novelDir>
```

- `locate.js`：source_ref 定位，输出 primary + alternatives（同章去重，跨章保留 score ≥ 60%）
- `verify.js`：子串匹配校验，标记 grounded / weak / unverified
- `cross-validate.js`：跨 JSON 一致性（关系对称、ID 引用完整性、幻觉检测）
  - `items.owner` 支持 characters.json 或 factions.json 的 ID

### Phase 3.5：双视角对抗校验

```bash
node <skill>/scripts/review-dialogues.js <novelDir>
# 用同一 LLM + reviewer prompt 审阅
# 输出到 review/review-result.json
```

## 质量指标（天龙八部 pilot）

| 指标 | 结果 |
|------|------|
| locate 率 | 100% |
| 事件匹配率 | 100% |
| dialogues 真实率 | 75% |
| relationship 冲突 | 0 |

## 执行顺序

0. 前置检查：原文存在
1. Phase 1：split + compact-mention
2. Phase 1.6：生成专属 prompt
3. Phase 1.6.5：校验 prompt
4. Phase 1.5（可选）：生成 outline.json
5. Phase 2 Pass 1：生成 5 个实体 JSON
6. Phase 3：locate + verify + cross-validate（评估 Pass 1 质量）
7. 如 locate 率 < 95% 或有 errors，调整 prompt 后重跑
8. Phase 2 Pass 2：生成 items + dialogues + chapter_summaries
9. Phase 2.2：交叉验证 chapter_summaries
10. Phase 2.5：提取 dialogues
11. Phase 3：完整校验
12. Phase 3.5：对抗校验
13. 最终验证：8 JSON 可解析、schema 合法、errors = 0

## 最终产物

8 个 JSON + 校验报告 + 书籍专属 prompt

## 参考文件

| 文件 | 用途 |
|------|------|
| `schemas.md` | 8 个 JSON 的 schema 定义 |
| `constants.md` | ID 规则、枚举值 |
| `prompts/prompt-craft.md` | Phase 1.6 meta-prompt |
| `prompts/outline.md` | Phase 1.5 大纲 prompt（fallback） |
| `prompts/pass1-entities.md` | Pass 1 prompt（fallback） |
| `prompts/pass2-details.md` | Pass 2 prompt（fallback） |
| `scripts/split-chapters.js` | Phase 1 拆分脚本 |
| `scripts/compact-mention.js` | Phase 1 mention 聚合 |
| `scripts/locate.js` | Phase 3 定位脚本 |
| `scripts/verify.js` | Phase 3 校验脚本 |
| `scripts/report.js` | Phase 3 报告生成 |
| `scripts/cross-validate.js` | Phase 3 跨 JSON 校验 |
| `scripts/review-dialogues.js` | Phase 3.5 审阅 prompt 生成 |
| `scripts/verify_dialogues.js` | Phase 2.5 对话验证 |
