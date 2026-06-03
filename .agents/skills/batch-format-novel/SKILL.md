---
name: batch-format-novel
description: 批量排版武侠小说章节。用户给出小说目录路径，自动完成 txt 拆分和排版。Use when batch formatting novel chapters or when user provides a novel directory path for formatting.
---

# 批量排版小说

## 快速开始

```bash
node .agents/skills/batch-format-novel/scripts/batch-format.js <小说目录路径>
```

**示例**：
```bash
node .agents/skills/batch-format-novel/scripts/batch-format.js "金庸/天龙八部"
```

## 工作流程

### 1. 检测目录结构

```
<小说目录>/
├── 天龙八部.txt          # 小说原文（txt 格式）
├── ch_original/          # 拆分后的章节原文（自动创建）
│   ├── ch_01.md
│   ├── ch_02.md
│   └── ...
└── ch_formatted/         # 排版后的章节（自动生成）
    ├── ch_01.md
    ├── ch_02.md
    └── ...
```

### 2. 章节拆分（如果需要）

**默认方式**：直接运行 `batch-format.js`，它会自动调用 `split-by-chapter.js` 完成拆分。

```bash
node .agents/skills/batch-format-novel/scripts/batch-format.js "<小说目录路径>"
```

**如果报错"未检测到章节标题"**，说明该书的章节格式尚未收录：
1. 读取 txt 文件开头（前 200 行），识别章节标题格式
2. **修改** `split-by-chapter.js` 的 `CHAPTER_PATTERNS` 数组，添加新的正则
3. 重新运行脚本

> ⚠️ **修改已有脚本，不要另写新脚本**。所有拆分逻辑统一在 `split-by-chapter.js` 中维护。

**常见格式示例**（均已内置支持）：
- 天龙八部：`一　　青衫磊落险峰行`（中文数字 + 标题）
- 射雕英雄传：`第一回 风雪惊变`
- 笑傲江湖：`灭门`（纯标题，需人工确认——此类无规律标题无法自动拆分）

**如果无法自动识别**：询问用户章节标题格式。

### 3. 增量排版

- 扫描 `ch_formatted` 中已存在的章节
- 跳过已排版的章节
- 只处理剩余章节

### 4. 执行排版

对每个待处理章节调用 `auto-format.js`：
- 识别说话标记（说道、笑道、心想等）
- 按叙述/对话分离
- 控制行宽（30-50 字符）
- 保持弯引号格式

## ⚠️ 重要：修改已有脚本，不要另写新脚本

`batch-format.js` 已内置完整的拆分 + 排版流程。**不要**另外编写新的拆分脚本。

**正确做法**：
```bash
# 1. 直接运行
node .agents/skills/batch-format-novel/scripts/batch-format.js "<小说目录路径>"

# 2. 如果报错，修改 split-by-chapter.js 的 CHAPTER_PATTERNS，然后重跑
```

## 输出示例

```
[批量排版] 金庸/天龙八部

[步骤 1] ch_original 不存在，开始拆分...
[识别] 章节格式：中文数字 + 标题
[拆分] 共 50 章

[统计] 原文: 50 章
[统计] 已排版: 3 章
[统计] 待处理: 47 章

[步骤 4] 开始排版 47 章...

  排版 ch_04.md...
  ✓ ch_04.md 完成

==================================================
[完成] 成功: 47 章
==================================================
```

## 依赖脚本

| 脚本 | 作用 |
|------|------|
| `batch-format.js` | 主入口：自动拆分 + 增量排版（一键完成） |
| `split-by-chapter.js` | 按章节标题拆分（内置多种格式，不要重写） |
| `auto-format.js` | 单章排版（说话标记、行宽、引号） |

## 常见问题

**Q: 如何重新排版某章？**
A: 删除 `ch_formatted` 中对应的 md 文件，重新运行 `batch-format.js`。

**Q: 章节标题格式不识别？**
A: 先运行 `batch-format.js`，如果报错则读取 txt 开头识别格式，**修改** `split-by-chapter.js` 的 `CHAPTER_PATTERNS` 添加新正则，然后重跑。不要另写新脚本。

**Q: 拆分不准确？**
A: **修改** `split-by-chapter.js` 中的 `CHAPTER_PATTERNS` 正则，然后重新运行。
