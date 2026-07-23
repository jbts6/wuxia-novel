# generate-game-kb v7 数据合同

当前可写合同为 `semantic_contract_version: 7`、
`semantic_profile: chapter-direct-v1`。AI 只生成单章 Worker YAML；Controller
补齐章节身份、保存 accepted 证据、确定性归并并投影最终五文件。

## 通用规则

- AI 草稿、accepted 证据与最终数据使用 YAML；运行状态、清单、报告和收据使用
  JSON。
- Worker 草稿不包含 Controller 身份字段、正式 ID 或章节局部 key。
- accepted 证据包含 `local_key` 和精确 `source_refs`，并由
  `artifact-manifest.json` 绑定内容哈希；一旦 accepted 不得改写。
- 最终五文件不携带 `source_refs`。证据闭环与所有确定性选择保存在 accepted
  证据和报告中。
- `aliases`、`identities`、`factions`、`skills`、`types` 按首次
  出现顺序去重。
- `description` 为 `string | null`；人物与武功 `rank` 为
  `string | null`。

## Job input 内嵌 `worker_contract`

每个 `chapter-worker` 和 `main-agent-repair` 的只读 JSON input 都必须携带
`worker_contract`。它是跨宿主运行时合同的唯一来源，不依赖
`.claude/agents/`、本文件或隐式 Skill 上下文。合同版本当前为 `4`，每个 input
获得独立对象，至少包含：

- `output`：单文档 YAML、禁止 Markdown 围栏、精确五个顶层字段，以及下文完整
  YAML skeleton；
- `required_fields/optional_fields/nullable_fields`：四类实体、skill technique、
  章节摘要和 `source_ref` 的递归字段规则；
- `forbidden_fields`：Controller 身份字段、正式 ID、`local_key`、
  `candidate_key` 和 legacy `type`；
- `controlled_fields`：人物层级、人物战力和武功战力的共享允许值、可空行为、
  八档标准、全书时间线语义，以及职位/身份写入 `characters[].identities` 的规则；
- `grounding`：`chapter_text.includes(entity.name)`、
  `chapter_text.includes(technique.name)`、
  `chapter_text.includes(source_ref.text)`；名称或引用不逐字存在时不得提取或引用，
  不得把描述性短语概括成正式实体名，也不得改写引号、标点或措辞；
- 实体和 technique 名还必须被自身至少一条 `source_refs[].text` 逐字覆盖；
- `summary`：强制 `chapter_summary.summary.trim() !== ""` 且至少一条引用；
- `taxonomy`：`skills/items/factions[].types` 使用 input 的闭合 `taxonomies`，
  未知值不得猜测；
- `reference_closure`：`characters[].skills/factions` 和 `skills[].factions` 必须
  解析到本次输出对应类别的候选；正式名称优先，其次仅允许唯一别名，缺失或多义
  目标由 Controller 返回 `REFERENCE_UNRESOLVED` / `REFERENCE_AMBIGUOUS`。Worker
  应补提取有据候选或省略关系；
- `preflight`：写后重读 YAML，递归检查每个实体、technique、章节摘要和全部
  `source_refs`，并执行当前 producer 的专属规则。

`main-agent-repair` 获得同一输出结构合同，但不会获得
`chapter_text/source_file/source_hash/taxonomies`。它只能修复
`allowed_repair_codes` 中的机械问题，不得新增、删除或改写语义内容。

## Controller source quote grounding

Worker 仍必须从 `chapter_text` 逐字复制 `source_refs[].text`，不得主动统一标点。
Controller 先执行 exact match；仅当 exact match 失败时，才对以下单字符排版字形
生成不落盘的比较视图：`。` / `.`、`“”「」『』` / `"`、`‘’` / `'`。

排版比较除上述字符外必须逐字、同序，并且在当前章节或已验证行范围内唯一命中。
唯一命中后，accepted quote 回填源章节规范化文本中的原始标点，并在
`normalizations` 写入 `grounding.typography-fold.v1` 审计。零命中或多命中仍返回
`SOURCE_QUOTE_NOT_FOUND`。

顿号、破折号、省略号、书名号等不在白名单；不得删除标点、使用编辑距离或选择
多个 folded match 中的第一个。Unicode 兼容归一化只接受单字符到单字符的映射，
不会把 `…` 展开为 `...`。

## Worker YAML

顶层恰好包含五个字段。以下是完整示例：

