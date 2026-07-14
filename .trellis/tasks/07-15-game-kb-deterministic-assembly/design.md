# Game KB 类别语义决策与确定性组装技术设计

## 1. 继承与替代边界

本设计取代前置任务 `07-14-fast-kb-pipeline` 设计 6.2、6.3 以及 17 中“主模型一次生成整本合并/清理 JSON”的边界。逐章直接读原文、run 隔离、候选覆盖、补漏、最终 ID、安装和归档合同不变。

## 2. 触发修订的可复现证据

《飞狐外传》20 章 accepted 数据共有 1,089 个候选。三份 60–69 万字节 merge 失败稿均为完整可解析 JSON；失败来自长机器键被改写、候选去向枚举错误和引用错误，不是输出截断。相同量级草稿后来能通过，进一步排除“文件绝对放不下”。

第一次 clean 草稿同样完整可解析，但 420 条删除决策都发明了 `entity_removed_during_cleaning`。字段校验和 ledger 各报一次，形成 840 条重复放大的 resolution 错误；另有 36 个核心/重要人物缺 biography、1 个缺 personality，合计 877 条错误。该草稿还删除了 76 个 `named_in_source: true` 招式，说明问题同时包含机械合同失误与语义过度清理。

后续通过稿把 1,089 条 resolution 全部改成 `merged_to`，九类实体一个不删，并在 `quantity_review` 明写“保留所有实体，不进行删除，避免 candidate_resolutions 失效”。该结果满足当前结构校验，却没有完成清理语义。随后 clean 又被自动 reset。该 run 只能作为负向架构证据，不能满足新流程验收。

## 3. 已选边界

新数据流为：

```text
accepted chapters
  -> deterministic merge work plan + private bindings
  -> merge:<category>:<shard> semantic decisions
  -> optional merge:<category>:consolidate
  -> deterministic accepted/merged/book.json
  -> deterministic clean obligations + private entity bindings
  -> clean:<category>:<shard> semantic decisions
  -> clean:materials:001
  -> deterministic accepted/cleaned/book.json
  -> existing build-final / verify / install / archive-run
```

AI 只回答“这些短引用如何归并、保留、删除、合并或修订”。脚本独占以下机械责任：

- 原始 `candidate_key` 和 accepted chapter 哈希；
- 候选/实体短引用到真实键的私有绑定；
- 全书唯一 `local_key`；
- 章节摘要拼接、未变化字段继承和 source_refs 并集；
- 全量 `candidate_resolutions` 展开与清理后的去向迁移；
- 类别对象、整本对象、最终 ID 和引用的确定性组装；
- 工作项大小、输入哈希、进度、attempt、staging、不可变 accepted artifact 和报告。

## 4. 工作项、私有绑定与稳定分片

每个工作项有 AI 可读 `input.json` 和控制器私有 `bindings.json`。`input.json` 只暴露短引用和完成语义判断所需的已接受事实；`bindings.json` 保存短引用到 candidate/local key 的精确映射，不进入模型提示词。AI 输出中出现 `candidate_key`、`local_key`、最终 `id`、`*_id` 或 `*_ids` 均以 `MECHANICAL_KEY_FORBIDDEN` 拒绝。

稳定常量为：

```javascript
const MAX_WORK_ITEM_CANDIDATES = 120;
const MAX_WORK_ITEM_BYTES = 96 * 1024;
```

分片先按类别，再按规范化名称组排序；不超过上限时一个类别只有一个 shard。一个同名组本身超限时允许拆成连续子组，但必须创建 consolidation 单元。任何类别产生两个以上 shard 时，也创建只读取初步实体摘要的 `merge:<category>:consolidate`，用于处理跨 shard 别名和重复，不再回读全部逐章候选。相同输入重复规划必须得到字节相同的短引用、边界、文件内容和哈希。

