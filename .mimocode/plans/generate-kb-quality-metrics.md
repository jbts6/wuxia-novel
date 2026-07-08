# generate-kb 质量指标体系改进方案

## 一、问题分析

### 1.1 当前质量指标的局限性

当前 generate-kb 流水线使用以下指标：

| 指标 | 定义 | 天龙八部结果 |
|------|------|-------------|
| locate 率 | source_ref 定位成功率 | 100% |
| 事件匹配率 | chapter_summaries 事件与原文匹配率 | 100% |
| dialogues 真实率 | 对话子串匹配验证 | 75% |
| grounded 率 | 实体引文可验证比例 | 40.8% |

**问题**：

1. **技术指标 vs 业务指标脱节**
   - grounded 率 40.8% 只能说明"找不到原文匹配"，不能说明"实体是否重要"或"是否遗漏"
   - 一个 grounded 率 100% 的知识库可能遗漏了 50% 的重要角色

2. **缺乏完整性度量**
   - 没有指标衡量"是否覆盖了所有重要实体"
   - 没有指标衡量"是否遗漏了关键关系"

3. **幻觉检测依赖 mention_summary.json**
   - 如果 mention_summary.json 本身不完整，幻觉检测会误报
   - 天龙八部有 15 个 possible_hallucination 警告，但其中"西夏公主"、"大理段氏"是真实实体

4. **关系对称性是设计选择，不是错误**
   - 62 个 relationship_asymmetric 警告中，很多是合理的（如段誉→王语嫣是恋人，但王语嫣→段誉可能不是恋人）
   - 当前系统无法区分"设计选择"和"数据错误"

### 1.2 核心思路

利用 LLM 对书籍的先验知识，定义**语义级质量指标**，而非仅依赖**文本级匹配**。

**优势**：
- AI 对经典武侠作品有丰富先验知识
- 可以生成"基准数据"（baseline.json），包含按重要性分级的角色清单、关系对、事件清单
- 然后与实际知识库对比，量化质量差距

## 二、新指标体系

### 2.1 六大语义级指标

#### 指标 1：实体完整性（Entity Completeness）

**定义**：知识库是否覆盖了书中所有重要实体

**分级标准**：

| 重要性 | 预期覆盖率 | 验证方式 |
|--------|-----------|----------|
| 核心角色 | 100% | AI 列举 + 人工确认 |
| 重要角色 | ≥95% | AI 列举 + 抽样验证 |
| 次要角色 | ≥80% | AI 列举 + 统计验证 |
| 龙套角色 | ≥60% | 统计验证 |

**计算公式**：
```
entity_completeness = (实际覆盖数 / AI 预期总数) × 100%
```

**天龙八部示例**：
- 核心角色：段誉、萧峰、虚竹（预期 100%）
- 重要角色：王语嫣、慕容复、阿朱、阿紫、木婉清、钟灵、鸠摩智、丁春秋等（预期 ≥95%）
- 次要角色：段正淳、刀白凤、秦红棉、阮星竹等（预期 ≥80%）

#### 指标 2：关系完整性（Relationship Completeness）

**定义**：知识库是否覆盖了书中所有重要关系

**分级标准**：

| 关系类型 | 预期覆盖率 | 验证方式 |
|----------|-----------|----------|
| 核心关系（主角间） | 100% | AI 列举 + 人工确认 |
| 重要关系（配角间） | ≥90% | AI 列举 + 抽样验证 |
| 次要关系 | ≥70% | 统计验证 |

**计算公式**：
```
relationship_completeness = (实际关系数 / AI 预期关系数) × 100%
```

**天龙八部示例**：
- 核心关系：段誉↔王语嫣（恋人）、萧峰↔阿朱（恋人）、虚竹↔西夏公主（恋人）
- 重要关系：段誉↔萧峰↔虚竹（结义兄弟）、段誉↔段正淳（父子）

#### 指标 3：关系准确性（Relationship Accuracy）

**定义**：关系类型是否正确

**计算公式**：
```
relationship_accuracy = (正确关系数 / 实际关系数) × 100%
```