```yaml
characters:
  - name: "陆小凤"
    aliases: []
    identities: ["四条眉毛"]
    level: "核心"
    rank: "登峰造极"
    description: "以灵犀一指闻名的侠客。"
    factions: []
    skills: ["灵犀一指"]
    source_refs:
      - text: "陆小凤忽然伸出两根手指，夹住了剑锋。"

skills:
  - name: "灵犀一指"
    aliases: []
    types: ["指法"]
    factions: []
    rank: "登峰造极"
    description: "以双指夹住兵刃。"
    techniques:
      - name: "灵犀一指"
        description: "双指迎住来剑。"
    source_refs:
      - text: "灵犀一指，天下无双。"

items:
  - name: "孔雀翎"
    aliases: []
    types: ["武器", "暗器"]
    description: "孔雀山庄的著名暗器。"
    source_refs:
      - text: "这就是孔雀翎。"

factions:
  - name: "青衣楼"
    aliases: []
    types: ["组织"]
    description: "江湖中的秘密组织。"
    source_refs:
      - text: "青衣楼的令牌就在桌上。"

chapter_summary:
  summary: "陆小凤以灵犀一指接下袭击，并发现青衣楼令牌。"
  source_refs:
    - text: "陆小凤忽然伸出两根手指，夹住了剑锋。"
```

四个实体数组即使为空也必须存在。每条记录必须有非空 `name` 和至少一条
`source_refs`；章节摘要必须有非空 `summary` 和至少一条
`source_refs`。引用中的 `text` 必须在当前 `chapter_text` 逐字存在。
Worker 不写 `chapter/line_start/line_end`。Controller 忽略旧 Worker 输出中的行号，
按规范化后最早的逐字命中确定性补齐这些字段，避免模型计算的错误坐标否定有效引文。

Worker 顶层禁止：
`schema_version/chapter/title/source_hash/unit/cycle/attempt/input_hash/output_file`。
实体禁止正式 `id`、`local_key`、`candidate_key` 及任何 Controller
身份字段。

## accepted 章节 YAML

Controller 校验 Worker YAML 后，规范化为：

```yaml
schema_version: 7
chapter: 1
title: "第一章 起始"
source_hash: "sha256:chapter-input"
characters:
  - name: "陆小凤"
    aliases: []
    identities: ["四条眉毛"]
    level: "核心"
    rank: "登峰造极"
    description: "以灵犀一指闻名的侠客。"
    factions: []
    skills: ["灵犀一指"]
    source_refs:
      - chapter: 1
        text: "陆小凤忽然伸出两根手指，夹住了剑锋。"
        line_start: 18
        line_end: 18
    local_key: "character:陆小凤"
skills:
  - name: "无名毒术"
    aliases: []
    types: ["毒功"]
    factions: []
    rank: null
    description: null
    techniques: []
    source_refs:
      - chapter: 1
        text: "无名毒术已练了三年。"
        line_start: 24
        line_end: 24
    local_key: "skill:无名毒术"
items: []
factions: []
chapter_summary:
  summary: "陆小凤接下袭击。"
  source_refs:
    - chapter: 1
      text: "陆小凤忽然伸出两根手指，夹住了剑锋。"
      line_start: 18
      line_end: 18
normalizations:
  - field_path: "$.skills[0].types[0]"
    original_value: "poison"
    normalized_value: "毒功"
    normalization_rule: "skills.poison"
```

`chapter/title/source_hash/local_key` 及 `source_refs[]` 的
`chapter/line_start/line_end` 全由 Controller
注入。accepted 文件按 `unit + output_hash` 登记到 artifact ledger；同一目标
只允许内容一致的幂等重放。

## types 受控数组

`skills`、`items`、`factions` 都使用 `types: string[]`，不得使用单值
`type`。

| 类别 | 允许值 |
|---|---|
| skills | 内功、心法、外功、轻功、身法、剑法、刀法、枪法、棍法、棒法、鞭法、拳法、掌法、腿法、爪法、指法、点穴、擒拿、暗器、毒功、医术、易容、音律、阵法、奇门、合击、其他 |
| items | 武器、防具、秘籍、丹药、暗器、坐骑、异兽、饰品、其他 |
| factions | 门派、帮会、组织、家族、世家、朝廷、官府、商会、镖局、教派、寺院、部族、王朝、山庄、其他 |

Controller 先精确匹配白名单，再对 key 执行 NFKC、小写化以及移除空白、下划线、
连字符的一对一别名匹配。`Internal_Skill`、`sword-skill` 与
`poison` 可分别归一化为 `内功`、`剑法`、`毒功`。未命中值以
`TYPE_VALUE_UNKNOWN` 拒绝；不使用编辑距离或子串猜测。

