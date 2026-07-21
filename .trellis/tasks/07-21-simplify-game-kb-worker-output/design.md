# `generate-game-kb` v7 简化设计

## 1. 文档状态与范围

本文是任务 `07-21-simplify-game-kb-worker-output` 的技术设计，供后续其他 AI 实施。

本任务只规划和实现新建的 v7 run。现有现场必须保持原样：

- 《陆小凤传奇》v6 run 已由 WorkBuddy 完成，但终态实体未有效跨章去重；WorkBuddy 已关闭。
- 《萧十一郎》v6 run 完成约一半；Claude Code 已关闭。
- 两个现有 run、`.kb-scratch`、仓库根目录拆章文件和其他中间产物都不迁移、不续跑、不修补、不删除。

本设计不启动 Trellis 实施阶段。只有规划文档复核完成后，执行者才可显式运行 `task.py start`。

## 2. 设计目标

v7 从第一原则出发，只保留完成任务必需的机制：

1. controller 持有全部运行状态、文件身份、验证、安装和归档职责。
2. AI 宿主只反复调用 `run`、派发 controller 返回的章节 job，并让 Worker 写一个唯一 YAML 文件。
3. Worker 不复制 controller 身份字段，不返回 envelope，不使用 stdin，不调用 `submit`。
4. 并发上限由持久化状态保证，而不是由 prompt 或主代理自觉保证。
5. 章节高召回与书级低重复分离：章节阶段尽量抽全，书级阶段确定性归并。
6. 正常流程不创建临时脚本，不要求人工编排 prepare/submit/assemble/verify/install。
7. 五个核心 YAML 继续作为游戏数据边界；审查信息放在独立 report。

## 3. 明确删除的设计

v7 不保留以下机制的兼容写入路径：

- Worker JSON envelope。
- stdin `submit` 和逐章主代理提交。
- `--deep`。
- `plan-domains`。
- `distill:characters`、`distill:skills`、`distill:items`、`distill:factions`。
- 领域 Worker input、attempt、accept 和 domain decisions 生命周期。
- 滚动 worker pool、429 降并发状态和 `batch_id`。
- 实体级 quarantine/sanitize 后继续接受章节。
- 默认流程中的 AI description 总结或 rank 蒸馏。
- 公开的 prepare、extract-plan、submit、assemble、verify、install、archive-run、archive-existing 命令。

删除领域机制后，相关生产模块和测试只能在所有调用者移除后删除。实施者必须使用 require/import 搜索确认无生产引用，不能按文件名猜测删除。

## 4. 对外命令面

公开命令只保留：

```text
node .agents/skills/generate-game-kb/scripts/flow.js run <novel-dir> [--run <run-id>] --json
node .agents/skills/generate-game-kb/scripts/flow.js status <novel-dir> [--run <run-id>] --json
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit <novel-dir> --run <run-id> --unit chapter:NNN --json
node .agents/skills/generate-game-kb/scripts/flow.js archive-abandoned <novel-dir> --run <run-id> --json
```

职责如下：

- `run`：创建或恢复 v7 run，接收已出现的 staging 文件，推进状态，返回下一批 job，并在章节完成后自动组装、验证、安装、已安装验证和归档。
- `status`：完全只读。显示 run 版本、阶段、固定窗口、单元状态、当前可重派 job 元数据、manual review 和终态摘要。
- `retry-unit`：只能用于 `manual_review` 单元。调用前必须已有用户明确授权；controller 开启新的两次尝试周期。
- `archive-abandoned`：显式归档废弃 run，不迁移、不修复其中数据。

旧命令必须返回清晰的已删除错误和替代命令，不能静默转发到隐藏兼容层。

## 5. `run` 返回合同

`run --json` 返回稳定 JSON：

```json
{
  "semantic_contract_version": 7,
  "run_id": "run-example",
  "status": "jobs",
  "jobs": [],
  "active_units": [],
  "progress": {
    "accepted": 0,
    "total": 25
  },
  "manual_review": null
}
```

