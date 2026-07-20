---
name: generate-game-kb-lite-cn
description: Use when a Chinese reference is needed for the source-grounded lightweight V4 game knowledge-base workflow.
---

# Generate Game KB Lite 中文参考

Lite 是 V4 的轻量版：保留逐章原文取证、动态分组、接收、有界重试、
组装、验证、安装、安装后验证和归档；基础流程不自动运行耗时的全书域蒸馏。
当前合同固定为 `semantic_contract_version: 6` 与 `profile: lite`；两者只属于
controller JSON 元数据，不得写入提交 envelope 或最终数据 YAML。章节 accepted
YAML 只由 controller 序列化。

## 执行合同

- controller 状态、报告、manifest 与收据使用 JSON；最终知识文件使用 YAML。
- 只执行 `lite-status` 返回的 `next_action` 与 `chapter_jobs`；控制器状态是唯一
  调度和接收依据，不得从文件数量或 worker 文本推断。

### 启动或恢复

在仓库根目录执行命令，并把两个占位符替换为选定的小说目录与 run ID。

- 已有 run：先执行 `lite-status`：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-status "<novel>" --run <run-id> --json
```

- 新 run：先执行一次 `lite-prepare`，然后立即执行上面的 `lite-status` 命令：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-prepare "<novel>" --run <run-id> --json
```

- worker 可见 descriptor 只使用 controller 给出的 `run_id`、`batch_id`、`unit`、
  `attempt`、`input_hash` 与 `source_file`。`source_file` 是绝对只读路径，
  `worker_write_paths = []`；worker 可见 payload 不含 `staging_path`、输出目录、
  输出文件名或任何可写位置。
- controller 将相邻 2 至 3 章组成调度 batch，合计不超过 36,000 个中日韩字符；
  status 再把它展开为单章 assignment。同一 batch 中每个子代理只接收一个章节
  descriptor、完整读取一章并只返回一个 JSON envelope。
- worker 不得创建、修改、移动或删除任何文件或目录；worker 不得调用 controller
  或脚本命令。worker message 只返回 envelope，worker 文本不能标记章节已接收。

先读 [章节提取合同](prompts/extract-chapters.md)，再按
[真实中文命令示例](examples-cn.md) 执行。英文命令说明见 [examples.md](examples.md)。

## Guard 与 broker 生命周期

每个 controller 有界窗口严格按以下顺序执行。选择前 `concurrency_limit`（并发上限）个不同 `batch_id` 的全部 descriptor；正常最多 15 个，退避最多 9 个，构成一个有界窗口。
提取前为每个入选 batch 打开一个 guard，并保留 `batch_id` 到 `guard_id` 的映射。

```text
lite-status
-> worker_pool.halted 时停止，不派发
-> 选择前 concurrency_limit 个不同 batch_id 及其全部 descriptor
-> 每个入选 batch 执行一次 lite-guard-open <novel>
-> Claude Code：game-kb-chapter-extract(run_id, prompt_file, descriptors, concurrency_limit)
-> 其他平台：维持等价的原生滚动池
-> 等待有界窗口内全部 worker message 返回
-> 对全部 guard_id 执行 lite-guard-check <novel>
-> 按映射 guard_id 串行执行 lite-submit-draft <novel> ... via stdin
-> lite-status
```

一个子代理只处理一章并只返回一个 envelope。有排队 descriptor 时，始终维持
`worker_pool.concurrency_limit` 个活跃 worker；任一 worker 返回后，其槽位释放，立即启动下一条排队 descriptor。等待整个有界窗口完成，检查全部 guard；全部 guard 干净之后才可提交，任一 guard 违规或无法检查时，本窗口不得提交。串行按原始 `chapter_jobs` descriptor 顺序提交，并使用每条 descriptor 对应的 guard。

主代理不得创建临时文件、手写 YAML、猜测路径或修改 envelope。只有取得干净的
guard 结果之后，主代理才可把每个原样 JSON envelope 经标准输入交给
`lite-submit-draft`，并使用 descriptor 的 `--unit`、`--batch`、`--attempt` 与
controller 返回的 `--guard-id`。

`null` 或缺失结果属于传输失败。`null` 或缺失结果不消耗 attempt；跳过该结果，
其他完整结果可在全部 guard 干净后继续提交。任一 broker 拒绝、身份过期、重放冲突
或命令失败都必须停止剩余提交并刷新 `lite-status`。只有明确的平台 429 才触发 worker 退避，不得从 `null` 或普通缺失结果推断 429。控制器是唯一接收主体。

身份匹配但非法的 envelope 由 controller 正式拒绝并消耗恰好一次 attempt；过期
身份或越界文件不消耗 attempt，必须停止并刷新状态。attempt 1 失败后只能派发
controller 签发的 attempt 2；第三次尝试禁止自动派发，第二次失败进入
`manual_review`。只有用户明确运行 `retry-unit --confirm` 才能开启新周期。

每个 guard 只清点 Git 仓库根目录内的内容并报告边界内的精确绝对路径；仓库之外不在监控范围。

## 恢复与阻断

`lite-guard-check` 报告错位但有效的 draft 可恢复时，先向用户展示 controller
报告。用户明确确认后才可执行 `lite-recover-draft ... --guard-id <id> --confirm`；
主代理不得手工复制、移动、改写或删除。恢复保留 source 字节且不消耗失败 attempt。
恢复后的 source 仍是证据：必须停止，等用户删除新增文件或还原被改路径，再刷新
`lite-status` 并打开新的 guard。状态仍为 `worker-write-review` 时不得提交、调度、
组装、发布、安装或验证。

包含旧 JSON-as-YAML accepted 文件的 run 只读，禁止继续派发或接收章节；必须创建
新的 V6 Lite run。

## 章节完成后的流程

章节全部经 broker 接收后继续执行 `lite-status`。只有状态明确要求时才运行
`lite-basic-curate` 或 `lite-publish`，不得绕过 controller gate。

## 最终产物

成功发布后，Dashboard 读取 `<novel>/data/` 中且仅有以下五个 YAML：

- `characters.yaml`
- `skills.yaml`
- `items.yaml`
- `factions.yaml`
- `chapter_summaries.yaml`

完成必须同时通过 source grounding、schema、候选闭包、引用闭包、安装后验证与归档
哈希绑定，并使 `assembly-report.json`、`verification-report.json`、
`generate_game_kb_install.json`、`artifact-manifest.json`、
`archive-receipt.json` 的 `source_hash` 与 `final_data_hash` 一致。

基础发布不阻塞，也不自动加载 deep Skill。只有用户主动要求某一域时，才加载对应
`generate-game-kb-deep-*`。每次 overlay 都从当前五文件数据合并，先备份旧
`data/`，验证临时副本后再原子晋升给 Dashboard；多次 overlay 累计生效。

真实测试路径统一使用 `C:\git\wuxia-novel\古龙\剑神一笑`，所有可运行命令及
`retry-unit` 章节示例均在 [examples-cn.md](examples-cn.md)。