## 枚举

人物 `level`、人物 `rank` 与武功 `rank` 的可执行允许值以
`semantic-contract.js` 导出的共享常量和 job 内
`worker_contract.controlled_fields` 为准，本文件不复制第二份枚举。
章节证据不足以支持稳定值时使用 `null`；职位、门派职务、称号和社会身份写入
`characters[].identities`。

## assembly-report.json

```json
{
  "schema_version": 7,
  "source_hash": "sha256:source",
  "final_data_hash": "sha256:data",
  "deterministic_audit_hash": "sha256:audit",
  "review_report_hash": "sha256:review",
  "deterministic_audit": {
    "field_decisions": [
      {
        "category": "characters",
        "canonical_name": "陆小凤",
        "member_refs": ["ch001:character:陆小凤"],
        "source_refs": [{ "chapter": 1, "text": "陆小凤忽然伸出两根手指。" }],
        "field": "description",
        "candidate_values": [
          {
            "value": "以灵犀一指闻名的侠客。",
            "member_refs": ["ch001:character:陆小凤"],
            "source_refs": [{ "chapter": 1, "text": "陆小凤忽然伸出两根手指。" }],
            "occurrences": 1,
            "unicode_length": 11
          }
        ],
        "selected_value": "以灵犀一指闻名的侠客。",
        "selection_rule": "longest_unicode_then_earliest_source_ref_then_text"
      }
    ],
    "type_normalizations": [
      {
        "category": "skills",
        "canonical_name": "无名毒术",
        "member_ref": "ch001:skill:无名毒术",
        "source_ref": { "chapter": 1, "text": "无名毒术已练了三年。" },
        "field_path": "$.skills[0].types[0]",
        "original_value": "poison",
        "normalized_value": "毒功",
        "normalization_rule": "skills.poison"
      }
    ],
    "grounding_normalizations": [
      {
        "category": "items",
        "canonical_name": "飞刀",
        "member_ref": "ch001:item:飞刀",
        "source_ref": { "chapter": 1, "text": "飞刀落地。" },
        "field_path": "$.items[0].source_refs[0].text",
        "original_value": "飞刀落地.",
        "normalized_value": "飞刀落地。",
        "normalization_rule": "grounding.typography-fold.v1"
      }
    ]
  },
  "chapter_count": 1,
  "entity_counts": {
    "characters": 1,
    "skills": 1,
    "items": 0,
    "factions": 0,
    "chapter_summaries": 1
  }
}
```

`deterministic_audit_hash` 对完整 `deterministic_audit` 计算稳定哈希；
`final_data_hash` 使用与五文件验证器相同的 `hashFinalData` 算法。

## reference-recovery.json

终态关系出现 `REFERENCE_UNRESOLVED` / `REFERENCE_AMBIGUOUS` 时，assembly 不发布
部分 final 数据，而是在 run 的 `reports/reference-recovery.json` 写入稳定报告：

```json
{
  "schema_version": 1,
  "parent_run": "run-id",
  "source_hash": "sha256:source",
  "artifact_manifest_hash": "sha256:accepted-manifest",
  "recovery_units": ["chapter:021"],
  "relationships": [
    {
      "code": "REFERENCE_UNRESOLVED",
      "owner_category": "characters",
      "owner_name": "人物名",
      "relation_field": "skills",
      "relation_path": "characters[0].skills[0]",
      "target_category": "skills",
      "target_name": "武功名",
      "member_refs": ["ch021:character:人物名"],
      "source_chapters": [21],
      "source_refs": [{ "chapter": 21, "text": "原文证据" }]
    }
  ],
  "report_hash": "sha256:report"
}
```

`report_hash` 对不含自身的完整报告计算稳定哈希。`run` 与 `status` 返回
`manual_review` 和 `recovery_units`；原 run 的 accepted artifact 与 final 目录不改写。

## recovery-receipt.json

`recover-relations <novel> --run <parent> --confirm` 创建稳定命名的派生 run，
并在 run 根目录写入 `recovery-receipt.json`。收据绑定 `parent_run`、
`source_hash`、父 `artifact_manifest_hash`、`report_hash`、`carried_units`、
`reopened_units` 和逐章 `unit_context`，最后以 `receipt_hash` 对不含自身的完整
收据计算稳定哈希。

