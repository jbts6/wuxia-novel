# 《鸳鸯刀》校准与 generate-kb 审核设计

## Boundaries

- 唯一事实来源仍是小说原文及其 `ch_split/`。
- 《鸳鸯刀》第 1-126 行是局部人工校准样本，不扩张为全书人工金标。
- G1-G5 证明流程证据是否闭环；数量合理性只负责发现可疑低召回，不能证明完整。
- 每本书独立执行和产出审核包；批次只是若干单本审核包的临时集合。

## Workflow

```text
原文
  -> 高召回窗口扫描
  -> AI 逐项 keep/merge/redirect/reject
  -> 独立 gap audit
  -> G1-G5 硬门禁
  -> 数量与保留率合理性检查
     -> 异常：needs_ai_rerun，AI 自行返工
     -> 正常：ready_for_human_review
  -> 人工审核高风险项与少量抽样
  -> 单本接受或定点返工
```

## Review Readiness

审核就绪判断与 `completion_gate_passed` 分离：

- 任一 G1-G5 失败：`blocked`。
- G1-G5 通过但存在阻塞性召回异常：`needs_ai_rerun`。
- G1-G5 通过且无阻塞性召回异常：`ready_for_human_review`。

长篇判定综合章节数与原文行数。数量规则只设置低端报警线；不得因数量充足而自动通过召回门禁。

## Review Packet

每本书输出：

- `reports/review_packet.json`：机器可读审核包。
- `reports/review_packet.md`：一页式人工审核摘要。

审核包包含：

- source hash、章节数、行数和窗口数。
- 各类别候选数、保留数、拒绝数、未决数、最终数和保留率。
- G1-G5 状态与审核就绪状态。
- 阻塞性和警告性召回信号。
- 最多 10 个最高风险裁决。
- 保留和拒绝两侧各 3 个确定性抽样。
- `accept`、`rerun_recall`、`rerun_precision`、`manual_investigation` 动作。

## Human Review Contract

- 高风险项超过审核包容量时，不截断后交给人工；先由 AI 继续归并或重跑。
- 人工可以立即审核一本，也可以任意选择五六本审核包组成临时批次。
- 批次内每本书独立接受或返工，不共享完成状态。
- 人工形成的新通用规则必须记录版本；旧书只重查受影响类别。

## Compatibility

- 最终八类 `data/*.json` 接口保持不变。
- `quality_report.json` 新增 `review_readiness`，不改变 `completion_gate_passed` 的含义。
- 新审核包是附加报告，旧消费者可忽略。

## Rollback

- 删除新增审核包不会影响知识库或 G1-G5 报告。
- 删除 `review_readiness` 集成即可恢复旧质量报告结构。
- 《鸳鸯刀》人工校准工作区与归档数据保持不变。
