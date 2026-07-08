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
- 核心质量指标：**综合质量分数 ≥ 85%**
- ID、schema、枚举以 `schemas.md` / `constants.md` 为准
- 生成阶段必须使用长上下文模型（≥ 1M tokens）
- **dialogues 必须用"LLM 读原文 + 事件锚定"方案提取**，禁止凭记忆生成
- **items.json 必须包含 `tags` 字段**，用于更灵活的分类
- **实体审核采用"广撒网 → 精挑选"策略**，避免遗漏重要实体

## 流水线

### Phase 1：split + keywords（纯代码）

```bash
node <skill>/scripts/split-chapters.js <novelDir>
node <skill>/scripts/compact-mention.js <novelDir>
node <skill>/scripts/extract-keywords.js <novelDir>
```

输出：`ch_split/`、`manifest.json`、`mention_summary.json`、`keywords.json`

**重要**：`keywords.json` 是 locate.js 的核心依赖。它包含：
- mention_index.jsonl 中的高频词
- 原文中出现的武侠关键词（门派、地名、功法、事件等）
- locate.js 会优先读取这个文件，如果没有则使用硬编码的 fallback（可能不适合本书）

**如果 locate 率低**，首先检查 `keywords.json` 是否包含足够的关键词。

### Phase 1.6：prompt-craft（LLM 生成书籍专属 prompt）

读取 `prompts/prompt-craft.md`（meta-prompt），输入 manifest.json + mention_summary.json + 原文采样，输出 `<novelDir>/prompts/` 下 4 个文件：
- `outline.md`、`pass1-entities.md`、`pass2-details.md`、`review-all.md`

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

**Phase 2.6：实体审核（新增）**

在 Phase 2 Pass 2 之后，对所有实体进行审核。采用**广撒网 → 精挑选**两步走策略：

**第一步：广撒网**
- 尽可能多地提取实体（凭记忆 + 原文）
- 不要遗漏任何可能的重要实体
- 输出 `*_candidates.json`

**第二步：精挑选**
- 读取候选实体 JSON
- 用 LLM 逐个审核：
  - 这个实体是否对剧情有重要意义？
  - 这个实体是否正确分类（武器 vs 技能）？
  - 这个实体是否重复？
  - 这个实体是否 trivial（如手帕、灯）？
- 删除不符合条件的实体
- 输出最终的实体 JSON

**审核规则**：
- **skills.json**：只保留真正的武学体系，武器（铁鞭、峨嵋刺等）应放入 items.json
- **items.json**：只保留对剧情有重要意义的物品，trivial 物品（手帕、灯等）应删除
- **characters.json**：只保留有名字、有剧情作用的角色，龙套角色可以保留但不需要太多细节

**items.json 物品分类标准**：
- **秘籍**：武功秘籍、图谱、经书
- **兵器**：刀、剑、枪、棍、棒、暗器等（暗器是兵器的子类）
- **丹药/毒药**：有名字的丹药、毒药、解药
- **信物**：帮派信物、家族信物、身份象征
- **剧情关键物品**：推动剧情发展的物品
- **特殊工具**：有特殊功能的工具

**tags 字段**：物品使用标签数组进行更灵活的分类，详见 `schemas.md`

**Phase 2.2：chapter_summaries 交叉验证**

检查每章 `key_events` 是否与原文匹配（关键词子串检测）。错位章节必须修正后才能进入 Phase 2.5。

### Phase 2.5 — dialogues 提取（LLM 上下文理解方案）

**核心思路**：用 LLM 阅读原文，通过上下文推断说话者，而非正则提取。

**流程**：
1. 读取 chapter_summaries 的 key_events + ch_split 原文
2. 读取 `prompts/extract-dialogues.md`（对话提取 prompt）
3. 用 subagent 逐批（每批 5-10 章）提取对话：
   - LLM 阅读原文，理解上下文
   - LLM 提取所有对话（包括隐式对话）
   - LLM 通过上下文推断说话者（如对话连续性、场景分析、语气分析）
   - 输出格式化的 dialogues.json
4. 用 `verify_dialogues.js` 做子串匹配验证，真实率应 ≥ 85%
5. 清理未通过条目