派生 `progress.json` 保留全部章节单元，并增加有序 `recovery_units`。未受影响
章节的状态为 `accepted`、producer 为 `carry-forward`，且在子 run 的
`artifact-manifest.json` 中拥有自己的不可变条目；问题章节从 pending 开始，
按最多五章窗口签发普通 `chapter-worker`。其 input 的 `recovery_context` 携带
父 run、报告哈希、父 accepted 草稿的子 run 内不可变副本、草稿哈希和对应关系
错误。派生 run 不复制父 run 的 final ID plan 或 final 数据。

## game-kb-review.json

这是只含 warning 的非阻塞报告：

```json
{
  "report_version": 1,
  "source_hash": "sha256:source",
  "final_data_hash": "sha256:data",
  "summary": {
    "warning_count": 1,
    "by_code": { "GENERIC_CANDIDATE_FILTERED": 1 },
    "by_category": { "characters": 1 }
  },
  "entries": [
    {
      "code": "GENERIC_CANDIDATE_FILTERED",
      "severity": "warning",
      "category": "characters",
      "name": "店小二",
      "chapter_numbers": [1],
      "source_refs": [{ "chapter": 1, "text": "店小二端来一壶酒。" }],
      "member_refs": ["ch001:character:店小二"],
      "reason": "confirmed_generic_name",
      "resolution": "filtered"
    }
  ]
}
```

同章不同局部 key 共享同一精确名称时，组装写入
`IDENTITY_COLLISION_REVIEW_REQUIRED` 并进入人工复核；该情况会阻断组装，
不会降级为普通 warning。

## 最终五文件

`<novel>/data/` 必须恰好包含以下顶层数组 YAML。

### characters.yaml

```yaml
- id: "char_lu_xiao_feng"
  name: "陆小凤"
  aliases: []
  identities: ["四条眉毛"]
  level: "核心"
  rank: "登峰造极"
  description: "以灵犀一指闻名的侠客。"
  factions: []
  skills: ["skill_ling_xi_yi_zhi"]
```

字段恰好为
`id/name/aliases/identities/level/rank/description/factions/skills`。

### skills.yaml

```yaml
- id: "skill_ling_xi_yi_zhi"
  name: "灵犀一指"
  aliases: []
  types: ["指法"]
  factions: []
  rank: "登峰造极"
  description: "以双指夹住兵刃。"
  techniques:
    - name: "灵犀一指"
      description: "双指迎住来剑。"
```

字段恰好为
`id/name/aliases/types/factions/rank/description/techniques`；每个 technique
恰好含 `name/description`。

### items.yaml

```yaml
- id: "item_kong_que_ling"
  name: "孔雀翎"
  aliases: []
  types: ["武器", "暗器"]
  description: "孔雀山庄的著名暗器。"
```

字段恰好为 `id/name/aliases/types/description`。

### factions.yaml

```yaml
- id: "faction_qing_yi_lou"
  name: "青衣楼"
  aliases: []
  types: ["组织"]
  description: "江湖中的秘密组织。"
```

字段恰好为 `id/name/aliases/types/description`。

### chapter_summaries.yaml

```yaml
- chapter: 1
  title: "第一章 起始"
  summary: "陆小凤接下袭击，并发现青衣楼令牌。"
```

字段恰好为 `chapter/title/summary`，章节号必须连续覆盖 manifest。

## 时间事件与 run metrics

新建 run 的 `run.json` 必须包含：

```yaml
timing_contract_version: 1
```

旧 run 缺少该字段时保持原字节，不迁移也不补写时间证据。只读 `status` 保持兼容；
继续运行、人工重试、关系恢复或正常归档等写路径返回 `TIMING_CONTRACT_UNSUPPORTED`，
只有显式 `archive-abandoned --confirm` 可按原字节归档。

### events.jsonl

`<run>/events.jsonl` 是 Controller 独占、只追加的 JSONL。每行精确包含以下基础字段：

- `schema_version: 1`
- `sequence`：从 1 开始连续递增
- `event_key`：由事件类型和绑定字段确定性生成，全文件唯一
- `type`：下表中的事件类型
- `occurred_at`：`Date#toISOString()` 形式的规范 UTC 时间

事件类型与额外字段：

| 类型 | 额外字段 |
| --- | --- |
| `run_started`、`source_prepare_started`、`source_prepared` | 无 |
| `window_issued`、`window_closed` | `window_sequence`（正整数） |
| `attempt_issued`、`attempt_observed`、`attempt_accepted`、`attempt_rejected` | `unit`、`cycle`、`attempt`、`producer` |
| `manual_review_entered`、`manual_review_resumed` | `unit`、`cycle`、`attempt`、`producer` |
| `phase_started`、`phase_completed` | `phase`，仅 `assemble`、`verify`、`install`、`archive` |

