# v4 rank/level 合同与严格 grounding 设计

## 状态

- 阶段：planning
- 已确认方案：受控枚举 + Controller 接收门禁
- 子任务：`.trellis/tasks/07-23-grounding-typography-folding/`

## 设计目标

1. Job input 自包含地说明 `rank` / `level` 的允许值和语义，Worker 不再把职位写入战力字段。
2. Controller 在 accepted artifact 写入前执行同一套语义校验，不能依赖 Worker 自检兜底。
3. 旧 v3 job fail closed，新 run 使用 v4 合同；不迁移或修补旧 run。
4. 允许严格、可审计的排版符号恢复，但不放宽汉字、数字、字母或词序。
5. 两个交付单元分别测试、分别提交，最后共同接受《血海飘香》新 run 验证。

## 非目标

- 不新增书级 AI enrichment。
- 不把章节 `rank` / `level` 强制清空。
- 不修改小说原文、prepared chapter 或旧 run。
- 不采用删除标点、编辑距离、模糊搜索或多候选择优。
- 不同时实施成本效率文档中的缓存、双章打包、并发扩容等建议。

## 交付单元 A：rank/level 合同

### 单一真相源

继续以 `scripts/lib/semantic-contract.js` 为唯一语义来源：

- `CHARACTER_LEVELS`：人物层级允许值；
- `POWER_RANKS`：人物及武功战力等级允许值；
- `POWER_RANK_CONTRACT`：八档标准、人物全书时间线规则、武功稳定上限规则。

`chapter-worker-contract.js` 只引用并投影这些共享常量，不复制第二份枚举。Job 中增加结构化语义段，至少包含：

- `characters[].level` 的允许值、可空规则和“叙事重要度”语义；
- `characters[].rank` / `skills[].rank` 的八档允许值、可空规则和全书聚合语义；
- 职位、门派职务、称号和社会身份写入 `characters[].identities`，不得写入 `rank`；
- 证据不足时写 `null`，不得根据身份光环猜测战力。

合同版本从 3 提升为 4。现有 `assertCurrentWorkerContract()` 继续作为唯一 stale-contract 门禁，因此 v3 run 的继续执行、接收和状态推进保持 fail closed；只读状态和废弃归档行为不变。

### 接收门禁

`scripts/lib/chapter-contract.js` 已有 `validatePowerRank()` 和 `validateCharacterLevel()`。v7 `validateWorkerChapterDraft()` 在遍历候选实体时直接复用它们：

- `characters[]`：校验 `level` 和 `rank`；
- `skills[]`：校验 `rank`；
- `null` 与共享枚举值通过；
- 其他字符串原样报 `CHARACTER_LEVEL_INVALID` 或 `POWER_RANK_INVALID`，不自动改写为 `null`，也不搬运到 `identities`。

错误继续走现有 receiver 拒绝与语义重试路径，accepted artifact 不会被创建。

### Worker surface 同步

同步结构化合同和维护者文档：

- `scripts/lib/chapter-worker-contract.js`
- `prompts/extract-chapters.md`
- `schemas.md`
- `examples.md`
- `SKILL.md`

文本只解释结构化合同的读取方式，不维护另一份允许值列表。

## 交付单元 B：排版符号 grounding

详细设计见子任务 `design.md`。父任务只规定集成边界：

- 原文和 prepared chapter 不变；
- Worker 仍须逐字引用，不把符号恢复当作可主动改写许可；
- Controller 只在 exact match 失败后尝试 allowlist folding；
- fallback 必须在当前章节唯一命中；
- accepted quote 回填源章节 canonical text，并写入既有 `normalizations` 审计；
- `chapter:015 attempt_01` 的措辞改写必须继续失败。

该子任务不依赖 rank/level 代码。父任务的最终新 run 同时依赖 A、B 两项通过。

## 数据流

```text
semantic-contract.js
        │
        ├──> worker contract v4 ──> self-contained job ──> chapter Worker
        │                                                   │
        └──> shared validators <── Controller receiver <────┘
                                      │
                         rank/level invalid ──> reject/retry
                                      │
                         grounding exact/folded match
                                      │
                         accepted artifact + audit
                                      │
                         deterministic assembly/verify
```

## 兼容性与失败策略

- v3 job：`WORKER_CONTRACT_STALE_RESTART_REQUIRED`，不得原地升级。
- 非法 rank/level：接收阶段拒绝，不自动修复语义。
- grounding 零命中或 fallback 多命中：继续使用 `SOURCE_QUOTE_NOT_FOUND`。
- 非 allowlist 符号差异：继续拒绝。
- accepted artifact：保持 immutable；所有规范化在首次写入前完成。
- 根目录临时文件策略沿用已完成的 containment 修复，本任务只做回归验证。

## 验证矩阵

| 场景 | 预期 |
|---|---|
| `characters[].rank = "帮主"` | receiver 返回 `POWER_RANK_INVALID` |
| 非法 `characters[].level` | receiver 返回 `CHARACTER_LEVEL_INVALID` |
| 共享枚举值或 `null` | accepted |
| 职位位于 `identities`、rank 为 `null` | accepted |
| v3 job 继续执行 | stale-contract fail closed |
| 仅 allowlist 符号不同且唯一命中 | 回填源文本并记录审计 |
| allowlist fallback 多命中 | `SOURCE_QUOTE_NOT_FOUND` |
| `chapter:015 attempt_01` 改写 | `SOURCE_QUOTE_NOT_FOUND` |
| 新《血海飘香》run | 27/27 accepted，最终验证、安装、归档通过，根目录临时文件为 0 |

