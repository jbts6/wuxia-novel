# Generate Game KB 换机交接

这是 `07-15-game-kb-deterministic-assembly` 的中间检查点，任务状态仍为 `in_progress`，不能把它当作双书验收完成证据。

## 恢复

在新电脑签出包含本目录的提交后，从仓库根目录执行：

```bash
rtk tar -xzf .trellis/tasks/07-15-game-kb-deterministic-assembly/evidence/handoff/generate-game-kb-portable-state-2026-07-15.tar.gz
```

随后验证压缩包哈希：

```text
sha256:78029cc5b6250aabfe75531f72641f5d1c2b538a4ffe678276b5abec9ffe7617
```

恢复后调用 `trellis-continue` 和 `generate-game-kb`。按 Skill 的压缩恢复合同，先完整重读 `SKILL.md`、`schemas.md` 与当前阶段 `prompts/merge-category.md`，再对两个 v2 run 各执行一次 `prepare` 和一次 `status --json`。不得再次运行 `archive-existing`。

本检查点包含 `prepare` 恢复回归：不带 `--run` 时，零活动 run 才会归档并创建新 run；唯一 v2 run 会原地恢复；多个 run 会停止。快照曾解到仓库内另一条根路径做双书冒烟，两书均返回原 run-id、`resumed: true`，且归档目录未变化。`run.json`/`manifest.json` 中旧电脑的绝对源路径只是来源记录，执行使用新电脑传入的书籍目录重新定位 run。

## 精确续跑点

- 《笑傲江湖》：40/40 章节已接受，`check-coverage` 无 blocking gap；`merge:events:001` 至 `004`、`merge:items:001` 已接受，其他 24 个初始 merge shard 尚待处理，staging 为空。下一步从尚未完成的非对白 merge shard 继续；events 全部完成后可处理 dialogues。全部 shard 完成后再次 `prepare-merge` 生成 consolidation 单元。
- 《飞狐外传》：20/20 章节及 17 个 merge 单元已完成；`merge:dialogues:001`、`merge:dialogues:002` 各 3 次失败并处于 `manual_review`。没有用户对这两个精确单元的 reset 授权时，禁止执行 `reset-unit`。
- 两书 `semantic_contract_version` 都是 2，worker pool 上限都是 10，均无 429 incident。
- 两个 run 的 staging 目录在打包时均为空，所有已返回 worker 草稿都已串行 `accept`。

## 文件边界

- 快照包含两个被 Git 忽略的 active run 和本轮四个 `archive-existing` 归档目录；展开后路径与原工作区一致。
- 本轮没有后续所需的仓库外草稿或状态文件，`external_required_files` 为空。旧 `/tmp/chapter_*_draft.json`、Claude task 输出和早期整书草稿均未被 active run 引用，且已由 accepted/run 状态取代，因此不收入换机快照。
- 仓库根目录的 `new-api_pg_data_backup.tar` 与本任务无关，未收入快照、未加入提交。
- `.agents/skills/generate-kb/` 不得修改。