`status` 只允许以下值：

- `jobs`：本次签发了新 job 或 attempt 2 job。
- `waiting`：当前固定窗口仍有未完成单元，但没有新 job 可签发，`jobs` 必须为空。
- `manual_review`：至少一个单元已硬停，整个 run 不再自动推进。
- `complete`：安装、已安装验证和归档均完成。

每个 job 包含：

```json
{
  "unit": "chapter:001",
  "cycle": 1,
  "attempt": 1,
  "producer": "chapter-worker",
  "input_file": "<absolute-read-only-path>",
  "output_file": "<absolute-unique-staging-path>",
  "input_hash": "<sha256>"
}
```

机械修复 job 的 `producer` 为 `main-agent-repair`，其输入不得包含小说原文，只包含拒绝稿、错误报告和机械修复白名单。

## 6. 持久化状态机

### 6.1 Run 状态

建议在现有 `progress.json` 中保存单一权威状态，不再保留独立 `worker-pool.json`：

```json
{
  "schema_version": 2,
  "semantic_contract_version": 7,
  "active_units": ["chapter:001", "chapter:002"],
  "units": {
    "chapter:001": {
      "status": "active",
      "cycle": 1,
      "attempt": 1,
      "producer": "chapter-worker",
      "input_hash": "...",
      "input_file": "...",
      "output_file": "..."
    }
  }
}
```

允许的章节单元状态：

```text
pending
  -> active
  -> accepted

active
  -> rejected
  -> accepted

rejected attempt 1
  -> active attempt 2

rejected attempt 2
  -> manual_review

manual_review
  -> active cycle+1 attempt 1   # 仅 retry-unit
```

状态转换必须由一个 controller 事务函数拥有。不得由 CLI 分支、Worker 或主代理直接改写 JSON。

### 6.2 固定窗口

- `active_units.length <= 5` 是每次状态写入前必须验证的不变量。
- 窗口为空时，controller 按章节号选择后续最多 5 个 pending 单元并一次性持久化。
- 当前窗口中只要仍有非 accepted 单元，就不能加入窗口外章节。
- 窗口内 1 至 4 个章节先完成时，后续 `run` 只能接收结果并返回 `waiting`。
- 当前窗口全部 accepted 后，下一次状态推进才能清空窗口并签发后续最多 5 章。
- 不创建 `batch_id`；窗口只是 `active_units` 的当前集合。

这会让一个慢 Worker 阻塞窗口，但换来可验证且不依赖宿主实现的并发上限。

## 7. Run 文件布局

继续使用 `<novel-dir>/.game-kb-work/runs/<run-id>/`。v7 建议布局：

```text
run.json
manifest.json
artifact-manifest.json
progress.json
manual_review.json

source/
  original.txt
  chapters/
    chapter_001.txt

tasks/
  chapter_001/
    cycle_01/
      attempt_01.json
      attempt_02.json

staging/
  chapter_001/
    cycle_01/
      attempt_01.yaml
      attempt_02.yaml

drafts/
  chapter_001/
    cycle_01/
      attempt_01.yaml

revisions/
  chapter_001/
    cycle_01/
      attempt_01.errors.json

accepted/
  chapters/
    chapter_001.yaml
  candidate-registry.json

reports/
  run-metrics.json

final/
  id_plan.json
  data/
    characters.yaml
    skills.yaml
    items.yaml
    factions.yaml
    chapter_summaries.yaml
  reports/
    assembly-report.json
    game-kb-review.json
    verification-report.json
```

关键约束：

- `cycle` 必须进入路径。`retry-unit` 开启新周期时不能覆盖旧 attempt 文件。
- Worker 只能获得一个 task input 和一个 staging output。
- staging 路径继续使用 path confinement、realpath/junction 防逃逸检查。
- 成功接收后 staging 文件原子移动到 `drafts`，accepted 文件由 controller 规范序列化。
- 失败稿移动到 `drafts`，错误报告写入 `revisions`；不能散落在仓库根目录或 `.kb-scratch`。

