---
name: deconstruct-novel
description: 解构武侠小说，从排版后的原文中提取人物、武功、物品、地点、势力、对话、剧情摘要等结构化数据。Use when user wants to extract structured data from a novel, deconstruct a wuxia novel, or build a knowledge base from novel text.
---

# 解构小说

从 `ch_formatted/ch_*.md` 读取排版原文，提取结构化数据写入 JSON。

## 快速开始

```bash
node .agents/skills/deconstruct-novel/scripts/prepare.js <小说目录路径> [批次大小]
```

**示例**：
```bash
node .agents/skills/deconstruct-novel/scripts/prepare.js 金庸/天龙八部
node .agents/skills/deconstruct-novel/scripts/prepare.js 金庸/天龙八部 5
```

默认批次大小为 3 章。

## JavaScript 模块系统说明

**⚠️ 重要：ctx_execute 和脚本中使用 CommonJS 语法（`require`），不要使用 ESModule 语法（`import`）。**

```javascript
// ✅ 正确：CommonJS 语法
const fs = require('fs');
const path = require('path');

// ❌ 错误：ESModule 语法（不要使用）
import fs from 'fs';
import path from 'path';
```

**不要创建 `.cjs` 文件**，直接使用 `.js` 后缀即可。

## 架构：分批并行

**核心思路：** 章节按批次分组，批内串行处理，批间并行处理，最后合并所有注册表。

```
主 Agent（调度，不读章节）
  │
  ├── 准备：运行 prepare.js → 生成 batch_config.json
  │
  ├── 分批并行提取（批内串行，批间并行）
  │   批次1: ch_001 → ch_003  (Sub Agent 串行，更新 batch_1_registry.json)
  │   批次2: ch_004 → ch_006  (Sub Agent 串行，更新 batch_2_registry.json)
  │   批次3: ch_007 → ch_009  (Sub Agent 串行，更新 batch_3_registry.json)
  │   ...同时进行
  │
  ├── 合并注册表（主 Agent 执行）
  │   运行 merge-registries.js → 合并所有批次 registry 到 entity_registry.json
  │
  ├── 代码合并（主 Agent 执行）
  │   · dialogues.json ← ch_N.json 中的 dialogues 拼接
  │   · chapter_summaries.json ← ch_N.json 中的 chapter_summary 拼接
  │
  └── 最终输出（代码执行）
      · entity_registry.json → 拆分为 6 个 JSON 文件
      · dialogues + chapter_summaries → 代码合并为 2 个 JSON 文件
      · 共 8 个输出文件
```

---

## 工作流

### 第0步：准备（主 Agent 执行）

```bash
node .agents/skills/deconstruct-novel/scripts/prepare.js <小说目录路径>
```

脚本会生成 `batch_config.json`，包含：
- 章节总数、批次大小、批次数量
- 每批的章节列表
- 每批的 registry 副本路径

### 第1步：分批并行提取

**批间并行**：同时启动多个批次的 Sub Agent。

**批内串行**：每个批次内，章节按顺序处理，前一章完成后才处理下一章。

**批次 Sub Agent 启动模板**（主 Agent 复制此模板，替换变量后使用 Task 工具）：

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

**执行步骤**：
1. 初始化批次注册表（如果不存在，创建空的 entity_registry.json 结构）
2. 对于本批次的每一章：
   a. 用 Read 工具读取 ch_formatted/ch_{N}.md（只传 filePath）
   b. 用 Read 工具读取当前批次注册表
   c. 用 ctx_execute 运行 JavaScript 提取对话
   d. AI 匹配 speaker，撰写 chapter_summary，识别实体
   e. 用 ctx_execute 将提取结果写入 batch_json/ch_{N}_raw.json
   f. 用 ctx_execute 组装 ch_{N}.json 并更新批次注册表

**关键规则**：
- 禁止使用 Write 工具写入 JSON，必须用 ctx_execute
- 禁止对 speaker 识别过度思考，5秒内无法判断就标 null
- 每句有说话人的对话都必须提取
```

**主 Agent 并行启动示例**：

```javascript
// 伪代码：并行启动多个批次
const batchConfig = JSON.parse(fs.readFileSync('batch_config.json', 'utf8'));
const promises = batchConfig.batches.map(batch => {
  return launchBatchSubAgent(batch);
});
await Promise.all(promises);
// 所有批次完成后，继续下一步
```

### 第2步：合并注册表（主 Agent 执行）

```bash
node .agents/skills/deconstruct-novel/scripts/merge-registries.js <小说目录路径>
```

脚本会：
1. 读取所有批次的 registry 副本
2. 按照 constants.md 的合并策略合并到主 entity_registry.json
3. 输出合并后的实体统计

### 第3步：代码合并（主 Agent 执行）

主 Agent 用 `ctx_execute` 执行合并脚本：
```javascript
const fs = require('fs');
const path = require('path');
const batchDir = '<小说目录>/batch_json';
const files = fs.readdirSync(batchDir)
  .filter(f => f.startsWith('ch_') && f.endsWith('.json'))
  .sort();
