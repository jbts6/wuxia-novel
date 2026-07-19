# Lite Worker 可靠性加固设计

## 1. 目标与依赖

本任务把 `generate-game-kb-lite` 变成零文件写入的 extraction worker 编排层。worker 只读取 controller 指定的原文并返回结构化 JSON；主代理把返回值经 stdin 交给 controller broker。路径选择、YAML 序列化、验证、attempt 和状态都属于 `07-19-harden-game-kb-controller-invariants`。

本任务在控制器子任务完成并通过测试后开始实现，直接消费稳定的 broker/guard/status contract。父任务继续暂停。

## 2. Worker 派发合同

主代理从一次 `lite-status --json` 取得 job，并把以下只读身份字段原样传给 worker：

```yaml
run_id: "<controller value>"
batch_id: "<controller value>"
novel_root: "C:\\git\\wuxia-novel\\古龙\\某书"
worker_write_paths: []
chapters:
  - unit: "chapter:001"
    attempt: 1
    source_file: "<absolute controller value>"
    input_hash: "sha256:<controller value>"
```

worker 不得：

- 创建、修改、移动或删除任何文件或目录；
- 调用 controller、accept、submit、shell 重定向或任何文件写入工具；
- 自造 `staging_path`、输出目录、输出文件名或 attempt；
- 把多章合并成一个 draft，或跨章节复制证据；
- 声称章节已经接受。

`.game-kb-migration-staging` 与其他 migration-controller 目录同样禁止：它不属于 worker payload、临时空间或 broker submission。

worker 每章返回一个 JSON envelope，不返回路径，不生成 YAML 文件：

```json
{
  "schema_version": 1,
  "batch_id": "<controller value>",
  "unit": "chapter:001",
  "attempt": 1,
  "input_hash": "sha256:<controller value>",
  "draft": { "schema_version": 6, "chapter": 1 }
}
```

`draft` 是待验证的数据对象，不是已经接受的 artifact。实际 `.yaml` 字节只能由 controller canonical writer 生成。

## 3. 主代理生命周期

```text
lite-status
  -> 若 legacy serialization，停止并要求新 run
  -> lite-guard-open（worker write set = empty）
  -> 派发 worker
  -> lite-guard-check
       -> 越界：停止；从 controller changed-path report 取得实际绝对路径，可只读判断是否 recoverable
       -> clean：逐章把 worker envelope 原样经 stdin 交给 lite-submit-draft
  -> broker valid：controller canonicalize + accept
  -> broker invalid：controller 正式记录 rejection
  -> 每批后重新 lite-status
```

主代理不得手写 YAML、创建临时文件、拼接路径、修补 worker envelope 或绕过 broker；也不得从 filesystem、drafts 数量、worker 自检或先前 status 推断进度。

主代理也不负责猜错位文件名或遍历可疑目录。`lite-guard-check` 的 controller report 是定位来源：它基于派发前后的 repository-root 全树差异返回实际 changed paths。worker 即使漏报或误报路径，也不影响仓库内定位。正常协议没有任何 worker 文件写入，因此不存在合法的“写到仓库外”分支；但这不是 OS 沙箱，Skill 不得声称能侦测主动违规后的任意仓库外写入。

## 4. 违规文件与恢复

正常流程没有 worker 输出路径。任何 worker-created file 都是零写入合同违规，发生在 broker 提交预算之前，无论内容是否合规都不消费 attempt。主代理不能手动 move/copy。

当 controller 返回 `recoverable: true` 时，主代理向用户展示 source、issued destination、unit、attempt 和校验摘要。只有用户明确确认后才运行 `lite-recover-draft --confirm`。恢复后重新 `lite-guard-check`；原越界现场未恢复到基线前，不继续下一 job 或 publish。

若内容无法唯一映射、来自另一小说、是 symlink/junction、校验失败或 destination 已存在，则只进入人工审查。

## 5. 内容错误与 attempt

broker submission 不是免费 preflight：

- identity 匹配的第一个 envelope 立即成为正式 attempt 1 submission；
- malformed JSON、非法/缺失字段、grounding 或 hash 错误都记录 rejection；
- controller 签发 attempt 2 后才可重新派发；
- attempt 2 失败进入 `manual_review`；
- worker 与主代理都不能创建 attempt 3；
- 用户显式 `retry-unit --confirm` 开启的是新的有界周期。

batch/unit/attempt/input-hash 不匹配属于 stale identity，不消费 attempt；主代理必须重新读取 status，不能修改 envelope 后在同一 attempt 下重交。相同 payload 的 crash replay 由 controller 幂等处理，不视为新提交。

## 6. Prompt 内容合同

`prompts/extract-chapters.md` 改为规范 JSON envelope 示例，并强调：

- 顶层仅 `schema_version/chapter/title/source_hash/factions/characters/skills/items/chapter_summary`；
- 每个 retained entity 必须有 `local_key/name/source_refs`；
- quote 必须逐字存在于当前 source file，name 必须能定位；
- `source_hash` 完全等于 descriptor `input_hash`；
- 证据不足使用 null/空数组；
- 禁止 `book/author/summary/role/formal id` 等字段；
- 只显式命名招式进入 techniques；
- 最终回复只含每章一个完整 envelope；`draft` 必须是 JSON object，不能用 Markdown fence、路径或“已写入”说明替代。

详细字段规范继续链接 generate-game-kb schema，避免在 `SKILL.md` 重复大段定义；零写入、身份字段和 broker 生命周期保留在 `SKILL.md`。YAML 格式不再由 worker 负责，controller serializer 对 artifact 字节负责。

## 7. 可信报告

worker 的自然语言自检只作为非权威说明。主代理给用户的状态必须来自：

- `lite-status` 的 controller 状态；
- `lite-guard-check` 的 changed paths；
- `lite-submit-draft` 的 receipt、机器错误与 accepted/rejected 状态；
- recovery receipt。

不得把 `.yaml` 后缀等同于 YAML 序列化，也不得把 drafts archive 数量等同于完成章节数。

## 8. 测试与上线

- Skill contract 测试检查只读绝对 source path、零 worker write paths、禁止 controller/file tool 调用、guard/broker 顺序、恢复确认、两次 attempt 上限和 controller-only status。
- CLI contract fixture 覆盖 malformed JSON envelope、identity mismatch、非法/缺失字段、wrong hash、fabricated quote、canonical YAML serialization、replay 和 path-only valid recovery。
- scripted rogue worker fixture 覆盖本次所有 `game-kb`/`out`/attempt 3 路径。
- 不读取或修改《凤舞九天》。在 inline 模式下不派发 implement/check 子代理；如以后做 disposable forward-test，必须另行取得用户同意并先启用 guard。

## 9. 文件所有权

本任务拥有 `.agents/skills/generate-game-kb-lite/` 下的 Skill、中文 Skill、prompt、examples，以及 `lite-skill-contract.test.js`、`lite-residue-contract.test.js`、新建的 worker lifecycle/safety tests。它只运行、不修改 controller 子任务拥有的 `lite-cli-contract.test.js`，不修改 `.claude/skills/*`，也不重新实现 controller 校验逻辑。