## 8. Worker 输入与输出

### 8.1 章节 Worker input

每个 attempt input 是 controller 生成的不可变 JSON，至少包含：

- `semantic_contract_version: 7`
- `unit`
- `cycle`
- `attempt`
- `chapter`
- `title`
- `source_file`
- `source_hash`
- `chapter_text`
- `output_file`
- 当前 YAML schema 和闭合枚举
- attempt 2 时允许提供上一稿错误码；语义重试可提供错误摘要，但不能要求 Worker读取 controller 私有状态

`input_hash` 对 Worker 可见输入做稳定序列化后计算。路径和哈希由 controller 生成，Worker 不复制到输出。

### 8.2 Worker output

Worker 直接把 YAML 写到唯一 `output_file`。顶层只有章节语义结构：

```yaml
characters: []
skills: []
items: []
factions: []
chapter_summary:
  summary: "..."
  source_refs: []
```

输出禁止包含：

- envelope
- unit、cycle、attempt
- input hash
- source hash
- 最终 ID
- controller 路径
- `type` 单值字段

controller 在接收后注入章节号、标题、源哈希、候选 local key 和其他确定性身份字段。

## 9. Staging 接收事务

每次 `run` 先遍历当前 `active_units` 的预期 output path，只处理已存在的预期文件：

1. 校验路径仍位于 selected run 的 staging 根内，拒绝 symlink/junction 逃逸。
2. 读取稳定字节并计算原稿哈希。
3. 解析 YAML，拒绝围栏外多余内容和非唯一文档。
4. 校验章节 schema、枚举、实体引用和 `source_refs`。
5. 对白名单英文类型执行一对一规范化，并记录字段路径、原值、规范值和规则名。
6. 注入 controller 字段并规范序列化 accepted YAML。
7. 原子写 accepted、artifact manifest 和 progress。
8. 把原始 staging 文件移动到 drafts，避免下一次 `run` 重复接收。

任一校验失败时：

- 不写 accepted。
- 不删除错误实体后继续。
- 原稿移入 drafts，错误报告写入 revisions。
- attempt 1 进入 attempt 2 或 repair 分支。
- attempt 2 进入 `manual_review`。

controller 必须对同一 output hash 幂等：重复看到已归档稿不能再次消耗 attempt。

## 10. Attempt 与修复边界

### 10.1 不消耗语义 attempt

以下情况复用原 job、cycle、attempt 和 output path：

- output 文件尚未出现。
- Worker 启动失败。
- 明确的宿主 429。
- 宿主丢失会话但没有产生稿件。

主代理可从原 `run` 响应或只读 `status` 重新获得 job 元数据并重派，不调用 reset。

### 10.2 主代理机械修复

只有所有错误均在白名单中时才创建 `producer: main-agent-repair` 的 attempt 2：

- YAML 缩进
- 引号
- 代码围栏
- 明确的空数组/空对象表示
- 不改变值的 YAML 语法修复

repair input 只含拒绝稿、错误码和 output path，不含小说原文。主代理不得新增、删除或改写实体、描述、摘要、证据、类型和关系。

修复稿记录：

- 原稿哈希
- 修复稿哈希
- 错误码
- `producer: main-agent-repair`

### 10.3 语义重试

实体、证据、摘要、关系、未知/歧义类型等错误必须由章节 Worker 重做 attempt 2。第二次失败后 run 硬停。

## 11. v7 章节语义合同

### 11.1 `types`

武功、物品和势力统一使用多值 `types`：

```yaml
skills:
  - name: "..."
    types: ["内功", "心法"]

items:
  - name: "孔雀翎"
    types: ["武器", "暗器"]

factions:
  - name: "..."
    types: ["门派", "商会"]
```

规则：

