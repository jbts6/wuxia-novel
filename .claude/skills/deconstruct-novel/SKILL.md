---
name: deconstruct-novel
description: 解构武侠小说，从排版后的原文中提取人物、武功、物品、地点、势力、对话、剧情摘要等结构化数据。Use when user wants to extract structured data from a novel, deconstruct a wuxia novel, or build a knowledge base from novel text.
---

# 解构小说

从 `ch_formatted/ch_*.md` 读取排版原文，提取结构化数据写入 JSON。

## 快速开始

```bash
node .agents/skills/deconstruct-novel/scripts/prepare.js <小说目录路径>
```

**示例**：
```bash
node .agents/skills/deconstruct-novel/scripts/prepare.js 金庸/天龙八部
```

**中断恢复：**
```bash
node .agents/skills/deconstruct-novel/scripts/resume.js <小说目录路径>
```

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

## 架构：增量写入 + 自主并行 + 可恢复

**核心思路：** 每章分段处理，增量写入进度文件（JSONL），中断后从上次中断的段落继续，最后合并为完整的 ch_N.json。

```
主 Agent（调度，不读章节）
  │
  ├── 准备：运行 prepare.js → 生成 chapter_list.json
  │
  ├── 恢复检测（中断后继续时执行）
  │   运行 resume.js → 扫描 batch_json/，报告已完成/未完成的章节
  │
  ├── 并行提取（Agent 自主调度）
  │   每个 Sub Agent 只处理 1 章
  │   唯一约束：RPM < 100（每分钟请求数不超过100）
  │   增量模式：分段读取 → 逐段提取 → 追加到 progress.jsonl → 最终合并为 ch_N.json
  │   中断恢复：读取 progress.jsonl 行数，跳过已完成的段
  │
  ├── 合并实体（主 Agent 执行）
  │   运行 merge-entities.js → 从所有 ch_N.json 合并到 entity_registry.json
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

### 增量写入流程

```
章节文件 (ch_001.md)
    │
    ├── 段落1 → 提取对话+实体 → 追加到 ch_001_progress.jsonl
    ├── 段落2 → 提取对话+实体 → 追加到 ch_001_progress.jsonl
    ├── 段落3 → 提取对话+实体 → 追加到 ch_001_progress.jsonl
    │   （如果中断，下次从第4段继续）
    ├── ...
    └── 段落N → 提取对话+实体 → 追加到 ch_001_progress.jsonl
                                              │
                                              ▼
                                    合并所有段落 + 生成摘要
                                              │
                                              ▼
                                    ch_001.json (最终文件)
```

---

## 工作流

### 第0步：准备（主 Agent 执行）

```bash
node .agents/skills/deconstruct-novel/scripts/prepare.js <小说目录路径>
```

脚本会生成 `chapter_list.json`，包含：
- 章节总数
- 所有章节文件列表

**中断恢复：** 如果 `batch_json/` 中已有部分 `ch_*.json`，脚本会提示已有提取结果。

### 第1步：流程恢复（中断后继续时执行）

如果中断后重新开始（会话超时、断连等），**必须先运行 resume.js 检测当前状态**，不要直接启动提取。

```bash
node .agents/skills/deconstruct-novel/scripts/resume.js <小说目录路径>
```

#### 输出解读

resume.js 会扫描 `batch_json/`，报告：
- 已完成的章节数量和列表
- 待处理的章节数量和列表
- entity_registry.json 是否存在
- 最终 8 个输出文件的状态

#### 主 Agent 恢复决策

```
if 还有未完成的章节:
    启动 Sub Agent 继续提取 → 第2步
elif entity_registry.json 不存在:
    运行 merge-entities.js → 第3步
elif 最终产物不完整(少于8个):
    运行代码合并/最终拆分 → 第4~5步
else:
    🎉 全部完成，验证即可 → 第6步