**说话者推断规则**：
- **显式标注**："XXX 说道"、"XXX 道"、"XXX 笑道"
- **隐式推断**：
  - 对话连续性：前一句是 A 说的，下一句通常是 B 说的
  - 上下文线索：通过对话内容推断（如"爹爹"说明是子女在说话）
  - 场景分析：通过场景推断（如两人对峙，通常是交替说话）
  - 语气分析：通过语气推断（如"本王"说明是王爷在说话）
- **无法确定时**：`speaker` 设为 `null`，不要猜测

**优势**：
- 可以识别隐式对话（原文没有明确标注说话者）
- 可以通过上下文推断说话者
- 对话提取更完整、更准确

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

### Phase 3.5：全量 JSON 对抗校验

```bash
node <skill>/scripts/review-dialogues.js <novelDir>
# 用同一 LLM + reviewer prompt 审阅所有 8 个 JSON
# 输出到 review/review-result.json
```

审阅范围：
- characters.json：角色身份、关系、别名
- factions.json：门派类型、地点关联
- locations.json：地点情节意义
- skills.json：**重点检查**是否混入武器（应为武学体系）
- techniques.json：招式归属
- items.json：**重点检查**物品分类是否正确
- dialogues.json：对话真实性、说话风格
- chapter_summaries.json：情节准确性

**审核不通过条件**：
1. 跨书混淆（其他作品的角色/功法/地点混入）
2. skills.json 混入武器（铁鞭、峨嵋刺等应为 item）
3. ID 引用缺失（引用不存在的 ID）
4. **数量完整性**：对照原文检查是否有重大遗漏（如重要角色、核心功法、关键物品）

## 质量指标体系

### 传统指标（文本级）

| 指标 | 定义 | 目标值 |
|------|------|--------|
| locate 率 | source_ref 定位成功率 | ≥ 99% |
| 事件匹配率 | chapter_summaries 事件与原文匹配率 | ≥ 90% |
| dialogues 真实率 | 对话子串匹配验证 | ≥ 85% |
| grounded 率 | 实体引文可验证比例 | ≥ 85% |

### 新指标（语义级，AI 认知驱动）

| 指标 | 定义 | 目标值 |
|------|------|--------|
| entity_completeness | 实体覆盖率 | 核心 100%，重要 ≥95% |
| entity_quantity | 实体数量 | 参考建议，不计入分数 |
| relationship_completeness | 关系覆盖率 | 核心 100%，重要 ≥90% |
| relationship_accuracy | 关系类型准确率 | ≥ 90% |
| description_accuracy | 描述准确率 | ≥ 90% |
| event_coverage | 事件覆盖率 | 主线 100%，支线 ≥85% |
| dialogue_authenticity | 对话真实率 | ≥ 85% |
| dialogue_representativeness | 对话代表性 | ≥ 85% |
| cross_book_purity | 跨书纯净度 | ≥ 95% |

**综合质量分数** = 各指标加权平均（见 `assess-quality.js`），目标 ≥ 85%

**实体数量参考建议**（不计入综合分数，Phase 2.6 清理后）：

| 章节数 | 角色 | 门派 | 技能 | 物品 | 地点 |
|--------|------|------|------|------|------|
| 10-20 章 | ≥8 | ≥3 | ≥5 | ≥3 | ≥5 |
| 20-30 章 | ≥15 | ≥4 | ≥8 | ≥6 | ≥8 |
| 30-50 章 | ≥20 | ≥5 | ≥10 | ≥8 | ≥10 |
| 50+ 章 | ≥30 | ≥6 | ≥15 | ≥10 | ≥15 |

**重要**：实体数量是参考建议，不是硬性指标。正确的做法是：
1. **广撒网**：尽可能多地提取实体（凭记忆 + 原文），输出 `*_candidates.json`
2. **精挑选**：结合原文逐个审核，删除杂物、重复、错误分类的实体
3. 避免为了达标而编造实体，或把 trivial 物品当成重要物品

**items.json 物品分类标准**：
- **秘籍**：武功秘籍、图谱、经书
- **兵器**：刀、剑、枪、棍、棒、暗器等（暗器是兵器的子类）
- **丹药/毒药**：有名字的丹药、毒药、解药
- **信物**：帮派信物、家族信物、身份象征
- **剧情关键物品**：推动剧情发展的物品
- **特殊工具**：有特殊功能的工具