工作项输入哈希包含：合同版本、阶段、类别、shard、排序后的上游 accepted 哈希、AI 可读 input 哈希和私有 binding 哈希。恢复时任一部分变化都会使对应单元 stale；无变化的 done 单元不重跑。

## 5. Merge 决策合同

merge 草稿只使用短引用：

```json
{
  "schema_version": 1,
  "stage": "merge_decision",
  "unit": "merge:items:001",
  "decisions": [
    {
      "entity_ref": "e001",
      "member_refs": ["c001", "c004"],
      "action": "merge",
      "canonical_name": "闯王军刀",
      "aliases": [],
      "fields": {}
    },
    {
      "member_refs": ["c002"],
      "action": "reject",
      "reason": "ordinary_item",
      "detail": "无特殊性且不推动剧情"
    }
  ],
  "ambiguities": []
}
```

每个输入 member ref 必须且只能出现一次，action 只允许 `merge`、`reject`、`ambiguous`。`reject` 复用 candidate-ledger 的唯一 rejection enum；`ambiguous` 必须有 detail 并阻断整书完成。脚本为 merge 实体生成稳定 local key，合并成员 source_refs，展开原始 candidate key，生成完整 ledger。AI 不复制候选键，也不输出章节摘要。

非 dialogue 类别可使用隔离的宿主原生 worker 并行生成草稿，实际派发仍受同一持久化 worker pool、宿主槽位和 429 退避约束；主模型串行 accept。events 先完成确定性类别投影，dialogues 再读取事件短引用目录，以保证 event 关系可验证。

所有必需 merge shard/consolidation 单元 done 且无 ambiguity 后，`assemble-merge` 生成 attempts 为 0 的 `merge:book` 确定性单元，并一次写入现有兼容路径 `accepted/merged/book.json`。组装不会调用模型，也不会覆盖已有不同哈希文件。

## 6. Clean 决策、义务和 ledger 迁移

`prepare-clean` 先从 accepted merged book 生成 `clean-obligations.json`。确定性义务至少包含：

- unresolved ambiguity；
- 核心/重要人物 biography 或 personality 缺失；
- 次要/龙套/背景人物 biography 超过 200 字或性格词超过 2 个；
- 非法 item inclusion reason；
- dialogue 指向不存在事件、章节不一致或同一事件多条最终对白；
- 当前 book contract、候选 ledger 或名称引用的其他确定性错误。

clean 草稿对每个实体短引用给出且只给出一个决定：

```json
{
  "schema_version": 1,
  "stage": "clean_decision",
  "unit": "clean:characters:001",
  "decisions": [
    { "entity_ref": "e001", "action": "keep" },
    {
      "entity_ref": "e002",
      "action": "edit",
      "patch": { "biography": "...", "personality": { "traits": ["沉着"] } },
      "resolves": ["o003"]
    },
    {
      "entity_ref": "e003",
      "action": "merge_into",
      "target_ref": "e001",
      "reason": "duplicate",
      "detail": "同一人物异名"
    }
  ],
  "quantity_explanation": null
}
```

action 只允许 `keep`、`edit`、`merge_into`、`drop`。patch 只允许类别语义字段，不能修改 local key、source refs、candidate resolutions、合同字段或最终 ID。脚本应用决定后重新执行合同校验；仅声称 `resolves` 而没有消除义务不能通过。

ledger 迁移完全确定性：

| Clean action | 原候选去向 |
|---|---|
| `keep` / `edit` | 保持原 resolution |
| `merge_into` | 所有指向旧实体的 `merged_to` 改指目标实体 |
| `drop` | 所有指向旧实体的候选改为同一有限 reason/detail 的 `rejected` |
| 原本已 rejected | 保持原拒绝决定，不被清理重写 |

命名功法/招式不得 `drop`，只允许 keep/edit 或以 duplicate merge_into；核心/重要人物同样不得直接 drop。存在未闭合 obligation 时 assemble-clean 阻断。obligation 为空、所有实体显式裁决、结果重新校验通过时，零删除合法；因此不以“必须删掉若干条”作为伪质量门禁。