`unit` 必须为 `chapter:<三位及以上数字>`；`cycle`、`attempt` 均为正整数；
`producer` 必须匹配安全短名。事件必须满足以下顺序：source prepare 成对；窗口先签发
后关闭；attempt 先签发、再观察、再且仅接受或拒绝之一；人工复核先进入后恢复；终态
阶段先开始后完成。时间不得倒退，文件必须以换行结束；缺失事件、重复 key、非法字段、
半行或生命周期不闭合均返回 `TIMING_EVENTS_INVALID`，同 key 不同语义载荷返回
`TIMING_EVENT_CONFLICT`。

### reports/run-metrics.json schema 2

新 run 的 metrics 必须从已经校验的事件序列和 accepted/final YAML 确定性生成：

```yaml
schema_version: 2
timing_contract_version: 1
timing_events_hash: <sha256>
run_id: <run-id>
semantic_profile: chapter-direct-v1
generated_at: <canonical UTC>
total_ms: 0
human_wait_ms: 0
active_ms: 0
phase_durations:
  prepare_ms: 0
  chapter_extraction_ms: 0
  assemble_ms: 0
  verify_ms: 0
  install_ms: 0
  archive_ms: 0
  total_ms: 0
ai_units:
  chapter: { planned: 0, done: 0, attempts: 0, corrections: 0 }
  total: { planned: 0, done: 0, attempts: 0, corrections: 0 }
windows:
  issued: 0
  closed: 0
  unclosed: 0
  wall_ms: { count: 0, total_ms: 0, min_ms: 0, max_ms: 0, average_ms: 0 }
attempt_timing:
  attempts: 0
  issued_to_observed_ms: { count: 0, total_ms: 0, min_ms: 0, max_ms: 0, average_ms: 0 }
  observed_to_decision_ms: { count: 0, total_ms: 0, min_ms: 0, max_ms: 0, average_ms: 0 }
max_ai_input_bytes: 0
candidate_counts:
  chapter_candidates: 0
  final_records: 0
```

口径：

- `total_ms` 是 `run_started` 到 `phase_completed:archive` 的墙钟跨度；
- `human_wait_ms` 是所有人工复核等待区间之和；`active_ms = total_ms - human_wait_ms`，
  仍是墙钟口径，不是 CPU 或模型推理时间；
- `chapter_extraction_ms` 是所有已关闭窗口墙钟跨度之和；`windows.unclosed` 保留未关闭窗口数；
- `ai_units` 汇总全部 cycle；`corrections = attempts - planned`；
- `issued_to_observed_ms` 是签发到 Controller 观察输出的端到端周转，包含调度、排队、
  Worker 执行和文件交付；`observed_to_decision_ms` 是 Controller 校验耗时；
- `chapter_candidates` 是 accepted 章节 YAML 的 `characters`、`skills`、`items`、
  `factions` 数组出现次数之和；`final_records` 是最终五文件记录数。

### 归档绑定

时间合同 run 的 `archive-receipt.json` 使用 `schema_version: 2`，必须包含
`timing_contract_version: 1`、`timing_events_hash` 和 `metrics_hash`。
`events.jsonl` 与 `reports/run-metrics.json` 都必须随整个 run 进入 `archive_dir`。归档后读取必须
复验事件格式、事件哈希、metrics 内哈希、metrics 文件哈希与回执；任一不一致返回
`TIMING_EVIDENCE_INVALID`。旧 run 继续读取原 schema，不补写新字段。

## 验证、安装与归档

- workspace 验证重新读取 accepted 章节及 artifact ledger，核对证据、五文件
  schema、引用闭环、`assembly-report.json`、`game-kb-review.json` 与当前字节。
- accepted 章节在写入后必须出现在 artifact ledger；未登记的 accepted 文件以
  `ACCEPTED_ARTIFACT_UNTRACKED` 失败。
- `manual_review.json` 缺失等价于没有待处理项；存在且非空时阻断最终验证。
- 安装以同一事务发布五个 data YAML、assembly/review/verification 三类报告及
  收据；失败时全部回滚。
- 验证报告直接绑定 `source_hash`、`final_data_hash`、
  `deterministic_audit_hash` 与 `review_report_hash`。安装回执直接绑定源、终态、
  review 和 verification report 哈希；归档回执直接绑定 assembly、verification、
  install、review、artifact manifest 与 ID plan 哈希，不得从旧工作区报告回退。
