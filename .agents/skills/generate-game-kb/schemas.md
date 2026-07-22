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
`.claude/agents/`、本文件或隐式 Skill 上下文。合同版本当前为 `2`，每个 input
获得独立对象，至少包含：

- `output`：单文档 YAML、禁止 Markdown 围栏、精确五个顶层字段，以及下文完整
  YAML skeleton；
- `required_fields/optional_fields/nullable_fields`：四类实体、skill technique、
  章节摘要和 `source_ref` 的递归字段规则；
- `forbidden_fields`：Controller 身份字段、正式 ID、`local_key`、
  `candidate_key` 和 legacy `type`；
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
        line_start: 18
        line_end: 18

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
        line_start: 20
        line_end: 20

items:
  - name: "孔雀翎"
    aliases: []
    types: ["武器", "暗器"]
    description: "孔雀山庄的著名暗器。"
    source_refs:
      - text: "这就是孔雀翎。"
        line_start: 31
        line_end: 31

factions:
  - name: "青衣楼"
    aliases: []
    types: ["组织"]
    description: "江湖中的秘密组织。"
    source_refs:
      - text: "青衣楼的令牌就在桌上。"
        line_start: 42
        line_end: 42

chapter_summary:
  summary: "陆小凤以灵犀一指接下袭击，并发现青衣楼令牌。"
  source_refs:
    - text: "陆小凤忽然伸出两根手指，夹住了剑锋。"
      line_start: 18
      line_end: 18
```

四个实体数组即使为空也必须存在。每条记录必须有非空 `name` 和至少一条
`source_refs`；章节摘要必须有非空 `summary` 和至少一条
`source_refs`。引用中的 `text` 必须在当前 `chapter_text` 逐字存在。
`line_start/line_end` 可选，存在时必须为整数。

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
    local_key: "skill:无名毒术"
items: []
factions: []
chapter_summary:
  summary: "陆小凤接下袭击。"
  source_refs:
    - chapter: 1
      text: "陆小凤忽然伸出两根手指，夹住了剑锋。"
normalizations:
  - field_path: "$.skills[0].types[0]"
    original_value: "poison"
    normalized_value: "毒功"
    normalization_rule: "skills.poison"
```

`chapter/title/source_hash/local_key/source_refs[].chapter` 全由 Controller
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

人物 `level`：

```text
核心、重要、次要、龙套、背景
```

人物与武功 `rank`：

```text
平平无奇、初窥门径、略有小成、登堂入室、
炉火纯青、出神入化、登峰造极、返璞归真
```

章节证据不足以支持稳定 rank 时使用 `null`。

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