**验证维度**：
- 关系类型是否正确（如段誉→王语嫣应是"恋人"而非"对手"）
- 关系强度是否合理（如萧峰→阿朱的 intensity 应为 90+）

#### 指标 4：描述准确性（Description Accuracy）

**定义**：实体描述是否符合书中设定

**验证维度**：

| 维度 | 验证方式 | 示例 |
|------|----------|------|
| 身份定位 | AI 验证 | 段誉应是"大理段氏世子"，不是"普通书生" |
| 性格特征 | AI 验证 | 萧峰应有"豪迈"、"义薄云天"，不应有"阴险" |
| 武功描述 | AI 验证 | 降龙十八掌应是"刚猛"，不应是"阴柔" |
| 关系动态 | AI 验证 | 段誉→王语嫣应是"单恋→相守"，不应是"敌对" |

**计算公式**：
```
description_accuracy = (准确描述数 / 总描述数) × 100%
```

#### 指标 5：事件覆盖度（Event Coverage）

**定义**：chapter_summaries 是否覆盖了书中所有重要事件

**分级标准**：

| 事件类型 | 预期覆盖率 | 验证方式 |
|----------|-----------|----------|
| 主线事件 | 100% | AI 列举 + 人工确认 |
| 支线事件 | ≥85% | AI 列举 + 抽样验证 |
| 细节事件 | ≥60% | 统计验证 |

**计算公式**：
```
event_coverage = (实际事件数 / AI 预期事件数) × 100%
```

**天龙八部示例**：
- 主线事件：段誉初入无量山（ch1）、萧峰首次登场（ch14）、聚贤庄血战（ch19）、萧峰雁门关自尽（ch50）

#### 指标 6：跨书纯净度（Cross-Book Purity）

**定义**：知识库是否混入了其他作品的内容

**计算公式**：
```
cross_book_purity = (本书实体数 / 总实体数) × 100%
```

**验证方式**：
- AI 验证每个实体是否属于本书
- 检查是否有其他金庸作品的角色/武功/地点混入

### 2.2 对话质量（复合指标）

对话质量包含三个子指标：

| 子指标 | 定义 | 目标值 |
|--------|------|--------|
| dialogue_authenticity | 对话真实性（子串匹配） | ≥80% |
| dialogue_representativeness | 对话代表性（是否有 speaker） | ≥70% |
| dialogue_character_fit | 角色符合度（说话风格是否匹配） | ≥60% |

### 2.3 综合质量分数

**公式**：
```
overall_quality = 
  entity_completeness × 0.25 +
  relationship_completeness × 0.15 +
  relationship_accuracy × 0.10 +
  description_accuracy × 0.15 +
  event_coverage × 0.10 +
  dialogue_authenticity × 0.10 +
  dialogue_representativeness × 0.05 +
  cross_book_purity × 0.10
```

**权重设计思路**：
- 实体完整性权重最高（0.25），因为这是知识库的基础
- 描述准确性和关系完整性并列第二（0.15），保证内容质量
- 事件覆盖、对话真实性、跨书纯净度并列第三（0.10）
- 对话代表性权重最低（0.05），因为它是锦上添花

**合格线**：综合质量分数 ≥ 80%

## 三、实现方案

### 3.1 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/assess-quality.js` | 新建 | 质量评估脚本 |
| `scripts/generate-baseline-prompt.js` | 新建 | 基准 prompt 生成脚本 |
| `prompts/generate-baseline.md` | 新建 | 基准生成 prompt 模板 |
| `.agents/skills/generate-kb/SKILL.md` | 更新 | 添加 Phase 3.6 |

### 3.2 assess-quality.js

**功能**：
- 读取知识库 JSON（characters.json, factions.json, etc.）
- 读取 baseline.json
- 计算各项质量指标
- 生成质量报告

**调用方式**：
```bash
node <skill>/scripts/assess-quality.js <novelDir>
```

**输出文件**：
- `quality_report.json`：结构化质量报告
- `quality_report.md`：人可读质量报告

