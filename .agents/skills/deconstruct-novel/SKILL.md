---
name: deconstruct-novel
description: Use when the user asks to deconstruct a formatted wuxia novel, extract structured entities/dialogues/summaries, build a novel knowledge base, or resume an interrupted extraction run.
---

# 解构小说

从 `<小说目录>/ch_formatted/ch_*.md` 提取结构化数据。主 Agent 负责调度、合并和验证；章节正文由 Sub Agent 按章处理。

下文的 `<技能目录>` 指当前加载的 `deconstruct-novel` 技能目录，例如 `.agents/skills/deconstruct-novel` 或 `.claude/skills/deconstruct-novel`。

## 必守规则

- 先确认 `<小说目录>/ch_formatted/ch_*.md` 存在；如果 `ch_formatted` 不存在或为空，必须先使用 `batch-format-novel` 格式化原文。
- 先判断状态：首次运行 `prepare.js`；中断、断连或不确定进度时先运行 `resume.js`。
- 主 Agent 不直接通读章节正文；每个 Sub Agent 只处理 1 章。
- 并发 5-8 个 Sub Agent，保持 RPM < 100。
- 调度必须保持活性：只要还有未完成章节且当前运行中的 Sub Agent 为 0，必须立即继续派发，不能等待、合并或收尾。
- 章节提取必须增量写 `batch_json/ch_NNN_progress.jsonl`，最后合并为 `batch_json/ch_NNN.json`；重跑要跳过已完成章节和已完成段落。
- 使用 CommonJS `require`；不要用 ESM `import`，不要创建 `.cjs` 文件。
- ID、schema、rank、枚举、dialogue tone 规则以参考文件为准，不在主技能里复述。

## 执行顺序

0. 前置检查：确认 `<小说目录>/ch_formatted/` 中存在 `ch_*.md`。缺失时先调用 `batch-format-novel`，完成后再继续。
1. 准备或恢复：
   - 首次：`node <技能目录>/scripts/prepare.js <小说目录路径>`
   - 继续：`node <技能目录>/scripts/resume.js <小说目录路径>`
2. 读取 `subagent-template.md`，按待处理章节启动 Sub Agent：1 个 Sub Agent = 1 章。
3. 所有目标章节生成 `batch_json/ch_*.json` 后，依次运行：
   - `node <技能目录>/scripts/merge-entities.js <小说目录路径>`
   - `node <技能目录>/scripts/merge-dialogues.js <小说目录路径>`
   - `node <技能目录>/scripts/split-registry.js <小说目录路径>`
4. 验证最终产物。

## 主 Agent 调度门

主 Agent 维护一个运行表：`queued`、`running`、`completed`、`failed`。每次 Sub Agent 完成、失败、超时、用户恢复会话，或运行 `resume.js` 后，都必须重新计算：

```text
unfinished = 可恢复章节 + 未开始章节
capacity = min(8, max(5, 100 RPM 允许的并发)) - running
if unfinished > 0 and running == 0:
    立即派发 min(5, unfinished) 个 Sub Agent
elif unfinished > 0 and capacity > 0:
    补足到 5-8 个 Sub Agent
else if unfinished == 0:
    进入合并阶段
```

硬性解释：
- `resume.js` 中的“可恢复章节”只表示有 `progress.jsonl`，不表示有 Sub Agent 正在运行。
- 有 `progress.jsonl` 但无 `ch_N.json` 的章节必须重新派发；Sub Agent 会从已完成段落后继续。
- 禁止在 `unfinished > 0 && running == 0` 时向用户汇报“等待中”、进入合并、验证或最终收尾。

## 继续任务时

运行 `resume.js` 后按状态处理：

| 状态 | 下一步 |
|------|--------|
| 还有可恢复或未开始章节 | 继续启动 Sub Agent 提取 |
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

## 验证重点

- 所有 JSON 可解析。
- `chapter_summaries.json` 覆盖章节数等于目标章节数。
- `dialogues.json` 的 `tone` 全部属于 `constants.md` 的 `dialogue_tone` 枚举。
- 实体 `source_refs` 的章节号在 `1..总章数` 范围内。
- `relationships.target` 和 `known_skills` 中的技能 ID 都能在最终实体中找到。
- ID 全部是小写拼音加下划线；`relationships` 不重复。

## 参考文件

| 文件 | 用途 |
|------|------|
| `subagent-template.md` | Sub Agent 启动模板、分段提取、自检清单 |
| `constants.md` | ID、rank、枚举、更新策略 |
| `schemas.md` | `entity_registry.json` 和 `ch_N.json` 格式 |
| `dialogue-rules.md` | speaker 和 tone 提取规则 |
| `scripts/*.js` | 准备、恢复、进度、合并、拆分、修复脚本 |
