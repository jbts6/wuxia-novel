---
name: generate-game-kb-lite-cn
description: Use when a Chinese reference is needed for the source-grounded lightweight V4 game knowledge-base workflow.
---

# Generate Game KB Lite 中文参考

Lite 是 V4 的轻量版：保留逐章原文取证、动态分组、接收、有界重试、
组装、验证、安装、安装后验证和归档；基础流程不自动运行耗时的全书域蒸馏。
当前合同固定为 `semantic_contract_version: 6` 与 `profile: lite`；两者只属于
controller JSON 元数据，不得写入章节草稿或最终数据 YAML。

## 执行合同

- 章节草稿和最终知识文件使用 YAML；controller 状态、报告、manifest 与收据使用 JSON。
- 只执行 `lite-status` 返回的 `next_action` 与 `next_units`。
- 主代理和子代理必须原样使用 controller 给出的 `run_id`、`unit`、`attempt`、
  绝对 `source_file`、`input_hash` 和唯一绝对 `staging_path`。
- 普通作业动态分配相邻 2 至 3 章，合计不超过 36,000 个中日韩字符；
  每章完整读取原文，每章单独写一个 YAML，然后由主代理逐个接收。
- 一个周期只有首次提交和最多一次自动重试；第二次失败进入 `manual_review`。
  用户可明确运行 `retry-unit --confirm` 开启新的有界周期，系统不得自动第三次尝试。

先读 [章节提取合同](prompts/extract-chapters.md)，再按
[真实中文命令示例](examples-cn.md) 执行。英文命令说明见 [examples.md](examples.md)。

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
