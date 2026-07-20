---
name: generate-game-kb-cn
description: Use when a Chinese reference for the complete v4 source-grounded wuxia game knowledge-base workflow is needed.
---

# generate-game-kb v4 中文参考

这是完整 V4 流程。原文是唯一事实来源；accepted、证据和最终知识数据由 controller 序列化为 YAML，状态、Worker envelope、清单、报告和收据使用 JSON。子代理只读输入并返回 JSON，禁止写文件。

新 V4 run 使用 `semantic_contract_version: 6`、`semantic_profile: domain-distill-v1` 和 `profile: v4`。版本 5 及更早的旧 run 只能查询、迁移或显式归档，不能原地升级。

## 最终产物

成功安装后，`<novel>/data/` 必须恰好包含：

```text
characters.yaml
skills.yaml
items.yaml
factions.yaml
chapter_summaries.yaml
```

Dashboard 直接读取这五个 YAML。完成前还必须看到 `assembly-report.json`、`verification-report.json`、`generate_game_kb_install.json`、`artifact-manifest.json` 和 `archive-receipt.json`，并确认 source hash、final data hash、id plan hash、verification report hash、引用闭包和安装验证一致；归档收据还记录可选 migration receipt hash。

## 章节作业

- controller 将 2 至 3 个相邻章节组成调度 batch，总长度不超过 36,000 个中日韩字符；超长单章或尾章可以独立成 batch。
- status 把 batch 展开为单章 assignment：每个子代理只处理一章、只返回一个 JSON envelope。
- Worker 只读取绝对 `source_file`，`worker_write_paths = []`；不得创建、修改、移动或删除任何文件或目录。
- Worker 看不到 `staging_path` 或输出位置。每个窗口选择前 `concurrency_limit`（并发上限）个不同 `batch_id` 的全部 descriptor；正常最多 15 章，降级最多 9 章。
- 提取前为全部入选 batch 打开 guard 并保存映射。Claude Code 使用 `game-kb-chapter-extract`；其他平台使用等价的原生滚动子代理池。任一 Worker 返回后槽位释放，立即派发下一章。
- 等待窗口全部 Worker 返回；全部 guard 检查完成以前不得提交任何 envelope。主代理按原始 `chapter_jobs` 顺序串行提交，通过 stdin 把 envelope 原样交给 controller，由 controller 序列化并写入 YAML。
- 并发上限正常为 5、降级为 3；只有明确 429 才执行 `worker-backoff`。空或缺失结果是传输失败，不消耗 attempt，也不得推断为 429。`worker_pool.halted` 时不派发。

```text
章节提取：game-kb-chapter-extract 滚动池，每个 agent 只处理一章
领域蒸馏：四个只读领域 Worker 可以并发生成
所有 controller submit-draft：仅主会话串行执行
```

## 阶段顺序

```text
archive-existing -> prepare -> 单章 Worker -> guard -> submit-draft -> basic-curate(可选)
-> plan-domains -> distill:factions -> distill:characters
-> distill:skills -> distill:items -> guarded submit-draft -> assemble -> verify -> install
-> verify --installed -> archive-run
```

## 全书 Rank

章节只记录局部证据，人物和武功的 `rank` 可以是 null 或省略。V4 的人物域和武功域会收到 controller 签发的全书 `source_files` 与 `rank_contract`，必须按章节顺序完整读取后，为每个 keep 决策填写最终八级 rank。

最终 rank 不取单章最高描写。后期直接战果、真实失败、被克制和反转优先于早期吹捧；当场行动优先于旁观评价；传闻、自述和身份不能单独支持高 rank。人物表示全书结束时的稳定综合战力，武功表示可靠使用者实际展示且未被后文推翻的稳定上限。证据不足时 rank 保持 null，不自动阻断发布；不可调和的 rank 冲突才进入 manual_review。

旧的零尝试 pending 人物/武功工作项缺少全书输入时，只能由 controller 显式刷新：

```text
node .agents/skills/generate-game-kb/scripts/flow.js refresh-domain-work "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit distill:characters --confirm --json
```

领域子代理只读取 controller 生成的 `worker-input.json`，`worker_write_paths = []`，每个子代理只返回一个 JSON envelope。不得手改 input、hash、plan 或 `progress.json`，也不得刷新已 accepted 的域。

每阶段后执行 `status --json`，只执行返回的 `next_action` 和 `next_units`。真实测试书使用 `古龙/剑神一笑`：

```text
node .agents/skills/generate-game-kb/scripts/flow.js prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js guard-open "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --json
node .agents/skills/generate-game-kb/scripts/flow.js guard-check "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js submit-draft "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --batch chapter-batch-001-003 --unit chapter:001 --attempt 1 --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --confirm --json
```

`unit` 是通用工作单元，例如 `chapter:001` 或 `distill:characters`。每周期首次提交后最多自动重试一次；第二次失败进入 `manual_review`，不会自动开始第三次。用户确认后才能用上面的 `retry-unit` 开启新的有界周期。

## 旧知识库审计与迁移

旧 JSON 只能通过确定性 controller 迁移，不能重新提取小说或由模型补写缺失证据。中文路径直接使用，无需改名：

```text
node .agents/skills/generate-game-kb/scripts/audit-v6.js "C:\git\wuxia-novel" --output ".trellis\tasks\07-19-audit-v6-knowledge-bases\reports"
node .agents/skills/generate-game-kb/scripts/flow.js migrate-legacy "C:\git\wuxia-novel\<作者>\<书名>" --run migration-<book>-v6 --from "C:\git\wuxia-novel\<作者>\<书名>\data" --json
node .agents/skills/generate-game-kb/scripts/flow.js migrate-legacy "C:\git\wuxia-novel\<作者>\<书名>" --run migration-<book>-v6 --from "C:\git\wuxia-novel\<作者>\<书名>\data" --staging-root "C:\git\wuxia-novel\.game-kb-migration-staging\<作者>\<书名>" --confirm --json
```

第一条 `migrate-legacy` 是完全只读的 dry-run。真正执行必须有 `--run`、`--staging-root`、`--confirm`；`--unit` 不适用于仓库迁移。失败后旧数据只在 `_archive/<run>-legacy/`，禁止恢复到活动 `data`，应原样执行 `migration-report.json` 的 `retry_command`。

## 安全边界

拒绝的 envelope、草稿和错误记录必须保留。`staging/` 是 controller 私有目录；不要手动复制、改名、删除 staging/accepted/final 文件，也不要凭文件存在判断完成。只有 controller 的验证、安装和归档收据可以证明完成。
