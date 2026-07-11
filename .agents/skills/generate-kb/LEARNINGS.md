# generate-kb 经验教训

天龙八部 pilot 的实测经验，供后续项目参考。

## 章节事件错位是最大风险

LLM 一次性生成 50 章的 chapter_summaries 时，最容易出现**事件与章节号错位**——记得事件本身，但记错了发生在哪一章。

**天龙八部 pilot 错位示例**：
| 章节 | LLM 标注 | 实际内容 |
|------|----------|----------|
| ch17 | 聚贤庄英雄宴 | 段誉王语嫣逃离西夏 |
| ch18 | 聚贤庄血战 | 乔峰养父母被害、玄苦圆寂 |
| ch19 | 乔峰阿朱感情发展 | **聚贤庄血战** |
| ch20 | 雁门关伏击真相 | 乔峰身世大白（基本正确） |

**后果**：Phase 2.5 按错误事件提取对话，ch18 提取了 6 条对话但全部验证失败（0% 真实率）。

**解决**：Phase 2.2 交叉验证 + 错误章节修正后重跑。

## prompt 质量直接影响后续阶段

专属 prompt 中的章节号错误会级联影响：
- outline.json 的实体分布
- Pass 1 的 source_refs 锚定
- chapter_summaries 的事件分配
- dialogues 的提取成功率

**Phase 1.6.5 的 prompt 校验是必要的防御步骤。**

## dialogues 提取方案演进

1. **旧方案（正则提取）**：每章抓 100+ 条对话，大量噪音，说话者识别不准
2. **LLM 凭记忆生成**：75% 真实率，但对虚竹线等段落记忆偏差大
3. **当前方案（LLM 读原文 + 事件锚定）**：66-73% 真实率，232 条对话覆盖 47/50 章

关键改进：让 LLM 先读原文再挑选对话，而不是凭记忆生成。

## items.owner 必须支持 faction ID

cross-validate.js 的 ID 引用完整性检查中，`items.owner` 不仅可以是 `characters.json` 中的角色 ID，还可以是 `factions.json` 中的门派 ID（如物品属于某个门派）。

**已修复**：`cross-validate.js` 第 155 行增加 `!factionIds.has(i.owner)` 检查。

## verify_dialogues.js 已参数化

原脚本硬编码了天龙八部目录路径，现已改为接受命令行参数：
```bash
node verify_dialogues.js <dialogues_json_file> [novelDir]
```

## 神雕侠侣+碧血剑审核发现的系统性缺陷（2026-07-09）

### 问题 1：Baseline 生成不可靠（根因）

baseline.json 由 LLM 凭记忆生成，存在三类问题：

| 问题 | 表现 | 影响 |
|------|------|------|
| **遗漏实体** | 白驼山、小慧等未收录 | 跨书纯净度误报 |
| **名称不一致** | 玄铁剑法 vs 玄铁剑 | 跨书纯净度误报 |
| **幻觉实体** | 阮沙主、刘继宗、索雪衣不存在 | 实体完整性误判 |
| **幻觉对话** | 10条基准对话中8条是编的 | 对话真实性误判 |

**解决**：
- `assess-quality.js` 新增 `validateBaseline()` 函数，验证 baseline 中的实体和对话是否在原文中出现
- 支持名称变体匹配（normalizeName + namesMatch）

### 问题 2：关系生成不完整

生成 characters.json 时只添加单向关系，没有自动添加反向关系，导致 30+ 个不对称警告。

**解决**：新增 `fix-relationships.js` 脚本，自动补全反向关系：
```bash
node fix-relationships.js <novelDir> [--dry-run]
```

### 问题 3：缺少原文验证环节

流程中没有强制验证：
- baseline 中的实体是否在原文中出现
- baseline 中的对话是否是真实原文

**解决**：`assess-quality.js` 新增 baseline 验证，检查所有实体和对话是否在原文中出现。

### 问题 4：名称规范化缺失

同一实体可能有多个名称变体（玄铁剑法/玄铁剑、五毒神掌/五毒、夏青青/青青），但流程中没有统一处理。

**解决**：
- `assess-quality.js` 的跨书纯净度检测支持名称变体匹配
- `cross-validate.js` 新增相似实体名称检测

### 问题 5：重复实体检测缺失

知识库中可能同时存在"夏青青"和"青青"这样的重复角色，但 cross-validate.js 没有检测。

**解决**：`cross-validate.js` 新增重复实体检测：
- 检测完全相同的名称
- 检测包含关系的名称（如"青青"包含"夏青青"）

### 改进后的流程

1. **Phase 1.7**：独立 baseline（含 relationships + events），禁止从 data 拷贝
2. **Phase 2.5 后**：`fix-relationships.js` 补反向关系
3. **Phase 3**：`cross-validate.js` 重复实体/相似名
4. **Phase 3.6**：`assess-quality.js` 双轨（金标 + honest）；自指 baseline → overall N/A

## 绝代双骄：自指 baseline 导致假 100 分（2026-07-11）

### 现象

`assess-quality.js` 报 Overall 100/100、单项全绿，但同时：
- Entity Quantity 60%（skills/locations 不足）
- baseline 缺 relationships/events
- 「江家」等原文不存在实体
- chapter_summaries 模板化

### 根因

1. baseline 从当前 `data/*.json` 生成 → Entity Completeness / Cross-Book Purity 恒 100
2. `expected=0` 时 completeness/event 默认 **100**
3. 对话「真实性」只查章+speaker，不查 quote 原文
4. Entity Quantity / baseline_validation **不进** overall

### 修复（已实现于 assess-quality.js）

- `detectSelfReferentialBaseline()` → `baseline_mode: invalid_self_ref | incomplete_gold | ok`
- expected=0 → `score: null` / `no_gold`
- 对话优先 **quote 原文命中**
- 输出 `honest_overall_score` + `completion_gate_passed`
- 金标 overall 在自指时为 **N/A**

### 流程约束

- Phase 1.7 独立 baseline 门禁
- 完成定义 = completion_gate，不是自指 100
- `.agents` 与 `.claude` 两份 skill **必须同步**