let allDialogues = [];
let allSummaries = [];
for (const f of files) {
  const chapter = JSON.parse(fs.readFileSync(path.join(batchDir, f), 'utf8'));
  allDialogues = allDialogues.concat(chapter.dialogues || []);
  if (chapter.chapter_summary) {
    allSummaries.push({ chapter: chapter.chapter, summary: chapter.chapter_summary });
  }
}
allDialogues.sort((a, b) => a.chapter - b.chapter);
allSummaries.sort((a, b) => a.chapter - b.chapter);
fs.writeFileSync('<小说目录>/dialogues.json', JSON.stringify(allDialogues, null, 2), 'utf8');
fs.writeFileSync('<小说目录>/chapter_summaries.json', JSON.stringify(allSummaries, null, 2), 'utf8');
console.log(`dialogues.json: ${allDialogues.length} 条对话`);
console.log(`chapter_summaries.json: ${allSummaries.length} 章摘要`);
```

### 第4步：最终输出（代码执行）

主 Agent 用 `ctx_execute` 执行拆分脚本：
```javascript
const fs = require('fs');
const path = require('path');
const registry = JSON.parse(fs.readFileSync('<小说目录>/entity_registry.json', 'utf8'));
const outputDir = '<小说目录>';
for (const [type, data] of Object.entries(registry)) {
  fs.writeFileSync(path.join(outputDir, `${type}.json`), JSON.stringify(data, null, 2), 'utf8');
}
console.log('最终输出文件已生成：');
for (const [type, data] of Object.entries(registry)) {
  console.log(`  ${type}.json: ${data.length} 个实体`);
}
```

### 第5步：验证（主 Agent 执行）

验证最终 8 个 JSON 文件：
- JSON 格式可解析
- 每个实体的 source_refs 章节号在 1~总章数范围内
- 关系中的 target_id 全部存在
- known_skills 中的 skill_id 全部存在
- chapter_summaries.json 共 N 章
- dialogues.json 对话数合理

---

## 核心规则（Sub Agent 必读）

### 逐章精读

**禁止以下行为：**
- ❌ 使用 shell/python 脚本批量读取或处理章节文件
- ❌ 用 `ctx_execute` 或 `ctx_execute_file` 批量**读取**章节（必须用 Read 工具逐章读取）
- ❌ 跳过任何章节
- ❌ Read 时使用 `limit` 或 `offset` 参数截断章节内容
- ❌ 使用 Write 工具写入 JSON 文件（必须用 ctx_execute 写入）
- ❌ 创建 `.cjs` 文件（直接使用 `.js`，ctx_execute 支持 `require`）

**必须执行：**
- ✅ 用 Read 工具**逐个**读取每一个 `ch_*.md` 文件
- ✅ Read 调用**只传 filePath 一个参数**
- ✅ 确保每个实体都从原文中找到准确的 source_ref

### 对话提取完整性

**必须执行：**
- ✅ 每章中**每一句有明确说话人的对话**都必须提取
- ✅ 短对话（"是。"、"好。"、"不错。"）也要提取
- ✅ 内心独白不算对话，不提取
- ✅ 判断标准：**有引号包裹 + 能确定说话人 = 必须提取**

### 快速处理原则

**⚠️ 避免思考循环。**
- **speaker 识别**：有标注直接取，无标注用交替模式，5秒内无法判断就标 null
- **实体识别**：首次出现的新实体直接添加
- **chapter_summary**：写 2-3 句话概括主要情节

### JSON 写入方式

**⚠️ 禁止使用 Write 工具写入 JSON 文件。**

**必须执行：**
- ✅ JSON 文件一律用 `ctx_execute` + JavaScript 写入
- ✅ ctx_execute 中使用 `require('fs')` 而非 `import`

### JSON 格式安全

中文小说原文使用全角引号 `""`，**必须原样保留在 JSON 字符串中**。

---

## 参考文件

| 文件 | 内容 |
|------|------|
| `constants.md` | ID 规则、rank 排序表、枚举值域、更新策略表 |
| `schemas.md` | entity_registry.json 格式 + ch_N.json delta 格式 |
| `dialogue-rules.md` | speaker 提取的 4 条判断规则、误判排除、示例 |

---

## 自检清单

### 每章 Sub Agent 完成后
- batch_json/ch_N.json 已成功写入且 JSON 格式正确
- 批次注册表已更新且 JSON 格式正确
- **JSON 文件是通过 ctx_execute 写入的（非 Write 工具）**
- 本章每个实体都有 source_refs，chapter 号正确
- **chapter_summary 约200字**
- 角色 personality.traits ≥ 5 项
- 技能 techniques ≥ 2 个招式
- **对话数量合理：本章对话数 ≥ 本章角色数 × 2**

### 最终验证
- 所有 ID 都是小写拼音+下划线
- 角色 personality.traits ≥ 5 项
- 技能 techniques ≥ 2 个招式
- 物品 description ≥ 20 字
- chapter_summaries.json 共 N 章
- relationships 无重复 (target+type)
- **每个实体的 source_refs 章节号在 1~总章数 范围内**