- 三个类别各有独立闭合白名单和英文别名表。
- 实施第一步先对现有安装书目、schema、类型翻译表和测试 fixture 做只读类型盘点；v7 白名单必须覆盖现有中文规范值以及用户确认的物品“武器/暗器”和势力“门派/朝廷/商会”等合法值，不能在运行时根据模型输出自动扩表。
- 每个数组元素独立规范化。
- 规范化后稳定去重。
- 合法多类型不是冲突，不生成 warning。
- v7 的草稿、accepted 和终态记录出现单值 `type` 时 fail closed。

### 11.2 Rank 与 level

- `rank` 使用既有八级量表，不取章节最高值。
- 同一书级人物或武功的 rank 取出现次数最多的值；最高票并列时取最新章节证据更晚的值；仍并列时使用固定枚举顺序形成稳定结果。
- 人物 `level` 取 `核心 > 重要 > 次要 > 龙套 > 背景` 中出现过的最高重要性。
- 所有候选分布和最终选择进入 review report。

### 11.3 Description

- 精确去重后选择字符数最长的有证据 description。
- 长度相同时取最早 source ref；仍并列时按中文文本稳定排序。
- 未选中的版本和证据进入 review report。
- 嵌套技法按精确规范名称归并，其 description 使用相同规则。
- v7 默认流程不进行 AI 总结或语义润色。

## 12. 确定性书级归并

数据流：

```text
accepted chapters
  -> 候选标准化
  -> 泛称过滤与 resolution 记录
  -> 同类别 + 精确规范名称分组
  -> 字段确定性归并
  -> ID 规划
  -> 引用闭环解析
  -> 五个终态 YAML + review report
```

### 12.1 自动归并键

唯一自动归并键为：

```text
category + normalized canonical name
```

`normalized canonical name` 复用并收敛现有 `normalizeCandidateName`：Unicode 规范化、首尾空白清理和已确认的标点/空白规则必须稳定且有测试。

以下信号不得触发归并：

- aliases 重合
- 某名称命中另一实体 alias
- 近似名称
- 包含关系
- 拼音相似
- 模型推断为同一实体

aliases 只在实体分组后做稳定去重并集。

### 12.2 同名异人

无全书 AI 身份裁决时，controller 只能处理明确的结构性冲突：

- 同一章节内同类别、同规范名称却存在多个独立 local key。
- 已有显式 identity collision resolution 指明不能合并。
- 引用闭环证明同一组成员要求互斥身份。

这些情况进入 `manual_review`，不能生成随机 suffix。跨章节但没有明确结构性冲突的精确同名候选按已确认规则自动归并；这是删除全书 AI 身份蒸馏后接受的残余风险，必须在 review report 中保留全部成员证据。

### 12.3 泛称过滤

保守过滤表排除不能稳定指向单一实体的称谓和泛化概念，例如：

- 表哥
- 管家婆
- 店小二
- 武林
- 江湖

稳定专指称号继续保留，例如：

- 老刀把子
- 老实和尚

所有被过滤候选都生成 `GENERIC_CANDIDATE_FILTERED` review entry；不自动判断剧情重要性，不丢弃章节证据。

### 12.4 字段规则

- `aliases`、`identities`、`factions`、`skills`、三类 `types`：稳定去重并集。
- `description`：最长文本规则。
- `rank`：多数值，平票取最新证据。
- `level`：最高剧情重要性。
- `techniques`：按精确规范名称归并，description 使用最长文本规则。
- 章节摘要：按章节一对一保留，不跨章归并。

任何确定性选择都必须可从 review report 追溯到成员 candidate key 和 source refs。

## 13. ID 规划

ID 在书级实体形成后一次性生成，不能从章节候选 ID 中选择赢家。

### 13.1 无碰撞

一个类别中某拼音 base 只对应一个规范中文名时直接使用 base：

```text
char_lu_xiao_feng
skill_tian_wai_fei_xian
```

不附加 hash。

