# 流水线详细步骤

## Phase 1：split + keywords（纯代码）

```bash
node <skill>/scripts/split-chapters.js <novelDir>
node <skill>/scripts/compact-mention.js <novelDir>
node <skill>/scripts/extract-keywords.js <novelDir>
```

输出：`ch_split/`、`build/manifest.json`、`mention_summary.json`、`keywords.json`

**配置文件**：`split-chapters.js` 支持通过 `split-config.json` 配置章节格式和关键词模式。

配置文件位置（按优先级）：
1. `<novelDir>/split-config.json`
2. `<novelDir>/build/split-config.json`
3. `<novelDir>/prompts/split-config.json`

配置文件格式：
```json
{
  "chapterPattern": "^第[零一二三四五六七八九十百千\\d]{1,8}[回章]\\s*.*$",
  "numberPattern": "^第([零一二三四五六七八九十百千\\d]{1,8})[回章]",
  "seedPatterns": [
    "角色名1|角色名2|角色名3",
    "门派1|门派2|门派3",
    "地点1|地点2|地点3",
    "武功1|武功2|武功3"
  ]
}
```

**重要**：`keywords.json` 是 locate.js 的核心依赖。如果 locate 率低，首先检查 `keywords.json` 是否包含足够的关键词。

## Phase 1.5：outline（可选）

读取专属 `outline.md`，生成 `outline.json`（characters/factions/locations/skills 骨架清单）。

## Phase 1.6：prompt-craft（LLM 生成书籍专属 prompt）

读取 `prompts/prompt-craft.md`（meta-prompt），输入 manifest.json + mention_summary.json + 原文采样，输出 `<novelDir>/prompts/` 下 4 个文件：
- `outline.md`、`pass1-entities.md`、`pass2-details.md`、`review-all.md`

## Phase 1.6.5：prompt 校验

用 subagent 校验 4 个专属 prompt 的章节号、事件分配、角色列表。**已知陷阱**：LLM 容易把事件张冠李戴到错误章节，会级联影响后续所有阶段。

## Phase 2：generate（2 个 pass）

**Pass 1 — 实体骨架**
- 输入：manifest.json + mention_summary.json + outline.json（可选）
- 输出：`characters.json`、`factions.json`、`locations.json`、`skills.json`、`techniques.json`

**Pass 2 — 细节**
- 输入：Pass 1 的 5 个 JSON
- 输出：`items.json`、`dialogues.json`、`chapter_summaries.json`
- **items.json 必须为每个物品分配 `rarity_tier`**（凡品/良品/珍品/神品），不能全部设为"未知"

## Phase 2.2：chapter_summaries 交叉验证

检查每章 `key_events` 是否与原文匹配（关键词子串检测）。错位章节必须修正后才能进入 Phase 2.5。

## Phase 2.5：dialogues 提取（LLM 上下文理解方案）

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
- **隐式推断**：对话连续性、上下文线索、场景分析、语气分析
- **无法确定时**：`speaker` 设为 `null`，不要猜测

```bash
node <skill>/scripts/verify_dialogues.js <dialogues.json> [novelDir]
```

## Phase 2.6：实体审核

详见 `review.md`。

## Phase 3：locate + verify + cross-validate

```bash
node <skill>/scripts/locate.js <novelDir>
node <skill>/scripts/verify.js <novelDir>
node <skill>/scripts/report.js <novelDir>
node <skill>/scripts/cross-validate.js <novelDir>
node <skill>/scripts/check-skill-items.js <novelDir>
```

- `locate.js`：source_ref 定位，输出 primary + alternatives（同章去重，跨章保留 score ≥ 60%）
- `verify.js`：子串匹配校验，标记 grounded / weak / unverified
- `check-skill-items.js`：检查 skills.json 是否混入兵器/暗器实物，输出可疑条目供 LLM 二次审核
- `cross-validate.js`：跨 JSON 一致性（关系对称、ID 引用完整性、幻觉检测）

## Phase 3.5：全量 JSON 对抗校验

```bash
node <skill>/scripts/review-dialogues.js <novelDir>
# 用同一 LLM + reviewer prompt 审阅所有 8 个 JSON
# 输出到 review/review-result.json
```

审阅范围详见 `review.md` 的"Phase 3.5 对抗校验审核不通过条件"。

## Phase 3.6：质量评估

```bash
node <skill>/scripts/generate-baseline-prompt.js <novelDir>
# 用 subagent 生成 baseline.json
node <skill>/scripts/assess-quality.js <novelDir>
```

### 质量标准

**综合质量分数 ≥ 85%**，且**所有单项指标必须达标**：

| 指标 | 最低门槛 | 权重 | 说明 |
|------|----------|------|------|
| Entity Completeness | ≥ 95% | 0.25 | 实体覆盖率 |
| Relationship Completeness | ≥ 95% | 0.15 | 关系覆盖率 |
| Relationship Accuracy | ≥ 90% | 0.10 | 关系准确率 |
| Description Accuracy | ≥ 70% | 0.15 | 描述准确率 |
| Event Coverage | ≥ 95% | 0.10 | 事件覆盖率 |
| Dialogue Authenticity | ≥ 70% | 0.10 | **对话真实率**（衡量对话是否为原文） |
| Cross-Book Purity | ≥ 85% | 0.10 | 跨书纯净度 |

**注意**：综合分数可能达标（如85%），但个别指标可能很低（如 Dialogue Authenticity 只有40%）。这种情况必须修复后重跑，不能放过。

**常见问题及修复方法**：
- **Dialogue Authenticity 低**：baseline.dialogues 缺少实际对话文本，需要更新 baseline.json 添加正确的 quote 字段
- **Cross-Book Purity 低**：baseline 缺少本书的真实实体，需要更新 baseline.json 添加所有应有实体
- **Description Accuracy 低**：baseline 中的角色描述与 KB 不一致，需要更新 baseline 的 expected_identity 和 expected_traits

## Phase 3.7：生成总览

```bash
node <skill>/scripts/generate-summary.js <novelDir>
```

输出 `summary.md`，包含实体统计、质量指标、核心角色、重要事件、文件清单。