### 天龙八部 pilot 结果

| 指标 | 结果 |
|------|------|
| Entity Completeness | 100% |
| Entity Quantity | 100% |
| Relationship Completeness | 100% |
| Relationship Accuracy | 100% |
| Description Accuracy | 100% |
| Event Coverage | 100% |
| Dialogue Authenticity | 100% |
| Dialogue Representativeness | 100% |
| Cross-Book Purity | 100% |
| **综合质量分数** | **100/100** |

**实体统计**：
- 角色：86 个（核心 3 + 重要 19 + 次要 12 + 龙套 52）
- 门派：9 个
- 技能：26 个
- 物品：36 个（秘籍 18 + 兵器 3 + 暗器 2 + 防具 1 + 丹药 1 + 毒药 3 + 信物 5 + 工具 3）
- 地点：19 个

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
9. **Phase 2.6：实体审核（新增）**
    - 广撒网：尽可能多地提取实体（凭记忆 + 原文），输出 `*_candidates.json`
    - 精挑选：用 LLM 逐个审核，删除 trivial、重复、错误分类的实体
    - 物品分类标准：秘籍、兵器、丹药/毒药、信物、剧情关键、特殊工具
    - items.json 必须包含 `tags` 字段
10. Phase 2.2：交叉验证 chapter_summaries
11. **Phase 2.5：提取 dialogues（LLM 上下文理解方案）**
    - 读取 `prompts/extract-dialogues.md`
    - 用 subagent 逐批（每批 5-10 章）提取对话
    - LLM 阅读原文，通过上下文推断说话者
    - 用 `verify_dialogues.js` 做子串匹配验证，真实率应 ≥ 85%
12. Phase 3：完整校验
13. Phase 3.5：对抗校验
14. **Phase 3.6：质量评估**
    - 生成 baseline：`node <skill>/scripts/generate-baseline-prompt.js <novelDir>`
    - 用 subagent 生成 baseline.json
    - 运行质量评估：`node <skill>/scripts/assess-quality.js <novelDir>`
    - 检查综合质量分数是否达标（≥85%）
15. **Phase 3.7：生成总览**
    - 生成 summary：`node <skill>/scripts/generate-summary.js <novelDir>`
    - 输出 `summary.md`，包含实体统计、质量指标、核心角色、重要事件、文件清单
16. 最终验证：8 JSON 可解析、schema 合法、errors = 0、综合质量分数 ≥ 85%

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
│   ├── quality_report.json
│   ├── quality_report.md
│   ├── verification_report.md
│   ├── verification_report.json
│   ├── verification_result.json
│   └── cross_validation_report.json
├── build/                     # 构建中间产物
│   ├── baseline.json
│   ├── manifest.json
│   ├── mention_summary.json
│   ├── mention_index.jsonl
│   ├── outline.json
│   └── ...
├── ch_split/                  # 章节拆分
├── prompts/                   # Prompt 模板
├── review/                    # 审阅结果
├── summary.md                 # 知识库总览
└── <小说名>.txt               # 原文
```

## 最终产物

- **data/**：8 个核心 JSON（characters, factions, locations, skills, techniques, items, dialogues, chapter_summaries）
- **reports/**：校验报告（verification_report.md, cross_validation_report.json）、质量报告（quality_report.json, quality_report.md）
- **build/**：baseline.json、manifest.json、mention_summary.json 等构建中间产物
- **summary.md**：知识库总览
- **prompts/**：书籍专属 prompt
- **review/**：审阅结果

## 参考文件

| 文件 | 用途 |
|------|------|
| `schemas.md` | 8 个 JSON 的 schema 定义（含 items.tags 字段） |
| `constants.md` | ID 规则、枚举值（含 item.tags 枚举） |
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
| `prompts/extract-dialogues.md` | Phase 2.5 对话提取 prompt（LLM 上下文理解方案） |
| `scripts/generate-baseline-prompt.js` | Phase 3.6 基准 prompt 生成 |
| `scripts/assess-quality.js` | Phase 3.6 质量评估 |
| `prompts/generate-baseline.md` | Phase 3.6 基准生成 prompt 模板 |
| `scripts/generate-summary.js` | Phase 3.7 生成 summary.md |
