---
name: format-novel-batch
description: 批量排版小说章节，使用 sub agent + 后处理脚本确保格式一致性。Use when user wants to format multiple novel chapters in batch, or mentions "批量排版", "批量处理章节", "format novel batch".
---

# 小说章节批量排版

## 快速开始

用户提供小说目录路径，由 AI 批量处理所有章节文件，输出到 `ch_formatted` 目录。

## 工作流程

### 1. 扫描源目录

- 确认源目录存在（如 `ch_original`）
- 获取所有 `.md` 文件列表
- 创建目标目录 `ch_formatted`

### 2. 分组处理

由于单章文件较大（200+行），需要分组处理：

1. 用脚本按行分割文件为 N 组（每组约 15 行）
2. 每组传给 sub agent 排版
3. sub agent 直接写入临时文件
4. 合并临时文件到输出文件

### 3. 后处理脚本

所有章节排版完成后，运行后处理脚本强制修正格式：

```bash
node scripts/post-process.js --dir ch_original ch_formatted
```

后处理脚本功能：
- **缩进移除**：移除全角空格缩进
- **短对话合并**：说话标记 + 对话 < 20 字时合并成一行
- **空行规范化**：保留段落间空行，移除过多连续空行
- **动态标记提取**：自动从内容提取说话标记并更新配置

## 排版规则

### 说话标记处理

- 识别说话标记：`说道：`、`笑道：`、`问道：` 等
- 说话标记后**空一行**
- 对话内容**单独一行**
- **短对话例外**：当说话标记 + 对话内容 < 20 字时，不换行

### 对话独立成行

- 对话必须单独一行，不能和叙述混在一起
- 对话前后用空行分隔

### 长对话拆分

- 长对话需要拆分时，拆分后的每段都要保持引号完整
- 每段对话之间空一行

### 行长度控制

- 一行内容建议 40-60 字
- 超过时需要智能拆分

### 段落格式

- **无缩进**：段落开头不要空格
- **空行分隔**：每个段落/对话之间用空行分隔

### 引号规范

- 引号使用由 AI 自行判断（中文引号或英文引号均可）
- 确保引号配对正确即可

## 批量处理方案

### 方案 A：逐章处理（推荐）

```
for each chapter:
  1. 读取章节文件
  2. 按行分割为 N 组（每组 15 行）
  3. 每组传给 sub agent 排版，直接写入文件
  4. 合并所有组到输出文件
  5. 运行后处理脚本修正格式
```

### 方案 B：Workflow 批处理

使用 Workflow 工具编排：

```javascript
phase('Scan')
const chapters = scanDir('ch_original/*.md')

phase('Format')
pipeline(chapters, 
  ch => agent(`排版 ${ch}，写入 ch_formatted/`, {writeTo: true}),
  ch => runPostProcess(ch)
)
```

## 脚本使用

### 单文件处理

```bash
node scripts/post-process.js input.md output.md
```

### 批量处理

```bash
node scripts/post-process.js --dir ch_original ch_formatted
```

### 查看配置

```bash
node scripts/post-process.js --config
```

## 配置文件

后处理脚本会自动创建 `scripts/speech-markers.json`，存储动态提取的说话标记：

```json
{
  "extraMarkers": [
    "左子穆道",
    "段誉笑道",
    "那少女道",
    ...
  ]
}
```

## 注意事项

- 保留原文内容，不修改故事情节
- 章节标题保持原样
- 特殊符号（如省略号、破折号）保持不变
- 处理完成后对比原文检查是否有遗漏

## 与 format-novel-chapters 的区别

| 特性 | format-novel-chapters | format-novel-batch |
|------|----------------------|-------------------|
| 处理方式 | 单章手动排版 | 批量自动排版 |
| 后处理 | 无 | 有（强制格式修正） |
| 动态标记 | 无 | 有（自动提取更新） |
| 适用场景 | 少量章节 | 大量章节（50+） |
