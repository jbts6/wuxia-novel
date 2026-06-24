---
name: deconstruct-novel
description: Use when the user asks to deconstruct a formatted wuxia novel, extract structured entities/dialogues/summaries, build a novel knowledge base, or resume an interrupted extraction run.
---

# 解构小说

从 `<小说目录>/ch_formatted/ch_*.md` 提取结构化数据。主 Agent 负责调度、合并、质量审计和下游交接；章节正文由章节工作单元按章处理：优先使用 Sub Agent，Sub Agent 不可用时由主 Agent 进入顺序兼容模式。

本技能产出的是 **raw extraction / 候选知识层**，目标是高召回、证据完整、便于后续清洗；它不是最终人工可用的设定库。最终可读数据必须继续交给对应 `distill-*` 技能清洗、合并和定级。

下文的 `<技能目录>` 指当前加载的 `deconstruct-novel` 技能目录，例如 `.agents/skills/deconstruct-novel` 或 `.claude/skills/deconstruct-novel`。

## 必守规则

- 先确认 `<小说目录>/ch_formatted/ch_*.md` 存在；如果 `ch_formatted` 不存在或为空，必须先使用 `batch-format-novel` 格式化原文。
- 先判断状态：首次运行 `prepare.js`；中断、断连或不确定进度时先运行 `resume.js`。
- 默认优先用 Sub Agent；每个 Sub Agent 只处理 1 章，最多同时 3 个，保持 RPM < 100。
- 如果 Claude Code、第三方模型或当前工具环境无法启动 Sub Agent，第一次派发失败后立刻切换顺序兼容模式；不要反复重试派发。
- 顺序兼容模式下，主 Agent 可以读取并处理当前 1 章正文，但不能跨章通读；每次只写当前章节的 progress、summary 和 `ch_NNN.json`，完成后运行 `resume.js` 再处理下一章。
- 调度只以文件事实为准：有效 `ch_NNN.json` 才算完成；无效 JSON、缺失字段、坏 ID 都不算完成。
- 章节提取必须增量写 `batch_json/ch_NNN_progress.jsonl`，最后合并为 `batch_json/ch_NNN.json`；重跑要跳过已完成章节和已完成段落。
- 首次处理一本书时必须先做 pilot gate：只跑 1-2 章，生成质量报告并检查失败模式；不能直接全书并发。
- 结构验证通过不等于质量合格；必须运行 `quality-report.js` 审计英文/问号占位、泛称实体、短说明、speaker 为空、重名和跨类型污染。
- 不要在 deconstruct 阶段硬做最终裁判。对不确定、泛称、噪音实体要保留证据并通过质量报告暴露，最终取舍交给 `distill-*`。
- 使用 CommonJS `require`；不要用 ESM `import`，不要创建 `.cjs` 文件。
- ID、schema、rank、枚举、dialogue tone 规则以参考文件为准，不在主技能里复述。

## 执行顺序

0. 前置检查：确认 `<小说目录>/ch_formatted/` 中存在 `ch_*.md`。缺失时先调用 `batch-format-novel`，完成后再继续。
1. 准备或恢复：
   - 首次：`node <技能目录>/scripts/prepare.js <小说目录路径>`
   - 继续：`node <技能目录>/scripts/resume.js <小说目录路径>`
2. 判断执行模式：
   - Sub Agent 可用：读取 `subagent-template.md`，按章启动章节工作单元。
   - Sub Agent 不可用或首次派发失败：进入顺序兼容模式，由主 Agent 按 `subagent-template.md` 一次处理 1 章。
3. 首次全书处理时先做 pilot gate：
   - 只处理 1-2 个待处理章节；1 个章节工作单元 = 1 章。
   - 每章生成有效 `batch_json/ch_NNN.json` 后运行 `node <技能目录>/scripts/quality-report.js <小说目录路径>`。
   - 检查 `deconstruct_report.md`：如果 high 问题集中在英文/问号占位、泛称实体、短说明、模板化招式、speaker 为空，先修正本次章节工作指令或章节输出，再继续全书。
4. pilot 通过后继续处理剩余章节：
   - Sub Agent 模式：按待处理章节启动 Sub Agent，最多同时 3 个。
   - 顺序兼容模式：主 Agent 每次只处理 1 章，完成后运行 `resume.js` 选择下一章。
