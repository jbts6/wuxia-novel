---
name: batch-format-novel
description: Use when a wuxia novel directory needs formatted chapter files, when ch_formatted is missing before deconstruction, or when raw txt/ch_original chapters need normalization.
---

# 批量排版小说

把小说目录整理成 `<小说目录>/ch_formatted/ch_*.md`，供 `deconstruct-novel` 继续抽取。

下文的 `<技能目录>` 指当前加载的 `batch-format-novel` 技能目录，例如 `.agents/skills/batch-format-novel` 或 `.claude/skills/batch-format-novel`。

## 执行

```bash
node <技能目录>/scripts/batch-format.js <小说目录路径>
```

脚本会：
- 没有 `ch_original/` 时，从目录内 `.txt` 拆分章节。
- 没有章节标题时，把整本作为 `ch_original/ch_01.md`。
- 创建 `ch_formatted/`，跳过已排版章节，只处理缺失章节。
- 对章节做引号规范化、段落空行和行宽整理。

## 必守规则

- 运行前确认小说目录存在。
- 如果既没有 `.txt`，也没有 `ch_original/ch_*.md`，向用户要原文文件。
- 如果拆分章数明显不对，先停下，让用户确认章节标题格式；不要继续排版错误章节。
- 不要手动覆盖已存在的 `ch_formatted/ch_*.md`。要重排某章，先让用户确认删除对应文件。
- 输出成功条件：`ch_formatted/` 存在，且至少有一个 `ch_*.md`。

## 何时人工介入

| 情况 | 处理 |
|------|------|
| 标题格式无法识别但全文很短 | 整本作为一章 |
| 标题格式无法识别且全文很长 | 询问用户章节标题格式 |
| 生成章节数异常 | 停止，报告章数和疑似标题样例 |
| 需要重新排版 | 只删除用户指定章节的 formatted 文件后重跑 |

## 脚本

| 脚本 | 用途 |
|------|------|
| `scripts/batch-format.js` | 总入口 |
| `scripts/split-by-chapter.js` | txt 拆分到 `ch_original/` |
| `scripts/auto-format.js` | 单章排版到 `ch_formatted/` |
