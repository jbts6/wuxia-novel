---
name: generate-kb
description: Use when building, rebuilding, or auditing a source-grounded wuxia novel knowledge base, especially when extraction recall, evidence quality, resumability, or existing final JSON is unreliable.
---

# generate-kb

以小说原文为唯一事实来源，通过可暂停、可恢复的六阶段状态机生成八类知识库 JSON。AI 只生产当前 work item 的 draft；状态、受管产物、正式 ID、正式数据和报告由控制器校验后写入。

## 不可变规则

1. `.agents/skills/generate-kb` 是唯一真实实现；`.claude/skills/generate-kb` 只是兼容软链接。
2. `scripts/pipeline.js` 是新 run 的唯一写入入口。旧脚本只可由控制器调用或用于明确的只读诊断/迁移。
3. 每次开始或恢复都先运行 `status --json`，只执行 `next_action`；一次调用最多推进一个控制器动作或处理一个 work item。
4. 固定执行六个有序阶段：`prepare`、`inventory`、`reconcile`、`enrich`、`semantic-audit`、`publish`。
5. `prepare` 到 `semantic-audit` 只使用 provisional key；正式 ID 仅在 `publish` 生成。此前不得写正式 `data/*.json`、`reports/*.json` 或修改 `.kb/current`。
6. 新 run 不读取旧正式 JSON、旧 baseline、百科、影视改编或模型记忆。模型先验只能提出原文检索锚点，不能成为事实。
7. 所有大阶段使用 `claim -> draft -> submit`。AI 只能写 claim 返回的非受管 draft 路径，不能直接修改 state、events、ledger、materialized、正式数据或报告。
8. 任一门禁失败立即停止。数量、总分、人工确认或其他阶段 PASS 均不能补偿失败。

## 六阶段

1. `prepare`：建立原文、章节、窗口和 source hash。
2. `inventory`：逐窗口提取候选和章节摘要草稿；实际零产出必须提交结构化原因。
3. `reconcile`：归并候选，确定 canonical name、类别和重要性；不生成正式 ID。
4. `enrich`：按稳定实体批次生成丰富草稿和字段级证据；禁止骨架、占位句和机械证据复用。
5. `semantic-audit`：独立检查召回、分类、事件参与者、对白 speaker、豁免和字段证据。
6. `publish`：为已通过审计的 provisional records 一次生成正式 ID，统一投影引用，验证 staging bundle，再原子 promote。

开始前完整读取 [pipeline.md](pipeline.md)。字段和中间产物读取 [schemas.md](schemas.md) 与 [constants.md](constants.md)；召回检查点和人工 receipt 读取 [review.md](review.md)。

## 执行入口

```bash
node "$SKILL/scripts/pipeline.js" status "$NOVEL" --json
```

根据返回的 `next_action.command` 执行且只执行一项：

```bash
node "$SKILL/scripts/pipeline.js" run "$NOVEL"
node "$SKILL/scripts/pipeline.js" claim "$NOVEL" --worker "$WORKER"
node "$SKILL/scripts/pipeline.js" submit "$NOVEL" --worker "$WORKER" --item "$ITEM" --draft "$DRAFT"
node "$SKILL/scripts/pipeline.js" check "$NOVEL"
node "$SKILL/scripts/pipeline.js" advance "$NOVEL"
```

长篇小说在 `reconcile` 后必须停在 recall review checkpoint。高风险裁决默认最多 15 项，用户可按精力把上限降到 10 项或更低；超过上限时由 AI 继续复核，不得截断未展示项。人工动作必须通过 `record-review` 写入绑定当前 hash 的 receipt，聊天确认不改变状态。

`publish` 使用 `build-publish "$NOVEL" --draft <publish-draft>`、`promote` 和 `rollback`。publish draft 位于受管 run 目录之外，只提供绑定当前 semantic audit hash 的 token plan；不得提交 `report_inputs`。控制器从当前 run 的 materialized 产物构建 staging bundle，并在投影后的 staging data 上实际生成 verification、cross-validation 和 G1-G5 quality 报告，不接受外部预制 bundle 或 PASS 报告。只有 staging bundle 内全部验证通过，且 `expected-current` 未变化，才允许原子切换 `.kb/current`。逻辑消费接口保持为 `data/*.json` 与 `reports/*.json`。

## 完成条件

只有同时满足以下条件才可声明完成：

- `status --json` 显示 `publish` 已通过并已 promote，且没有允许的后续生成动作。
- staging manifest、八类正式 JSON、G1-G5、semantic audit、verification 和 cross-validation 绑定同一个当前 hash。
- `pipeline.js check` 成功；没有未提交 work item、陈旧 lease、失效 receipt 或未处理高风险项。
- 当前版本可通过 manifest 完整性复验和 rollback 目标校验。

不得用直接运行旧 validators、直接编辑 JSON 或聊天中的“已核对”制造完成状态。

## Legacy

旧 baseline、多 pass prompts 和直接写 `build/`/`data/` 的流程只用于旧知识库的只读诊断与迁移。它们不参与新 run，不得作为新草稿模板、完整性证明或受管写入入口。
