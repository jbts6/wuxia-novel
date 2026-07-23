# generate-game-kb v7 示例

以下示例使用 `古龙/剑神一笑`。公开命令只有
`run/status/retry-unit/archive-abandoned`。

## 创建并推进运行

```powershell
node .agents/skills/generate-game-kb/scripts/flow.js run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v7 --json
```

首次调用返回最多十个 job（`max_active_units` 默认 10；旧 run 无该字段时仍为 5）：

```json
{
  "semantic_contract_version": 7,
  "run_id": "run-jian-shen-yi-xiao-v7",
  "status": "jobs",
  "jobs": [
    {
      "unit": "chapter:001",
      "cycle": 1,
      "attempt": 1,
      "producer": "chapter-worker",
      "input_file": "C:\\...\\tasks\\chapter_001\\cycle_01\\attempt_01.json",
      "output_file": "C:\\...\\staging\\chapter_001\\cycle_01\\attempt_01.yaml",
      "input_hash": "sha256"
    }
  ],
  "active_units": ["chapter:001"],
  "progress": { "accepted": 0, "total": 20 },
  "manual_review": null
}
```

为每个返回的 job 派发一个 Worker。Worker 的任务说明只需要：

```text
只读取 <input_file>，严格服从其中内嵌的 worker_contract，
把一个纯 YAML 文档写到 input 声明的 output_file；
不得执行 Shell、Node、Python 或 BAT 命令，也不得创建辅助文件；
level/rank 只使用 controlled_fields 的允许值或 null，职位和身份写入 identities；
写完执行 worker_contract 的递归 preflight，不要读取合同外文件或写其他路径。
```

该派发说明不依赖 `.claude/agents/`、`schemas.md` 或隐式 Skill 上下文；
`input_file` 本身就是跨宿主的完整执行合同。

Worker 完成后再次执行同一条 `run` 命令。Controller 会自动接收已有输出：

- 返回 `jobs`：派发本次返回的 job。
- 返回 `waiting`：当前窗口还有未完成输出；等待后再调用 `run`。
- 返回 `manual_review`：停止，向用户报告失败单元。
- 返回 `complete`：五文件已验证、安装并归档。

不要在 `waiting` 时从目录自行构造下一章 job。

## 恢复中断会话

```powershell
node .agents/skills/generate-game-kb/scripts/flow.js status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v7 --json
```

`status` 是只读命令。它返回活跃 job 的原始
`input_file/output_file/producer/cycle/attempt`，用这些路径恢复派发。
已正常归档的 run 返回 `status: "complete"`。

## 用户确认后重试单章

当 `run` 或 `status` 返回：

```json
{
  "status": "manual_review",
  "manual_review": ["chapter:007"]
}
```

先向用户说明两次失败及错误。只有用户明确同意后执行：

```powershell
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v7 --unit chapter:007 --confirm --json
```

命令为该单元开启新 cycle 并返回新的 job。派发该 job，完成后回到 `run`
循环。没有 `--confirm` 时命令必须失败。

## 归档废弃运行

```powershell
node .agents/skills/generate-game-kb/scripts/flow.js archive-abandoned "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v7 --json
```

该命令把所选 run 原样移动到
`<novel>/_archive/generate-game-kb/<run-id>/`，不解析或改写其内部字节。用于
放弃仍在进行或已经进入人工复核的 run；正常成功路径由 `run` 自动归档。