### 13.2 不同中文名的拼音碰撞

两个不同规范中文名生成相同拼音 base 时，每个冲突实体使用只由以下稳定输入生成的 suffix：

```text
category + canonical Chinese name
```

不得使用完整 candidate-key 集合、证据列表、输入顺序或后续章节数量。为既有实体增加新证据不能改变 ID。

### 13.3 同名异人

规范中文名完全相同、又有明确结构性证据不能合并时，不自动分配 suffix，进入 `manual_review`。没有稳定身份锚点时不得发布两个同名 ID。

`id_plan.json` 继续记录 base、碰撞原因、suffix 输入和最终 ID，工作区验证重算并比对。

## 14. Review report

工作区路径：

```text
final/reports/game-kb-review.json
```

安装路径：

```text
reports/game-kb-review.json
```

建议 schema：

```json
{
  "report_version": 1,
  "source_hash": "...",
  "final_data_hash": "...",
  "summary": {
    "warning_count": 0,
    "info_count": 0,
    "by_code": {},
    "by_category": {}
  },
  "entries": []
}
```

每条 entry 至少包含：

- `code`
- `severity`: `info` 或 `warning`
- `category`
- `name`
- `chapter_numbers`
- `source_refs`
- `member_refs`
- `reason`
- `resolution`

字段归并 entry 还包含：

- `field`
- `candidate_values`
- `selected_value`
- `selection_rule`

典型代码：

- `GENERIC_CANDIDATE_FILTERED`
- `DESCRIPTION_VARIANTS_COLLAPSED`
- `RANK_CONFLICT_RESOLVED`
- `LEVEL_CONFLICT_RESOLVED`
- `TYPE_ALIAS_NORMALIZED`
- `IDENTITY_COLLISION_REVIEW_REQUIRED`

已知一对一类型别名规范化可为 `info`；泛称过滤和可能影响人工判断的字段冲突为 `warning`。合法多 `types` 不生成 entry。

## 15. 验证、安装与归档

### 15.1 工作区验证

保留并更新现有硬门禁：

- source hash
- accepted 不可变哈希
- 章节证据覆盖
- 五文件精确集合
- schema 和闭合枚举
- ID 稳定性与引用闭环
- chapter summaries 覆盖
- final data hash
- `LOW_RECALL`
- 零未决 manual review

新增门禁：

- v7 三类实体只使用 `types`，不出现 `type`。
- review report schema 有效。
- report 的 source hash、final data hash 与当前产物一致。
- report 的字段选择可回溯到 accepted candidate。
- assembly report 和 verification report 绑定 review report hash。

新生成 run 的 review report 缺失、畸形或过期必须阻断安装。Dashboard 对已经安装的旧书采取非阻断 warning 是不同信任边界。

### 15.2 安装

安装继续使用兄弟暂存和失败回滚。五个 data YAML 与 `reports/game-kb-review.json` 必须作为一个发布事务处理：

1. 写入临时 data 和 report。
2. 校验临时产物原始哈希。
3. 备份当前 data 和当前 review report（若存在）。
4. 提升新 data 和 report。
5. 写安装回执，绑定五文件哈希、review report hash、source hash、final data hash 和 verification report hash。
6. 任一步失败时恢复旧 data 和旧 report。

已安装验证只读取已安装文件和回执，禁止回退工作区产物。

### 15.3 归档

只有工作区验证、安装和已安装验证全部通过后，`run` 才自动归档 v7 run。归档前任何失败都保留 run 供恢复。

## 16. v6/v7 兼容边界

### 16.1 Run

- 新建 run 写 `semantic_contract_version: 7`；`run.json`、`progress.json`、worker input、report 和 receipt 继续使用各自的 `schema_version`，不新增含义重叠的泛化版本字段。
- v6 及更早 run 的写入命令统一 fail closed。
- `status` 可只读展示旧 run。
- `archive-abandoned` 可显式归档旧 run，但不能转换数据。
- 不提供原地升级、import 或 migration 命令。

