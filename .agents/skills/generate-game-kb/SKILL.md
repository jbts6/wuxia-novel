---
name: generate-game-kb
description: Use when generating or regenerating a source-grounded wuxia novel knowledge base for game design, especially when fast chapter-level extraction, nine compatible JSON files, martial-arts recall, bounded retries, or direct data installation are needed.
---

# generate-game-kb

以小说原文为唯一事实来源，快速生成面向武侠游戏素材的九类知识库。它是独立的 95 分实用流程，不是审计级 `generate-kb` 的六阶段状态机，也不能宣称通过 G1–G5。

设：

```bash
SKILL=.agents/skills/generate-game-kb
CLI="$SKILL/scripts/flow.js"
NOVEL=<作者>/<小说名>
```

开始任何阶段前完整读取 [schemas.md](schemas.md)，再读取该阶段对应的 `prompts/*.md`。只能把 AI 草稿写到受管产物目录之外，再用 `accept` 提交；不能直接编辑 `.game-kb-work/chapters`、`merged`、`cleaned`、`final`、`progress.json`、`manual_review.json` 或最终 `data/`。

## 恢复入口

每次开始或恢复只运行一次：

```bash
node "$CLI" prepare "$NOVEL"
node "$CLI" status "$NOVEL" --json
```

`prepare` 会保留输入哈希未变化的已完成章节。`status` 只用于观察文件清单，不返回命令，也不得循环调用来等待进展；读完一次状态后，选择一个尚未完成且未进入 `manual_review` 的单元处理。

## 1. 逐章提取

读取 [prompts/extract-chapters.md](prompts/extract-chapters.md)。每轮读取 2–3 章完整原文，但每章分别生成一个 JSON 草稿并分别提交：

```bash
node "$CLI" accept "$NOVEL" --unit chapter:003 --draft <章3草稿>
node "$CLI" accept "$NOVEL" --unit chapter:004 --draft <章4草稿>
```

完成标准：每个 manifest 章节都有一个 `done` 章节单元，或已明确进入 `manual_review`。某章转人工后继续其他独立章节；不要重做未变化的 `done` 章节。

## 2. 全书合并

所有章节均已接受且没有缺章时，读取 [prompts/merge-book.md](prompts/merge-book.md)，生成一次全书合并草稿：

```bash
node "$CLI" accept "$NOVEL" --unit merge:book --draft <合并草稿>
```

合并同一实体、别名和跨章事件；无法唯一裁决的同名异人或引用写入 `ambiguities`，不能猜测。合并成功后不再自动提交第二份合并结果。

## 3. 一次清理与数量复核

读取 [prompts/clean-book.md](prompts/clean-book.md)、已接受合并文件和 `pre_clean_quantity.json`，生成唯一一轮清理草稿：

```bash
node "$CLI" accept "$NOVEL" --unit clean:book --draft <清理草稿>
```

这一轮同时完成错类/伪实体清理、人物详略投影、对白精简和一次数量复核。数量超出建议区间只能记录解释，不能触发第二轮补数或删数。`clean:book` 成功后不得再次清理。

## 4. 稳定 ID、质量抽样与安装

AI 不生成、修补或猜测最终 ID。脚本一次生成稳定 ID 并重写全部引用：

```bash
node "$CLI" build-final "$NOVEL"
node "$CLI" verify "$NOVEL"
```

首次 `verify` 会固定 `final/reports/quality_sample.json`，并以 `QUALITY_REVIEW_REQUIRED` 停止。读取 [prompts/sample-quality.md](prompts/sample-quality.md)，只核对样本及其引用章节，再提交：

```bash
node "$CLI" accept "$NOVEL" --unit quality:sample --draft <抽样复核草稿>
node "$CLI" verify "$NOVEL"
```

工作区验证通过后才允许安装，并必须复验已安装结果：

```bash
node "$CLI" install "$NOVEL"
node "$CLI" verify "$NOVEL" --installed
```

只有最后一条命令成功，且 `data/` 中存在九类数组、安装回执存在、无人工问题，才可声明完成。`install` 会完整备份非空旧 `data/`、保留未知非目标条目、移除并记录 `REBUILD_REQUIRED.md`，失败时恢复旧目录。

## 有界失败规则

- 每个 `chapter:*`、`merge:book`、`clean:book`、`quality:sample` 最多 3 次总提交；首次生成已计入。
- 相同输出、相同标准化错误或 `A → B → A` 震荡会提前进入 `manual_review`。
- 重启不会重置同一输入哈希的次数。不得自动执行 `reset-unit`，也不得换文件名、换会话或反复调用 `accept` 绕过预算。
- `manual_review` 是人工终态：继续无依赖章节，但禁止 `build-final`/`install`。把问题清单交给用户，不自行重置。
- 有效但低于 95% 的质量复核直接转人工，不回到 merge/clean，也不重建全库。
- 任何确定性引用无法唯一解析时转人工；禁止让 AI 在多个 ID 方案之间循环修正。

## 内容取舍

- 功法与原文明确定名的招式优先高召回；“全力一挥”“拍出一掌”等普通动作既不是招式，也不另建动作类别。
- 事件优先经典冲突、奇遇、传承、反转和关系转折；允许跨多个不连续章节。
- 人物分 `核心/重要/次要/龙套/背景`；只详写前两级，后三档保持短记录。
- 物品只保留秘籍、剧情关键物、高级药毒、神兵利器或其他稀有特殊物品。
- 对白从属于事件，每个事件最多一条短对白。
- 证据必须不错章；行号、段落和锚点只需近似。旧 `data/`、百科、影视改编和模型记忆不能成为生成输入。

## 命令速查

| 命令 | 完成标准 |
|---|---|
| `prepare` | manifest 和逐章源文件存在 |
| `status --json` | 读取一次当前清单，不执行循环 |
| `accept --unit ... --draft ...` | 单元变为 `done` 或有界转人工 |
| `build-final` | 九类 final JSON 与游戏素材索引生成 |
| `verify` | 固定抽样已通过且无阻断问题 |
| `install` | 旧数据已备份、目录已替换、回执已写 |
| `verify --installed` | 只用已安装 data/报告/回执复验通过 |

《飞狐外传》等约 20 章中篇以 60 分钟为试跑基准，约 50 章长篇以 90 分钟为基准。耗时是性能证据，不是正确性门禁；超时不废弃已验证数据，也不能放宽上述停止条件。
