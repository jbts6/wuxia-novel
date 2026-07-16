---
name: generate-game-kb
description: 快速生成武侠小说游戏素材知识库（人物/武功/物品/章节摘要），目标 30-45 分钟完成
---

# generate-game-kb v2

以小说原文为唯一事实来源，生成四类游戏素材知识库。这是精简快速流程，事件和对话提取分离为独立 skill。

## 输出文件

```
data/
├── characters.yaml        # 人物
├── skills.yaml            # 武功+招式（招式作为 techniques 字段）
├── items.yaml             # 关键物品、武器装备
├── factions.yaml          # 势力门派
└── chapter_summaries.yaml # 章节摘要（机械生成）
```

## 核心规则

1. **AI 输出 YAML**：避免 JSON 格式错误
2. **人物 rank**：八级固定为 `平平无奇`→`初窥门径`→`略有小成`→`登堂入室`→`炉火纯青`→`出神入化`→`登峰造极`→`返璞归真`
3. **武功+招式统一**：招式作为 `skills[].techniques[]` 字段
4. **物品筛选**：只保留秘籍、剧情关键、高级药毒、神兵利器、其他稀有特殊
5. **章节摘要**：机械生成，AI 尝试数为 0
6. **不提取对话和事件**：分离为独立流程
7. **source_refs 必须保留**：草稿中每个实体必须有 source_refs，避免 AI 编造

## 最终输出字段

| 类型 | 字段 |
|------|------|
| characters | id, name, aliases, identity, role, rank, biography, faction, skills, items |
| skills | id, name, type, faction, rank, description, techniques |
| items | id, name, type, tags, description |
| factions | id, name, type, description |
| chapter_summaries | chapter, title, summary |

## 流程路径

```text
prepare
→ chapter:NNN（逐章提取，3 并发）
→ distill:factions（先提取势力）
→ distill:characters / distill:skills / distill:items（3 域并发）
→ assemble
→ verify
→ install
→ archive-run
```

## 路径管理（强制）

所有中间产物必须在书籍目录内，路径格式固定：

```
<书籍目录>/.game-kb-work/runs/<run-id>/
├── staging/<unit>_attempt_<NN>.json    # 草稿
├── accepted/<category>/<unit>.json     # 已接受
├── final/data/*.json                   # 最终数据
└── progress.json                       # 进度
```

**禁止**：子代理不得在书籍目录外写文件，不得生成 .js/.py 等脚本文件。

## 逐章提取

读取 [prompts/extract-chapters.md](prompts/extract-chapters.md)。

- 每个子代理处理一个章节，直接读取原文
- 提取：人物、武功、招式、关键物品
- **不提取**：事件、对话、地点、势力（分离为独立流程）
- 每个人物/武功必须写暂定 `power_rank`
- staging 路径：`<run-dir>/staging/chapter_<NNN>_attempt_<NN>.json`

并发规则：
- 最多 3 个 Worker 并发
- 429 限流时 `3 → 1` 退避
- 相同输出或格式错误提前进入 manual_review

## 域蒸馏

读取 [prompts/distill-domain.md](prompts/distill-domain.md)。

**顺序**：先蒸馏 factions，再并行蒸馏 characters/skills/items。

| 单元 | 类别 | 标准 | 顺序 |
|---|---|---|---|
| `distill:factions` | factions | 合并同名势力，统一 ID | **先执行** |
| `distill:characters` | characters | 人物 keep 必须给全书巅峰 power_rank | 后续并行 |
| `distill:skills` | skills | 武功 keep 必须给全书巅峰 power_rank；招式必须 named_in_source | 后续并行 |
| `distill:items` | items | 只保留秘籍、剧情关键、高级药毒、神兵利器 | 后续并行 |

- factions 必须先完成，因为 characters 和 skills 都引用 faction
- 每域生成一个草稿
- staging 路径：`<run-dir>/staging/distill_<category>_attempt_<NN>.json`

## 组装与验证

```bash
node "$CLI" assemble "$NOVEL"      # 确定性组装四类实体
node "$CLI" verify "$NOVEL"        # 独立验证
node "$CLI" install "$NOVEL"       # 安装到 data/
node "$CLI" archive-run "$NOVEL"   # 归档
```

验证阻断项：
- 人物/武功缺 power_rank
- 招式未由原文明确定名
- 普通物品进入关键物品库
- 稳定 ID、引用闭包、证据章号不完整

## 有界失败

每个单元最多 3 次提交：初始、格式修正、语义补救。相同错误或震荡进入 manual_review。

## 耗时目标

| 环节 | 目标耗时 |
|------|---------|
| 章节提取（21 章） | 15-20 min |
| 域蒸馏 factions | 2-3 min |
| 域蒸馏 characters/skills/items | 8-12 min |
| 组装+验证 | 3-5 min |
| **总计** | **28-40 min** |

硬上限：45 分钟。超时不能放宽正确性门。