```

**Sub Agent 会跳过已存在的章节**，因此重复运行是安全的。

---

### 第2步：并行提取

**⚠️ 主 Agent 调度约束**

**硬性限制：RPM < 100**（每分钟请求数不超过100）

**核心规则：每个 Sub Agent 只处理 1 章**

这样可以：
- 最大化并行度
- 每章完成得更快
- 单个 Sub Agent 失败不影响其他章节

**调度策略：**
- 每章约需 10-15 次请求（Read + ctx_execute）
- 同时并行 5-8 个 Sub Agent
- 某个完成后立即启动下一个待处理章节

**Sub Agent 启动模板**在 `.agents/skills/deconstruct-novel/subagent-template.md`，主 Agent 用 Read 工具读取后复制给 Task 工具。

**主 Agent 状态追踪表格（每次启动/完成更新）：**

| 章节 | 状态 | 说明 |
|------|------|------|
| ch_001 | ✅ 完成 | ch_001.json 已存在 |
| ch_002 | ✅ 完成 | ch_002.json 已存在 |
| ch_003 | ▶️ 运行中 | Sub Agent A |
| ch_004 | ▶️ 运行中 | Sub Agent B |
| ch_005 | ▶️ 运行中 | Sub Agent C |
| ch_006 | ⬜ 队列中 | 等待启动 |
| ... | ⬜ 队列中 | 等待启动 |

### 第3步：合并实体（主 Agent 执行）

**⚠️ 合并前检查：** 如果还有未完成的章节，可以合并但数据不完整。建议先完成所有章节再合并。

```bash
node .agents/skills/deconstruct-novel/scripts/merge-entities.js <小说目录路径>
```

脚本会：
1. 扫描所有 `batch_json/ch_*.json`（按章节顺序）
2. 从每个文件的 `new_entities` 和 `entity_updates` 字段提取实体
3. 按 ID 去重，合并 source_refs
4. 输出 `entity_registry.json`

### 第4步：代码合并（主 Agent 执行）

**⚠️ 合并前检查：** `batch_json/` 中必须存在 `ch_*.json`。如果因中断缺少部分章节，代码合并仍然可以运行（只合并已有的章节），最终输出中会缺失那些章节的数据。建议先完成所有章节再运行此步。

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
console.log(`[合并] 共处理 ${files.length} 个章节文件`);
console.log(`dialogues.json: ${allDialogues.length} 条对话`);
console.log(`chapter_summaries.json: ${allSummaries.length} 章摘要`);
```

### 第5步：最终输出（代码执行）

**⚠️ 执行前检查：** `entity_registry.json` 必须存在。如果文件不存在或为空，请先运行第3步（合并实体）。

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

### 第6步：验证（主 Agent 执行）

验证最终 8 个 JSON 文件：
- JSON 格式可解析
- 每个实体的 source_refs 章节号在 1~总章数范围内
- 关系中的 target_id 全部存在
- known_skills 中的 skill_id 全部存在
- chapter_summaries.json 共 N 章
- dialogues.json 对话数合理
- dialogues.json 中所有 tone 值均属于 constants.md 的 dialogue_tone 枚举（≤ 41 种）

**恢复后验证（如果是中断后继续）：**
- 所有已完成的 ch_N.json 都能被正确解析
- 合并后的 entity_registry.json 中无重复实体
- entity_registry.json 中的 source_refs 覆盖了已处理的所有章节
- 最终输出的 8 个文件完整无缺失

---

## 参考文件

| 文件 | 内容 |
|------|------|
| `subagent-template.md` | Sub Agent 启动模板 + 核心规则 + 自检清单 |
| `constants.md` | ID 规则、rank 排序表、枚举值域、更新策略表 |
| `schemas.md` | entity_registry.json 格式 + ch_N.json delta 格式 |
| `dialogue-rules.md` | speaker 提取规则 + tone 提取规则（受控词汇表、映射表、否定清单） |

---

## 自检清单

Sub Agent 的每章自检清单和恢复检查请见 `subagent-template.md`。

### 最终验证
- 所有 ID 都是小写拼音+下划线
- 角色 personality.traits ≥ 5 项
- 技能 techniques ≥ 2 个招式
- 物品 description ≥ 20 字
- chapter_summaries.json 共 N 章
- relationships 无重复 (target+type)
- **每个实体的 source_refs 章节号在 1~总章数 范围内**
