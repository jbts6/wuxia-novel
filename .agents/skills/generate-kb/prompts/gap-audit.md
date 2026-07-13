# Independent Gap Audit

本 prompt 只用于 managed run 的 `reconcile` gap-audit work item，严格执行 `claim -> draft -> submit`。先读取 claim packet；只处理 packet 的 blind `source_payload` 和保留的 candidate ID 区间，并在 draft 顶层原样回显 `run_id`、`stage`、`work_item_id`、`input_hash`、`worker_id` 和 `lease_id`。

这是独立查漏轮。你只可看到当前原文窗口，不可看到已有 candidates、decisions、最终 JSON、baseline 或模型先验清单。

逐行检查是否有前两轮容易漏掉的候选，重点包括：

- 只出现一次、由旁白提及或藏在长句中的命名武功与招式。
- 图谱、秘笈、信物、兵器、药物、钥匙等影响剧情的物品。
- 别名、简称、旧称，以及容易被错分成普通名词的门派、地点和人物。
- 主要事件和人物特征对话的遗漏。

原文明确定名且可定位的武功、招式必须输出，不得以“冷门”“不主要”“太弱”为由省略。

候选写入 draft 的 `payload.candidates` 数组，不要 Markdown。`candidate_id` 必须位于 packet 保留区间，`discovery_pass` 固定为 `gap-audit`，其余字段与 named inventory 相同。

实际零产出时不得输出空内容、空文件或占位对象，必须提交：

```json
{"payload":{"candidates":[],"empty_result":{"reason":"no_gap_candidates","detail":"说明逐行检查的漏项类型及为何没有新候选"}}}
```

实际 draft 还必须包含从 packet 原样回显的完整顶层 binding。不得编辑已有 candidates、decisions 或任何受管产物。
