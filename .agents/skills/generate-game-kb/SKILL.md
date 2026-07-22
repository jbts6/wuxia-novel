---
name: generate-game-kb
description: 从中文武侠小说生成溯源证据完备的游戏知识库（角色/武功/物品/势力/章节摘要）。当用户需要根据小说目录产出结构化、可溯源的游戏素材知识库时使用。
---

# generate-game-kb

从一本中文武侠小说生成游戏知识库。当前可写合同固定为
`semantic_contract_version: 7`、`semantic_profile: chapter-direct-v1`。
Controller 把小说拆成单章 job；每个 Worker 只读一个 `input_file`，把一份
YAML 直接写到唯一的 `output_file`。Controller 负责接收、校验、归并、审计、
安装与归档。

## 公开命令

```text
run <novel> [--run <id>]                              # 创建或继续运行
status <novel> [--run <id>]                           # 只读恢复状态和活跃 job 路径
retry-unit <novel> --run <id> --unit <u> --confirm   # 用户确认后开启新周期
archive-abandoned <novel> [--run <id>]                # 原样归档废弃运行
```

调用入口：

```text
node .agents/skills/generate-game-kb/scripts/flow.js <command> ... --json
```

旧版本运行只允许 `status` 与 `archive-abandoned`；任何继续写入都必须从新的
v7 run 开始。归档废弃运行不会解析、迁移或改写其内部文件。

## 必须执行的循环

1. 调用 `run`。
2. 当返回 `status: "jobs"` 时，只派发本次 `jobs` 数组中的 job。
3. 等这些 Worker 写完各自的 `output_file`。
4. 再次调用 `run`；Controller 会发现输出并推进状态。
5. 重复以上步骤，直到返回 `status: "complete"`。

`waiting` 表示当前固定窗口仍有在途单元，返回值不会签发新 job。此时等待，
不要自行补位。若会话中断，调用 `status` 恢复 `active_units` 以及每个活跃
job 的 `input_file`、`output_file`、`producer`、`cycle` 和 `attempt`，
不得根据目录猜路径。

### `run` / `status` 稳定返回

```json
{
  "semantic_contract_version": 7,
  "run_id": "run-example",
  "status": "jobs",
  "jobs": [
    {
      "unit": "chapter:001",
      "cycle": 1,
      "attempt": 1,
      "producer": "chapter-worker",
      "input_file": "绝对路径",
      "output_file": "绝对路径",
      "input_hash": "sha256"
    }
  ],
  "active_units": ["chapter:001"],
  "progress": { "accepted": 0, "total": 1 },
  "manual_review": null
}
```

状态只有以下处理方式：

| status | 动作 |
|---|---|
| `jobs` | 按 `producer` 派发返回的 job，然后再次 `run` |
| `waiting` | 等待当前窗口，不派发新章节；需要恢复路径时调用 `status` |
| `manual_review` | 停止自动推进，向用户报告失败单元 |
| `complete` | 五文件已验证、安装并归档，结束 |

固定窗口最多包含五章。窗口中的全部章节 accepted 前，Controller 不会签发下一
窗口。

## Worker 调度

- `producer: chapter-worker`：派发章节 Worker。它只读取 job 的
  `input_file`，完整扫描其中的 `chapter_text`，并只写
  `output_file`。
- `producer: main-agent-repair`：由主代理执行机械修复。它只读取拒绝稿、
  错误报告和 `allowed_repair_codes`，不读取小说原文，不改变语义。

Worker 输出是单个纯 YAML 文档，顶层恰好为：

```yaml
characters: []
skills: []
items: []
factions: []
chapter_summary:
  summary: "本章发生的关键事件。"
  source_refs:
    - text: "当前章节中逐字存在的原文"
      line_start: 1
      line_end: 1
```

四个实体数组必须存在，即使为空。Worker 不写
`schema_version/chapter/title/source_hash/unit/cycle/attempt/input_hash`，不写
正式 `id`、`local_key` 或 `candidate_key`。这些身份字段由 Controller
写入 accepted YAML。Worker 不调用 Controller 命令，也不写
`output_file` 之外的路径。

完整字段与示例见 [schemas.md](schemas.md)，可执行示例见
[examples.md](examples.md)，Worker 提示合同见
[prompts/extract-chapters.md](prompts/extract-chapters.md)。

## 两次 attempt 与人工确认

每个单元的每个 cycle 最多两次：

- attempt 1 是完整章节抽取。
- 若第一次只出现允许的 YAML 机械错误，attempt 2 使用
  `main-agent-repair`，因此机械修复会消耗第二次机会。
- 若第一次是证据、字段或语义错误，attempt 2 仍使用 `chapter-worker`，输入会
  携带前次错误。
- 第二次失败进入 `manual_review`。只有用户明确同意后，才可调用
  `retry-unit ... --confirm` 开启新 cycle；主代理不得自行重置或改进度文件。

## 抽取与证据

- 每章穷举所有有明确名称的角色、武功、物品和势力；龙套、背景角色及有名的
  一次性实体也应保留。
- 每个实体与章节摘要至少有一条当前章节的 `source_refs`，其中 `text` 必须
  在本章原文逐字存在，并包含实体名称。不得依赖记忆或其他章节。
- 人物 `level` 只允许：核心、重要、次要、龙套、背景。
- 人物和武功 `rank` 可为 `null`；非空时使用八级表。证据不足时保持
  `null`，不要猜测。
- `skills/items/factions` 使用 `types: string[]`。Controller 只做一对一
  机械别名归一化；例如 `poison` 归一化为 `毒功`。未知值以
  `TYPE_VALUE_UNKNOWN` 拒绝，不做相似度猜测。

## 确定性归并与完成条件

- 只按“类别 + NFKC/trim 后的精确名称”归并；别名、拼音或近似名不触发自动
  合并。
- 同一章内不同 `local_key` 的同名实体进入人工复核并阻断组装。
- 泛称候选被过滤为 warning，不进入终态；专指称号仍可保留。
- 描述取 Unicode 最长值；同长按最早证据位置和文本排序。人物 level 取最高剧情
  重要性，rank 依次按多数票、最新证据、较低 rank 索引决胜，types 取稳定并集。

成功后 `<novel>/data/` 恰好包含：

```text
characters.yaml
skills.yaml
items.yaml
factions.yaml
chapter_summaries.yaml
```

`assembly-report.json` 绑定确定性字段决策、类型归一化和最终数据哈希；
`game-kb-review.json` 只记录非阻塞 warning；`verification-report.json` 是
安装前硬门禁。验证报告直接绑定确定性审计与复核哈希；安装回执绑定源、终态、
复核与验证哈希；归档回执再绑定 assembly、安装和 artifact manifest 哈希。
