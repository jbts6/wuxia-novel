# generate-game-kb v7 时间统计设计

## 1. 目标与边界

本设计只服务于新建的 v7 `chapter-direct-v1` run。它不迁移、不回填、不改写已经完成或归档的 run；缺少时间合同的旧 run 继续按现有只读路径处理。游戏数据语义合同仍为 `semantic_contract_version: 7`，新增的是独立的 `timing_contract_version: 1`。

时间统计的事实来源是 Controller 产生的事件和当前 run 的 accepted artifact。文件 `mtime`、`birthtime`、run 目录名和 Worker 自己写入的辅助文件都不是正式时间证据。Worker 仍只读 job input、只写唯一 YAML output，不感知事件系统。

## 2. 方案与模块边界

新增 `scripts/lib/timing-events.js`，负责：

- 事件 schema、UTC 时间解析、单调序号与稳定事件键。
- Controller 独占的事件追加、读取、顺序校验、幂等去重和事件文件哈希。
- 从事件构建 attempt、窗口、人工等待和阶段时间线。

`paths.js` 增加 run 私有 `events.jsonl` 路径；`run.js` 新建 run 时写入 `timing_contract_version` 与 `run_started`，恢复已有新合同 run 时不重复写入。旧 run 不自动补文件。

现有边界负责发出事件，不让纯状态 reducer 产生文件副作用：

- `source.js`：`source_prepare_started` / `source_prepared`。
- `chapter-work.js`：`window_issued`、每个 `attempt_issued`。
- `chapter-receiver.js`：每个 `attempt_observed`，随后 `attempt_accepted` 或 `attempt_rejected`；最后一个 active unit 被接受时写 `window_closed`。
- `flow.js`：检测进入/退出 chapter `manual_review`，并包围 assemble、verify、install、archive 阶段。
- `retry-unit`：确认后写 `manual_review_resumed`，然后由 `chapter-work` 写新 cycle 的 `attempt_issued`。

事件记录固定为 JSONL 对象：

```json
{
  "schema_version": 1,
  "sequence": 17,
  "event_key": "attempt-issued:chapter:024:2:1",
  "type": "attempt_issued",
  "occurred_at": "2026-07-23T07:05:55.400Z",
  "unit": "chapter:024",
  "cycle": 2,
  "attempt": 1,
  "producer": "chapter-worker"
}
```

带 unit 的事件必须绑定 `unit/cycle/attempt/producer`；阶段事件绑定 `phase`；窗口事件绑定稳定的 `window_sequence`。同一 `event_key` 只能计数一次。事件写入采用完整行校验和原子更新，异常中断后恢复会重读、校验并按键幂等，不接受半行或乱序日志。

## 3. Metrics 口径

`timing.js` 保留旧 `phase_durations` 字段名，并把新 run 的 `run-metrics.json` 升级为 schema 2：

- `total_ms`：`run_started` 到归档结束的墙钟时长。
- `human_wait_ms`：每个 `manual_review_entered` 与 `manual_review_resumed` 配对后的总和。
- `active_ms`：`total_ms - human_wait_ms`，不允许为负。
- `phase_durations`：由对应开始/完成事件计算；`chapter_extraction_ms` 是章节窗口墙钟跨度，人工等待作为独立子集报告，不与 `active_ms` 相加。
- `ai_units`：由全部唯一 `attempt_issued` 事件累计；`corrections = attempts - planned`，跨 cycle 不丢失。
- `windows`：签发、关闭、未闭合窗口数及窗口墙钟跨度。
- `attempt_timing`：按 attempt 汇总 `issued -> observed` 周转和 `observed -> accepted/rejected` Controller 校验时长。它不宣称是纯模型推理时间。
- `candidate_counts.chapter_candidates`：扫描当前 run 的 accepted chapter YAML，四类数组长度求和；`final_records` 仍由最终五文件计算。
- `timing_events_hash` / `timing_contract_version`：绑定事件证据和合同版本。

`manifest.json.prepared_at`、`artifact-manifest.json.entries[].accepted_at`、安装回执的 `started_at/installed_at` 和归档回执的 `archived_at` 保持兼容，并由事件时间线覆盖其性能统计用途。`generated_at` 继续表示 metrics 生成时刻，不再被当作独立阶段完成时间。

## 4. 一致性、恢复与兼容

事件和 progress 不是跨文件事务；Controller 采用“稳定 event key + 原子事件更新 + 现有 progress 原子写入”的幂等协议。事件已经写入但 progress 尚未落盘时，下一次恢复不会重复计数；progress 已落盘但事件缺失时，当前动作必须在重新执行前补写同一 event key。任何事件 schema、sequence、绑定或 hash 错误都 fail closed，不推进下一阶段。

新合同 run 的 archive receipt 增加事件文件哈希和 timing contract 字段；旧回执结构继续可读。`status` 的公开字段集合、job input、accepted YAML、五个安装文件、legacy fail-closed 和 `archive-abandoned` 字节保持不变。新时间文件缺失只对新合同 run 失败，旧 run 不被强制改写。

## 5. 测试策略

- 新增 `timing-events.test.js`：schema、UTC、sequence、event key 幂等、半行/乱序/绑定错误拒绝和 hash 稳定性。
- 扩展 `progress.test.js` 与 `chapter-work.test.js`：首发窗口、attempt 2、用户新 cycle 的事件顺序和全 cycle 累计。
- 扩展 `chapter-receiver.test.js`：观察、接受、拒绝各只产生一次事件；重复 `run` 不重复计数。
- 扩展 `performance-budget.test.js`：代表性 fixture 具有真实事件、`active_ms`/`human_wait_ms`、跨 cycle attempts 和候选数。
- 扩展 `run-archive.test.js` 与 `v7-e2e.test.js`：阶段事件、事件 hash、归档回执、旧 v7 无时间合同只读兼容和新 run 完整链路。
- 使用确定性可注入时钟测试人工等待，不依赖睡眠或文件系统时间。

## 6. 回滚与发布

改动只新增 run 私有事件文件和回执/metrics 的可选字段；不需要数据迁移。若新事件门禁失败，run 停留在当前状态且不安装/归档；旧 run 仍可只读。回滚代码后，已生成的新 run 不应被伪装为旧合同，需继续通过 timing contract 的只读兼容路径处理。