5. 所有目标章节生成 `batch_json/ch_*.json` 后，依次运行：
   - `node <技能目录>/scripts/merge-entities.js <小说目录路径>`
   - `node <技能目录>/scripts/merge-dialogues.js <小说目录路径>`
   - `node <技能目录>/scripts/split-registry.js <小说目录路径>`
   - `node <技能目录>/scripts/quality-report.js <小说目录路径>`
6. 验证最终产物，并在最终回复中明确说明：这是 deconstruct raw 产物；如果用户要人工可用设定库，下一步必须运行对应 `distill-*` 技能。

## 主 Agent 文件状态门

主 Agent 不依赖 Sub Agent 的口头状态、运行表或通知。每次章节工作单元完成、失败、超时、用户恢复会话，或准备进入下一阶段前，都必须运行 `resume.js` 或等价文件扫描，并按文件有效性重新计算：

```text
completed = 存在且校验通过的 batch_json/ch_NNN.json
unfinished = 无效章节 + 可恢复章节 + 未开始章节
if unfinished > 0:
    继续处理或修复对应章节，直到文件有效
else:
    进入合并阶段
```

硬性解释：
- Sub Agent 是否还在运行不参与完成判定；可能已经完成但没有通知，也可能已停止但留下 progress 文件。
- 顺序兼容模式没有后台 Sub Agent；完成判定仍然只看章节文件。
- 有效完成只看 `batch_json/ch_NNN.json` 是否存在、可解析、结构有效、ID 合规。
- 有 `progress.jsonl` 但无有效 `ch_NNN.json` 的章节必须重新处理或重新合并；章节工作单元会从已完成段落后继续。
- 禁止在 `unfinished > 0` 时进入合并、验证或最终收尾。

## 继续任务时

运行 `resume.js` 后按状态处理：

| 状态 | 下一步 |
|------|--------|
| 还有无效、可恢复或未开始章节 | 继续章节处理；Sub Agent 可用则派发，不可用则顺序兼容模式处理 |
| 章节完成但无 `entity_registry.json` | 运行 `merge-entities.js` |
| 最终 8 个产物不完整 | 运行 `merge-dialogues.js` 和/或 `split-registry.js` |
| 全部完整 | 只做验证 |

重复运行准备、恢复、合并脚本应当是安全的；不要因为已有部分结果而手动删除进度文件。

## 最终产物

必须生成 8 个 JSON 文件：

- `characters.json`
- `skills.json`
- `techniques.json`
- `factions.json`
- `locations.json`
- `items.json`
- `dialogues.json`
- `chapter_summaries.json`

同时必须生成 2 个审计文件：

- `deconstruct_report.json`
- `deconstruct_report.md`

## 验证重点

- 所有 JSON 可解析。
- `chapter_summaries.json` 覆盖章节数等于目标章节数。
- `dialogues.json` 的 `tone` 全部属于 `constants.md` 的 `dialogue_tone` 枚举。
- 实体 `source_refs` 的章节号在 `1..总章数` 范围内。
- `relationships.target` 和 `known_skills` 中的技能 ID 都能在最终实体中找到。
- ID 全部是小写拼音加下划线；`relationships` 不重复。
- `deconstruct_report.md` 已检查；high 问题要么已修复，要么在最终回复里列出并交给 distill。
- 人工可读字段不得大量出现英文占位、问号、`unknown`、`weapon`、`hidden_weapon`、模板化招式说明。
- `dialogues` 的 `speaker` 为空比例要作为质量风险报告；不能只因为 JSON 合法就忽略。

## Distill 交接

deconstruct 完成后按数据类型交接，不要把这些清洗逻辑塞回章节抽取阶段：

| 数据 | 下一步 |
|------|--------|
| `characters.json` | 使用 `distill-characters` |
| `skills.json` + `techniques.json` | 使用 `distill-skills-and-techniques` |
| `items.json` | 使用 `distill-items` |
| `dialogues.json` + `locations.json` + `factions.json` | 使用 `distill-dialogues-locations-factions` |

最终回复要给出报告路径、主要质量风险和建议的 distill 顺序。

## 参考文件

| 文件 | 用途 |
|------|------|
| `subagent-template.md` | 章节工作模板；Sub Agent 和顺序兼容模式共用 |
| `constants.md` | ID、rank、枚举、更新策略 |
| `schemas.md` | `entity_registry.json` 和 `ch_N.json` 格式 |
| `dialogue-rules.md` | speaker 和 tone 提取规则 |
| `scripts/quality-report.js` | raw 产物质量审计、pilot gate 和 distill 交接依据 |
| `scripts/*.js` | 准备、恢复、进度、合并、拆分、修复脚本 |
