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
- worker 可见 descriptor 只使用 controller 给出的 `run_id`、`batch_id`、`unit`、
  `attempt`、`input_hash` 与 `source_file`。`source_file` 是绝对只读路径，
  `worker_write_paths = []`；worker 可见 payload 不含 `staging_path`、输出目录、
  输出文件名或任何可写位置。
- 普通作业动态分配相邻 2 至 3 章，合计不超过 36,000 个中日韩字符；
  每章完整读取原文，每个 descriptor 返回一个 JSON envelope。
- worker 不得创建、修改、移动或删除任何文件或目录；worker 不得调用 controller
  或脚本命令。worker message 只返回 envelope，worker 文本不能标记章节已接收。

先读 [章节提取合同](prompts/extract-chapters.md)，再按
[真实中文命令示例](examples-cn.md) 执行。英文命令说明见 [examples.md](examples.md)。

## Guard 与 broker 生命周期

每个 controller job 严格按以下顺序执行：

```text
lite-status
-> lite-guard-open <novel>
-> worker message
-> lite-guard-check <novel> --guard-id <controller guard_id>
-> lite-submit-draft <novel> ... --guard-id <controller guard_id> via stdin
-> lite-status
```

主代理不得创建临时文件、手写 YAML、猜测路径或修改 envelope。只有取得干净的
guard 结果之后，主代理才可把每个原样 JSON envelope 经标准输入交给
`lite-submit-draft`，并使用 descriptor 的 `--unit`、`--batch`、`--attempt` 与
controller 返回的 `--guard-id`。

身份匹配但非法的 envelope 由 controller 正式拒绝并消耗恰好一次 attempt；过期
身份或越界文件不消耗 attempt，必须停止并刷新状态。attempt 1 失败后只能派发
controller 签发的 attempt 2；第三次尝试禁止自动派发，第二次失败进入
`manual_review`。只有用户明确运行 `retry-unit --confirm` 才能开启新周期。

guard 只清点 Git 仓库根目录内的内容并报告边界内的精确绝对路径；仓库之外不在监控范围。

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
