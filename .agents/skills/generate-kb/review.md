# 审核与人工 receipt

审核分为自动语义门禁、reconcile 后的召回检查点和 publish 摘要。人工只处理紧凑、可追踪的边界裁决，不能替代 AI enrich、semantic audit 或 bundle 验证。

## Reconcile 自动审核

每个候选必须形成 keep/merge/redirect/reject decision，并保留 candidate、source refs 和 provisional key 的证据链。

- 命名武功与招式不因低频、弱小或不影响主线而 reject；`importance` 只分级。
- skill 是功法、体系或门类，technique 是明确命名的一招一式；类别错误用 redirect，重复/别名用 merge。
- 主要事件参与者和强人物信号必须形成 character candidate/record，或有具体、可定位的处理证据。
- item 只保留推动剧情、体现人物或武学相关的物品；穴位、经脉、普通动作、外号和普通花名不得误入正式类别。
- blind gap audit 发现有效新增时继续 reconcile，不能用人工检查跳过。

控制器根据 evidence、分类边界、归并冲突和 reject 风险生成 `high_risk_decisions`。AI 先复核并写 `confirmed|revised|needs_human`；只有仍无法确定的边界项进入人工 packet。

## Recall Review Checkpoint

长篇小说在 reconcile PASS 后、enrich 前必须暂停。中短篇在自动异常或存在未决高风险项时也进入同一检查点。状态名固定为 `awaiting_recall_review`，不能使用 `ready_for_human_review` 暗示整库已完成。

审核包只展示：

- 拟定核心/重要角色、主要事件和主要武功。
- 章节覆盖异常及自动发现的疑似漏项。
- 不超过当前配置上限的高风险裁决。
- keep/reject 两侧少量确定性样本。

高风险上限默认最多 15 项。用户可按精力把上限降到 10 项或更低；超过当前上限时不得截断或丢弃未展示项，AI 必须继续核对证据、修正 decision 或确定化，再重新生成审核包。

人工无需阅读全量 candidates、decisions 或 enrich 草稿。人工补充的名称只成为下一轮原文检索锚点，不能直接变成 candidate、record 或正式 ID。

## 人工动作

聊天中的“接受”“已核对”不改变流水线。所有动作使用唯一 CLI：

```bash
node "$SKILL/scripts/pipeline.js" record-review "$NOVEL" --input "$RECEIPT_DRAFT"
```

receipt draft 包含：

- `action`: `accept_recall|rerun_recall`。
- 每个高风险 decision 的结论与备注。
- reviewer 标识。
- packet 中的 source hash、reconcile output hash 和 decision IDs。

控制器校验 binding 后写入机器 receipt。source、reconcile output、decision 或 packet 变化会使 receipt 自动失效。`rerun_recall` 回到状态机指定的 inventory/reconcile remediation；`accept_recall` 只允许进入 enrich，不代表知识库完成。

## Enrich 与 Semantic Audit

enrich 必须补全复杂字段和字段级证据。以下情况由 AI 返工，不能交给人工兜底：

- 最终草稿仍只有名称、引用等骨架字段。
- 占位句、同义反复、模板描述或无原文支持的全书判断。
- 三个或以上语义不同字段机械复用同一证据组。
- `shared_evidence_justification` 未逐字段指出原文事实。

semantic audit 独立检查对白、人物特征、事件参与者、类别、豁免和字段证据。persona/both 对话必须有真实 speaker；有明显原文对白的主要角色不能用通用理由豁免。任何自动门禁失败都生成 remediation transition，人工 receipt 不得覆盖。

## Publish 后查看

publish staging bundle 通过全部自动校验并 promote 后，生成绑定当前 bundle hash 的最终摘要。若有效 recall receipt 已覆盖召回和高风险裁决，不再强制第二次逐项人工审核；用户仍可查看摘要、版本 manifest、promote receipt 和 rollback 目标。

只有 `pipeline.js status --json` 与 `pipeline.js check` 共同显示六阶段完成、publish 已 promote、所有报告 hash 一致，才可声明本书知识库完成。

## Legacy

旧 `review_packet.md`、固定 10 项终审、`accept|rerun_precision|manual_investigation` 动作和聊天确认，只用于旧知识库诊断/迁移，不参与新 run，也不能产生有效 receipt。