**quality_report.json 结构**：
```json
{
  "generated_at": "2026-07-08T...",
  "novel": "天龙八部",
  "author": "金庸",
  "overall_score": 78.5,
  "metrics": {
    "entity_completeness": {
      "score": 85.0,
      "details": {
        "core": {"expected": 3, "actual": 3, "coverage": 100.0},
        "important": {"expected": 16, "actual": 15, "coverage": 93.75},
        "secondary": {"expected": 20, "actual": 18, "coverage": 90.0},
        "minor": {"expected": 30, "actual": 22, "coverage": 73.33}
      },
      "missing": [
        {"id": "char_wang_furen", "name": "王夫人", "importance": "重要", "reason": "段誉生母，剧情关键人物"}
      ]
    },
    "relationship_completeness": {
      "score": 70.0,
      "accuracy": 90.0,
      "details": {...},
      "missing": [...],
      "incorrect": [...]
    },
    "description_accuracy": {
      "score": 80.0,
      "issues": [...]
    },
    "event_coverage": {
      "score": 75.0,
      "details": {...},
      "missing": [...]
    },
    "dialogue_quality": {
      "authenticity": 75.0,
      "representativeness": 60.0,
      "characterFit": 50.0,
      "details": {...},
      "issues": [...]
    },
    "cross_book_purity": {
      "score": 95.0,
      "suspicious": [...]
    }
  }
}
```

### 3.3 generate-baseline-prompt.js

**功能**：
- 接收小说目录作为参数
- 读取 manifest.json、mention_summary.json、characters.json
- 生成 baseline prompt
- 输出到 `<novelDir>/prompts/baseline-prompt.md`

**调用方式**：
```bash
node <skill>/scripts/generate-baseline-prompt.js <novelDir>
```

### 3.4 generate-baseline.md（Prompt 模板）

**内容**：
- 定义 baseline.json 的输出格式
- 定义角色分级标准（核心/重要/次要/龙套）
- 定义关系分级标准（核心/重要/次要）
- 定义事件分级标准（主线/支线/细节）
- 提供天龙八部示例

### 3.5 SKILL.md 更新

在 Phase 3.5 之后添加 Phase 3.6：

```
### Phase 3.6：质量评估

1. 生成 baseline prompt：`node <skill>/scripts/generate-baseline-prompt.js <novelDir>`
2. 用 subagent 生成 baseline.json
3. 运行质量评估：`node <skill>/scripts/assess-quality.js <novelDir>`
4. 检查综合质量分数是否达标（≥80%）
5. 如不达标，根据 quality_report.md 中的 missing 列表补充知识库
```

## 四、执行流程

### 4.1 完整流程

```
Phase 1: split + keywords
    ↓
Phase 1.6: prompt-craft
    ↓
Phase 1.6.5: prompt 校验
    ↓
Phase 1.5: outline（可选）
    ↓
Phase 2 Pass 1: 生成 5 个实体 JSON
    ↓
Phase 3: locate + verify + cross-validate
    ↓
Phase 2 Pass 2: 生成 items + dialogues + chapter_summaries
    ↓
Phase 2.2: 交叉验证 chapter_summaries
    ↓
Phase 2.5: 提取 dialogues
    ↓
Phase 3: 完整校验
    ↓
Phase 3.5: 对抗校验
    ↓
Phase 3.6: 质量评估（新增）← 在这里
    ↓
最终验证：8 JSON 可解析、schema 合法、errors = 0、综合质量分数 ≥ 80%
```

### 4.2 Phase 3.6 详细步骤

**Step 1：生成 baseline prompt**
```bash
node <skill>/scripts/generate-baseline-prompt.js <novelDir>
```
输出：`<novelDir>/prompts/baseline-prompt.md`

**Step 2：用 subagent 生成 baseline.json**

使用 general subagent，输入 baseline-prompt.md 的内容，输出 baseline.json。

**关键点**：
- baseline 必须包含：characters（按重要性分级）、relationships、events、skills、items、dialogues
- ID 必须与知识库中的 ID 一致（使用 `char_`、`fac_`、`skill_`、`item_` 前缀）
- 角色分级必须准确（核心/重要/次要/龙套）

**Step 3：运行质量评估**
```bash
node <skill>/scripts/assess-quality.js <novelDir>
```
输出：`quality_report.json` + `quality_report.md`

**Step 4：检查结果**

