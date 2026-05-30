---
name: format-novel-batch
description: Batch format Chinese wuxia novel chapters using sub-agent for intelligent typesetting and post-processing script for mechanical consistency enforcement. Use when user wants to format multiple novel chapters in batch, or mentions "批量排版", "批量处理章节", "format novel batch", "排版小说".
---

# 小说章节批量排版

## 工作流

```
{book_dir}/ch_original/  → node scripts/split-chapter.js --batch {book_dir}/ch_original
                         → {book_dir}/.ch_groups/{chapter}/
  → sub agent（逐组排版→写回→progress.js --done）
  → node scripts/merge-groups.js --batch {book_dir}/.ch_groups {book_dir}/ch_formatted
  → node scripts/post-process.js --dir {book_dir}/ch_original {book_dir}/ch_formatted
  → node scripts/post-process.js --validate {book_dir}/ch_formatted
```

## 目录约定

```
{book_dir}/
├── ch_original/               # 原始章节目录
├── ch_formatted/              # 排版后章节目录
└── .ch_groups/                # 分组文件+progress.json（自动生成）
    ├── ch_001/
    │   ├── ch_001_g001.md
    │   ├── ch_001_g002.md
    │   └── ...
    ├── ch_002/
    │   └── ...
    └── progress.json
```

`.ch_groups` 始终生成在 `ch_original` 的父目录（即书籍目录）下。脚本通过路径中 `ch_original` 段自动检测书籍目录，因此调用时**必须使用含书籍目录的完整路径**：

```bash
# ✅ 正确：含书籍目录路径
node scripts/split-chapter.js "金庸/天龙八部/ch_original/ch_01.md"

# ❌ 错误：纯相对路径导致 .ch_groups 生成在 CWD 下
node scripts/split-chapter.js ch_original/ch_01.md
```

### 1. 扫描

确认源目录（如 `ch_original`）存在，创建目标目录 `ch_formatted`。

### 2. 标准化分组

```bash
# 单章拆分（自动检测书籍目录，生成到 {book_dir}/.ch_groups/{chapter}/）
node scripts/split-chapter.js "金庸/天龙八部/ch_original/ch_04.md"

# 批量拆分（输入目录含 ch_original 段即可自动检测）
node scripts/split-chapter.js --batch "金庸/天龙八部/ch_original"
```

每组一个文件（如 `ch_04_g001.md`），输出到 `{book_dir}/.ch_groups/{chapter}/`。

### 3. Sub Agent 排版（关键）

**Sub agent 只做一件事**：读内容 → 按 [REFERENCE.md](./REFERENCE.md) 的规则排版 → 输出格式化文本。

| 角色 | 做的事 | 不做 |
|------|--------|------|
| 主 Agent | 遍历分组、读内容、构造提示词、调 sub agent、写回文件、更新进度 | 不替 sub agent 做排版 |
| Sub Agent | 接收规则+文本 → 输出格式化文本 | 不知道文件名、路径、组号、流程位置 |

主 Agent 循环：
```
for each 分组文件 in .ch_groups/{chapter}/:
  1. 读文件内容 → 2. 嵌入提示词（只给规则+内容，不含路径/组号）
  3. 调 sub agent 取输出 → 4. 覆写原文件 → 5. progress.js --done <文件>
```

### 4. 进度追踪

每章拆分后自动生成 `.ch_groups/progress.json`。合并脚本自动检查未完成组。

```bash
# --done 自动从文件路径检测 groups 目录，其余需要 --groups-dir
node scripts/progress.js --status                # 查看全部进度（需 --groups-dir 或上级命令）
node scripts/progress.js --done <group-file>     # 标记一组完成（自动检测目录）
node scripts/progress.js --groups-dir <dir> --status   # 指定 groups 目录查看进度
node scripts/progress.js --groups-dir <dir> --check <chapter>
node scripts/progress.js --groups-dir <dir> --reset <chapter>
```

### 5. 合并

```bash
# 单章合并（自动检测 groups 目录）
node scripts/merge-groups.js ch_04 {book_dir}/ch_formatted/ch_04.md

# 批量合并（指定完整路径）
node scripts/merge-groups.js --batch {book_dir}/.ch_groups {book_dir}/ch_formatted

# 或从 ch_original 自动检测 book_dir
node scripts/merge-groups.js --batch {book_dir}/.ch_groups {book_dir}/ch_formatted
```

### 6. 后处理

```bash
node scripts/post-process.js --dir {book_dir}/ch_original {book_dir}/ch_formatted
```

### 7. 验证

```bash
node scripts/post-process.js --validate {book_dir}/ch_formatted
```

验证报告：
```
ch_001.md  行数: 145  OK
ch_002.md  行数: 132  2 个警告
  [行 24]  长度 78 字 > 60
  [行 67]  行尾多余空格
```

问题章节需重新排版。

## 排版规则

| 规则 | 要求 |
|------|------|
| 无缩进 | 段落开头不要空格 |
| 对话独立成行 | 说话标记后空一行，对话单独一行 |
| 短对话合并 | 标记+对话 < 20 字时不换行 |
| 空行分隔 | 段落/对话之间空行 |
| 行长度 | 40-80 字，在句号处拆分，禁止逗号截断 |
| 引号 | 统一 `"`，确保配对 |

完整规则见 [REFERENCE.md](./REFERENCE.md)。

## 注意事项

- 保留原文内容，不改情节
- 章节标题保持原样
- 特殊符号（省略号、破折号）保持不变
- 处理完成后对比原文检查