events 清理先完成，dialogues 再读取 surviving event 目录。全部实体类别完成后，`clean:materials:001` 读取紧凑的 surviving entity catalog，只输出五类游戏素材引用与用途，不嵌入事实记录。数量说明从各类别的 `quantity_explanation` 和确定性数量报告汇总。`assemble-clean` 生成 attempts 为 0 的 `clean:book` 和现有兼容 `accepted/cleaned/book.json`。

## 7. 状态、失败与恢复

新 run 写入 `semantic_contract_version: 2`。AI 状态单元为 `merge:<category>:<shard>`、可选 `merge:<category>:consolidate`、`clean:<category>:<shard>` 和 `clean:materials:001`；`merge:book`、`clean:book` 是 attempts 为 0 的确定性聚合单元。

类别 worker 沿用 run 级 `worker-pool.json`：同批一个或多个显式 429 只退避一次且不 accept、不消耗语义 attempts。每个 AI 单元仍最多三次提交，staging 必须精确绑定 run/unit/attempt，成功或拒绝后消费。某单元 manual_review 后继续其他无依赖类别，但 assemble 和 install 被阻断。任何单元都不得自动调用 reset-unit。

确定性规划或组装错误写入报告并停止，不伪装成 AI validation error，也不消耗语义预算。输入哈希变化只轮换受影响单元；已完成且输入不变的其他类别保持 done。

缺少 `semantic_contract_version: 2` 的旧 run 只允许 status、证据导出和用户明确授权的 abandoned archive，不得静默生成新类别工作项、重置旧 merge/clean、继续安装或计入新版正向验收。最终兼容 JSON 形状不带合同版本，消费者不受影响。

## 8. 错误矩阵

| 条件 | 错误 | 结果 |
|---|---|---|
| AI 输出机械键或最终 ID | `MECHANICAL_KEY_FORBIDDEN` | 拒绝当前单元 |
| ref 缺失、重复或不属于 work item | `WORK_REF_INVALID` | 拒绝当前单元 |
| binding/input/hash 不一致 | `WORK_ITEM_STALE` | stale，重新规划受影响单元 |
| 非法 action/reason/patch 字段 | `SEMANTIC_DECISION_INVALID` | 拒绝当前单元 |
| named technique 或核心人物被直接 drop | `PROTECTED_ENTITY_REMOVAL` | 拒绝 clean 单元 |
| obligation 声称完成但结果仍失败 | `CLEAN_OBLIGATION_UNRESOLVED` | 拒绝 clean 单元 |
| merge ambiguity 未解决 | `MERGE_AMBIGUITY_UNRESOLVED` | 阻断 assemble-merge |
| 类别未完成或 ledger 未闭合 | `BOOK_ASSEMBLY_INCOMPLETE` | 阻断聚合，不消耗 AI attempt |
| 旧 run 进入新语义阶段 | `LEGACY_SEMANTIC_CONTRACT` | 停止并保留只读证据 |
| 尝试耗尽或无进展 | 既有 `ATTEMPTS_EXHAUSTED` / no-progress code | `manual_review`，禁止自动 reset |

## 9. 验证与推出

首先使用纯合成但真实形状的 1,089-key fixture 证明短引用能无损展开；再用 420-candidate drop fixture 证明一个实体级有限原因能机械迁移全部去向。回归还覆盖稳定分片、跨 shard consolidation、named technique 保护、详细人物义务、多对白义务、合法/非法 clean no-op、类别失败隔离、精确 staging、上下文恢复和旧 run fail-closed。

实现完成后只用 `semantic_contract_version: 2` 创建 fresh run 做《飞狐外传》和《笑傲江湖》前向试跑。当前发生过 whole-book reset 和 keep-all clean 的 run 保留为负向 evidence，不得为了得到绿色状态继续 reset，也不能替代 fresh-run 验收。
