# distill 剩余数据源计划

日期：2026-06-23

## 现状

已完成：distill-characters / distill-items / distill-skills / distill-techniques

待评估：dialogues / locations / factions / chapter_summaries

## 各源分析

### dialogues.json（13137 条）— 值得写，复杂度高

**问题**：
- 1902 条缺 speaker（14.5%）
- 333 条≤2 字噪声（`嗤`、`着！`、`啊`）
- 326 个 unique speaker（远超角色数，含未归一化变体）
- tone 字段有重叠（`厉声`/`大声`、`轻笑`/`微笑`）

**清洗方向**：
- 删除≤2 字噪声对话
- speaker 归一化（变体 → 角色 ID）
- 缺 speaker 的 1902 条：尝试从上下文（前后对话的 listener）推断，无法推断则删除
- tone 归一化（合并近义词）

**难点**：speaker 归一化需要和 characters.json 做交叉匹配，326 个变体的归一化规则需要人工确认。

### locations.json（196 条）— 轻量处理即可

**问题**：
- 30 条缺 region
- 35 条缺 one_line
- region 命名不统一（`大理国` vs `大理城` vs `大理国万劫谷`）

**清洗方向**：
- 补全 region（从 source_refs 的文本推断）
- 补全 one_line
- region 归一化（建立标准 region 层级）

**评估**：196 条量不大，问题主要是缺失而非错误。可以用一个轻量 distill-locations 处理，也可以直接手动补。

### factions.json（77 条）— 可手动处理

**问题**：
- 5 条缺 type
- type 重叠：`家族`/`武林家族`/`武林世家`、`帮派`/`丐帮分舵`

**评估**：77 条是最小的数据集，type 不一致只影响约 10 条。不值得写独立 skill，手动修或写一个一次性脚本即可。

### chapter_summaries.json（50 条）— 不需要

结构干净，无噪声。是人工/AI 精心写的摘要，不需要 distill。

## 结论

| 文件 | 建议 | 优先级 |
|------|------|--------|
| dialogues.json | 写 distill-dialogues | 高（量大、问题多）|
| locations.json | 轻量 distill-locations 或手动补 | 中 |
| factions.json | 手动修 / 一次性脚本 | 低 |
| chapter_summaries.json | 不需要 | — |

## 下一步

1. 先跑 distill-techniques 验证效果
2. 写 distill-dialogues（最复杂、收益最高）
3. locations 和 factions 按需处理
