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

## 架构：分批并行 + 可恢复

**核心思路：** 每章输出 checkpoint（`ch_N.json`），中断后可扫描已有产物恢复，不重复处理。

```
主 Agent（调度，不读章节）
  │
  ├── 准备：运行 prepare.js → 生成 batch_config.json
  │
  ├── 恢复检测（中断后继续时执行）
  │   运行 resume.js → 扫描 batch_json/，报告已完成/未完成的批次
  │   主 Agent 据此决定从何处继续
  │
  ├── 分批并行提取（批内串行，批间并行）
  │   批次1: ch_001 → ch_003  (Sub Agent 串行，更新 batch_1_registry.json)
  │   批次2: ch_004 → ch_006  (Sub Agent 串行，更新 batch_2_registry.json)
  │   批次3: ch_007 → ch_009  (Sub Agent 串行，更新 batch_3_registry.json)
  │   ...同时进行
  │   中断恢复：每章的 ch_N.json 作为 checkpoint，Sub Agent 跳过已存在的章节
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

**中断恢复：** 如果 `batch_json/` 中已有部分 `ch_*.json`，脚本会提示运行 `resume.js` 检测恢复点。

### 第1步：流程恢复（中断后继续时执行）

如果中断后重新开始（会话超时、断连等），**必须先运行 resume.js 检测当前状态**，不要直接启动批次提取。

```bash
node .agents/skills/deconstruct-novel/scripts/resume.js <小说目录路径>
```

#### 输出解读

resume.js 会扫描 `batch_json/`，对每个批次报告三种状态之一：

| 状态 | 含义 | 下一步 |
|------|------|--------|
| ✅ 完成 | 批次内所有章节已提取，registry 已更新 | 跳过，无需处理 |
| 🔄 部分完成 | 部分章节已提取，部分未完成 | 以恢复模式启动 Sub Agent（跳过已完成章节） |
| ⬜ 未开始 | 没有任何提取结果 | 正常启动 Sub Agent |

同时检测：
- `entity_registry.json` — 合并进度
- 8 个最终输出文件 — 是否全部就绪

生成的 `batch_resume.json` 包含结构化数据供脚本使用。

#### 主 Agent 恢复决策

根据 resume.js 的输出，决定从何处继续：

```
if 还有部分完成或未开始的批次:
    以恢复模式启动 Sub Agent → 第2步
elif entity_registry.json 不存在:
    运行 merge-registries.js → 第3步
elif 最终产物不完整(少于8个):
    运行代码合并/最终拆分 → 第4~5步
else:
    🎉 全部完成，验证即可 → 第6步
```

**从恢复的批次中，Sub Agent 会跳过已完成的章节**，因此重复运行是安全的。

---

### 第2步：分批并行提取

**批间并行**：同时启动最多3个批次的 Sub Agent。

**批内串行**：每个批次内，章节按顺序处理，前一章完成后才处理下一章。

**Sub Agent 启动模板**在 `.agents/skills/deconstruct-novel/subagent-template.md`，主 Agent 用 Read 工具读取后复制给 Task 工具。

**⚠️ 主 Agent 并行调度算法（硬约束，必须严格遵循）**

❌ **禁止**分批启动后等待全部完成再启动下一批
❌ **禁止**一次性启动所有批次然后等待
❌ **禁止**启动3个后等全部3个完成再启动下3个

✅ **必须**执行以下滑动窗口算法（含状态检测）：

```
// 第零步：状态检测（处理已完成的批次）
已完成 = []
for each 批次 in 队列:
    if 批次的所有 ch_N.json 已存在 且 batch_registry.json 已存在:
        标记为 已完成 → 不加入队列
    elif 批次的部分 ch_N.json 已存在:
        标记为 恢复模式 → 加入队列（携带 resume 标记）

队列 = [批次10(恢复模式), 批次11, 批次12, ..., 批次N]
运行中 = []

// 第一步：填充初始窗口（启动前3个）
while 运行中.length < 3 且 队列非空:
    启动 队列.shift() → 加入 运行中

// 第二步：滑动窗口（每收到一个完成通知，立即启动下一个）
while 运行中 非空:
    等待 运行中 任意一个完成
    从 运行中 移除已完成的
    打印当前进度 → 已完成批次/总批次
    if 队列非空:
        启动 队列.shift() → 加入 运行中
```

**实际操作示例**（假设批次10-22共13批，批次10/12已完成）：
1. 状态检测：批次10已完成（跳过），批次12已完成（跳过）
2. 同时启动批次 11（恢复模式）、13、14（3个并行）
3. 批次11完成 → 立即启动批次15
4. 批次13完成 → 立即启动批次16
5. ...如此循环，直到所有批次完成

**每收到一个 Task 完成通知后，立即检查队列并启动下一个，不要等到多个完成再启动。**

**主 Agent 状态追踪表格（每次启动/完成更新）：**

| 批次 | 状态 | 说明 |
|------|------|------|
| 第10批 | ✅ 跳过 | ch_28~ch_30.json 已存在 |
| 第11批 | 🔄 恢复模式 | ch_31.json ✓, ch_32.json ✗, ch_33.json ✗ |
| 第12批 | ✅ 跳过 | ch_34~ch_36.json 已存在 |
| 第13批 | ▶️ 运行中 | 正常启动 |
| ... | ⬜ 队列中 | 等待启动 |

### 第3步：合并注册表（主 Agent 执行）

**⚠️ 合并前检查：** 如果 `resume.js` 报告有未完成的批次，能合并但数据不完整。建议先完成所有批次再合并。

```bash
node .agents/skills/deconstruct-novel/scripts/merge-registries.js <小说目录路径>
```

脚本会：
1. 读取所有批次的 registry 副本（跳过不存在的副本）
2. 按照 constants.md 的合并策略合并到主 entity_registry.json
3. 输出合并后的实体统计，包含"已合并批次/总批次"信息

### 第4步：代码合并（主 Agent 执行）

**⚠️ 合并前检查：** `batch_json/` 中必须存在 `ch_*.json`。如果因中断缺少部分章节，代码合并仍然可以运行（只合并已有的章节），最终输出中会缺失那些章节的数据。建议先完成所有批次再运行此步。

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

**⚠️ 执行前检查：** `entity_registry.json` 必须存在。如果文件不存在或为空，请先运行第3步（合并注册表）。

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