### 16.2 已安装图书

旧书可能使用：

```yaml
items:
  - type: 武器
factions:
  - type: 门派
```

v7 新书使用：

```yaml
items:
  - types: [武器, 暗器]
factions:
  - types: [门派, 商会]
```

Dashboard 读取边界必须支持两种形状：

- 恰好存在 `types`：验证为字符串数组，规范化为数组。
- 恰好存在 legacy `type`：验证为字符串或 null，在内存中规范化为零或一个元素的数组。
- 同时存在 `type` 和 `types`：合同无效，避免来源不明确。

磁盘上的旧 YAML 不改写。`/api/library/book-data` 继续返回服务端解析后的原始五文件值；客户端 `normalizeNovelData` 负责归一化成统一的 `types: string[]` 读模型。

旧书缺少 review report 时，review-report 接口返回有效空结果，不影响 browseable/completed。

## 17. Dashboard 设计

### 17.1 核心数据

- `DATA_FILE_NAMES` 和 `/api/library/book-data` 的五个顶层 key 不变。
- scanner 最低合同允许 legacy `type` 或 v7 `types`，但不允许两者同时存在。
- `NovelData` 的物品、武功和势力统一暴露 `types: string[]`。
- 详情页使用已有 taxonomy 展示能力显示多个类型；空数组显示未分类，不渲染 `null` 文本。

### 17.2 Review status

`/api/library/status` 为每本书增加轻量摘要：

```ts
review: {
  status: 'missing' | 'current' | 'stale' | 'invalid';
  warningCount: number;
  infoCount: number;
  reportPath: string | null;
}
```

规则：

- 旧书 missing 是正常状态，不降低 browseable/completed。
- v7 当前报告返回 current 和计数。
- hash 不匹配返回 stale，并产生 `REVIEW_REPORT_STALE` 扫描 warning。
- malformed 返回 invalid warning；对旧书不阻断浏览，对声明 v7 且应有报告的新书应使 completed=false，但不影响五文件可解析时的 browseable。

### 17.3 Review details API

新增只读接口：

```text
GET /api/library/review-report?path=<author>/<book>
```

约束：

- 只允许已发现、路径安全的书。
- 只读取固定 `reports/game-kb-review.json`。
- 不探测 `.yaml`、`.yml` 或其他 JSON 名称。
- missing 返回 schema 有效的空报告。
- 非 GET 返回 405；缺 path 返回 400；不安全/未知路径返回 422；畸形报告返回可诊断错误。
- 不复用 `/api/review/*` 写接口，保持 library controller 只读。

### 17.4 UI

- 书籍状态页显示 review warning 数量。
- 点击后按类别、代码和章节查看 entries。
- 每条详情展示名称、原因、处理结果和 source refs。
- UI 不提供在本任务内修改或“恢复”候选的按钮；这是只读审查面。

## 18. 代码边界与预期文件

实施者应优先沿用现有模块边界，预计影响：

### Skill 与合同

- `.agents/skills/generate-game-kb/SKILL.md`
- `.agents/skills/generate-game-kb/schemas.md`
- `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- 删除 `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- 平台 Worker 指南，例如 `.claude/agents/game-kb-chapter-worker.md`，但必须先保留并理解用户现有未提交修改

### Controller

- `scripts/flow.js`
- `scripts/lib/run.js`
- `scripts/lib/paths.js`
- `scripts/lib/progress.js`
- `scripts/lib/chapter-contract.js`
- `scripts/lib/semantic-contract.js`
- `scripts/lib/candidate-registry.js`
- `scripts/lib/ids.js`
- `scripts/lib/finalize.js`
- `scripts/lib/assemble.js`
- `scripts/lib/verify.js`
- `scripts/lib/install.js`
- `scripts/lib/archive.js`
- `scripts/lib/accept.js`：保留为 controller 内部 staging 接收事务或用更明确的章节接收模块替代
- `scripts/lib/semantic-work.js`：删除领域分支并收窄为章节工作，或替换为单一职责的 `chapter-work.js`