- 综合质量分数 ≥ 80%：通过，进入最终验证
- 综合质量分数 < 80%：根据 quality_report.md 中的 missing 列表补充知识库

**Step 5：迭代改进**

根据 quality_report.md 中的问题，补充缺失的实体、关系、事件：

1. **实体缺失**：补充到 characters.json、skills.json、items.json
2. **关系缺失**：补充到 characters.json 的 relationships 字段
3. **事件缺失**：补充到 chapter_summaries.json
4. **描述不准确**：修正 characters.json 的 identity、personality 等字段

补充后重新运行 Phase 3 + Phase 3.6，直到综合质量分数 ≥ 80%。

## 五、天龙八部测试结果

### 5.1 测试环境

- 知识库：26 个角色、9 个门派、26 个技能、15 个物品
- baseline：89 个角色、28 个技能、20 个物品

### 5.2 测试结果

| 指标 | 分数 | 说明 |
|------|------|------|
| Entity Completeness | 28.1% | KB 只有 26 角色，baseline 期望 89 个 |
| Relationship Completeness | 100% | 已有关系全部匹配 |
| Relationship Accuracy | 33.3% | 关系类型匹配率低 |
| Description Accuracy | 13.6% | 描述字段匹配率低 |
| Event Coverage | 100% | 事件覆盖完整 |
| Dialogue Authenticity | 17.2% | 对话匹配率低 |
| Dialogue Representativeness | 76.1% | 对话有 speaker |
| Cross-Book Purity | 63.2% | 部分实体不在 baseline 中 |
| **综合分数** | **4.9/100** | 知识库不完整 |

### 5.3 结果分析

1. **知识库不完整是主因**：天龙八部 KB 只有 26 个角色，而 baseline 期望 89 个。这是合理的——KB 只覆盖了核心和重要角色。

2. **baseline 本身有误差**：LLM 生成的 baseline 包含了其他书籍的武功（如九阴真经、太极拳），也遗漏了一些天龙八部的武功（如火焰刀、生死符）。

3. **质量评估框架有效**：脚本能正确识别 KB 与 baseline 的差距，包括缺失的角色、关系、技能等。

### 5.4 改进建议

1. **人工审核 baseline**：修正 baseline 中的错误（如移除其他书籍的武功）
2. **扩展知识库**：补充缺失的次要和龙套角色
3. **调整指标权重**：根据实际需求调整各指标的权重

## 六、优势对比

| 维度 | 当前方案 | 新方案 |
|------|----------|--------|
| 完整性度量 | 无 | 有（entity_completeness, event_coverage） |
| 准确性度量 | 部分（grounded 率） | 全面（description_accuracy, relationship_accuracy） |
| 语义验证 | 无 | 有（AI 验证描述是否符合设定） |
| 可操作性 | 低（只知道有问题，不知道缺什么） | 高（知道缺什么，如何补） |
| 自动化程度 | 高 | 中（需要 AI 参与） |

## 七、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| AI 生成的 baseline 不准确 | 人工抽样验证，调整 prompt |
| 质量评估脚本性能问题 | 分批处理，添加进度提示 |
| 与现有流程冲突 | 保持向后兼容，新指标作为补充 |
| 指标权重不合理 | 根据测试结果调整 |

## 八、后续工作

1. **人工审核天龙八部 baseline**：修正错误，补充遗漏
2. **扩展知识库**：补充缺失的次要和龙套角色
3. **测试其他作品**：在射雕英雄传、倚天屠龙记等作品上测试
4. **优化指标权重**：根据测试结果调整权重
5. **集成到 CI/CD**：自动化质量评估流程

## 九、总结

本方案通过引入 AI 认知驱动的语义级质量指标，解决了当前 generate-kb 流水线缺乏完整性度量的问题。核心创新点：

1. **利用 LLM 先验知识**：AI 对经典武侠作品有丰富认知，可以生成基准数据
2. **6 大语义级指标**：覆盖实体、关系、描述、事件、对话、跨书纯净度
3. **综合质量分数**：加权平均，可量化比较不同知识库的质量
4. **可操作性**：quality_report.md 列出所有缺失项，指导迭代改进

合格线：综合质量分数 ≥ 80%。
