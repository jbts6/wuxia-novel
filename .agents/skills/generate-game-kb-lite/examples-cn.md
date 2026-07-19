# Lite 真实命令示例

以下命令使用 `C:\git\wuxia-novel\古龙\剑神一笑`。实际执行时必须原样使用
controller 返回的身份字段，不得猜测路径或 batch。

## 准备

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## Guard 保护的章节提交

先读取当前 controller job：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

为当前 job 打开 guard。`lite-guard-open` 会自动绑定当前 batch，不传猜测的 batch：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-guard-open "C:\git\wuxia-novel\古龙\剑神一笑" --json
```

只派发 status 返回的只读 descriptor。worker message 每章返回一个 envelope，
不写任何文件。例如：

```json
{"schema_version":1,"batch_id":"chapter-batch-001","unit":"chapter:001","attempt":1,"input_hash":"sha256:controller-input-hash","draft":{"schema_version":1,"chapter":1,"title":"章节标题","source_hash":"sha256:controller-input-hash","factions":[],"characters":[],"skills":[],"items":[],"chapter_summary":{"title":"章节标题","summary":"有原文依据的摘要。","source_refs":[{"chapter":1,"text":"原文中的逐字引文。"}]}}}
```

使用 controller 返回的 guard ID 检查写入边界：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-guard-check "C:\git\wuxia-novel\古龙\剑神一笑" --guard-id <guard-id> --json
```

只有 guard 干净后，主代理才把原样 envelope 经标准输入交给 broker。主代理不创建
临时文件，也不增加 `--draft` 路径：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-submit-draft "C:\git\wuxia-novel\古龙\剑神一笑" --batch chapter-batch-001 --unit chapter:001 --attempt 1 --guard-id <guard-id> --json
stdin: <原样 worker envelope>
```

每个 broker batch 完成后刷新状态：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## Controller 报告的恢复

guard check 报告错位文件可恢复时，先向用户展示报告。只有用户明确确认后，才能让
controller 复制；不得手工复制、移动、改写或删除：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-recover-draft "C:\git\wuxia-novel\古龙\剑神一笑" --unit chapter:001 --source <guard-report-absolute-path> --guard-id <guard-id> --confirm --json
```

随后用同一 `--guard-id` 再次运行 `lite-guard-check`。结果干净后才能继续，并重新
运行 `lite-status`。

## 可选基础整理

status 提供明确跳过选项时：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-basic-curate "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --skip --json
```

## 发布

仅当状态返回 `next_action: lite-publish` 时执行：

```text
node .agents/skills/generate-game-kb/scripts/flow.js lite-publish "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --json
```

## 用户手动重试

attempt 2 进入 `manual_review` 后，只有用户能开启新的有界周期：

```text
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-lite --unit chapter:001 --confirm --json
```

完成后重新运行 `lite-status`，只使用新签发的身份和 attempt。