在调用者切换完成后预计删除：

- `scripts/lib/submit.js`
- `scripts/lib/domain-assembly.js`
- `scripts/lib/domain-contract.js`
- `scripts/lib/domain-work.js`
- 不再有生产引用的领域 helper
- `scripts/lib/worker-pool.js`，其并发数字由 `progress.active_units` 不变量替代

`candidate-ledger.js` 当前还参与 accepted serialization、安装和验证，不能仅因名称像旧流程而直接删除；实施者应在归并职责明确后决定保留或收窄。

### Dashboard

- `dashboard/server/libraryScanner.ts`
- `dashboard/server/libraryApiPlugin.ts`
- 对应 server tests
- `dashboard/src/types/library.ts`
- `dashboard/src/types/novel.ts`
- `dashboard/src/lib/normalizeNovelData.ts`
- 类型展示和书籍状态相关组件
- 新增只读 review report 详情组件或在现有书籍状态页内实现

### Trellis 规范

- `.trellis/spec/backend/quality-guidelines.md`：替换 v6 envelope/submit/deep/rolling-pool 合同，记录 v7 固定窗口、直接 staging、确定性归并和 review report 门禁。
- `.trellis/spec/backend/library-status-api.md`：记录 v6 `type`/v7 `types` 双读、review 摘要和只读 review-report 接口，保持 `/book-data` 五 key 不变。
- 相关 frontend spec：记录多类型展示和只读审查详情；实施者先从 `.trellis/spec/frontend/index.md` 选择现有归属文件，不新建重复规范。

## 19. 错误合同

实施者应使用稳定错误码，至少覆盖：

- `LEGACY_SEMANTIC_CONTRACT`
- `ACTIVE_WINDOW_INVALID`
- `UNIT_ALREADY_ACTIVE`
- `STAGING_PATH_ESCAPE`
- `STAGING_OUTPUT_INVALID`
- `CHAPTER_OUTPUT_SCHEMA_INVALID`
- `CHAPTER_OUTPUT_SEMANTIC_INVALID`
- `CHAPTER_OUTPUT_EVIDENCE_INVALID`
- `MECHANICAL_REPAIR_NOT_ALLOWED`
- `UNIT_MANUAL_REVIEW`
- `RETRY_UNIT_NOT_REVIEWABLE`
- `IDENTITY_COLLISION_REVIEW_REQUIRED`
- `REVIEW_REPORT_INVALID`
- `REVIEW_REPORT_STALE`
- `LEGACY_TYPE_AND_TYPES_CONFLICT`

错误对象必须包含足够的 run、unit、cycle、attempt、path 和 field 上下文，但不能把整章原文写进错误日志。

## 20. 测试策略

### 20.1 Controller 单元测试

- active window 永远不超过 5。
- 25 章首次只签发 5 章；无输出前重复 `run` 不签发第 6 章。
- 窗口内部分完成不补位；全部完成后才签发下一窗口。
- output 缺失、启动失败、429 不消耗 attempt。
- cycle/attempt 路径唯一，retry-unit 不覆盖旧稿。
- staging path confinement 和 junction/symlink 防逃逸。
- 成功稿自动接收，失败稿归档，重复 hash 幂等。
- 机械修复只允许白名单错误，repair input 不含原文。
- attempt 2 再失败进入 manual review。
- v6 run 写入路径 fail closed。

### 20.2 合同测试

- v7 章节输出无 envelope 和 controller 字段。
- 三类实体只接受 `types`。
- 三套白名单独立，已知英文一对一规范化，未知/歧义值拒绝。
- accepted 和终态字段精确。
- 旧公开命令已删除，四个新命令可用。

### 20.3 归并测试

