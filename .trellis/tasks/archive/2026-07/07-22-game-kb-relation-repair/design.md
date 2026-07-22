# 关系闭环与派生恢复设计

## 目标

把 Worker 输出中的关系名称稳定投影为终态 ID；在关系确实缺失或多义时，保留足够的章节级溯源信息，以派生 run 的方式只重做受影响章节。

## 已确认事实

- `finalize.js` 现有 resolver 仅索引 `local_key`、`registry_key` 与 `member_local_keys`，但 Worker 合同要求关系字段传递名称。因此已有正式实体的名称也会在终态失败。
- `chapter-contract.js` 目前验证实体、证据与枚举值，但不对 `characters.skills`、`characters.factions`、`skills[*].factions` 做候选闭包校验。
- `chapter-progress.js` 的 `new-cycle` 只允许第 2 次失败的 rejected 单元；`chapter-receiver.js` 始终写入固定 `accepted/chapters/chapter_XXX.yaml`；`candidate-ledger.js` 会拒绝该 artifact 的哈希变化。因此不可在原 run 内重开 accepted 章节。
- 本任务不修改已安装的《萧十一郎》run，也不以它作为测试 fixture。

## 关系解析

`resolveReferences` 为每个目标类别建立三个独立索引：正式名称、内部候选键和别名。解析顺序固定为：

1. 唯一正式名称；
2. 唯一内部候选键，仅用于兼容已有 Controller 产物；
3. 唯一别名；
4. 否则返回 `REFERENCE_UNRESOLVED` 或 `REFERENCE_AMBIGUOUS`。

正式名称始终压过同文本的别名，禁止子串、拼音、编辑距离等模糊匹配。成功结果仍然是稳定 ID，五个终态 YAML 的字段和 Dashboard 合同不变。

## 章节闭包校验

接收 Worker 输出前，Controller 基于本章四类候选建立同样的名称/别名索引，并校验：

- `characters[*].skills[*]` 指向本章唯一技能候选；
- `characters[*].factions[*]` 指向本章唯一势力候选；
- `skills[*].factions[*]` 指向本章唯一势力候选。

正式名称优先、唯一别名次之。缺失或多义目标产生结构化章节错误，进入普通 `chapter-worker` 重试路径；不得由 `main-agent-repair` 修复。运行时 `worker_contract` 明确相同规则，确保提示与 Controller 同步。

## 终态溯源报告

确定性归并在合并关系数组时保留非终态的 relation provenance：目标名称、关系字段、拥有者类别/名称、贡献 member ref、章节号和 source refs。该 provenance 不写入五个终态 YAML。

终态 resolver 失败时生成并持久化 `reports/reference-recovery.json`，包含 parent run、source hash、accepted artifact-manifest hash、解析类别、拥有者、目标类别、目标名称、关系路径、精确来源章节集合与报告哈希。

普通 `run` 返回 `manual_review`，并把报告中的待恢复章节公开为 `manual_review` 单元；它不签发 job，也不修改 accepted artifact。

## 派生恢复 run

新增公开命令：

```text
recover-relations <novel> --run <parent-run> --confirm
```

它只接受带有有效 `reference-recovery.json` 的 v7 父 run，并执行：

1. 验证父 run 的 source hash、accepted artifacts、报告哈希和全部待恢复单元。
2. 创建新的 v7 recovery run，写入 `recovery-receipt.json`，绑定 parent run、报告哈希、带入单元、重开单元和 source hash。
3. 把未受影响章节以新 run 自己的 immutable artifact manifest 记录为 carry-forward artifacts；原文件不修改。
4. 将问题章节初始化为 pending；其 job input 附带本章原文、当前 Worker 合同、父 run 的对应 accepted draft 与关系错误上下文，并要求从原文重新产出完整章节 YAML。
5. 按现有五章窗口和 `chapter-worker` 接收流程继续；成功后使用现有 assembly、verify、install、archive 逻辑。

恢复 run 不复用父 run 的 final ID plan 或 final data。所有章节输出重新由恢复 run 的确定性归并和 ID 分配生成，避免把父 run 的失败投影带入新终态。

## Controller 派生证据行号

Worker 合同中的 `source_refs` 只包含逐字 `text`，不要求模型计算行坐标。章节接收时，grounding 先按既有 NFKC、换行和空白规范化规则验证全文命中，再以最早命中位置映射回原章节的 `line_start/line_end`，连同 `chapter` 一起写入 accepted YAML。

为兼容已经签发的 v7 job，Worker 输出中已有的行号不作为证据边界，接收时会被忽略并覆盖。accepted 与终态数据仍按严格行区间验证，因此信任边界只从模型移动到 Controller，没有放松发布门禁。

## 失败与回滚

- `recover-relations` 在 `--confirm` 缺失、父 run 报告过期、父 artifact 变更、源文本哈希变化或章节集合不一致时 fail closed。
- 失败前不创建部分可选的 carry-forward 状态；若创建 run 后任一写入失败，仅删除尚未登记的临时 recovery run，不触及父 run。
- recovery run 后续再次产生关系错误时，生成它自己的报告；不会回写或覆盖父 run。

## 兼容性

- 旧 run 仍只允许既有的只读/归档操作。
- v7 的既有 `retry-unit` 语义不变，仅处理 rejected 单元；终态关系恢复使用独立命令，避免把 accepted 重开伪装成普通 retry。
- 不改变终态 YAML 文件名、顶层字段、ID 格式或 Dashboard 读取路径。
