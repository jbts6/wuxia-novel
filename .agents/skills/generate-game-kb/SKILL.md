---
name: generate-game-kb
description: Use when quickly generating a source-grounded wuxia game knowledge base with characters, skills, items, factions, and chapter summaries in 30-45 minutes.
---

# generate-game-kb v4

以小说原文为唯一事实来源，生成四类实体和章节摘要。这是精简快速流程，事件和对话提取分离为独立 skill。

当前可写契约为 `semantic_contract_version: 4`、`semantic_profile: domain-distill-v1`。旧版本 run 只允许读取状态或显式归档；任何继续写入都必须报 `LEGACY_SEMANTIC_CONTRACT`，不得原地升级。

## 输出文件

最终数据严格为五个 YAML 文件：

```
data/
├── characters.yaml        # 人物
├── skills.yaml            # 武功+招式（招式作为 techniques 字段）
├── items.yaml             # 关键物品、武器装备
├── factions.yaml          # 势力门派
└── chapter_summaries.yaml # 章节摘要（机械生成）
```

## 核心规则

1. **YAML 语义产物**：AI 草稿、accepted 证据和最终数据统一使用 YAML
2. **人物 rank**：八级固定为 `平平无奇`→`初窥门径`→`略有小成`→`登堂入室`→`炉火纯青`→`出神入化`→`登峰造极`→`返璞归真`
3. **武功+招式统一**：招式作为 `skills[].techniques[]` 字段
4. **物品筛选**：只保留秘籍、剧情关键、高级药毒、神兵利器、其他稀有特殊
5. **章节摘要**：机械生成，AI 尝试数为 0
6. **不提取对话和事件**：分离为独立流程
7. **source_refs 必须保留**：草稿和 accepted 证据中每个实体必须有 source_refs；最终五文件只保留消费字段
8. **JSON 控制器产物**：状态、清单、收据和报告由脚本写为 JSON

## 最终输出字段

| 类型 | 字段 |
|------|------|
| characters | id, name, aliases, identity, level, rank, biography, faction, skills, items |
| skills | id, name, type, faction, rank, description, techniques |
| items | id, name, type, description |
| factions | id, name, type, description |
| chapter_summaries | chapter, title, summary |

## 流程路径

```text
archive-existing
→ prepare
→ chapter:NNN（逐章提取，5 并发）→ 主模型串行 accept
→ plan-domains
→ distill:factions / distill:characters / distill:skills / distill:items（四域独立，可并发生成草稿）→ 主模型串行 accept
→ assemble
→ verify
→ install
→ verify --installed
→ archive-run
```

## 路径管理（强制）

所有中间产物必须在书籍目录内，路径格式固定：

```
<书籍目录>/.game-kb-work/runs/<run-id>/
├── staging/<unit>_attempt_<NN>.yaml    # 草稿（AI生成，YAML格式）
├── accepted/<category>/<unit>.yaml     # 已接受
├── final/data/*.yaml                   # 最终数据
├── final/reports/assembly-report.json  # 组装收据（控制器 JSON）
├── final/reports/verification-report.json # 验证收据（控制器 JSON）
├── artifact-manifest.json              # accepted 哈希清单（控制器 JSON）
└── progress.json                       # 控制器状态（脚本生成，JSON格式）
```

**禁止**：子代理不得在书籍目录外写文件，不得生成 .js/.py 等脚本文件。

## 逐章提取

读取 [prompts/extract-chapters.md](prompts/extract-chapters.md)。

- 每个子代理处理一个章节，直接读取原文
- 提取：人物、武功、关键物品、势力；招式嵌套在 `skills[].techniques[]`
- **不提取**：事件、对话、地点
- 每个人物/武功必须写暂定 `rank`，人物同时写 `level`
- 章节摘要写入 `chapter_summary.summary`
- staging 路径：`<run-dir>/staging/chapter_<NNN>_attempt_<NN>.yaml`

并发规则：
- 最多 5 个 Worker 并发
- 章节与领域 Worker 只写各自 staging 草稿；主模型串行调用 `accept`
- 首个明确 429 batch 触发 `5 → 3` 退避；同一 batch 重复上报保持幂等
- 第二个不同 batch 的 429 在并发 3 时停止 Worker 池并报告限流；传输失败不消耗 AI 提交次数
- 相同输出或相同验证错误提前进入 manual_review

## 域蒸馏

读取 [prompts/distill-domain.md](prompts/distill-domain.md)。

四个域彼此独立，可并发生成草稿。固定单元顺序 `distill:factions` → `distill:characters` → `distill:skills` → `distill:items` 仅用于确定性展示与报告，主模型仍串行调用 `accept`。

| 单元 | 类别 | 标准 | 固定展示顺序 |
|---|---|---|---|
| `distill:factions` | factions | 合并同名势力，统一 ID | 1 |
| `distill:characters` | characters | 人物 keep 必须给全书巅峰 rank | 2 |
| `distill:skills` | skills | 武功 keep 必须给全书巅峰 rank；招式必须 named_in_source | 3 |
| `distill:items` | items | 只保留秘籍、剧情关键、高级药毒、神兵利器 | 4 |

- characters 与 skills 的 faction 引用延迟绑定到 `assemble`，由组装器在四个域决策齐备后统一解析
- 每域生成一个草稿
- staging 路径：`<run-dir>/staging/distill_<category>_attempt_<NN>.yaml`

## 组装与验证

```bash
node "$CLI" plan-domains "$NOVEL"      # 生成恰好四个域工作单元
node "$CLI" assemble "$NOVEL"          # 一次性投影严格五个 YAML
node "$CLI" verify "$NOVEL"            # accepted 证据 + assembly-report 验证
node "$CLI" install "$NOVEL"           # 收据绑定后原子安装到 data/
node "$CLI" verify "$NOVEL" --installed # 只验证已安装数据与收据
node "$CLI" archive-run "$NOVEL"       # 归档
```

`assemble` 必须消费所有 accepted 章节和恰好四个 accepted 域决策，写入字节稳定的五文件数据及 `assembly-report.json`。`verify` 重新验证 accepted 证据、候选闭包、最终引用和组装收据，通过后才写 `verification-report.json`。安装收据绑定五文件哈希和验证报告哈希；`verify --installed` 不得回退读取 worktree 数据。

验证阻断项：
- 人物/武功缺 rank
- 招式未由原文明确定名
- 普通物品进入关键物品库
- 稳定 ID、引用闭包、证据章号不完整

## 有界失败

每个单元最多 2 次提交：初始草稿和一次 validator 指导的修正。YAML 解析错误与语义错误共用同一提交预算；第二次失败、重复输出或重复验证错误进入 `manual_review`。

`status --json` 始终只返回一个 `next_action`，需要处理 AI 单元时同时返回稳定排序的 `next_units`；manual_review 的优先级高于所有可执行动作。

## 耗时目标

| 环节 | 目标耗时 |
|------|---------|
| 章节提取（21 章） | 15-20 min |
| 域蒸馏 factions | 2-3 min |
| 域蒸馏 characters/skills/items | 8-12 min |
| 组装+验证 | 3-5 min |
| **总计** | **28-40 min** |

硬上限：45 分钟。超时不能放宽正确性门。
