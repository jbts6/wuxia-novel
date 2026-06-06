# Sub Agent 启动模板 + 规则

## 批次 Sub Agent 启动模板

主 Agent 复制此模板，替换变量后使用 Task 工具：

```
你是小说解构专家。请处理批次 {BATCH_NUM}，包含章节：{CHAPTERS}。

**任务**：依次处理本批次的每一章，提取结构化数据并更新批次注册表。

**文件路径**：
- 章节文件：ch_formatted/ch_{N}.md
- 批次注册表：batch_json/batch_{BATCH_NUM}_registry.json（每章完成后更新）
- 输出目录：batch_json/

**参考文件**（必须先阅读）：
- .agents/skills/deconstruct-novel/schemas.md
- .agents/skills/deconstruct-novel/constants.md
- .agents/skills/deconstruct-novel/dialogue-rules.md

**恢复检测（先执行，再决定从哪章开始）**：
1. 读取 batch_json/ 目录（用 ctx_execute: fs.readdirSync）
2. 检查本批次的哪些 ch_{N}.json 已存在
3. 已完成的章节跳过 → 从第一个未完成的章节开始
4. 读取已存在的批次注册表（如果有），在其基础上继续
5. 如果本批次所有章节都已完成 → 直接报告"本批次全部完成"并退出

**执行步骤**：
1. 初始化批次注册表（如果不存在且批次未完成，创建空的 entity_registry.json 结构）
2. 对于本批次中**未完成**的每一章（按序号从小到大）：
   a. 用 Read 工具读取 ch_formatted/ch_{N}.md（只传 filePath）
   b. 用 Read 工具读取当前批次注册表（每章前重新读取，保证恢复时状态最新）
   c. 用 ctx_execute 运行 JavaScript 提取对话（stdout 输出 JSON）
   d. AI 匹配 speaker，撰写 chapter_summary，识别实体，格式化为 JS 对象字面量
   e. 用 ctx_execute 直接组装 ch_{N}.json 并更新批次注册表（AI 的分析结果作为字面量内联在脚本中）

**关键规则**：
- 禁止使用 Write 工具写入 JSON，必须用 ctx_execute
- ❌ 禁止创建任何中间文件，包括但不限于：`_raw.json`、`_processed.json`、`_analysis.json`、`_temp.json`、`_dialogues.json`、`_text.json`、`_group_*`、`_paras.json`
- ❌ 禁止往系统临时目录（`%TEMP%`、`/tmp`）写入任何文件
- 每章只产出一个文件：`batch_json/ch_{N}.json`，不得有其他输出
- 禁止对 speaker 识别过度思考，5秒内无法判断就标 null
- 每句有说话人的对话都必须提取
- tone 字段：从 constants.md 的 dialogue_tone 枚举（42个合法值）中选择，只取情绪/语气，不取动作或叙事描写；无法判断用"陈述"
```

---

## 逐章精读

**禁止以下行为：**
- ❌ 使用 shell/python 脚本批量读取或处理章节文件
- ❌ 用 `ctx_execute` 或 `ctx_execute_file` 批量**读取**章节（必须用 Read 工具逐章读取）
- ❌ 跳过任何需要处理的章节（恢复模式下跳过已完成章节是允许的）
- ❌ Read 时使用 `limit` 或 `offset` 参数截断章节内容
- ❌ 使用 Write 工具写入 JSON 文件（必须用 ctx_execute 写入）
- ❌ 创建 `.cjs` 文件（直接使用 `.js`，ctx_execute 支持 `require`）

**必须执行：**
- ✅ 用 Read 工具**逐个**读取每一个 `ch_*.md` 文件
- ✅ Read 调用**只传 filePath 一个参数**
- ✅ 确保每个实体都从原文中找到准确的 source_ref

## 对话提取完整性

**必须执行：**
- ✅ 每章中**每一句有明确说话人的对话**都必须提取
- ✅ 短对话（"是。"、"好。"、"不错。"）也要提取
- ✅ 内心独白不算对话，不提取
- ✅ 判断标准：**有引号包裹 + 能确定说话人 = 必须提取**

## 快速处理原则

**⚠️ 避免思考循环。**
- **speaker 识别**：有标注直接取，无标注用交替模式，5秒内无法判断就标 null
- **实体识别**：首次出现的新实体直接添加
- **chapter_summary**：写 2-3 句话概括主要情节

## JSON 写入方式

**⚠️ 禁止使用 Write 工具写入 JSON 文件。**

**必须执行：**
- ✅ JSON 文件一律用 `ctx_execute` + JavaScript 写入
- ✅ ctx_execute 中使用 `require('fs')` 而非 `import`

## JSON 格式安全

中文小说原文使用全角引号 `""`，**必须原样保留在 JSON 字符串中**。

---

## Sub Agent 自检清单

### 每章完成后
- batch_json/ch_N.json 已成功写入且 JSON 格式正确
- 批次注册表已更新且 JSON 格式正确
- **JSON 文件是通过 ctx_execute 写入的（非 Write 工具）**
- 本章每个实体都有 source_refs，chapter 号正确
- **chapter_summary 约200字**
- 角色 personality.traits ≥ 5 项
- 技能 techniques ≥ 2 个招式
- **对话数量合理：本章对话数 ≥ 本章角色数 × 2**
- **所有 dialogue.tone 均属于 constants.md 的 dialogue_tone 枚举**

### 中断恢复检查（恢复处理时）
- ✅ 读取 batch_json/ 目录，确认哪些章节已完成
- ✅ 读取已存在的 batch_registry.json，在其基础上继续
- ✅ 跳过已完成的章节，只处理 pending 的章节
- ✅ 每章处理前重新读取批次注册表（保证恢复时状态最新）
- ✅ 恢复完成后，本批次所有 ch_N.json + batch_registry.json 完整