- 角色、武功、物品、势力跨章精确同名归并。
- alias 重合、近似名、包含关系、拼音相似不归并。
- aliases/types/引用数组稳定去重。
- description 最长规则和全部变体 report。
- rank 多数规则、平票最新证据。
- level 最高重要性。
- 泛称过滤、专指称号保留。
- 同名结构性身份碰撞进入 manual review。
- 新增后续章节证据不改变 ID。
- 不同中文名拼音碰撞只按规范名称生成稳定 suffix。

### 20.4 Report、验证、安装测试

- review report schema、统计和 entry 追溯。
- source/final hash stale 检测。
- assembly/verification/install receipt 绑定 report hash。
- 五 YAML + report 原子安装，任一失败恢复旧 data 和旧 report。
- installed verification 无工作区回退。
- LOW_RECALL、source hash、final data hash 硬门禁保持。

### 20.5 Dashboard 测试

- legacy `type` 归一化为单元素 `types`。
- v7 `types` 保持数组。
- 同时出现 type/types 为合同错误。
- 详情页显示多个类型。
- 旧书缺 report 仍 browseable。
- current/stale/invalid report 状态和 warning 摘要。
- review-report API 的 GET、路径限制、missing、malformed 和正常响应。
- `/book-data` 仍精确返回五个顶层 key。

### 20.6 集成与真实模型验收

- 使用同一份 6 章专用语料跑自动化端到端测试。
- 使用 25 章 fixture 证明固定窗口不会提前签发第 6 章。
- 实施完成后分别在 Claude Code 与 WorkBuddy 上跑同一份 6 章真实模型流程。
- 两边都必须跨过首个五章窗口并完成安装。
- 两边都不得产生 `.kb-scratch`、临时清洗/提交脚本或散落 raw envelope。

真实平台验收属于实施后的人工门禁；自动测试必须先独立通过。

## 21. 回滚策略

- 不迁移 v6，因此 controller 回滚只需恢复代码，不需要回写旧 run。
- 新建 v7 run 若遇到缺陷可用 `archive-abandoned` 保留现场，不尝试降级为 v6。
- 安装失败恢复旧 data 和旧 review report。
- Dashboard 兼容层允许实现回滚后继续浏览 legacy `type` 书籍。
- 任何回滚不得删除用户当前工作区的两个观察现场。

## 22. 风险与约束

### 风险：同名异人跨章节误合并

删除全书 AI 身份裁决后，只有明确结构性冲突可以自动识别。缓解方式是保留全部成员证据、同章重复 fail closed、明确碰撞进入 manual review，并把该限制写进 review report。

### 风险：最长 description 不一定最好

这是为删除 AI 总结接受的质量取舍。所有变体保留在 report，未来可独立增加不阻断安装的 description refinement，而不能偷偷放回 v7 默认流程。

### 风险：types 扩大消费者合同

通过 v7 写入严格、Dashboard 双读、旧书不迁移和 type/types 同时存在 fail closed 控制风险。

### 风险：固定窗口吞吐下降

这是防止宿主一次派发全部章节的有意取舍。设计优先保证上限真实、恢复简单和运行可解释。

### 风险：工作区已有未提交现场

实施者必须在每个提交前检查 `git status`，只暂存本任务文件；不得清理或提交 `.kb-scratch`、根目录拆章文件、WorkBuddy/Claude 状态目录和其他用户产物。

## 23. 实施交接原则

- 本任务是复杂任务，实施前必须另有 `implement.md`。
- Codex 当前为 inline planning；不策划或填充 implement/check JSONL，任务创建时生成的 seed 文件保持原样。
- 每个实施提交必须逻辑独立、可单独说明、可运行对应测试。
- 不允许最后一次性提交全部 controller、Dashboard 和文档改动。
- 实施者必须先读本设计、PRD、Trellis backend/frontend spec 和工作区未提交差异。
- 用户已明确由其他 AI 执行，因此本会话不得运行 `task.py start` 或修改生产代码。
