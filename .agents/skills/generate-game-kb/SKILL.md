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
recover-relations <novel> --run <id> --confirm        # 从关系报告创建派生返工 run
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

`manual_review` 若来自章节 attempt 失败，使用 `retry-unit`；若父 run 存在
`reports/reference-recovery.json`，在用户确认后使用 `recover-relations`。后者
创建新的派生 run，carry-forward 无关章节，只向报告中的章节签发普通
`chapter-worker` job；不得改写父 run 的 accepted artifact 或 final 数据。

## 时间统计与归档证据

新建 run 在 `run.json` 固定写入 `timing_contract_version: 1`。只有 Controller
可以追加 `<run>/events.jsonl`；Worker 不得读取或写入该文件。每行事件都使用连续
`sequence`、稳定 `event_key` 和规范 UTC `occurred_at`，覆盖 run/source、章节窗口、
每个 cycle/attempt、人工复核，以及 assemble/verify/install/archive 阶段。重复写入同一
语义事件是幂等的；同 key 不同载荷、缺失前置事件、时间倒退、半行或事件丢失均
fail closed。

新 run 的 `<run>/reports/run-metrics.json` 使用 `schema_version: 2`，由已经校验的
`events.jsonl` 确定性投影，至少包含：

- `total_ms`：`run_started` 到 `archive` 完成的墙钟跨度；
- `human_wait_ms`：每段 `manual_review_entered` 到 `manual_review_resumed` 的总和；
- `active_ms`：`total_ms - human_wait_ms`，表示非人工等待墙钟时间，不是 CPU 或模型推理时间；
- `phase_durations`、`windows`：source、章节窗口和四个终态阶段的耗时与窗口计数；
- `ai_units`：跨全部 cycle 的 planned/done/attempts/corrections；
- `attempt_timing.issued_to_observed_ms`：Controller 签发到观察到输出的周转时间，
  包含调度、排队、Worker 执行和文件交付，不得解释为纯模型推理时间；
- `attempt_timing.observed_to_decision_ms`：Controller 观察输出到接受/拒绝的校验时间；
- `candidate_counts.chapter_candidates`：accepted 章节 YAML 中四类候选数组的出现次数，
  不是去重实体数，也不读取旧 candidate registry；`final_records` 继续统计最终五文件记录数；
- `timing_events_hash`：规范 `events.jsonl` 字节的哈希。

归档回执绑定 `events.jsonl`、`run-metrics.json`、`timing_events_hash` 和
`metrics_hash`；归档后 `status` 会复验版本、事件、metrics 与回执的一致性，失败返回
`TIMING_EVIDENCE_INVALID`。没有 `timing_contract_version` 的既有 v7/遗留 run 不迁移、
不补写时间文件，继续只读兼容；任何继续、重试、关系恢复或正常归档写路径返回
`TIMING_CONTRACT_UNSUPPORTED`，显式 `archive-abandoned --confirm` 仍按原字节归档。
Worker job/output 和公开 `run` / `status` 返回结构不变。

## Worker 调度

- `producer: chapter-worker`：派发章节 Worker。它只读取 job 的
  `input_file`，严格服从其中内嵌的 `worker_contract`，完整扫描其中的
  `chapter_text`，并只写 `output_file`。
- `producer: main-agent-repair`：由主代理执行机械修复。它只读取拒绝稿、
  错误报告、`allowed_repair_codes` 和同版本 `worker_contract`，不读取小说
  原文，不新增、删除或改写语义内容。

派发提示必须只要求读取 `input_file`，不能要求 Worker 自行寻找
`.claude/agents/`、`schemas.md` 或其他隐式 Skill 上下文。写完后必须按
`worker_contract.preflight` 递归检查实体、technique、摘要及所有
`source_refs`，并按 `controlled_fields` 检查 `level/rank`，确认每个名称被自身
证据覆盖、所有关系名称能解析到对应候选，再
报告完成。Worker 不执行 Shell、Node、Python 或 BAT 命令，也不创建辅助脚本、
中间文本或校验日志。

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
```

四个实体数组必须存在，即使为空。Worker 的 `source_refs` 只写逐字 `text`，不写
`chapter/line_start/line_end`；Controller 根据 `chapter_text` 中最早的精确命中
确定性补齐章节与行区间。为兼容已签发 job，旧输出中的行号会被忽略并覆盖。Worker 不写
`schema_version/chapter/title/source_hash/unit/cycle/attempt/input_hash`，不写
正式 `id`、`local_key` 或 `candidate_key`。这些身份字段由 Controller
写入 accepted YAML。Worker 不调用 Controller 命令，也不写
`output_file` 之外的路径。

运行时完整字段骨架、必填/禁止规则、逐字证据检查与 taxonomy 规则都直接嵌在
每个 job 的 `worker_contract` 中。维护者文档见 [schemas.md](schemas.md)，
可执行示例见 [examples.md](examples.md)，Worker 提示合同见
[prompts/extract-chapters.md](prompts/extract-chapters.md)；这些文档不是运行时依赖。

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
- 人物 `level`、人物 `rank` 和武功 `rank` 的允许值、八级标准及全书时间线
  语义只读取 job 的 `worker_contract.controlled_fields`。证据不足时保持 `null`。
- 职位、门派职务、称号和社会身份写入 `characters[].identities`，不得写入
  `rank`；身份光环不能单独支持战力等级。
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

`assembly-report.json` 绑定确定性字段决策、类型归一化、grounding 归一化和最终数据哈希；
`game-kb-review.json` 只记录非阻塞 warning；`verification-report.json` 是
安装前硬门禁。验证报告直接绑定确定性审计与复核哈希；安装回执绑定源、终态、
复核与验证哈希；归档回执再绑定 assembly、安装和 artifact manifest 哈希。
